import asyncio
import json
import logging
import time
import uuid
from contextvars import ContextVar
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from src.utils.performance_tracker import PerformanceTracker

# Request correlation ID for distributed tracing
request_id_var: ContextVar[str] = ContextVar("request_id", default="")
# Make braintrust optional for test environments
try:
    from braintrust import current_span, start_span, traced

    BRAINTRUST_AVAILABLE = True
except ImportError:
    BRAINTRUST_AVAILABLE = False

    # Create no-op decorators and functions when braintrust is not available
    def traced(name=None, type=None):
        def decorator(func):
            return func

        return decorator

    class MockSpan:
        def log(self, *args, **kwargs):
            pass

        def end(self):
            pass

    def start_span(name=None, type=None):
        return MockSpan()

    def current_span():
        return MockSpan()


import importlib

import src.db.activity as activity_module
import src.db.api_keys as api_keys_module
import src.db.chat_history as chat_history_module
import src.db.plans as plans_module
import src.db.rate_limits as rate_limits_module
import src.db.users as users_module
from src.config import Config
from src.schemas import ProxyRequest, ResponseRequest
from src.security.deps import get_api_key
from src.utils.rate_limit_headers import get_rate_limit_headers

# Import provider clients with graceful error handling
# This prevents a single provider's import failure from breaking the entire chat endpoint
_provider_import_errors = {}


# Helper function to safely import provider clients
def _safe_import_provider(provider_name, imports_list):
    """Safely import provider functions with error logging

    Returns a dict with either:
    - Real functions if import succeeds
    - Sentinel functions that raise HTTPException if used
    """
    try:
        module_path = f"src.services.{provider_name}_client"
        module = __import__(module_path, fromlist=imports_list)
        result = {}
        for import_name in imports_list:
            result[import_name] = getattr(module, import_name)
        logging.getLogger(__name__).debug(f"✓ Loaded {provider_name} provider client")
        return result
    except Exception as e:
        error_msg = (
            f"⚠  Failed to load {provider_name} provider client: {type(e).__name__}: {str(e)}"
        )
        logging.getLogger(__name__).error(error_msg)
        _provider_import_errors[provider_name] = str(e)

        # Return sentinel functions that raise informative errors when called
        def make_error_raiser(prov_name, func_name, error):
            async def async_error(*args, **kwargs):
                raise HTTPException(
                    status_code=503,
                    detail=f"Provider '{prov_name}' is unavailable: {func_name} failed to load. Error: {str(error)[:100]}"
                )

            def sync_error(*args, **kwargs):
                raise HTTPException(
                    status_code=503,
                    detail=f"Provider '{prov_name}' is unavailable: {func_name} failed to load. Error: {str(error)[:100]}"
                )

            # Return the sync version by default (async handling is done elsewhere)
            return sync_error

        return {import_name: make_error_raiser(provider_name, import_name, e) for import_name in imports_list}

# Load all provider clients
_openrouter = _safe_import_provider(
    "openrouter",
    [
        "make_openrouter_request_openai",
        "process_openrouter_response",
        "make_openrouter_request_openai_stream",
    ],
)
make_openrouter_request_openai = _openrouter.get("make_openrouter_request_openai")
process_openrouter_response = _openrouter.get("process_openrouter_response")
make_openrouter_request_openai_stream = _openrouter.get("make_openrouter_request_openai_stream")


_featherless = _safe_import_provider(
    "featherless",
    [
        "make_featherless_request_openai",
        "process_featherless_response",
        "make_featherless_request_openai_stream",
    ],
)
make_featherless_request_openai = _featherless.get("make_featherless_request_openai")
process_featherless_response = _featherless.get("process_featherless_response")
make_featherless_request_openai_stream = _featherless.get("make_featherless_request_openai_stream")

_fireworks = _safe_import_provider(
    "fireworks",
    [
        "make_fireworks_request_openai",
        "process_fireworks_response",
        "make_fireworks_request_openai_stream",
    ],
)
make_fireworks_request_openai = _fireworks.get("make_fireworks_request_openai")
process_fireworks_response = _fireworks.get("process_fireworks_response")
make_fireworks_request_openai_stream = _fireworks.get("make_fireworks_request_openai_stream")

_together = _safe_import_provider(
    "together",
    [
        "make_together_request_openai",
        "process_together_response",
        "make_together_request_openai_stream",
    ],
)
make_together_request_openai = _together.get("make_together_request_openai")
process_together_response = _together.get("process_together_response")
make_together_request_openai_stream = _together.get("make_together_request_openai_stream")

_huggingface = _safe_import_provider(
    "huggingface",
    [
        "make_huggingface_request_openai",
        "process_huggingface_response",
        "make_huggingface_request_openai_stream",
    ],
)
make_huggingface_request_openai = _huggingface.get("make_huggingface_request_openai")
process_huggingface_response = _huggingface.get("process_huggingface_response")
make_huggingface_request_openai_stream = _huggingface.get("make_huggingface_request_openai_stream")

_aimo = _safe_import_provider(
    "aimo",
    [
        "make_aimo_request_openai",
        "process_aimo_response",
        "make_aimo_request_openai_stream",
    ],
)
make_aimo_request_openai = _aimo.get("make_aimo_request_openai")
process_aimo_response = _aimo.get("process_aimo_response")
make_aimo_request_openai_stream = _aimo.get("make_aimo_request_openai_stream")

_xai = _safe_import_provider(
    "xai",
    [
        "make_xai_request_openai",
        "process_xai_response",
        "make_xai_request_openai_stream",
    ],
)
make_xai_request_openai = _xai.get("make_xai_request_openai")
process_xai_response = _xai.get("process_xai_response")
make_xai_request_openai_stream = _xai.get("make_xai_request_openai_stream")

_cerebras = _safe_import_provider(
    "cerebras",
    [
        "make_cerebras_request_openai",
        "process_cerebras_response",
        "make_cerebras_request_openai_stream",
    ],
)
make_cerebras_request_openai = _cerebras.get("make_cerebras_request_openai")
process_cerebras_response = _cerebras.get("process_cerebras_response")
make_cerebras_request_openai_stream = _cerebras.get("make_cerebras_request_openai_stream")

_chutes = _safe_import_provider(
    "chutes",
    [
        "make_chutes_request_openai",
        "process_chutes_response",
        "make_chutes_request_openai_stream",
    ],
)
make_chutes_request_openai = _chutes.get("make_chutes_request_openai")
process_chutes_response = _chutes.get("process_chutes_response")
make_chutes_request_openai_stream = _chutes.get("make_chutes_request_openai_stream")

_google_vertex = _safe_import_provider(
    "google_vertex",
    [
        "make_google_vertex_request_openai",
        "process_google_vertex_response",
        "make_google_vertex_request_openai_stream",
    ],
)
make_google_vertex_request_openai = _google_vertex.get("make_google_vertex_request_openai")
process_google_vertex_response = _google_vertex.get("process_google_vertex_response")
make_google_vertex_request_openai_stream = _google_vertex.get(
    "make_google_vertex_request_openai_stream"
)

_near = _safe_import_provider(
    "near",
    [
        "make_near_request_openai",
        "process_near_response",
        "make_near_request_openai_stream",
    ],
)
make_near_request_openai = _near.get("make_near_request_openai")
process_near_response = _near.get("process_near_response")
make_near_request_openai_stream = _near.get("make_near_request_openai_stream")

_vercel_ai_gateway = _safe_import_provider(
    "vercel_ai_gateway",
    [
        "make_vercel_ai_gateway_request_openai",
        "process_vercel_ai_gateway_response",
        "make_vercel_ai_gateway_request_openai_stream",
    ],
)
make_vercel_ai_gateway_request_openai = _vercel_ai_gateway.get(
    "make_vercel_ai_gateway_request_openai"
)
process_vercel_ai_gateway_response = _vercel_ai_gateway.get("process_vercel_ai_gateway_response")
make_vercel_ai_gateway_request_openai_stream = _vercel_ai_gateway.get(
    "make_vercel_ai_gateway_request_openai_stream"
)

_helicone = _safe_import_provider(
    "helicone",
    [
        "make_helicone_request_openai",
        "process_helicone_response",
        "make_helicone_request_openai_stream",
    ],
)
make_helicone_request_openai = _helicone.get("make_helicone_request_openai")
process_helicone_response = _helicone.get("process_helicone_response")
make_helicone_request_openai_stream = _helicone.get("make_helicone_request_openai_stream")

_aihubmix = _safe_import_provider(
    "aihubmix",
    [
        "make_aihubmix_request_openai",
        "process_aihubmix_response",
        "make_aihubmix_request_openai_stream",
    ],
)
make_aihubmix_request_openai = _aihubmix.get("make_aihubmix_request_openai")
process_aihubmix_response = _aihubmix.get("process_aihubmix_response")
make_aihubmix_request_openai_stream = _aihubmix.get("make_aihubmix_request_openai_stream")

_anannas = _safe_import_provider(
    "anannas",
    [
        "make_anannas_request_openai",
        "process_anannas_response",
        "make_anannas_request_openai_stream",
    ],
)
make_anannas_request_openai = _anannas.get("make_anannas_request_openai")
process_anannas_response = _anannas.get("process_anannas_response")
make_anannas_request_openai_stream = _anannas.get("make_anannas_request_openai_stream")

_alpaca_network = _safe_import_provider(
    "alpaca_network",
    [
        "make_alpaca_network_request_openai",
        "process_alpaca_network_response",
        "make_alpaca_network_request_openai_stream",
    ],
)
make_alpaca_network_request_openai = _alpaca_network.get("make_alpaca_network_request_openai")
process_alpaca_network_response = _alpaca_network.get("process_alpaca_network_response")
make_alpaca_network_request_openai_stream = _alpaca_network.get(
    "make_alpaca_network_request_openai_stream"
)

_alibaba_cloud = _safe_import_provider(
    "alibaba_cloud",
    [
        "make_alibaba_cloud_request_openai",
        "process_alibaba_cloud_response",
        "make_alibaba_cloud_request_openai_stream",
    ],
)
make_alibaba_cloud_request_openai = _alibaba_cloud.get("make_alibaba_cloud_request_openai")
process_alibaba_cloud_response = _alibaba_cloud.get("process_alibaba_cloud_response")
make_alibaba_cloud_request_openai_stream = _alibaba_cloud.get(
    "make_alibaba_cloud_request_openai_stream"
)

_clarifai = _safe_import_provider(
    "clarifai",
    [
        "make_clarifai_request_openai",
        "process_clarifai_response",
        "make_clarifai_request_openai_stream",
    ],
)
make_clarifai_request_openai = _clarifai.get("make_clarifai_request_openai")
process_clarifai_response = _clarifai.get("process_clarifai_response")
make_clarifai_request_openai_stream = _clarifai.get("make_clarifai_request_openai_stream")

import src.services.rate_limiting as rate_limiting_service
import src.services.trial_validation as trial_module
from src.services.model_transformations import detect_provider_from_model_id, transform_model_id
from src.services.pricing import calculate_cost
from src.services.provider_failover import (
    build_provider_failover_chain,
    map_provider_error,
    should_failover,
)
from src.utils.security_validators import sanitize_for_logging


# Backwards compatibility wrappers for test patches
def increment_api_key_usage(*args, **kwargs):
    return api_keys_module.increment_api_key_usage(*args, **kwargs)


def enforce_plan_limits(*args, **kwargs):
    return plans_module.enforce_plan_limits(*args, **kwargs)


def create_rate_limit_alert(*args, **kwargs):
    return rate_limits_module.create_rate_limit_alert(*args, **kwargs)


def update_rate_limit_usage(*args, **kwargs):
    return rate_limits_module.update_rate_limit_usage(*args, **kwargs)


def get_user(*args, **kwargs):
    return users_module.get_user(*args, **kwargs)


def deduct_credits(*args, **kwargs):
    return users_module.deduct_credits(*args, **kwargs)


def log_api_usage_transaction(*args, **kwargs):
    return users_module.log_api_usage_transaction(*args, **kwargs)


def record_usage(*args, **kwargs):
    return users_module.record_usage(*args, **kwargs)


def create_chat_session(*args, **kwargs):
    return chat_history_module.create_chat_session(*args, **kwargs)


def save_chat_message(*args, **kwargs):
    return chat_history_module.save_chat_message(*args, **kwargs)


def get_chat_session(*args, **kwargs):
    return chat_history_module.get_chat_session(*args, **kwargs)


def log_activity(*args, **kwargs):
    return activity_module.log_activity(*args, **kwargs)


def get_provider_from_model(*args, **kwargs):
    return activity_module.get_provider_from_model(*args, **kwargs)


def get_rate_limit_manager(*args, **kwargs):
    return rate_limiting_service.get_rate_limit_manager(*args, **kwargs)


def validate_trial_access(*args, **kwargs):
    return trial_module.validate_trial_access(*args, **kwargs)


def track_trial_usage(*args, **kwargs):
    return trial_module.track_trial_usage(*args, **kwargs)


logger = logging.getLogger(__name__)
router = APIRouter()

# Log module initialization to help debug route loading
logger.info("🔄 Chat module initialized - router created")
logger.info(f"   Router type: {type(router)}")

DEFAULT_PROVIDER_TIMEOUT = 30
PROVIDER_TIMEOUTS = {
    "huggingface": 120,
    "near": 120,  # Large models like Qwen3-30B need extended timeout
}


def mask_key(k: str) -> str:
    return f"...{k[-4:]}" if k and len(k) >= 4 else "****"


async def _to_thread(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)


def _fallback_get_user(api_key: str):
    try:
        supabase_module = importlib.import_module("src.config.supabase_config")
        client = supabase_module.get_supabase_client()
        result = client.table("users").select("*").eq("api_key", api_key).execute()
        if result.data:
            logging.getLogger(__name__).debug("Fallback user lookup succeeded for %s", api_key)
            return result.data[0]
        logging.getLogger(__name__).debug(
            "Fallback lookup found no data; table snapshot=%s",
            client.table("users").select("*").execute().data,
        )
    except Exception as exc:
        logging.getLogger(__name__).debug(
            "Fallback user lookup error for %s: %s", mask_key(api_key), exc
        )
        return None
    return None


async def _process_stream_completion_background(
    user,
    api_key,
    model,
    trial,
    environment_tag,
    session_id,
    messages,
    accumulated_content,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    elapsed,
    provider,
):
    """
    Background task for post-stream processing (100-200ms faster [DONE] event!)

    This runs asynchronously after the stream completes, allowing the [DONE]
    event to be sent immediately without waiting for database operations.
    """
    try:
        # Track trial usage
        if trial.get("is_trial") and not trial.get("is_expired"):
            try:
                await _to_thread(track_trial_usage, api_key, total_tokens, 1)
            except Exception as e:
                logger.warning("Failed to track trial usage: %s", e)

        cost = calculate_cost(model, prompt_tokens, completion_tokens)
        is_trial = trial.get("is_trial", False)

        # Log transaction and deduct credits
        if is_trial:
            try:
                await _to_thread(
                    log_api_usage_transaction,
                    api_key,
                    0.0,
                    f"API usage - {model} (Trial)",
                    {
                        "model": model,
                        "total_tokens": total_tokens,
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "cost_usd": 0.0,
                        "is_trial": True,
                    },
                    True,
                )
            except Exception as e:
                logger.error(f"Failed to log trial API usage transaction: {e}", exc_info=True)
        else:
            try:
                await _to_thread(
                    deduct_credits,
                    api_key,
                    cost,
                    f"API usage - {model}",
                    {
                        "model": model,
                        "total_tokens": total_tokens,
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "cost_usd": cost,
                    },
                )
                await _to_thread(
                    record_usage,
                    user["id"],
                    api_key,
                    model,
                    total_tokens,
                    cost,
                    int(elapsed * 1000),
                )
                await _to_thread(update_rate_limit_usage, api_key, total_tokens)
            except Exception as e:
                logger.error("Usage recording error in background: %s", e)

        # Increment API key usage counter
        await _to_thread(increment_api_key_usage, api_key)

        # Log activity
        try:
            provider_name = get_provider_from_model(model)
            speed = total_tokens / elapsed if elapsed > 0 else 0
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
                    "gateway": provider,
                },
            )
        except Exception as e:
            logger.error(
                f"Failed to log activity for user {user['id']}, model {model}: {e}", exc_info=True
            )

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
                        user_content = last_user.get("content", "")
                        if isinstance(user_content, list):
                            text_parts = []
                            for item in user_content:
                                if isinstance(item, dict) and item.get("type") == "text":
                                    text_parts.append(item.get("text", ""))
                            user_content = (
                                " ".join(text_parts) if text_parts else "[multimodal content]"
                            )

                        await _to_thread(
                            save_chat_message,
                            session_id,
                            "user",
                            user_content,
                            model,
                            0,
                            user["id"],
                        )

                    if accumulated_content:
                        await _to_thread(
                            save_chat_message,
                            session_id,
                            "assistant",
                            accumulated_content,
                            model,
                            total_tokens,
                            user["id"],
                        )
            except Exception as e:
                logger.error(
                    f"Failed to save chat history for session {session_id}, user {user['id']}: {e}",
                    exc_info=True,
                )
    except Exception as e:
        logger.error(f"Background stream processing error: {e}", exc_info=True)


async def stream_generator(
    stream,
    user,
    api_key,
    model,
    trial,
    environment_tag,
    session_id,
    messages,
    rate_limit_mgr=None,
    provider="openrouter",
    tracker=None,
):
    """Generate SSE stream from OpenAI stream response (OPTIMIZED: background post-processing)"""
    accumulated_content = ""
    accumulated_thinking = ""
    prompt_tokens = 0
    completion_tokens = 0
    total_tokens = 0
    start_time = time.monotonic()
    rate_limit_mgr is not None and not trial.get("is_trial", False)
    has_thinking = False
    streaming_ctx = None

    try:
        # Track streaming duration if tracker is provided
        if tracker:
            streaming_ctx = tracker.streaming()
            streaming_ctx.__enter__()

        chunk_count = 0
        for chunk in stream:
            chunk_count += 1
            logger.debug(f"[STREAM] Processing chunk {chunk_count} for model {model}")

            # Extract chunk data
            chunk_dict = {
                "id": chunk.id,
                "object": chunk.object,
                "created": chunk.created,
                "model": chunk.model,
                "choices": [],
            }

            for choice in chunk.choices:
                choice_dict = {
                    "index": choice.index,
                    "delta": {},
                    "finish_reason": choice.finish_reason,
                }

                if hasattr(choice.delta, "role") and choice.delta.role:
                    choice_dict["delta"]["role"] = choice.delta.role
                if hasattr(choice.delta, "content") and choice.delta.content:
                    content = choice.delta.content
                    choice_dict["delta"]["content"] = content
                    accumulated_content += content
                    logger.debug(
                        f"[STREAM] Chunk {chunk_count}: Added {len(content)} characters of content"
                    )

                    # Detect thinking tags for debug logging
                    if "<thinking>" in content or "[THINKING" in content or "thinking>" in content:
                        has_thinking = True
                        accumulated_thinking += content
                        # Log when we first detect thinking
                        if accumulated_thinking.count("<thinking>") == 1:
                            logger.info(
                                f"[THINKING DEBUG] Detected thinking tag in stream for model {model}"
                            )
                else:
                    logger.debug(f"[STREAM] Chunk {chunk_count}: No content in delta")

                chunk_dict["choices"].append(choice_dict)

            logger.debug(
                f"[STREAM] Chunk {chunk_count} dict: {json.dumps(chunk_dict, default=str)}"
            )

            # Check for usage in chunk (some providers send it in final chunk)
            if hasattr(chunk, "usage") and chunk.usage:
                prompt_tokens = chunk.usage.prompt_tokens
                completion_tokens = chunk.usage.completion_tokens
                total_tokens = chunk.usage.total_tokens

            # Send SSE event with potential debug info
            if has_thinking and not accumulated_thinking.endswith("DEBUG_LOGGED"):
                logger.debug(
                    f"[THINKING DEBUG] Streaming chunk with thinking content: {json.dumps(choice_dict)}"
                )

            yield f"data: {json.dumps(chunk_dict)}\n\n"

        logger.info(
            f"[STREAM] Stream completed with {chunk_count} chunks, accumulated content length: {len(accumulated_content)}"
        )

        # If no usage was provided, estimate based on content
        if total_tokens == 0:
            # Rough estimate: 1 token ≈ 4 characters
            completion_tokens = max(1, len(accumulated_content) // 4)

            # Calculate prompt tokens, handling both string and multimodal content
            prompt_chars = 0
            for m in messages:
                content = m.get("content", "")
                if isinstance(content, str):
                    prompt_chars += len(content)
                elif isinstance(content, list):
                    # For multimodal content, extract text parts
                    for item in content:
                        if isinstance(item, dict) and item.get("type") == "text":
                            prompt_chars += len(item.get("text", ""))
            prompt_tokens = max(1, prompt_chars // 4)
            total_tokens = prompt_tokens + completion_tokens

        elapsed = max(0.001, time.monotonic() - start_time)

        # OPTIMIZATION: Quick plan limit check (critical - must be synchronous)
        post_plan = await _to_thread(enforce_plan_limits, user["id"], total_tokens, environment_tag)
        if not post_plan.get("allowed", False):
            error_chunk = {
                "error": {
                    "message": f"Plan limit exceeded: {post_plan.get('reason', 'unknown')}",
                    "type": "plan_limit_exceeded",
                }
            }
            yield f"data: {json.dumps(error_chunk)}\n\n"
            yield "data: [DONE]\n\n"
            return

        # OPTIMIZATION: Send [DONE] immediately, process credits/logging in background!
        # This makes the stream complete 100-200ms faster for the client
        yield "data: [DONE]\n\n"

        # Schedule background processing (non-blocking)
        asyncio.create_task(
            _process_stream_completion_background(
                user=user,
                api_key=api_key,
                model=model,
                trial=trial,
                environment_tag=environment_tag,
                session_id=session_id,
                messages=messages,
                accumulated_content=accumulated_content,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                elapsed=elapsed,
                provider=provider,
            )
        )

    except Exception as e:
        logger.error(f"Streaming error: {e}")
        error_chunk = {"error": {"message": "Streaming error occurred", "type": "stream_error"}}
        yield f"data: {json.dumps(error_chunk)}\n\n"
        yield "data: [DONE]\n\n"
    finally:
        # Record streaming duration
        if streaming_ctx:
            streaming_ctx.__exit__(None, None, None)
        # Record performance percentages if tracker is provided
        if tracker:
            tracker.record_percentages()


# Log route registration for debugging
logger.info("📍 Registering /v1/chat/completions endpoint")


@router.post("/v1/chat/completions", tags=["chat"])
@traced(name="chat_completions", type="llm")
async def chat_completions(
    req: ProxyRequest,
    background_tasks: BackgroundTasks,
    api_key: str = Depends(get_api_key),
    session_id: Optional[int] = Query(None, description="Chat session ID to save messages to"),
    request: Request = None,
):
    # === 0) Setup / sanity ===
    # Generate request correlation ID for distributed tracing
    request_id = str(uuid.uuid4())
    request_id_var.set(request_id)

    # Never print keys; log masked
    if Config.IS_TESTING and request:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            api_key = auth_header.split(" ", 1)[1].strip()

    logger.info(
        "chat_completions start (request_id=%s, api_key=%s, model=%s)",
        request_id,
        mask_key(api_key),
        req.model,
        extra={"request_id": request_id},
    )

    # Start Braintrust span for this request
    span = start_span(name=f"chat_{req.model}", type="llm")

    # Initialize performance tracker
    tracker = PerformanceTracker(endpoint="/v1/chat/completions")

    try:
        # === 1) User + plan/trial prechecks (OPTIMIZED: parallelized DB calls) ===
        with tracker.stage("auth_validation"):
            # Step 1: Get user first (required for subsequent checks)
            user = await _to_thread(get_user, api_key)
            if not user and Config.IS_TESTING:
                logger.debug("Fallback user lookup invoked for %s", mask_key(api_key))
                user = await _to_thread(_fallback_get_user, api_key)
            if not user:
                logger.warning("Invalid API key or user not found for key %s", mask_key(api_key))
                raise HTTPException(status_code=401, detail="Invalid API key")

            environment_tag = user.get("environment_tag", "live")

            # Step 2: Only validate trial access (plan limits checked after token usage known)
            trial = await _to_thread(validate_trial_access, api_key)

        # Validate trial access
        if not trial.get("is_valid", False):
            if trial.get("is_trial") and trial.get("is_expired"):
                raise HTTPException(
                    status_code=403,
                    detail=trial["error"],
                    headers={
                        "X-Trial-Expired": "true",
                        "X-Trial-End-Date": trial.get("trial_end_date", ""),
                    },
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

        # Allow disabling rate limiting for testing (DEV ONLY)
        import os

        disable_rate_limiting = os.getenv("DISABLE_RATE_LIMITING", "false").lower() == "true"

        # Initialize rate limit variables
        rl_pre = None
        rl_final = None

        # Rate limiting will be checked after we know actual token usage (more accurate)

        if not trial.get("is_trial", False) and user.get("credits", 0.0) <= 0:
            raise HTTPException(status_code=402, detail="Insufficient credits")

        # === 2) Build upstream request ===
        with tracker.stage("request_parsing"):
            messages = [m.model_dump() for m in req.messages]

        # === 2.1) Inject conversation history if session_id provided ===
        if session_id:
            try:
                # Fetch the session with its message history
                session = await _to_thread(get_chat_session, session_id, user["id"])

                if session and session.get("messages"):
                    # Transform DB messages to OpenAI format and prepend to current messages
                    history_messages = [
                        {"role": msg["role"], "content": msg["content"]}
                        for msg in session["messages"]
                    ]

                    # Prepend history to incoming messages
                    messages = history_messages + messages

                    logger.info(
                        "Injected %d messages from session %s",
                        len(history_messages),
                        sanitize_for_logging(str(session_id)),
                    )
                else:
                    logger.debug(
                        "No history found for session %s or session doesn't exist",
                        sanitize_for_logging(str(session_id)),
                    )

            except Exception as e:
                # Don't fail the request if history fetch fails
                logger.warning(
                    "Failed to fetch chat history for session %s: %s",
                    sanitize_for_logging(str(session_id)),
                    sanitize_for_logging(str(e)),
                )

        # Store original model for response
        original_model = req.model

        with tracker.stage("request_preparation"):
            optional = {}
            for name in (
                "max_tokens",
                "temperature",
                "top_p",
                "frequency_penalty",
                "presence_penalty",
                "tools",
            ):
                val = getattr(req, name, None)
                if val is not None:
                    optional[name] = val

            # Auto-detect provider if not specified
            req_provider_missing = req.provider is None or (
                isinstance(req.provider, str) and not req.provider
            )
            provider = (req.provider or "openrouter").lower()

            # Normalize provider aliases
            if provider == "hug":
                provider = "huggingface"

            override_provider = detect_provider_from_model_id(original_model)
            if override_provider:
                override_provider = override_provider.lower()
                if override_provider == "hug":
                    override_provider = "huggingface"
                if override_provider != provider:
                    logger.info(
                        f"Provider override applied for model {original_model}: '{provider}' -> '{override_provider}'"
                    )
                    provider = override_provider
                # Mark provider as determined even if it matches the default
                # This prevents the fallback logic from incorrectly routing to wrong providers
                req_provider_missing = False

            if req_provider_missing:
                # Try to detect provider from model ID using the transformation module
                detected_provider = detect_provider_from_model_id(original_model)
                if detected_provider:
                    provider = detected_provider
                    # Normalize provider aliases
                    if provider == "hug":
                        provider = "huggingface"
                    logger.info(
                        "Auto-detected provider '%s' for model %s",
                        sanitize_for_logging(provider),
                        sanitize_for_logging(original_model),
                    )
                else:
                    # Fallback to checking cached models
                    from src.services.models import get_cached_models

                    # Try each provider with transformation
                    for test_provider in [
                        "huggingface",
                        "featherless",
                        "fireworks",
                        "together",
                        "google-vertex",
                    ]:
                        transformed = transform_model_id(original_model, test_provider)
                        provider_models = get_cached_models(test_provider) or []
                        if any(m.get("id") == transformed for m in provider_models):
                            provider = test_provider
                            logger.info(
                                f"Auto-detected provider '{provider}' for model {original_model} (transformed to {transformed})"
                            )
                            break
                    # Otherwise default to openrouter (already set)

            provider_chain = build_provider_failover_chain(provider)
            model = original_model

        # Diagnostic logging for tools parameter
        if "tools" in optional:
            logger.info(
                "Tools parameter detected: tools_count=%d, provider=%s, model=%s",
                len(optional["tools"]) if isinstance(optional["tools"], list) else 0,
                sanitize_for_logging(provider),
                sanitize_for_logging(original_model),
            )
            logger.debug("Tools content: %s", sanitize_for_logging(str(optional["tools"])[:500]))

        # === 3) Call upstream (streaming or non-streaming) ===
        if req.stream:
            last_http_exc = None
            for idx, attempt_provider in enumerate(provider_chain):
                attempt_model = transform_model_id(original_model, attempt_provider)
                if attempt_model != original_model:
                    logger.info(
                        f"Transformed model ID from '{original_model}' to '{attempt_model}' for provider {attempt_provider}"
                    )

                request_model = attempt_model
                try:
                    if attempt_provider == "featherless":
                        stream = await _to_thread(
                            make_featherless_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "fireworks":
                        stream = await _to_thread(
                            make_fireworks_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "together":
                        stream = await _to_thread(
                            make_together_request_openai_stream, messages, request_model, **optional
                        )
                    elif attempt_provider == "huggingface":
                        stream = await _to_thread(
                            make_huggingface_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "aimo":
                        stream = await _to_thread(
                            make_aimo_request_openai_stream, messages, request_model, **optional
                        )
                    elif attempt_provider == "xai":
                        stream = await _to_thread(
                            make_xai_request_openai_stream, messages, request_model, **optional
                        )
                    elif attempt_provider == "cerebras":
                        stream = await _to_thread(
                            make_cerebras_request_openai_stream, messages, request_model, **optional
                        )
                    elif attempt_provider == "chutes":
                        stream = await _to_thread(
                            make_chutes_request_openai_stream, messages, request_model, **optional
                        )
                    elif attempt_provider == "near":
                        stream = await _to_thread(
                            make_near_request_openai_stream, messages, request_model, **optional
                        )
                    elif attempt_provider == "google-vertex":
                        stream = await _to_thread(
                            make_google_vertex_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "vercel-ai-gateway":
                        stream = await _to_thread(
                            make_vercel_ai_gateway_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "helicone":
                        stream = await _to_thread(
                            make_helicone_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "aihubmix":
                        stream = await _to_thread(
                            make_aihubmix_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "anannas":
                        stream = await _to_thread(
                            make_anannas_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "alpaca-network":
                        stream = await _to_thread(
                            make_alpaca_network_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "alibaba-cloud":
                        stream = await _to_thread(
                            make_alibaba_cloud_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "clarifai":
                        stream = await _to_thread(
                            make_clarifai_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    else:
                        stream = await _to_thread(
                            make_openrouter_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )

                    provider = attempt_provider
                    model = request_model
                    # Get rate limit headers if available (pre-stream check)
                    stream_headers = {}
                    if rl_pre is not None:
                        stream_headers.update(get_rate_limit_headers(rl_pre))

                    return StreamingResponse(
                        stream_generator(
                            stream,
                            user,
                            api_key,
                            model,
                            trial,
                            environment_tag,
                            session_id,
                            messages,
                            rate_limit_mgr,
                            provider,
                            tracker,
                        ),
                        media_type="text/event-stream",
                        headers=stream_headers,
                    )
                except Exception as exc:
                    if isinstance(exc, (httpx.TimeoutException, asyncio.TimeoutError)):
                        logger.warning("Upstream timeout (%s): %s", attempt_provider, exc)
                    elif isinstance(exc, httpx.RequestError):
                        logger.warning("Upstream network error (%s): %s", attempt_provider, exc)
                    elif isinstance(exc, httpx.HTTPStatusError):
                        logger.debug(
                            "Upstream HTTP error (%s): %s",
                            attempt_provider,
                            exc.response.status_code,
                        )
                    else:
                        logger.error("Unexpected upstream error (%s): %s", attempt_provider, exc)
                    http_exc = map_provider_error(attempt_provider, request_model, exc)

                    last_http_exc = http_exc
                    if idx < len(provider_chain) - 1 and should_failover(http_exc):
                        next_provider = provider_chain[idx + 1]
                        logger.warning(
                            "Provider '%s' failed with status %s (%s). Falling back to '%s'.",
                            attempt_provider,
                            http_exc.status_code,
                            http_exc.detail,
                            next_provider,
                        )
                        continue

                    raise http_exc

            raise last_http_exc or HTTPException(status_code=502, detail="Upstream error")

        # Non-streaming response
        start = time.monotonic()
        processed = None
        last_http_exc = None

        for idx, attempt_provider in enumerate(provider_chain):
            attempt_model = transform_model_id(original_model, attempt_provider)
            if attempt_model != original_model:
                logger.info(
                    f"Transformed model ID from '{original_model}' to '{attempt_model}' for provider {attempt_provider}"
                )

            request_model = attempt_model
            request_timeout = PROVIDER_TIMEOUTS.get(attempt_provider, DEFAULT_PROVIDER_TIMEOUT)
            if request_timeout != DEFAULT_PROVIDER_TIMEOUT:
                logger.debug(
                    "Using extended timeout %ss for provider %s", request_timeout, attempt_provider
                )

            try:
                if attempt_provider == "featherless":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_featherless_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_featherless_response, resp_raw)
                elif attempt_provider == "fireworks":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_fireworks_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_fireworks_response, resp_raw)
                elif attempt_provider == "together":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_together_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_together_response, resp_raw)
                elif attempt_provider == "huggingface":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_huggingface_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_huggingface_response, resp_raw)
                elif attempt_provider == "aimo":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(make_aimo_request_openai, messages, request_model, **optional),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_aimo_response, resp_raw)
                elif attempt_provider == "xai":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(make_xai_request_openai, messages, request_model, **optional),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_xai_response, resp_raw)
                elif attempt_provider == "cerebras":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_cerebras_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_cerebras_response, resp_raw)
                elif attempt_provider == "chutes":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(make_chutes_request_openai, messages, request_model, **optional),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_chutes_response, resp_raw)
                elif attempt_provider == "near":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(make_near_request_openai, messages, request_model, **optional),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_near_response, resp_raw)
                elif attempt_provider == "google-vertex":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_google_vertex_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_google_vertex_response, resp_raw)
                elif attempt_provider == "vercel-ai-gateway":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_vercel_ai_gateway_request_openai,
                            messages,
                            request_model,
                            **optional,
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_vercel_ai_gateway_response, resp_raw)
                elif attempt_provider == "helicone":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_helicone_request_openai,
                            messages,
                            request_model,
                            **optional,
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_helicone_response, resp_raw)
                elif attempt_provider == "aihubmix":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_aihubmix_request_openai,
                            messages,
                            request_model,
                            **optional,
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_aihubmix_response, resp_raw)
                elif attempt_provider == "anannas":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_anannas_request_openai,
                            messages,
                            request_model,
                            **optional,
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_anannas_response, resp_raw)
                elif attempt_provider == "alpaca-network":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_alpaca_network_request_openai,
                            messages,
                            request_model,
                            **optional,
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_alpaca_network_response, resp_raw)
                elif attempt_provider == "alibaba-cloud":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_alibaba_cloud_request_openai,
                            messages,
                            request_model,
                            **optional,
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_alibaba_cloud_response, resp_raw)
                elif attempt_provider == "clarifai":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_clarifai_request_openai,
                            messages,
                            request_model,
                            **optional,
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_clarifai_response, resp_raw)
                else:
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_openrouter_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_openrouter_response, resp_raw)

                provider = attempt_provider
                model = request_model
                break
            except Exception as exc:
                if isinstance(exc, (httpx.TimeoutException, asyncio.TimeoutError)):
                    logger.warning("Upstream timeout (%s): %s", attempt_provider, exc)
                elif isinstance(exc, httpx.RequestError):
                    logger.warning("Upstream network error (%s): %s", attempt_provider, exc)
                elif isinstance(exc, httpx.HTTPStatusError):
                    logger.debug(
                        "Upstream HTTP error (%s): %s", attempt_provider, exc.response.status_code
                    )
                else:
                    logger.error("Unexpected upstream error (%s): %s", attempt_provider, exc)
                http_exc = map_provider_error(attempt_provider, request_model, exc)

                last_http_exc = http_exc
                if idx < len(provider_chain) - 1 and should_failover(http_exc):
                    next_provider = provider_chain[idx + 1]
                    logger.warning(
                        "Provider '%s' failed with status %s (%s). Falling back to '%s'.",
                        attempt_provider,
                        http_exc.status_code,
                        http_exc.detail,
                        next_provider,
                    )
                    continue

                raise http_exc

        if processed is None:
            raise last_http_exc or HTTPException(status_code=502, detail="Upstream error")

        elapsed = max(0.001, time.monotonic() - start)

        # === 4) Usage, pricing, final checks ===
        usage = processed.get("usage", {}) or {}
        total_tokens = usage.get("total_tokens", 0)
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)

        post_plan = await _to_thread(enforce_plan_limits, user["id"], total_tokens, environment_tag)
        if not post_plan.get("allowed", False):
            raise HTTPException(
                status_code=429, detail=f"Plan limit exceeded: {post_plan.get('reason', 'unknown')}"
            )

        if trial.get("is_trial") and not trial.get("is_expired"):
            try:
                await _to_thread(track_trial_usage, api_key, total_tokens, 1)
            except Exception as e:
                logger.warning("Failed to track trial usage: %s", e)

        if should_release_concurrency and rate_limit_mgr and not disable_rate_limiting:
            try:
                await rate_limit_mgr.release_concurrency(api_key)
            except Exception as exc:
                logger.debug(
                    "Failed to release concurrency before final check for %s: %s",
                    mask_key(api_key),
                    exc,
                )
            rl_final = await rate_limit_mgr.check_rate_limit(api_key, tokens_used=total_tokens)
            if not rl_final.allowed:
                await _to_thread(
                    create_rate_limit_alert,
                    api_key,
                    "rate_limit_exceeded",
                    {
                        "reason": rl_final.reason,
                        "retry_after": rl_final.retry_after,
                        "remaining_requests": rl_final.remaining_requests,
                        "remaining_tokens": rl_final.remaining_tokens,
                        "tokens_requested": total_tokens,
                    },
                )
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: {rl_final.reason}",
                    headers=(
                        {"Retry-After": str(rl_final.retry_after)} if rl_final.retry_after else None
                    ),
                )

        cost = calculate_cost(model, prompt_tokens, completion_tokens)
        is_trial = trial.get("is_trial", False)

        if is_trial:
            # Log transaction for trial users (with $0 cost)
            try:
                await _to_thread(
                    log_api_usage_transaction,
                    api_key,
                    0.0,
                    f"API usage - {model} (Trial)",
                    {
                        "model": model,
                        "total_tokens": total_tokens,
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "cost_usd": 0.0,
                        "is_trial": True,
                    },
                    True,
                )
            except Exception as e:
                logger.error(f"Failed to log trial API usage transaction: {e}", exc_info=True)
        else:
            # For non-trial users, deduct credits
            try:
                await _to_thread(
                    deduct_credits,
                    api_key,
                    cost,
                    f"API usage - {model}",
                    {
                        "model": model,
                        "total_tokens": total_tokens,
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "cost_usd": cost,
                    },
                )
                await _to_thread(
                    record_usage,
                    user["id"],
                    api_key,
                    model,
                    total_tokens,
                    cost,
                    int(elapsed * 1000),
                )
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
                    "gateway": provider,  # Track which gateway was used
                },
            )
        except Exception as e:
            logger.error(
                f"Failed to log activity for user {user['id']}, model {model}: {e}", exc_info=True
            )

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
                        await _to_thread(
                            save_chat_message,
                            session_id,
                            "user",
                            last_user.get("content", ""),
                            model,
                            0,
                            user["id"],
                        )

                    assistant_content = (
                        processed.get("choices", [{}])[0].get("message", {}).get("content", "")
                    )
                    if assistant_content:
                        await _to_thread(
                            save_chat_message,
                            session_id,
                            "assistant",
                            assistant_content,
                            model,
                            total_tokens,
                            user["id"],
                        )
                else:
                    logger.warning("Session %s not found for user %s", session_id, user["id"])
            except Exception as e:
                logger.error(
                    f"Failed to save chat history for session {session_id}, user {user['id']}: {e}",
                    exc_info=True,
                )

        # === 6) Attach gateway usage (non-sensitive) ===
        processed.setdefault("gateway_usage", {})
        processed["gateway_usage"].update(
            {
                "tokens_charged": total_tokens,
                "request_ms": int(elapsed * 1000),
            }
        )
        if not trial.get("is_trial", False):
            # If you can cheaply re-fetch balance, do it here; otherwise omit
            processed["gateway_usage"]["cost_usd"] = round(cost, 6)

        # === 7) Log to Braintrust ===
        try:
            messages_for_log = [
                m.model_dump() if hasattr(m, "model_dump") else m for m in req.messages
            ]
            span.log(
                input=messages_for_log,
                output=processed.get("choices", [{}])[0].get("message", {}).get("content", ""),
                metrics={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                    "latency_ms": int(elapsed * 1000),
                    "cost_usd": cost if not trial.get("is_trial", False) else 0.0,
                },
                metadata={
                    "model": model,
                    "provider": provider,
                    "user_id": user["id"],
                    "session_id": session_id,
                    "is_trial": trial.get("is_trial", False),
                    "environment": user.get("environment_tag", "live"),
                },
            )
            span.end()
        except Exception as e:
            logger.warning(f"Failed to log to Braintrust: {e}")

        # Prepare headers including rate limit information
        headers = {}
        if rl_final is not None:
            headers.update(get_rate_limit_headers(rl_final))

        return JSONResponse(content=processed, headers=headers)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"[{request_id}] Unhandled server error: {type(e).__name__}",
            extra={"request_id": request_id, "error_type": type(e).__name__},
        )
        # Don't leak internal details, but include request ID for support
        raise HTTPException(
            status_code=500, detail=f"Internal server error (request ID: {request_id})"
        )


@router.post("/v1/responses", tags=["chat"])
@traced(name="unified_responses", type="llm")
async def unified_responses(
    req: ResponseRequest,
    background_tasks: BackgroundTasks,
    api_key: str = Depends(get_api_key),
    session_id: Optional[int] = Query(None, description="Chat session ID to save messages to"),
    request: Request = None,
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
    if Config.IS_TESTING and request:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            api_key = auth_header.split(" ", 1)[1].strip()

    logger.info("unified_responses start (api_key=%s, model=%s)", mask_key(api_key), req.model)

    # Start Braintrust span for this request
    span = start_span(name=f"responses_{req.model}", type="llm")

    rate_limit_mgr = None
    should_release_concurrency = False
    stream_release_handled = False

    try:
        # === 1) User + plan/trial prechecks ===
        user = await _to_thread(get_user, api_key)
        if not user and not Config.IS_TESTING:
            logger.debug("Fallback user lookup invoked for %s", mask_key(api_key))
            user = await _to_thread(_fallback_get_user, api_key)
        if not user:
            logger.warning("Invalid API key or user not found for key %s", mask_key(api_key))
            raise HTTPException(status_code=401, detail="Invalid API key")

        environment_tag = user.get("environment_tag", "live")

        # Only validate trial access (plan limits checked after token usage known)
        trial = await _to_thread(validate_trial_access, api_key)
        if not trial.get("is_valid", False):
            if trial.get("is_trial") and trial.get("is_expired"):
                raise HTTPException(
                    status_code=403,
                    detail=trial["error"],
                    headers={
                        "X-Trial-Expired": "true",
                        "X-Trial-End-Date": trial.get("trial_end_date", ""),
                    },
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
                await _to_thread(
                    create_rate_limit_alert,
                    api_key,
                    "rate_limit_exceeded",
                    {
                        "reason": rl_pre.reason,
                        "retry_after": rl_pre.retry_after,
                        "remaining_requests": rl_pre.remaining_requests,
                        "remaining_tokens": rl_pre.remaining_tokens,
                    },
                )
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: {rl_pre.reason}",
                    headers=(
                        {"Retry-After": str(rl_pre.retry_after)} if rl_pre.retry_after else None
                    ),
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
                                transformed_content.append(
                                    {"type": "text", "text": item.get("text", "")}
                                )
                            elif item.get("type") == "input_image_url":
                                transformed_content.append(
                                    {"type": "image_url", "image_url": item.get("image_url", {})}
                                )
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
                    raise HTTPException(
                        status_code=400, detail=f"Invalid content type: {type(inp_msg.content)}"
                    )
        except Exception as e:
            logger.error(f"Error transforming input to messages: {e}, input: {req.input}")
            raise HTTPException(status_code=400, detail=f"Invalid input format: {str(e)}")

        # === 2.1) Inject conversation history if session_id provided ===
        if session_id:
            try:
                session = await _to_thread(get_chat_session, session_id, user["id"])
                if session and session.get("messages"):
                    history_messages = [
                        {"role": msg["role"], "content": msg["content"]}
                        for msg in session["messages"]
                    ]
                    messages = history_messages + messages
                    logger.info(
                        "Injected %d messages from session %s",
                        len(history_messages),
                        sanitize_for_logging(str(session_id)),
                    )
            except Exception as e:
                logger.warning(
                    "Failed to fetch chat history for session %s: %s",
                    sanitize_for_logging(str(session_id)),
                    sanitize_for_logging(str(e)),
                )

        # Store original model for response
        original_model = req.model

        optional = {}
        for name in (
            "max_tokens",
            "temperature",
            "top_p",
            "frequency_penalty",
            "presence_penalty",
            "tools",
        ):
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
                    "json_schema": req.response_format.json_schema,
                }

        # Auto-detect provider if not specified
        req_provider_missing = req.provider is None or (
            isinstance(req.provider, str) and not req.provider
        )
        provider = (req.provider or "openrouter").lower()

        # Normalize provider aliases
        if provider == "hug":
            provider = "huggingface"

        override_provider = detect_provider_from_model_id(original_model)
        if override_provider:
            override_provider = override_provider.lower()
            if override_provider == "hug":
                override_provider = "huggingface"
            if override_provider != provider:
                logger.info(
                    f"Provider override applied for model {original_model}: '{provider}' -> '{override_provider}'"
                )
                provider = override_provider
            # Mark provider as determined even if it matches the default
            # This prevents the fallback logic from incorrectly routing to wrong providers
            req_provider_missing = False

        if req_provider_missing:
            # Try to detect provider from model ID using the transformation module
            detected_provider = detect_provider_from_model_id(original_model)
            if detected_provider:
                provider = detected_provider
                logger.info(
                    "Auto-detected provider '%s' for model %s",
                    sanitize_for_logging(provider),
                    sanitize_for_logging(original_model),
                )
            else:
                # Fallback to checking cached models
                from src.services.models import get_cached_models

                # Try each provider with transformation
                for test_provider in [
                    "huggingface",
                    "featherless",
                    "fireworks",
                    "together",
                    "google-vertex",
                ]:
                    transformed = transform_model_id(original_model, test_provider)
                    provider_models = get_cached_models(test_provider) or []
                    if any(m.get("id") == transformed for m in provider_models):
                        provider = test_provider
                        logger.info(
                            "Auto-detected provider '%s' for model %s (transformed to %s)",
                            sanitize_for_logging(provider),
                            sanitize_for_logging(original_model),
                            sanitize_for_logging(transformed),
                        )
                        break

        provider_chain = build_provider_failover_chain(provider)
        model = original_model

        # Diagnostic logging for tools parameter
        if "tools" in optional:
            logger.info(
                "Tools parameter detected (unified_responses): tools_count=%d, provider=%s, model=%s",
                len(optional["tools"]) if isinstance(optional["tools"], list) else 0,
                sanitize_for_logging(provider),
                sanitize_for_logging(original_model),
            )
            logger.debug("Tools content: %s", sanitize_for_logging(str(optional["tools"])[:500]))

        # === 3) Call upstream (streaming or non-streaming) ===
        if req.stream:
            last_http_exc = None
            for idx, attempt_provider in enumerate(provider_chain):
                attempt_model = transform_model_id(original_model, attempt_provider)
                if attempt_model != original_model:
                    logger.info(
                        f"Transformed model ID from '{original_model}' to '{attempt_model}' for provider {attempt_provider}"
                    )

                request_model = attempt_model
                http_exc = None
                try:
                    if attempt_provider == "featherless":
                        stream = await _to_thread(
                            make_featherless_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "fireworks":
                        stream = await _to_thread(
                            make_fireworks_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "together":
                        stream = await _to_thread(
                            make_together_request_openai_stream, messages, request_model, **optional
                        )
                    elif attempt_provider == "huggingface":
                        stream = await _to_thread(
                            make_huggingface_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )
                    elif attempt_provider == "aimo":
                        stream = await _to_thread(
                            make_aimo_request_openai_stream, messages, request_model, **optional
                        )
                    elif attempt_provider == "xai":
                        stream = await _to_thread(
                            make_xai_request_openai_stream, messages, request_model, **optional
                        )
                    elif attempt_provider == "cerebras":
                        stream = await _to_thread(
                            make_cerebras_request_openai_stream, messages, request_model, **optional
                        )
                    elif attempt_provider == "chutes":
                        stream = await _to_thread(
                            make_chutes_request_openai_stream, messages, request_model, **optional
                        )
                    else:
                        stream = await _to_thread(
                            make_openrouter_request_openai_stream,
                            messages,
                            request_model,
                            **optional,
                        )

                    async def response_stream_generator():
                        """Transform chat/completions stream to responses format with usage tracking"""
                        async for chunk_data in stream_generator(
                            stream,
                            user,
                            api_key,
                            request_model,
                            trial,
                            environment_tag,
                            session_id,
                            messages,
                            rate_limit_mgr,
                            provider="openrouter",
                            tracker=None,
                        ):
                            if chunk_data.startswith("data: "):
                                data_str = chunk_data[6:].strip()
                                if data_str == "[DONE]":
                                    yield chunk_data
                                    continue

                                try:
                                    chunk_json = json.loads(data_str)
                                    if "choices" in chunk_json:
                                        output = []
                                        for choice in chunk_json["choices"]:
                                            output_item = {"index": choice.get("index", 0)}
                                            if "delta" in choice:
                                                if "role" in choice["delta"]:
                                                    output_item["role"] = choice["delta"]["role"]
                                                if "content" in choice["delta"]:
                                                    output_item["content"] = choice["delta"][
                                                        "content"
                                                    ]
                                            if choice.get("finish_reason"):
                                                output_item["finish_reason"] = choice[
                                                    "finish_reason"
                                                ]
                                            output.append(output_item)

                                        transformed_chunk = {
                                            "id": chunk_json.get("id"),
                                            "object": "response.chunk",
                                            "created": chunk_json.get("created"),
                                            "model": chunk_json.get("model"),
                                            "output": output,
                                        }
                                        yield f"data: {json.dumps(transformed_chunk)}\n\n"
                                    else:
                                        yield chunk_data
                                except json.JSONDecodeError:
                                    yield chunk_data
                            else:
                                yield chunk_data

                    stream_release_handled = True
                    provider = attempt_provider
                    model = request_model
                    return StreamingResponse(
                        response_stream_generator(),
                        media_type="text/event-stream",
                    )
                except Exception as exc:
                    http_exc = map_provider_error(attempt_provider, request_model, exc)

                if http_exc is None:
                    continue

                last_http_exc = http_exc
                if idx < len(provider_chain) - 1 and should_failover(http_exc):
                    next_provider = provider_chain[idx + 1]
                    logger.warning(
                        "Provider '%s' failed with status %s (%s). Falling back to '%s'.",
                        attempt_provider,
                        http_exc.status_code,
                        http_exc.detail,
                        next_provider,
                    )
                    continue

                raise http_exc

            raise last_http_exc or HTTPException(status_code=502, detail="Upstream error")

        # Non-streaming response
        start = time.monotonic()
        processed = None
        last_http_exc = None

        for idx, attempt_provider in enumerate(provider_chain):
            attempt_model = transform_model_id(original_model, attempt_provider)
            if attempt_model != original_model:
                logger.info(
                    f"Transformed model ID from '{original_model}' to '{attempt_model}' for provider {attempt_provider}"
                )

            request_model = attempt_model
            request_timeout = PROVIDER_TIMEOUTS.get(attempt_provider, DEFAULT_PROVIDER_TIMEOUT)
            if request_timeout != DEFAULT_PROVIDER_TIMEOUT:
                logger.debug(
                    "Using extended timeout %ss for provider %s", request_timeout, attempt_provider
                )

            http_exc = None
            try:
                if attempt_provider == "featherless":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_featherless_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_featherless_response, resp_raw)
                elif attempt_provider == "fireworks":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_fireworks_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_fireworks_response, resp_raw)
                elif attempt_provider == "together":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_together_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_together_response, resp_raw)
                elif attempt_provider == "huggingface":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_huggingface_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_huggingface_response, resp_raw)
                elif attempt_provider == "aimo":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(make_aimo_request_openai, messages, request_model, **optional),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_aimo_response, resp_raw)
                elif attempt_provider == "xai":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(make_xai_request_openai, messages, request_model, **optional),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_xai_response, resp_raw)
                elif attempt_provider == "cerebras":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_cerebras_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_cerebras_response, resp_raw)
                elif attempt_provider == "chutes":
                    resp_raw = await asyncio.wait_for(
                        _to_thread(make_chutes_request_openai, messages, request_model, **optional),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_chutes_response, resp_raw)
                else:
                    resp_raw = await asyncio.wait_for(
                        _to_thread(
                            make_openrouter_request_openai, messages, request_model, **optional
                        ),
                        timeout=request_timeout,
                    )
                    processed = await _to_thread(process_openrouter_response, resp_raw)

                provider = attempt_provider
                model = request_model
                break
            except Exception as exc:
                http_exc = map_provider_error(attempt_provider, request_model, exc)

            if http_exc is None:
                continue

            last_http_exc = http_exc
            if idx < len(provider_chain) - 1 and should_failover(http_exc):
                next_provider = provider_chain[idx + 1]
                logger.warning(
                    "Provider '%s' failed with status %s (%s). Falling back to '%s'.",
                    attempt_provider,
                    http_exc.status_code,
                    http_exc.detail,
                    next_provider,
                )
                continue

            raise http_exc

        if processed is None:
            raise last_http_exc or HTTPException(status_code=502, detail="Upstream error")

        elapsed = max(0.001, time.monotonic() - start)

        # === 4) Usage, pricing, final checks ===
        usage = processed.get("usage", {}) or {}
        total_tokens = usage.get("total_tokens", 0)
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)

        post_plan = await _to_thread(enforce_plan_limits, user["id"], total_tokens, environment_tag)
        if not post_plan.get("allowed", False):
            raise HTTPException(
                status_code=429, detail=f"Plan limit exceeded: {post_plan.get('reason', 'unknown')}"
            )

        if trial.get("is_trial") and not trial.get("is_expired"):
            try:
                await _to_thread(track_trial_usage, api_key, total_tokens, 1)
            except Exception as e:
                logger.warning("Failed to track trial usage: %s", e)

        if not trial.get("is_trial", False):
            rl_final = await rate_limit_mgr.check_rate_limit(api_key, tokens_used=total_tokens)
            if not rl_final.allowed:
                await _to_thread(
                    create_rate_limit_alert,
                    api_key,
                    "rate_limit_exceeded",
                    {
                        "reason": rl_final.reason,
                        "retry_after": rl_final.retry_after,
                        "remaining_requests": rl_final.remaining_requests,
                        "remaining_tokens": rl_final.remaining_tokens,
                        "tokens_requested": total_tokens,
                    },
                )
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: {rl_final.reason}",
                    headers=(
                        {"Retry-After": str(rl_final.retry_after)} if rl_final.retry_after else None
                    ),
                )

        cost = calculate_cost(model, prompt_tokens, completion_tokens)
        is_trial = trial.get("is_trial", False)

        if is_trial:
            # Log transaction for trial users (with $0 cost)
            try:
                await _to_thread(
                    log_api_usage_transaction,
                    api_key,
                    0.0,
                    f"API usage - {model} (Trial)",
                    {
                        "model": model,
                        "total_tokens": total_tokens,
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "cost_usd": 0.0,
                        "is_trial": True,
                    },
                    True,
                )
            except Exception as e:
                logger.error(f"Failed to log trial API usage transaction: {e}", exc_info=True)
        else:
            # For non-trial users, deduct credits
            try:
                await _to_thread(
                    deduct_credits,
                    api_key,
                    cost,
                    f"API usage - {model}",
                    {
                        "model": model,
                        "total_tokens": total_tokens,
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "cost_usd": cost,
                    },
                )
                await _to_thread(
                    record_usage,
                    user["id"],
                    api_key,
                    model,
                    total_tokens,
                    cost,
                    int(elapsed * 1000),
                )
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
                    "gateway": provider,  # Track which gateway was used
                },
            )
        except Exception as e:
            logger.error(
                f"Failed to log activity for user {user['id']}, model {model}: {e}", exc_info=True
            )

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
                            user_content = (
                                " ".join(text_parts) if text_parts else "[multimodal content]"
                            )

                        await _to_thread(
                            save_chat_message,
                            session_id,
                            "user",
                            user_content,
                            model,
                            0,
                            user["id"],
                        )

                    assistant_content = (
                        processed.get("choices", [{}])[0].get("message", {}).get("content", "")
                    )
                    if assistant_content:
                        await _to_thread(
                            save_chat_message,
                            session_id,
                            "assistant",
                            assistant_content,
                            model,
                            total_tokens,
                            user["id"],
                        )
            except Exception as e:
                logger.error(
                    f"Failed to save chat history for session {session_id}, user {user['id']}: {e}",
                    exc_info=True,
                )

        # === 6) Transform response format: choices -> output ===
        output = []
        for choice in processed.get("choices", []):
            output_item = {
                "index": choice.get("index", 0),
                "finish_reason": choice.get("finish_reason"),
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
            "usage": usage,
        }

        # Add gateway usage metadata
        response["gateway_usage"] = {
            "tokens_charged": total_tokens,
            "request_ms": int(elapsed * 1000),
        }
        if not trial.get("is_trial", False):
            response["gateway_usage"]["cost_usd"] = round(cost, 6)

        # === 7) Log to Braintrust ===
        try:
            # Convert input messages to loggable format
            input_messages = []
            for inp_msg in req.input:
                if isinstance(inp_msg.content, str):
                    input_messages.append({"role": inp_msg.role, "content": inp_msg.content})
                else:
                    input_messages.append({"role": inp_msg.role, "content": str(inp_msg.content)})

            span.log(
                input=input_messages,
                output=response["output"][0].get("content", "") if response["output"] else "",
                metrics={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                    "latency_ms": int(elapsed * 1000),
                    "cost_usd": cost if not trial.get("is_trial", False) else 0.0,
                },
                metadata={
                    "model": model,
                    "provider": provider,
                    "user_id": user["id"],
                    "session_id": session_id,
                    "is_trial": trial.get("is_trial", False),
                    "environment": user.get("environment_tag", "live"),
                    "endpoint": "/v1/responses",
                },
            )
            span.end()
        except Exception as e:
            logger.warning(f"Failed to log to Braintrust: {e}")

        return response

    except HTTPException:
        raise
    except Exception:
        logger.exception("Unhandled server error in unified_responses")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if (
            should_release_concurrency
            and rate_limit_mgr
            and (not req.stream or not stream_release_handled)
        ):
            try:
                await rate_limit_mgr.release_concurrency(api_key)
            except Exception as exc:
                logger.debug("Failed to release concurrency for %s: %s", mask_key(api_key), exc)


# Log successful module load - this should appear in startup logs if chat.py loads correctly
logger.info("✅ Chat module fully loaded - all routes registered successfully")
logger.info(f"   Total routes in router: {len(router.routes)}")

# Log any provider import errors that occurred during safe imports
if _provider_import_errors:
    logger.warning(f"⚠  Provider import warnings ({len(_provider_import_errors)} failed):")
    for provider_name, error_msg in _provider_import_errors.items():
        logger.warning(f"     - {provider_name}: {error_msg}")
else:
    logger.info("✓ All provider clients loaded successfully")
