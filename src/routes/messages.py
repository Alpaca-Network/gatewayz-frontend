"""
Anthropic Messages API endpoint
Compatible with Claude API: https://docs.claude.com/en/api/messages
"""

import logging
import asyncio
import time
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from src.db.api_keys import increment_api_key_usage
from src.db.plans import enforce_plan_limits
from src.db.rate_limits import create_rate_limit_alert, update_rate_limit_usage
from src.db.users import get_user, deduct_credits, record_usage
from src.db.chat_history import save_chat_message, get_chat_session
from src.db.activity import log_activity, get_provider_from_model
from src.schemas import MessagesRequest
from src.security.deps import get_api_key
from src.services.openrouter_client import make_openrouter_request_openai, process_openrouter_response
from src.services.portkey_client import make_portkey_request_openai, process_portkey_response
from src.services.featherless_client import make_featherless_request_openai, process_featherless_response
from src.services.fireworks_client import make_fireworks_request_openai, process_fireworks_response
from src.services.together_client import make_together_request_openai, process_together_response
from src.services.huggingface_client import make_huggingface_request_openai, process_huggingface_response
from src.services.rate_limiting import get_rate_limit_manager
from src.services.trial_validation import validate_trial_access, track_trial_usage
from src.services.pricing import calculate_cost
from src.services.anthropic_transformer import (
    transform_anthropic_to_openai,
    transform_openai_to_anthropic,
    extract_text_from_content
)

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_PROVIDER_TIMEOUT = 60
PROVIDER_TIMEOUTS = {
    "huggingface": 120,
}


def mask_key(k: str) -> str:
    return f"...{k[-4:]}" if k and len(k) >= 4 else "****"


async def _to_thread(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)


@router.post("/v1/messages", tags=["chat"])
async def anthropic_messages(
    req: MessagesRequest,
    api_key: str = Depends(get_api_key),
    session_id: Optional[int] = Query(None, description="Chat session ID to save messages to")
):
    """
    Anthropic Messages API endpoint (Claude API compatible).

    This endpoint accepts Anthropic-style requests and transforms them to work
    with OpenAI-compatible providers (OpenRouter, Portkey, Featherless).

    Key differences from OpenAI Chat Completions:
    - Uses 'messages' array but 'system' is a separate parameter
    - 'max_tokens' is REQUIRED (not optional like in OpenAI)
    - Returns Anthropic-style response with 'content' array and 'stop_reason'
    - Supports 'stop_sequences' instead of 'stop'
    - Supports 'top_k' parameter (Anthropic-specific, logged but not used)

    Example request:
    ```json
    {
      "model": "claude-sonnet-4-5-20250929",
      "max_tokens": 1024,
      "messages": [
        {"role": "user", "content": "Hello, Claude!"}
      ]
    }
    ```

    Example response:
    ```json
    {
      "id": "msg-123",
      "type": "message",
      "role": "assistant",
      "content": [{"type": "text", "text": "Hello! How can I help?"}],
      "model": "claude-sonnet-4-5-20250929",
      "stop_reason": "end_turn",
      "usage": {"input_tokens": 10, "output_tokens": 12}
    }
    ```
    """
    logger.info("anthropic_messages start (api_key=%s, model=%s)", mask_key(api_key), req.model)

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
        should_release_concurrency = not trial.get("is_trial", False)

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

        # === 2) Transform Anthropic format to OpenAI format ===
        messages_data = [msg.model_dump() for msg in req.messages]
        openai_messages, openai_params = transform_anthropic_to_openai(
            messages=messages_data,
            system=req.system,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            top_p=req.top_p,
            top_k=req.top_k,
            stop_sequences=req.stop_sequences
        )

        # === 2.1) Inject conversation history if session_id provided ===
        if session_id:
            try:
                session = await _to_thread(get_chat_session, session_id, user['id'])
                if session and session.get('messages'):
                    history_messages = [
                        {"role": msg["role"], "content": msg["content"]}
                        for msg in session['messages']
                    ]
                    # Insert history after system message (if present)
                    if openai_messages and openai_messages[0].get("role") == "system":
                        openai_messages = [openai_messages[0]] + history_messages + openai_messages[1:]
                    else:
                        openai_messages = history_messages + openai_messages
                    logger.info(f"Injected {len(history_messages)} messages from session {session_id}")
            except Exception as e:
                logger.warning(f"Failed to fetch chat history for session {session_id}: {e}")

        original_model = req.model

        # Auto-detect provider
        provider = (req.provider or "openrouter").lower()

        # Normalize provider aliases
        if provider == "hug":
            provider = "huggingface"

        if not req.provider:
            # Try to detect provider from model ID using the transformation module
            from src.services.model_transformations import detect_provider_from_model_id
            detected_provider = detect_provider_from_model_id(original_model)
            if detected_provider:
                provider = detected_provider
                # Normalize provider aliases
                if provider == "hug":
                    provider = "huggingface"
                logger.info(f"Auto-detected provider '{provider}' for model {original_model}")
            else:
                # Fallback to checking cached models
                from src.services.models import get_cached_models
                from src.services.model_transformations import transform_model_id

                # Try each provider with transformation
                for test_provider in ["featherless", "fireworks", "together", "huggingface", "portkey"]:
                    transformed = transform_model_id(original_model, test_provider)
                    provider_models = get_cached_models(test_provider) or []
                    if any(m.get("id") == transformed for m in provider_models):
                        provider = test_provider
                        logger.info(f"Auto-detected provider '{provider}' for model {original_model} (transformed to {transformed})")
                        break
                # Otherwise default to openrouter (already set)

        # Transform model ID to provider-specific format
        from src.services.model_transformations import transform_model_id
        model = transform_model_id(original_model, provider)
        if model != original_model:
            logger.info(f"Transformed model ID from '{original_model}' to '{model}' for provider {provider}")

        # === 3) Call upstream ===
        request_timeout = PROVIDER_TIMEOUTS.get(provider, DEFAULT_PROVIDER_TIMEOUT)
        if request_timeout != DEFAULT_PROVIDER_TIMEOUT:
            logger.debug("Using extended timeout %ss for provider %s", request_timeout, provider)

        start = time.monotonic()
        try:
            if provider == "portkey":
                portkey_provider = req.portkey_provider or "anthropic"
                portkey_virtual_key = getattr(req, "portkey_virtual_key", None)
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_portkey_request_openai, openai_messages, model, portkey_provider, portkey_virtual_key, **openai_params),
                    timeout=request_timeout
                )
                processed = await _to_thread(process_portkey_response, resp_raw)
            elif provider == "featherless":
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_featherless_request_openai, openai_messages, model, **openai_params),
                    timeout=request_timeout
                )
                processed = await _to_thread(process_featherless_response, resp_raw)
            elif provider == "fireworks":
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_fireworks_request_openai, openai_messages, model, **openai_params),
                    timeout=request_timeout
                )
                processed = await _to_thread(process_fireworks_response, resp_raw)
            elif provider == "together":
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_together_request_openai, openai_messages, model, **openai_params),
                    timeout=request_timeout
                )
                processed = await _to_thread(process_together_response, resp_raw)
            elif provider == "huggingface":
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_huggingface_request_openai, openai_messages, model, **openai_params),
                    timeout=request_timeout
                )
                processed = await _to_thread(process_huggingface_response, resp_raw)
            else:
                resp_raw = await asyncio.wait_for(
                    _to_thread(make_openrouter_request_openai, openai_messages, model, **openai_params),
                    timeout=request_timeout
                )
                processed = await _to_thread(process_openrouter_response, resp_raw)
        except Exception as e:
            logger.error(f"Upstream error for model {model} on {provider}: {e}")
            error_msg = str(e).lower()
            if "timeout" in error_msg:
                raise HTTPException(status_code=504, detail="Upstream timeout")
            elif "not found" in error_msg or ("model" in error_msg and "unavailable" in error_msg):
                raise HTTPException(status_code=404, detail=f"Model {model} not found or unavailable on {provider}")
            elif "rate limit" in error_msg:
                raise HTTPException(status_code=429, detail="Upstream rate limit exceeded")
            else:
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

        if should_release_concurrency and rate_limit_mgr:
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

            try:
                await rate_limit_mgr.release_concurrency(api_key)
            except Exception as exc:
                logger.debug("Failed to release concurrency for %s: %s", mask_key(api_key), exc)

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

        # === 4.5) Log activity ===
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
                    "endpoint": "/v1/messages",
                    "session_id": session_id,
                    "gateway": provider  # Track which gateway was used
                }
            )
        except Exception as e:
            logger.warning(f"Failed to log activity: {e}")

        # === 5) Save chat history ===
        if session_id:
            try:
                session = await _to_thread(get_chat_session, session_id, user["id"])
                if session:
                    # Save last user message
                    last_user = None
                    for m in reversed(openai_messages):
                        if m.get("role") == "user":
                            last_user = m
                            break

                    if last_user:
                        user_content = extract_text_from_content(last_user.get("content", ""))
                        await _to_thread(save_chat_message, session_id, "user", user_content, model, 0)

                    # Save assistant response
                    assistant_content = processed.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if assistant_content:
                        await _to_thread(save_chat_message, session_id, "assistant", assistant_content, model, total_tokens)
            except Exception as e:
                logger.warning("Failed to save chat history: %s", e)

        # === 6) Transform response to Anthropic format ===
        anthropic_response = transform_openai_to_anthropic(processed, model)

        # Add gateway usage metadata (Gatewayz-specific)
        anthropic_response["gateway_usage"] = {
            "tokens_charged": total_tokens,
            "request_ms": int(elapsed * 1000),
        }
        if not trial.get("is_trial", False):
            anthropic_response["gateway_usage"]["cost_usd"] = round(cost, 6)

        return anthropic_response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unhandled server error in anthropic_messages")
        raise HTTPException(status_code=500, detail="Internal server error")
