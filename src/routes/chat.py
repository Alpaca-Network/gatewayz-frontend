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
from src.db.activity import log_activity, get_provider_from_model
from src.schemas import ProxyRequest, ResponseRequest, InputMessage
from src.security.deps import get_api_key
from src.services.openrouter_client import make_openrouter_request_openai, process_openrouter_response, make_openrouter_request_openai_stream
from src.services.portkey_client import make_portkey_request_openai, process_portkey_response, make_portkey_request_openai_stream
from src.services.featherless_client import make_featherless_request_openai, process_featherless_response, make_featherless_request_openai_stream
from src.services.rate_limiting import get_rate_limit_manager
from src.services.trial_validation import validate_trial_access, track_trial_usage
from src.services.pricing import calculate_cost

logger = logging.getLogger(__name__)
router = APIRouter()

def mask_key(k: str) -> str:
    return f"...{k[-4:]}" if k and len(k) >= 4 else "****"

async def _to_thread(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)

async def stream_generator(stream, user, api_key, model, trial, environment_tag, session_id, messages, rate_limit_mgr=None, provider="openrouter"):
    """Generate SSE stream from OpenAI stream response"""
    accumulated_content = ""
    prompt_tokens = 0
    completion_tokens = 0
    total_tokens = 0
    start_time = time.monotonic()
    release_required = rate_limit_mgr is not None and not trial.get("is_trial", False)

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

        # Log activity for streaming
        try:
            provider_name = get_provider_from_model(model)
            speed = total_tokens / elapsed if elapsed > 0 else 0
            cost = calculate_cost(model, prompt_tokens, completion_tokens) if not trial.get("is_trial", False) else 0.0
            await _to_thread(
                log_activity,
                user_id=user["id"],
                model=model,
                provider=provider_name,
                tokens=total_tokens,
                cost=cost,
                speed=speed,
                finish_reason="stop",
                app="API",
                metadata={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "endpoint": "/v1/chat/completions",
                    "stream": True,
                    "session_id": session_id,
                    "gateway": provider  # Track which gateway was used
                }
            )
        except Exception as e:
            logger.warning(f"Failed to log activity: {e}")

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
                        # Extract text content from multimodal content if needed
                        user_content = last_user.get("content", "")
                        if isinstance(user_content, list):
                            # Extract text from multimodal content
                            text_parts = []
                            for item in user_content:
                                if isinstance(item, dict) and item.get("type") == "text":
                                    text_parts.append(item.get("text", ""))
                            user_content = " ".join(text_parts) if text_parts else "[multimodal content]"

                        await _to_thread(save_chat_message, session_id, "user", user_content, model, 0)

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
        should_release_concurrency = not trial.get("is_trial", False)
        stream_release_handled = False
        if should_release_concurrency:
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

        # === 2.1) Inject conversation history if session_id provided ===
        if session_id:
            try:
                from src.db.chat_history import get_chat_session

                # Fetch the session with its message history
                session = await _to_thread(get_chat_session, session_id, user['id'])

                if session and session.get('messages'):
                    # Transform DB messages to OpenAI format and prepend to current messages
                    history_messages = [
                        {"role": msg["role"], "content": msg["content"]}
                        for msg in session['messages']
                    ]

                    # Prepend history to incoming messages
                    messages = history_messages + messages

                    logger.info(f"Injected {len(history_messages)} messages from session {session_id}")
                else:
                    logger.debug(f"No history found for session {session_id} or session doesn't exist")

            except Exception as e:
                # Don't fail the request if history fetch fails
                logger.warning(f"Failed to fetch chat history for session {session_id}: {e}")

        model = req.model
        optional = {}
        for name in ("max_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"):
            val = getattr(req, name, None)
            if val is not None:
                optional[name] = val

        # Auto-detect provider if not specified
        provider = (req.provider or "openrouter").lower()
        if not req.provider:
            # Try to detect provider from model ID
            from src.services.models import get_cached_models

            # Check Featherless first (largest catalog)
            featherless_models = get_cached_models("featherless") or []
            if any(m.get("id") == model for m in featherless_models):
                provider = "featherless"
                logger.info(f"Auto-detected provider 'featherless' for model {model}")
            else:
                # Check Portkey
                portkey_models = get_cached_models("portkey") or []
                if any(m.get("id") == model for m in portkey_models):
                    provider = "portkey"
                    logger.info(f"Auto-detected provider 'portkey' for model {model}")
                # Otherwise default to openrouter (already set)


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
                elif provider == "featherless":
                    stream = await _to_thread(make_featherless_request_openai_stream, messages, model, **optional)
                else:
                    stream = await _to_thread(make_openrouter_request_openai_stream, messages, model, **optional)

                stream_release_handled = True
                return StreamingResponse(
                    stream_generator(stream, user, api_key, model, trial, environment_tag, session_id, messages, rate_limit_mgr, provider),
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
            elif provider == "featherless":
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_featherless_request_openai, messages, model, **optional),
                    timeout=30
                )
                processed = await _to_thread(process_featherless_response, resp_raw)
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

        if should_release_concurrency and rate_limit_mgr:
            try:
                await rate_limit_mgr.release_concurrency(api_key)
            except Exception as exc:
                logger.debug("Failed to release concurrency before final check for %s: %s", mask_key(api_key), exc)
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

        # === 4.5) Log activity for tracking and analytics ===
        try:
            provider_name = get_provider_from_model(model)
            speed = total_tokens / elapsed if elapsed > 0 else 0
            await _to_thread(
                log_activity,
                user_id=user["id"],
                model=model,
                provider=provider_name,
                tokens=total_tokens,
                cost=cost if not trial.get("is_trial", False) else 0.0,
                speed=speed,
                finish_reason=processed.get("choices", [{}])[0].get("finish_reason", "stop"),
                app="API",
                metadata={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "endpoint": "/v1/chat/completions",
                    "session_id": session_id,
                    "gateway": provider  # Track which gateway was used
                }
            )
        except Exception as e:
            logger.warning(f"Failed to log activity: {e}")

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
        # Don't leak internal details
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/v1/responses", tags=["chat"])
async def unified_responses(
    req: ResponseRequest,
    api_key: str = Depends(get_api_key),
    session_id: Optional[int] = Query(None, description="Chat session ID to save messages to")
):
    """
    Unified response API endpoint (OpenAI v1/responses compatible).
    This is the newer, more flexible alternative to v1/chat/completions.

    Key differences:
    - Uses 'input' instead of 'messages'
    - Returns 'output' instead of 'choices'
    - Supports response_format for structured JSON output
    - Future-ready for multimodal input/output
    """
    logger.info("unified_responses start (api_key=%s, model=%s)", mask_key(api_key), req.model)

    rate_limit_mgr = None
    should_release_concurrency = False
    stream_release_handled = False

    try:
        # === 1) User + plan/trial prechecks ===
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

        # === 2) Transform 'input' to 'messages' format for upstream ===
        messages = []
        try:
            for inp_msg in req.input:
                # Convert InputMessage to standard message format
                if isinstance(inp_msg.content, str):
                    messages.append({"role": inp_msg.role, "content": inp_msg.content})
                elif isinstance(inp_msg.content, list):
                    # Multimodal content - transform to OpenAI format
                    transformed_content = []
                    for item in inp_msg.content:
                        if isinstance(item, dict):
                            # Map input types to OpenAI chat format
                            if item.get("type") == "input_text":
                                transformed_content.append({
                                    "type": "text",
                                    "text": item.get("text", "")
                                })
                            elif item.get("type") == "input_image_url":
                                transformed_content.append({
                                    "type": "image_url",
                                    "image_url": item.get("image_url", {})
                                })
                            elif item.get("type") in ("text", "image_url"):
                                # Already in correct format
                                transformed_content.append(item)
                            else:
                                logger.warning(f"Unknown content type: {item.get('type')}")
                                transformed_content.append(item)
                        else:
                            logger.warning(f"Invalid content item (not a dict): {type(item)}")

                    messages.append({"role": inp_msg.role, "content": transformed_content})
                else:
                    logger.error(f"Invalid content type: {type(inp_msg.content)}")
                    raise HTTPException(status_code=400, detail=f"Invalid content type: {type(inp_msg.content)}")
        except Exception as e:
            logger.error(f"Error transforming input to messages: {e}, input: {req.input}")
            raise HTTPException(status_code=400, detail=f"Invalid input format: {str(e)}")

        # === 2.1) Inject conversation history if session_id provided ===
        if session_id:
            try:
                session = await _to_thread(get_chat_session, session_id, user['id'])
                if session and session.get('messages'):
                    history_messages = [
                        {"role": msg["role"], "content": msg["content"]}
                        for msg in session['messages']
                    ]
                    messages = history_messages + messages
                    logger.info(f"Injected {len(history_messages)} messages from session {session_id}")
            except Exception as e:
                logger.warning(f"Failed to fetch chat history for session {session_id}: {e}")

        model = req.model
        optional = {}
        for name in ("max_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"):
            val = getattr(req, name, None)
            if val is not None:
                optional[name] = val

        # Add response_format if specified
        if req.response_format:
            if req.response_format.type == "json_object":
                optional["response_format"] = {"type": "json_object"}
            elif req.response_format.type == "json_schema" and req.response_format.json_schema:
                optional["response_format"] = {
                    "type": "json_schema",
                    "json_schema": req.response_format.json_schema
                }

        # Auto-detect provider
        provider = (req.provider or "openrouter").lower()
        if not req.provider:
            from src.services.models import get_cached_models
            featherless_models = get_cached_models("featherless") or []
            if any(m.get("id") == model for m in featherless_models):
                provider = "featherless"
                logger.info(f"Auto-detected provider 'featherless' for model {model}")
            else:
                portkey_models = get_cached_models("portkey") or []
                if any(m.get("id") == model for m in portkey_models):
                    provider = "portkey"
                    logger.info(f"Auto-detected provider 'portkey' for model {model}")

        # === 3) Call upstream (streaming or non-streaming) ===
        if req.stream:
            try:
                if provider == "portkey":
                    portkey_provider = req.portkey_provider or "openai"
                    portkey_virtual_key = getattr(req, "portkey_virtual_key", None)
                    stream = await _to_thread(
                        make_portkey_request_openai_stream, messages, model, portkey_provider, portkey_virtual_key, **optional
                    )
                elif provider == "featherless":
                    stream = await _to_thread(make_featherless_request_openai_stream, messages, model, **optional)
                else:
                    stream = await _to_thread(make_openrouter_request_openai_stream, messages, model, **optional)

                # Use the same stream_generator but transform output format
                async def response_stream_generator():
                    """Transform chat/completions stream to responses format"""
                    async for chunk_data in stream_generator(stream, user, api_key, model, trial, environment_tag, session_id, messages, rate_limit_mgr):
                        # Parse the SSE data
                        if chunk_data.startswith("data: "):
                            data_str = chunk_data[6:].strip()
                            if data_str == "[DONE]":
                                yield chunk_data
                                continue

                            try:
                                chunk_json = json.loads(data_str)

                                # Transform format: choices -> output
                                if "choices" in chunk_json:
                                    output = []
                                    for choice in chunk_json["choices"]:
                                        output_item = {
                                            "index": choice.get("index", 0)
                                        }
                                        if "delta" in choice:
                                            if "role" in choice["delta"]:
                                                output_item["role"] = choice["delta"]["role"]
                                            if "content" in choice["delta"]:
                                                output_item["content"] = choice["delta"]["content"]
                                        if choice.get("finish_reason"):
                                            output_item["finish_reason"] = choice["finish_reason"]
                                        output.append(output_item)

                                    transformed = {
                                        "id": chunk_json.get("id"),
                                        "object": "response.chunk",
                                        "created": chunk_json.get("created"),
                                        "model": chunk_json.get("model"),
                                        "output": output
                                    }
                                    yield f"data: {json.dumps(transformed)}\n\n"
                                else:
                                    # Pass through errors or other messages
                                    yield chunk_data
                            except json.JSONDecodeError:
                                yield chunk_data
                        else:
                            yield chunk_data

                stream_release_handled = True
                return StreamingResponse(
                    response_stream_generator(),
                    media_type="text/event-stream"
                )
            except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.RequestError, asyncio.TimeoutError) as e:
                # Same error handling as chat/completions
                if isinstance(e, httpx.TimeoutException) or isinstance(e, asyncio.TimeoutError):
                    raise HTTPException(status_code=504, detail="Upstream timeout")
                elif isinstance(e, httpx.HTTPStatusError):
                    status = e.response.status_code
                    if status == 429:
                        raise HTTPException(status_code=429, detail="Upstream rate limit exceeded")
                    elif status in (401, 403):
                        raise HTTPException(status_code=500, detail="Upstream authentication error")
                    elif status in (404,):
                        # Model not found - return 404 instead of 500
                        raise HTTPException(status_code=404, detail=f"Model {model} not found or unavailable on {provider}")
                    elif 400 <= status < 500:
                        raise HTTPException(status_code=400, detail="Upstream rejected the request")
                    else:
                        raise HTTPException(status_code=502, detail="Upstream service error")
                else:
                    raise HTTPException(status_code=503, detail="Upstream service unavailable")
            except Exception as e:
                # Catch all other exceptions (e.g., from OpenAI client library)
                error_msg = str(e).lower()
                if "not found" in error_msg or "model" in error_msg and ("unavailable" in error_msg or "does not exist" in error_msg):
                    logger.warning(f"Model not found or unavailable: {model} on {provider} - {e}")
                    raise HTTPException(status_code=404, detail=f"Model {model} not found or unavailable on {provider}")
                elif "timeout" in error_msg:
                    raise HTTPException(status_code=504, detail="Upstream timeout")
                else:
                    logger.error(f"Unexpected error calling {provider} for model {model}: {e}")
                    raise HTTPException(status_code=502, detail=f"Error communicating with upstream provider: {str(e)}")

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
            elif provider == "featherless":
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_featherless_request_openai, messages, model, **optional),
                    timeout=30
                )
                processed = await _to_thread(process_featherless_response, resp_raw)
            else:
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_openrouter_request_openai, messages, model, **optional),
                    timeout=30
                )
                processed = await _to_thread(process_openrouter_response, resp_raw)
        except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.RequestError, asyncio.TimeoutError) as e:
            if isinstance(e, httpx.TimeoutException) or isinstance(e, asyncio.TimeoutError):
                raise HTTPException(status_code=504, detail="Upstream timeout")
            elif isinstance(e, httpx.HTTPStatusError):
                status = e.response.status_code
                if status == 429:
                    raise HTTPException(status_code=429, detail="Upstream rate limit exceeded")
                elif status in (401, 403):
                    raise HTTPException(status_code=500, detail="Upstream authentication error")
                elif status in (404,):
                    # Model not found - return 404 instead of 500
                    raise HTTPException(status_code=404, detail=f"Model {model} not found or unavailable on {provider}")
                elif 400 <= status < 500:
                    raise HTTPException(status_code=400, detail="Upstream rejected the request")
                else:
                    raise HTTPException(status_code=502, detail="Upstream service error")
            else:
                raise HTTPException(status_code=503, detail="Upstream service unavailable")
        except Exception as e:
            # Catch all other exceptions (e.g., from OpenAI client library)
            error_msg = str(e).lower()
            if "not found" in error_msg or "model" in error_msg and ("unavailable" in error_msg or "does not exist" in error_msg):
                logger.warning(f"Model not found or unavailable: {model} on {provider} - {e}")
                raise HTTPException(status_code=404, detail=f"Model {model} not found or unavailable on {provider}")
            elif "timeout" in error_msg:
                raise HTTPException(status_code=504, detail="Upstream timeout")
            else:
                logger.error(f"Unexpected error calling {provider} for model {model}: {e}")
                raise HTTPException(status_code=502, detail=f"Error communicating with upstream provider: {str(e)}")

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
                raise HTTPException(status_code=402, detail=str(e))
            except Exception as e:
                logger.error("Usage recording error: %s", e)

            await _to_thread(update_rate_limit_usage, api_key, total_tokens)

        await _to_thread(increment_api_key_usage, api_key)

        # === 4.5) Log activity for tracking and analytics ===
        try:
            provider_name = get_provider_from_model(model)
            speed = total_tokens / elapsed if elapsed > 0 else 0
            await _to_thread(
                log_activity,
                user_id=user["id"],
                model=model,
                provider=provider_name,
                tokens=total_tokens,
                cost=cost if not trial.get("is_trial", False) else 0.0,
                speed=speed,
                finish_reason=processed.get("choices", [{}])[0].get("finish_reason", "stop"),
                app="API",
                metadata={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "endpoint": "/v1/responses",
                    "session_id": session_id,
                    "gateway": provider  # Track which gateway was used
                }
            )
        except Exception as e:
            logger.warning(f"Failed to log activity: {e}")

        # === 5) History ===
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
                        # Extract text content from multimodal content if needed
                        user_content = last_user.get("content", "")
                        if isinstance(user_content, list):
                            # Extract text from multimodal content
                            text_parts = []
                            for item in user_content:
                                if isinstance(item, dict) and item.get("type") == "text":
                                    text_parts.append(item.get("text", ""))
                            user_content = " ".join(text_parts) if text_parts else "[multimodal content]"

                        await _to_thread(save_chat_message, session_id, "user", user_content, model, 0)

                    assistant_content = processed.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if assistant_content:
                        await _to_thread(save_chat_message, session_id, "assistant", assistant_content, model, total_tokens)
            except Exception as e:
                logger.warning("Failed to save chat history: %s", e)

        # === 6) Transform response format: choices -> output ===
        output = []
        for choice in processed.get("choices", []):
            output_item = {
                "index": choice.get("index", 0),
                "finish_reason": choice.get("finish_reason")
            }

            # Transform message to response format
            if "message" in choice:
                msg = choice["message"]
                output_item["role"] = msg.get("role", "assistant")
                output_item["content"] = msg.get("content", "")

                # Include function/tool calls if present
                if "function_call" in msg:
                    output_item["function_call"] = msg["function_call"]
                if "tool_calls" in msg:
                    output_item["tool_calls"] = msg["tool_calls"]

            output.append(output_item)

        response = {
            "id": processed.get("id"),
            "object": "response",
            "created": processed.get("created"),
            "model": processed.get("model"),
            "output": output,
            "usage": usage
        }

        # Add gateway usage metadata
        response["gateway_usage"] = {
            "tokens_charged": total_tokens,
            "request_ms": int(elapsed * 1000),
        }
        if not trial.get("is_trial", False):
            response["gateway_usage"]["cost_usd"] = round(cost, 6)

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unhandled server error in unified_responses")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if should_release_concurrency and rate_limit_mgr and (not req.stream or not stream_release_handled):
            try:
                await rate_limit_mgr.release_concurrency(api_key)
            except Exception as exc:
                logger.debug("Failed to release concurrency for %s: %s", mask_key(api_key), exc)
