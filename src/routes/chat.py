import logging, asyncio, time, json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import httpx

from src.db.api_keys import increment_api_key_usage
from src.db.plans import enforce_plan_limits
from src.db.rate_limits import create_rate_limit_alert, update_rate_limit_usage
from src.db.users import get_user, deduct_credits, record_usage
from src.db.chat_history import create_chat_session, save_chat_message, get_chat_session
from src.schemas import ProxyRequest
from src.security.deps import get_api_key
from src.services.openrouter_client import make_openrouter_request_openai, process_openrouter_response, make_openrouter_request_openai_stream
from src.services.portkey_client import make_portkey_request_openai, process_portkey_response, make_portkey_request_openai_stream
from src.services.rate_limiting import get_rate_limit_manager
from src.services.trial_validation import validate_trial_access, track_trial_usage
from src.services.pricing import calculate_cost

logger = logging.getLogger(__name__)
router = APIRouter()

def mask_key(k: str) -> str:
    return f"...{k[-4:]}" if k and len(k) >= 4 else "****"

async def _to_thread(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)

async def stream_generator(stream, user, api_key, model, trial, environment_tag, session_id, messages):
    """Generate SSE stream from OpenAI stream response"""
    accumulated_content = ""
    prompt_tokens = 0
    completion_tokens = 0
    total_tokens = 0
    start_time = time.monotonic()

    try:
        for chunk in stream:
            # Extract chunk data
            chunk_dict = {
                "id": chunk.id,
                "object": chunk.object,
                "created": chunk.created,
                "model": chunk.model,
                "choices": []
            }

            for choice in chunk.choices:
                choice_dict = {
                    "index": choice.index,
                    "delta": {},
                    "finish_reason": choice.finish_reason
                }

                if hasattr(choice.delta, 'role') and choice.delta.role:
                    choice_dict["delta"]["role"] = choice.delta.role
                if hasattr(choice.delta, 'content') and choice.delta.content:
                    choice_dict["delta"]["content"] = choice.delta.content
                    accumulated_content += choice.delta.content

                chunk_dict["choices"].append(choice_dict)

            # Check for usage in chunk (some providers send it in final chunk)
            if hasattr(chunk, 'usage') and chunk.usage:
                prompt_tokens = chunk.usage.prompt_tokens
                completion_tokens = chunk.usage.completion_tokens
                total_tokens = chunk.usage.total_tokens

            # Send SSE event
            yield f"data: {json.dumps(chunk_dict)}\n\n"

        # If no usage was provided, estimate based on content
        if total_tokens == 0:
            # Rough estimate: 1 token ≈ 4 characters
            completion_tokens = max(1, len(accumulated_content) // 4)
            prompt_tokens = max(1, sum(len(m.get("content", "")) for m in messages) // 4)
            total_tokens = prompt_tokens + completion_tokens

        elapsed = max(0.001, time.monotonic() - start_time)

        # Post-stream processing: plan limits, usage tracking, credits
        post_plan = await _to_thread(enforce_plan_limits, user["id"], total_tokens, environment_tag)
        if not post_plan.get("allowed", False):
            error_chunk = {
                "error": {
                    "message": f"Plan limit exceeded: {post_plan.get('reason', 'unknown')}",
                    "type": "plan_limit_exceeded"
                }
            }
            yield f"data: {json.dumps(error_chunk)}\n\n"
            yield "data: [DONE]\n\n"
            return

        if trial.get("is_trial") and not trial.get("is_expired"):
            try:
                await _to_thread(track_trial_usage, api_key, total_tokens, 1)
            except Exception as e:
                logger.warning("Failed to track trial usage: %s", e)

        if not trial.get("is_trial", False):
            cost = calculate_cost(model, prompt_tokens, completion_tokens)

            try:
                await _to_thread(deduct_credits, api_key, cost, f"API usage - {model}", {
                    "model": model,
                    "total_tokens": total_tokens,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "cost_usd": cost,
                })
                await _to_thread(record_usage, user["id"], api_key, model, total_tokens, cost, int(elapsed * 1000))
                await _to_thread(update_rate_limit_usage, api_key, total_tokens)
            except ValueError as e:
                error_chunk = {
                    "error": {
                        "message": str(e),
                        "type": "insufficient_credits"
                    }
                }
                yield f"data: {json.dumps(error_chunk)}\n\n"
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                logger.error("Usage recording error: %s", e)

        await _to_thread(increment_api_key_usage, api_key)

        # Save chat history
        if session_id:
            try:
                session = await _to_thread(get_chat_session, session_id, user["id"])
                if session:
                    last_user = None
                    for m in reversed(messages):
                        if m.get("role") == "user":
                            last_user = m
                            break
                    if last_user:
                        await _to_thread(save_chat_message, session_id, "user", last_user.get("content",""), model, 0)

                    if accumulated_content:
                        await _to_thread(save_chat_message, session_id, "assistant", accumulated_content, model, total_tokens)
            except Exception as e:
                logger.warning("Failed to save chat history: %s", e)

        # Send final done message
        yield "data: [DONE]\n\n"

    except Exception as e:
        logger.error(f"Streaming error: {e}")
        error_chunk = {
            "error": {
                "message": "Streaming error occurred",
                "type": "stream_error"
            }
        }
        yield f"data: {json.dumps(error_chunk)}\n\n"
        yield "data: [DONE]\n\n"

@router.post("/v1/chat/completions", tags=["chat"])
async def chat_completions(
    req: ProxyRequest,
    api_key: str = Depends(get_api_key),
    session_id: Optional[int] = Query(None, description="Chat session ID to save messages to")
):
    # === 0) Setup / sanity ===
    # Never print keys; log masked
    logger.info("chat_completions start (api_key=%s, model=%s)", mask_key(api_key), req.model)

    try:
        # === 1) User + plan/trial prechecks (DB calls on thread) ===
        user = await _to_thread(get_user, api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        environment_tag = user.get("environment_tag", "live")

        pre_plan = await _to_thread(enforce_plan_limits, user["id"], 0, environment_tag)
        if not pre_plan.get("allowed", False):
            raise HTTPException(status_code=429, detail=f"Plan limit exceeded: {pre_plan.get('reason', 'unknown')}")

        trial = await _to_thread(validate_trial_access, api_key)
        if not trial.get("is_valid", False):
            if trial.get("is_trial") and trial.get("is_expired"):
                raise HTTPException(
                    status_code=403,
                    detail=trial["error"],
                    headers={"X-Trial-Expired": "true", "X-Trial-End-Date": trial.get("trial_end_date", "")},
                )
            elif trial.get("is_trial"):
                headers = {}
                for k in ("remaining_tokens", "remaining_requests", "remaining_credits"):
                    if k in trial:
                        headers[f"X-Trial-{k.replace('_','-').title()}"] = str(trial[k])
                raise HTTPException(status_code=429, detail=trial["error"], headers=headers)
            else:
                raise HTTPException(status_code=403, detail=trial.get("error", "Access denied"))

        rate_limit_mgr = get_rate_limit_manager()
        if not trial.get("is_trial", False):
            rl_pre = await rate_limit_mgr.check_rate_limit(api_key, tokens_used=0)
            if not rl_pre.allowed:
                await _to_thread(create_rate_limit_alert, api_key, "rate_limit_exceeded", {
                    "reason": rl_pre.reason,
                    "retry_after": rl_pre.retry_after,
                    "remaining_requests": rl_pre.remaining_requests,
                    "remaining_tokens": rl_pre.remaining_tokens
                })
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: {rl_pre.reason}",
                    headers={"Retry-After": str(rl_pre.retry_after)} if rl_pre.retry_after else None
                )

        if not trial.get("is_trial", False) and user.get("credits", 0.0) <= 0:
            raise HTTPException(status_code=402, detail="Insufficient credits")

        # === 2) Build upstream request ===
        messages = [m.model_dump() for m in req.messages]
        model = req.model
        optional = {}
        for name in ("max_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"):
            val = getattr(req, name, None)
            if val is not None:
                optional[name] = val

        provider = (req.provider or "openrouter").lower()

        # === 3) Call upstream (streaming or non-streaming) ===
        if req.stream:
            # Handle streaming response
            try:
                if provider == "portkey":
                    portkey_provider = req.portkey_provider or "openai"
                    portkey_virtual_key = getattr(req, "portkey_virtual_key", None)
                    stream = await _to_thread(
                        make_portkey_request_openai_stream, messages, model, portkey_provider, portkey_virtual_key, **optional
                    )
                else:
                    stream = await _to_thread(make_openrouter_request_openai_stream, messages, model, **optional)

                return StreamingResponse(
                    stream_generator(stream, user, api_key, model, trial, environment_tag, session_id, messages),
                    media_type="text/event-stream"
                )
            except httpx.TimeoutException as e:
                logger.warning("Upstream timeout (%s): %s", provider, e)
                raise HTTPException(status_code=504, detail="Upstream timeout")
            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                retry_after = e.response.headers.get("retry-after")
                if status == 429:
                    raise HTTPException(
                        status_code=429,
                        detail="Upstream rate limit exceeded",
                        headers={"Retry-After": retry_after} if retry_after else None
                    )
                elif status in (401, 403):
                    raise HTTPException(status_code=500, detail="OpenRouter authentication error")
                elif 400 <= status < 500:
                    raise HTTPException(status_code=400, detail="Upstream rejected the request")
                else:
                    raise HTTPException(status_code=502, detail="Upstream service error")
            except httpx.RequestError as e:
                logger.warning("Upstream network error (%s): %s", provider, e)
                raise HTTPException(status_code=503, detail="OpenRouter service unavailable")
            except asyncio.TimeoutError:
                raise HTTPException(status_code=504, detail="Upstream timeout")
            except Exception as e:
                logger.error("Unexpected upstream error: %s", e)
                raise HTTPException(status_code=502, detail="Upstream error")

        # Non-streaming response
        start = time.monotonic()
        try:
            if provider == "portkey":
                portkey_provider = req.portkey_provider or "openai"
                portkey_virtual_key = getattr(req, "portkey_virtual_key", None)
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_portkey_request_openai, messages, model, portkey_provider, portkey_virtual_key, **optional),
                    timeout=30
                )
                processed = await _to_thread(process_portkey_response, resp_raw)
            else:
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_openrouter_request_openai, messages, model, **optional),
                    timeout=30
                )
                processed = await _to_thread(process_openrouter_response, resp_raw)
        except httpx.TimeoutException as e:
            logger.warning("Upstream timeout (%s): %s", provider, e)
            raise HTTPException(status_code=504, detail="Upstream timeout")
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            retry_after = e.response.headers.get("retry-after")
            # Map upstream statuses to client-facing statuses
            if status == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Upstream rate limit exceeded",
                    headers={"Retry-After": retry_after} if retry_after else None
                )
            elif status in (401, 403):
                # Tests expect 500 for upstream auth failures
                raise HTTPException(status_code=500, detail="OpenRouter authentication error")
            elif 400 <= status < 500:
                raise HTTPException(status_code=400, detail="Upstream rejected the request")
            else:
                raise HTTPException(status_code=502, detail="Upstream service error")
        except httpx.RequestError as e:
            logger.warning("Upstream network error (%s): %s", provider, e)
            # Tests expect 503 for generic network/request errors
            raise HTTPException(status_code=503, detail="OpenRouter service unavailable")
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Upstream timeout")
        except Exception as e:
            logger.error("Unexpected upstream error: %s", e)
            raise HTTPException(status_code=502, detail="Upstream error")

        elapsed = max(0.001, time.monotonic() - start)

        # === 4) Usage, pricing, final checks ===
        usage = processed.get("usage", {}) or {}
        total_tokens = usage.get("total_tokens", 0)
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)

        post_plan = await _to_thread(enforce_plan_limits, user["id"], total_tokens, environment_tag)
        if not post_plan.get("allowed", False):
            raise HTTPException(status_code=429, detail=f"Plan limit exceeded: {post_plan.get('reason', 'unknown')}")

        if trial.get("is_trial") and not trial.get("is_expired"):
            try:
                await _to_thread(track_trial_usage, api_key, total_tokens, 1)
            except Exception as e:
                logger.warning("Failed to track trial usage: %s", e)

        if not trial.get("is_trial", False):
            rl_final = await rate_limit_mgr.check_rate_limit(api_key, tokens_used=total_tokens)
            if not rl_final.allowed:
                await _to_thread(create_rate_limit_alert, api_key, "rate_limit_exceeded", {
                    "reason": rl_final.reason,
                    "retry_after": rl_final.retry_after,
                    "remaining_requests": rl_final.remaining_requests,
                    "remaining_tokens": rl_final.remaining_tokens,
                    "tokens_requested": total_tokens
                })
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: {rl_final.reason}",
                    headers={"Retry-After": str(rl_final.retry_after)} if rl_final.retry_after else None
                )

        cost = calculate_cost(model, prompt_tokens, completion_tokens)

        if not trial.get("is_trial", False):
            # Ideally: wrap deduct+record+balance fetch in a DB transaction
            try:
                await _to_thread(deduct_credits, api_key, cost, f"API usage - {model}", {
                    "model": model,
                    "total_tokens": total_tokens,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "cost_usd": cost,
                })
                await _to_thread(record_usage, user["id"], api_key, model, total_tokens, cost, int(elapsed * 1000))
            except ValueError as e:
                # e.g., insufficient funds detected atomically in DB
                raise HTTPException(status_code=402, detail=str(e))
            except Exception as e:
                logger.error("Usage recording error: %s", e)

            await _to_thread(update_rate_limit_usage, api_key, total_tokens)

        await _to_thread(increment_api_key_usage, api_key)

        # === 5) History (use the last user message in this request only) ===
        if session_id:
            try:
                session = await _to_thread(get_chat_session, session_id, user["id"])
                if session:
                    # save last user turn in this call
                    last_user = None
                    for m in reversed(messages):
                        if m.get("role") == "user":
                            last_user = m
                            break
                    if last_user:
                        await _to_thread(save_chat_message, session_id, "user", last_user.get("content",""), model, 0)

                    assistant_content = processed.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if assistant_content:
                        await _to_thread(save_chat_message, session_id, "assistant", assistant_content, model, total_tokens)
                else:
                    logger.warning("Session %s not found for user %s", session_id, user["id"])
            except Exception as e:
                logger.warning("Failed to save chat history: %s", e)

        # === 6) Attach gateway usage (non-sensitive) ===
        processed.setdefault("gateway_usage", {})
        processed["gateway_usage"].update({
            "tokens_charged": total_tokens,
            "request_ms": int(elapsed * 1000),
        })
        if not trial.get("is_trial", False):
            # If you can cheaply re-fetch balance, do it here; otherwise omit
            processed["gateway_usage"]["cost_usd"] = round(cost, 6)

        return processed

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unhandled server error")
        # Don’t leak internal details
        raise HTTPException(status_code=500, detail="Internal server error")
