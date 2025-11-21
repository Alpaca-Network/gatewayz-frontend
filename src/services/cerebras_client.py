"""
Cerebras client for direct API integration.

This client uses the official cerebras-cloud-sdk to interact with Cerebras AI models.
Falls back to OpenAI SDK with custom base URL if the official SDK is not available.
"""

from __future__ import annotations

from datetime import UTC, datetime
import logging
from typing import Any

from src.cache import _cerebras_models_cache

# Initialize logging
logger = logging.getLogger(__name__)

DEFAULT_CEREBRAS_MODELS: list[dict[str, Any]] = [
    {
        "id": "llama3.1-8b",
        "name": "Llama 3.1 8B",
        "owned_by": "meta",
        "context_length": 131072,
    },
    {
        "id": "llama3.1-70b",
        "name": "Llama 3.1 70B",
        "owned_by": "meta",
        "context_length": 131072,
    },
    {
        "id": "llama3.1-405b",
        "name": "Llama 3.1 405B",
        "owned_by": "meta",
        "context_length": 131072,
    },
    {
        "id": "llama-3.3-70b",
        "name": "Llama 3.3 70B",
        "owned_by": "meta",
        "context_length": 131072,
    },
    {
        "id": "llama-3.3-405b",
        "name": "Llama 3.3 405B",
        "owned_by": "meta",
        "context_length": 131072,
    },
]

DEFAULT_SUPPORTED_PARAMETERS = [
    "max_tokens",
    "temperature",
    "top_p",
    "top_k",
    "frequency_penalty",
    "presence_penalty",
    "stream",
]


def get_cerebras_client():
    """Get Cerebras client using official cerebras-cloud-sdk

    Cerebras provides ultra-fast inference through their official SDK.
    Falls back to OpenAI SDK with custom base URL if official SDK is not available.
    Base URL (for OpenAI SDK fallback): https://api.cerebras.ai/v1
    """
    try:
        # Lazy import to avoid circular dependencies
        from src.config import Config

        if not Config.CEREBRAS_API_KEY:
            raise ValueError("Cerebras API key not configured")

        # Try using the official Cerebras SDK first
        try:
            from cerebras.cloud.sdk import Cerebras

            return Cerebras(api_key=Config.CEREBRAS_API_KEY)
        except ImportError:
            # Fallback to OpenAI SDK with Cerebras base URL
            logger.info("Cerebras SDK not available, using OpenAI SDK with Cerebras base URL")
            from openai import OpenAI

            return OpenAI(base_url="https://api.cerebras.ai/v1", api_key=Config.CEREBRAS_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Cerebras client: {e}")
        raise


def make_cerebras_request_openai(messages, model, **kwargs):
    """Make request to Cerebras using official SDK or OpenAI-compatible client

    Args:
        messages: List of message objects
        model: Model name (e.g., "llama3.1-8b", "llama-3.3-70b", etc.)
        **kwargs: Additional parameters like max_tokens, temperature, etc.

    Returns:
        Response object from Cerebras API
    """
    try:
        client = get_cerebras_client()

        # Log request for debugging
        logger.debug(f"Cerebras request - model: {model}, messages: {len(messages)}")

        response = client.chat.completions.create(model=model, messages=messages, **kwargs)

        return response
    except Exception as e:
        logger.error(f"Cerebras request failed: {e}")
        raise


def make_cerebras_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Cerebras using official SDK or OpenAI-compatible client

    Args:
        messages: List of message objects
        model: Model name (e.g., "llama3.1-8b", "llama-3.3-70b", etc.)
        **kwargs: Additional parameters like max_tokens, temperature, etc.

    Returns:
        Streaming response generator from Cerebras API
    """
    try:
        client = get_cerebras_client()

        # Log request for debugging
        logger.debug(f"Cerebras streaming request - model: {model}, messages: {len(messages)}")

        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )

        return stream
    except Exception as e:
        logger.error(f"Cerebras streaming request failed: {e}")
        raise


def process_cerebras_response(response):
    """Process Cerebras response to extract relevant data

    Args:
        response: Response object from Cerebras API

    Returns:
        Standardized response dictionary
    """
    try:
        # Lazy import to avoid circular dependencies
        from src.services.anthropic_transformer import extract_message_with_tools

        choices = []
        for choice in response.choices:
            msg = extract_message_with_tools(choice.message)

            choices.append(
                {
                    "index": choice.index,
                    "message": msg,
                    "finish_reason": choice.finish_reason,
                }
            )

        return {
            "id": response.id,
            "object": response.object,
            "created": response.created,
            "model": response.model,
            "choices": choices,
            "usage": (
                {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }
                if response.usage
                else {}
            ),
        }
    except Exception as e:
        logger.error(f"Failed to process Cerebras response: {e}")
        raise


def fetch_models_from_cerebras():
    """Fetch and normalize models from Cerebras.

    The Cerebras SDK exposes a models.list endpoint that mirrors OpenAI's shape.
    We normalize that response so the catalog can display Cerebras models just like
    other gateways, and we fall back to a static catalog if the live fetch fails.
    """

    def _cache_and_return(models: list[dict[str, Any]]) -> list[dict[str, Any]]:
        _cerebras_models_cache["data"] = models
        _cerebras_models_cache["timestamp"] = datetime.now(UTC)
        return models

    try:
        client = get_cerebras_client()
    except Exception as exc:
        logger.error(f"Unable to initialize Cerebras client for catalog fetch: {exc}")
        fallback = _fallback_cerebras_models("client_init_failed")
        return _cache_and_return(fallback) if fallback else None

    try:
        response = client.models.list()
    except Exception as exc:
        logger.error(f"Cerebras models.list() failed: {exc}")
        fallback = _fallback_cerebras_models("api_error")
        return _cache_and_return(fallback) if fallback else None

    raw_models = _extract_models_from_response(response)
    normalized_models = [
        model for model in (_normalize_cerebras_model(entry) for entry in raw_models) if model
    ]

    if not normalized_models:
        logger.warning("Cerebras API returned zero models; falling back to static catalog")
        fallback = _fallback_cerebras_models("empty_response")
        return _cache_and_return(fallback) if fallback else None

    logger.info("Fetched %s Cerebras models from live API", len(normalized_models))
    return _cache_and_return(normalized_models)


def _fallback_cerebras_models(reason: str) -> list[dict[str, Any]] | None:
    logger.warning("Using static Cerebras model catalog (%s)", reason)
    normalized = [
        model for model in (_normalize_cerebras_model(entry) for entry in DEFAULT_CEREBRAS_MODELS) if model
    ]
    return normalized or None


def _extract_models_from_response(response: Any) -> list[Any]:
    """
    Coerce whatever the Cerebras/OpenAI SDK returns (SyncPage, list, dict, etc.)
    into a plain list of model payloads.
    """

    if response is None:
        return []

    for attr in ("data", "models", "items"):
        if hasattr(response, attr):
            data = getattr(response, attr)
            return _coerce_sequence(data)

    if isinstance(response, dict):
        for key in ("data", "models", "items"):
            if key in response:
                return _coerce_sequence(response[key])

    return _coerce_sequence(response)


def _coerce_sequence(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    try:
        return list(value)
    except TypeError:
        return [value]


def _coerce_model_to_dict(model: Any) -> dict[str, Any]:
    if isinstance(model, dict):
        return dict(model)

    for attr in ("model_dump", "dict"):
        if hasattr(model, attr):
            try:
                payload = getattr(model, attr)()
                if isinstance(payload, dict):
                    return payload
            except Exception:  # pragma: no cover - defensive
                continue

    data: dict[str, Any] = {}
    for attr in (
        "id",
        "object",
        "created",
        "owned_by",
        "name",
        "display_name",
        "description",
        "context_length",
        "max_context_length",
        "max_sequence_length",
        "pricing",
        "capabilities",
        "metadata",
        "default_parameters",
        "provider",
        "provider_slug",
        "limits",
        "rate_limits",
        "tags",
    ):
        if hasattr(model, attr):
            data[attr] = getattr(model, attr)

    if not data:
        data["value"] = str(model)

    return data


def _normalize_cerebras_model(model: Any) -> dict[str, Any] | None:
    payload = _coerce_model_to_dict(model)
    raw_id = payload.get("id") or payload.get("name")
    if not raw_id:
        return None

    model_id = _cleanup_model_id(str(raw_id))
    provider_slug = (
        payload.get("provider_slug")
        or payload.get("provider")
        or payload.get("owned_by")
        or (model_id.split("/")[0] if "/" in model_id else "cerebras")
    )
    provider_slug = str(provider_slug).lstrip("@").lower() if provider_slug else "cerebras"

    display_name = payload.get("display_name") or payload.get("name") or model_id
    description = payload.get("description") or f"Cerebras hosted model '{display_name}'."
    context_length = (
        payload.get("context_length")
        or payload.get("max_context_length")
        or payload.get("max_sequence_length")
        or 0
    )

    architecture = payload.get("architecture") if isinstance(payload.get("architecture"), dict) else {}
    normalized_architecture = {
        "modality": architecture.get("modality") or "text->text",
        "input_modalities": architecture.get("input_modalities") or ["text"],
        "output_modalities": architecture.get("output_modalities") or ["text"],
        "tokenizer": architecture.get("tokenizer"),
        "instruct_type": architecture.get("instruct_type") or "chat",
    }

    normalized = {
        "id": model_id,
        "slug": model_id,
        "canonical_slug": model_id,
        "hugging_face_id": payload.get("hugging_face_id"),
        "name": display_name,
        "created": payload.get("created"),
        "description": description,
        "context_length": context_length,
        "architecture": normalized_architecture,
        "pricing": _normalize_pricing(payload.get("pricing")),
        "top_provider": None,
        "per_request_limits": payload.get("limits") or payload.get("rate_limits"),
        "supported_parameters": _extract_supported_parameters(payload),
        "default_parameters": payload.get("default_parameters") or {},
        "provider_slug": provider_slug,
        "provider_site_url": payload.get("provider_site_url") or "https://www.cerebras.net/",
        "model_logo_url": payload.get("model_logo_url"),
        "source_gateway": "cerebras",
        "tags": payload.get("tags") or [],
        "raw_cerebras": payload,
    }

    return normalized


def _normalize_pricing(pricing: dict[str, Any] | None) -> dict[str, str | None]:
    pricing = pricing or {}

    def _stringify(value: Any) -> str | None:
        if value is None:
            return None
        try:
            return str(value)
        except Exception:  # pragma: no cover - defensive
            return None

    prompt = (
        pricing.get("prompt")
        or pricing.get("input")
        or pricing.get("prompt_price")
        or pricing.get("prompt_tokens")
    )
    completion = (
        pricing.get("completion")
        or pricing.get("output")
        or pricing.get("completion_price")
        or pricing.get("completion_tokens")
    )

    return {
        "prompt": _stringify(prompt),
        "completion": _stringify(completion),
        "request": _stringify(pricing.get("request")),
        "image": _stringify(pricing.get("image")),
        "web_search": _stringify(pricing.get("web_search")),
        "internal_reasoning": _stringify(pricing.get("internal_reasoning")),
    }


def _extract_supported_parameters(payload: dict[str, Any]) -> list[str]:
    supported = payload.get("supported_parameters")
    capabilities = payload.get("capabilities")

    params: list[str] = []

    if isinstance(supported, list | tuple | set):
        params.extend(str(item) for item in supported if item)

    if isinstance(capabilities, dict):
        for key, value in capabilities.items():
            if key:
                params.append(str(key))
            if isinstance(value, dict):
                params.extend(str(inner) for inner in value.keys() if inner)
            elif isinstance(value, list | tuple | set):
                params.extend(str(inner) for inner in value if inner)

    if not params:
        params = DEFAULT_SUPPORTED_PARAMETERS.copy()

    # Deduplicate while preserving order
    seen = set()
    deduped: list[str] = []
    for item in params:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped


def _cleanup_model_id(model_id: str) -> str:
    cleaned = model_id.strip()
    if cleaned.startswith("@"):
        cleaned = cleaned.lstrip("@")
    if cleaned.startswith("cerebras/"):
        cleaned = cleaned.split("cerebras/", 1)[1]
    if cleaned.startswith("models/"):
        cleaned = cleaned.split("models/", 1)[1]
    if cleaned.startswith("api/"):
        cleaned = cleaned.split("api/", 1)[1]
    if cleaned.startswith("@cerebras/"):
        cleaned = cleaned.split("@cerebras/", 1)[1]
    return cleaned
