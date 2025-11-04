"""
Provider Integration Functions

These functions fetch models from various AI providers using their native APIs and SDKs.

PROVIDERS WITH OFFICIAL SDK INTEGRATION:
  - Cerebras: Uses cerebras-cloud-sdk package
    - Fallback: Direct HTTP to https://api.cerebras.ai/v1/models
  - xAI: Uses xai-sdk package
    - Fallback: OpenAI SDK with base_url="https://api.x.ai/v1"

PROVIDERS USING OPENAI SDK WITH CUSTOM BASE URL:
  - Nebius: OpenAI SDK with base_url="https://api.studio.nebius.ai/v1/"
  - Novita: OpenAI SDK with base_url="https://api.novita.ai/v3/openai"

PROVIDERS USING PORTKEY FILTERING:
  - Google: Filters Portkey catalog by patterns "@google/", "google/", "gemini", "gemma"
  - Hugging Face: Filters Portkey catalog by patterns "llava-hf", "hugging", "hf/"

IMPLEMENTATION STRATEGY:
  - Use official SDKs when available (better type safety, official support)
  - Use OpenAI SDK for OpenAI-compatible APIs (proven reliability, no extra dependencies)
  - Use Portkey filtering only when direct API access is not feasible

HISTORICAL NOTE:
  Initially attempted to use pattern-based filtering from Portkey's unified catalog for all
  providers, but this approach was unreliable as Portkey's /v1/models endpoint doesn't always
  include models from all integrated providers. Direct API integration provides better
  reliability and completeness.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from src.cache import (
    _cerebras_models_cache,
    _google_models_cache,
    _google_vertex_models_cache,
    _huggingface_models_cache,
    _nebius_models_cache,
    _novita_models_cache,
    _xai_models_cache,
)
from src.services.pricing_lookup import enrich_model_with_pricing

logger = logging.getLogger(__name__)


# xAI fallback models - used when SDK/API is unavailable
XAI_FALLBACK_MODELS = [
    # Grok 4 Models (2025)
    {"id": "grok-4", "owned_by": "xAI"},
    {"id": "grok-4-latest", "owned_by": "xAI"},
    {"id": "grok-4-fast-reasoning", "owned_by": "xAI"},
    {"id": "grok-4-fast-non-reasoning", "owned_by": "xAI"},
    # Grok 3 Models
    {"id": "grok-3", "owned_by": "xAI"},
    {"id": "grok-3-latest", "owned_by": "xAI"},
    {"id": "grok-3-mini", "owned_by": "xAI"},
    # Grok 2 Models
    {"id": "grok-2", "owned_by": "xAI"},
    {"id": "grok-2-latest", "owned_by": "xAI"},
    {"id": "grok-2-mini", "owned_by": "xAI"},
    {"id": "grok-2-image-1212", "owned_by": "xAI"},
    # Legacy Beta Models
    {"id": "grok-beta", "owned_by": "xAI"},
    {"id": "grok-vision-beta", "owned_by": "xAI"},
]


def _check_api_key(api_key: str | None, provider_name: str) -> bool:
    """Check if API key is configured - returns False and logs warning if not

    Args:
        api_key: API key to check
        provider_name: Provider name for logging

    Returns:
        True if API key exists, False otherwise
    """
    if not api_key:
        logger.warning(f"{provider_name} API key not configured")
        return False
    return True


def _handle_http_error(error: Exception, provider_name: str) -> None:
    """Handle HTTP errors with consistent logging

    Args:
        error: The HTTP error exception
        provider_name: Provider name for logging
    """
    import httpx

    if isinstance(error, httpx.HTTPStatusError):
        logger.error(
            f"{provider_name} API HTTP error {error.response.status_code}: {error.response.text[:200]}"
        )
    else:
        logger.error(f"{provider_name} HTTP API error: {error}")


def _unwrap_sdk_response(models_response: Any) -> list:
    """Unwrap SDK response to extract raw models list - handles various response formats

    Args:
        models_response: SDK response (object with data attr, list, iterator, etc.)

    Returns:
        List of raw model objects
    """
    # Check if it has a 'data' attribute first (common API response pattern)
    if hasattr(models_response, "data"):
        raw_models = models_response.data
        logger.debug(f"Extracted from .data attribute, type: {type(raw_models)}")
    # Check if it's already a list
    elif isinstance(models_response, list):
        raw_models = models_response
        logger.debug("Response is already a list")
    # Convert to list if it's an iterator/generator (but not dict-like)
    elif hasattr(models_response, "__iter__") and not hasattr(models_response, "items"):
        raw_models = list(models_response)
        logger.debug(f"Converted iterator to list, length: {len(raw_models)}")
    else:
        # Last resort: try to extract as single item
        raw_models = [models_response]
        logger.debug("Wrapped response in list")

    # Additional unwrapping if the data is nested in a dict
    if isinstance(raw_models, dict) and "data" in raw_models:
        raw_models = raw_models["data"]
        logger.debug("Unwrapped data from dict")
    elif raw_models and len(raw_models) > 0:
        # Check if first element is a tuple (e.g., from .items() conversion)
        if (
            isinstance(raw_models[0], tuple)
            and len(raw_models[0]) == 2
            and raw_models[0][0] == "data"
        ):
            # Extract the data list from the tuple ('data', [model_list])
            raw_models = raw_models[0][1]
            logger.debug("Unwrapped data from tuple format")
        elif isinstance(raw_models[0], dict) and "data" in raw_models[0]:
            raw_models = raw_models[0]["data"]
            logger.debug("Unwrapped data from first element")

    return raw_models if isinstance(raw_models, list) else []


def _extract_models_from_response(payload: dict | list, key: str = "data") -> list:
    """Extract models list from API response - handles dict or list formats

    Args:
        payload: API response (dict with models key or list)
        key: Key to look for in dict (default: "data", can be "models")

    Returns:
        List of models, or empty list if extraction fails
    """
    if isinstance(payload, dict) and key in payload:
        return payload.get(key, [])
    elif isinstance(payload, list):
        return payload
    else:
        return []


def _convert_model_to_dict(model: Any) -> dict | None:
    """Convert SDK model object to dict - shared helper to reduce duplication

    Handles Pydantic v1/v2 models, regular objects, and dicts.

    Args:
        model: Model object from SDK (Pydantic, dict, or other)

    Returns:
        Dictionary representation of the model, or None if conversion fails
    """
    if hasattr(model, "model_dump"):
        # Pydantic v2 model
        return model.model_dump()
    elif hasattr(model, "dict"):
        # Legacy Pydantic v1 model
        return model.dict()
    elif hasattr(model, "__dict__"):
        # Regular object
        return vars(model)
    elif isinstance(model, dict):
        # Already a dict
        return model
    else:
        # Fallback: convert to string id
        return {"id": str(model)}


def _normalize_models_list(models_list: list, provider: str) -> list:
    """Normalize a list of raw models with error handling

    Args:
        models_list: Raw models from provider API
        provider: Provider name for logging

    Returns:
        List of successfully normalized models
    """
    normalized_models = []
    for model in models_list:
        if not model:
            continue
        try:
            normalized = normalize_portkey_provider_model(model, provider)
            if normalized:
                normalized_models.append(normalized)
        except Exception as normalization_error:
            logger.warning(f"Failed to normalize {provider} model: {normalization_error}")
            continue
    return normalized_models


def _cache_normalized_models(models_list: list, provider: str, cache_dict: dict) -> list:
    """Normalize models and cache them - shared helper to reduce duplication

    Args:
        models_list: Raw models from provider API
        provider: Provider name (e.g., "nebius", "novita")
        cache_dict: Cache dictionary to store results

    Returns:
        List of normalized and cached models
    """
    normalized_models = _normalize_models_list(models_list, provider)

    cache_dict["data"] = normalized_models
    cache_dict["timestamp"] = datetime.now(timezone.utc)

    logger.info(f"Cached {len(normalized_models)} {provider} models")
    return cache_dict["data"]


def _fetch_openai_compatible_models(
    provider_name: str, base_url: str, api_key: str, cache_dict: dict
) -> list | None:
    """Fetch models from OpenAI-compatible API - shared helper for Nebius and Novita

    Args:
        provider_name: Display name (e.g., "Nebius", "Novita")
        base_url: API base URL
        api_key: API key for authentication
        cache_dict: Cache dictionary to store results

    Returns:
        List of normalized models or None if failed
    """
    try:
        from openai import OpenAI

        if not _check_api_key(api_key, provider_name):
            return None

        client = OpenAI(base_url=base_url, api_key=api_key)
        models_response = client.models.list()

        # Convert model objects to dicts
        models_list = [_convert_model_to_dict(model) for model in models_response.data]

        if not models_list:
            logger.warning(f"No models returned from {provider_name} API")
            return None

        logger.info(f"Fetched {len(models_list)} models from {provider_name} API")

        return _cache_normalized_models(models_list, provider_name.lower(), cache_dict)

    except Exception as e:
        logger.error(f"Failed to fetch models from {provider_name}: {e}", exc_info=True)
        return None


def _filter_portkey_models_by_patterns(patterns: list, provider_name: str):
    """
    Filter Portkey unified models by name patterns and cache them.

    Args:
        patterns: List of strings to match in model ID (case-insensitive)
        provider_name: The internal provider name (e.g., "google", "cerebras")

    Returns:
        List of filtered models or None
    """
    try:
        from src.services.models import fetch_models_from_portkey

        logger.info(
            f"Fetching {provider_name} models from Portkey unified catalog (filtering by patterns: {patterns})"
        )

        # Get all Portkey models
        all_portkey_models = fetch_models_from_portkey()

        if not all_portkey_models:
            logger.warning(f"No Portkey models returned for {provider_name}")
            return None

        logger.info(
            f"Portkey returned {len(all_portkey_models)} total models to filter for {provider_name}"
        )

        # Filter by matching any of the patterns
        filtered_models = []
        seen_ids = set()  # Avoid duplicates

        for model in all_portkey_models:
            model_id = model.get("id", "").lower()

            # Check if any pattern matches
            for pattern in patterns:
                if pattern.lower() in model_id:
                    if model.get("id") not in seen_ids:
                        model_copy = model.copy()
                        model_copy["source_gateway"] = provider_name
                        filtered_models.append(model_copy)
                        seen_ids.add(model.get("id"))
                    break

        if filtered_models:
            logger.info(
                f"✅ Filtered {len(filtered_models)} {provider_name} models from Portkey catalog"
            )
        else:
            logger.warning(
                f"⚠️  No {provider_name} models matched patterns {patterns} in Portkey catalog of {len(all_portkey_models)} models"
            )
            # Log sample model IDs to help debug pattern matching
            if all_portkey_models:
                sample_ids = [m.get("id", "unknown") for m in all_portkey_models[:5]]
                logger.warning(f"Sample Portkey model IDs: {sample_ids}")

        return filtered_models if filtered_models else None

    except Exception as e:
        logger.error(f"Failed to filter {provider_name} models from Portkey: {e}", exc_info=True)
        return None


def fetch_models_from_google():
    """
    Fetch models from Google using their Generative AI API.

    Uses the Google Generative AI API to list available models (Gemini, etc.)
    """
    try:
        import httpx

        from src.config import Config

        if not _check_api_key(Config.GOOGLE_API_KEY, "Google"):
            return None

        # Google Generative AI API endpoint
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={Config.GOOGLE_API_KEY}"

        headers = {
            "Content-Type": "application/json",
        }

        try:
            response = httpx.get(url, headers=headers, timeout=20.0)
            response.raise_for_status()

            payload = response.json()
            models_list = _extract_models_from_response(payload, key="models")

            if not models_list:
                logger.warning("No models returned from Google API")
                return None

            logger.info(f"Fetched {len(models_list)} models from Google Generative AI API")

        except Exception as http_error:
            _handle_http_error(http_error, "Google")
            return None

        # Normalize the models
        if not models_list:
            logger.warning("No models available from Google")
            return None

        return _cache_normalized_models(models_list, "google", _google_models_cache)

    except Exception as e:
        logger.error(f"Failed to fetch models from Google: {e}", exc_info=True)
        return None


def fetch_models_from_cerebras():
    """
    Fetch models from Cerebras using their official SDK.

    Uses the cerebras-cloud-sdk package to interact with Cerebras Cloud API.
    Falls back to direct HTTP call if SDK is not available.
    """
    try:
        from src.config import Config

        if not _check_api_key(Config.CEREBRAS_API_KEY, "Cerebras"):
            return None

        models_list = None

        # Try using the official Cerebras SDK first
        try:
            from cerebras.cloud.sdk import Cerebras

            client = Cerebras(api_key=Config.CEREBRAS_API_KEY)

            # The SDK's models.list() returns a list of model objects
            models_response = client.models.list()
            logger.debug(f"Cerebras SDK response type: {type(models_response)}")

            raw_models = _unwrap_sdk_response(models_response)
            logger.info(f"Processing {len(raw_models)} raw models from Cerebras SDK")

            # Convert SDK model objects to dicts if needed
            models_list = []
            for idx, model in enumerate(raw_models):
                try:
                    if idx == 0:
                        logger.debug(f"First model type: {type(model)}")

                    converted_model = _convert_model_to_dict(model)

                    # Validate that we got a proper dict with an id
                    if converted_model and isinstance(converted_model, dict):
                        if "id" in converted_model:
                            models_list.append(converted_model)
                        else:
                            logger.warning(
                                f"Model dict missing 'id' field: {list(converted_model.keys())[:5]}"
                            )
                    else:
                        logger.warning(f"Failed to convert model to dict: {type(converted_model)}")
                except Exception as conversion_error:
                    logger.warning(f"Failed to convert Cerebras model object: {conversion_error}")
                    continue

            if models_list:
                logger.info(f"Fetched {len(models_list)} models from Cerebras SDK")
            else:
                logger.warning("Cerebras SDK returned no models, falling back to HTTP API")
                raise ValueError("SDK returned empty model list")

        except (ImportError, ModuleNotFoundError):
            # Fallback to direct HTTP API call if SDK not installed
            logger.info("Cerebras SDK not available, using direct HTTP API")
            models_list = None
        except Exception as sdk_error:
            # Fallback to HTTP if SDK fails for any reason
            logger.warning(f"Cerebras SDK error: {sdk_error}. Falling back to direct HTTP API")
            models_list = None

        # Fallback to direct HTTP API if SDK didn't work
        if models_list is None:
            import httpx

            headers = {
                "Authorization": f"Bearer {Config.CEREBRAS_API_KEY}",
                "Content-Type": "application/json",
            }

            try:
                response = httpx.get(
                    "https://api.cerebras.ai/v1/models",
                    headers=headers,
                    timeout=20.0,
                )
                response.raise_for_status()

                payload = response.json()
                models_list = _extract_models_from_response(payload, key="data")

                if not models_list:
                    logger.warning("No models returned from Cerebras API")
                    return None

                logger.info(f"Fetched {len(models_list)} models from Cerebras HTTP API")

            except Exception as http_error:
                _handle_http_error(http_error, "Cerebras")
                return None

        # Normalize the models
        if not models_list:
            logger.warning("No models available from Cerebras")
            return None

        normalized_models = _normalize_models_list(models_list, "cerebras")

        if not normalized_models:
            logger.warning("No models were successfully normalized from Cerebras")
            return None

        return _cache_normalized_models(normalized_models, "cerebras", _cerebras_models_cache)

    except Exception as e:
        logger.error(f"Failed to fetch models from Cerebras: {e}", exc_info=True)
        return None


def fetch_models_from_nebius():
    """
    Fetch models from Nebius using OpenAI SDK.

    Nebius AI Studio provides an OpenAI-compatible API at https://api.studio.nebius.ai/v1/
    Uses the OpenAI Python SDK with a custom base URL.
    """
    from src.config import Config

    return _fetch_openai_compatible_models(
        provider_name="Nebius",
        base_url="https://api.studio.nebius.ai/v1/",
        api_key=Config.NEBIUS_API_KEY,
        cache_dict=_nebius_models_cache,
    )


def fetch_models_from_xai():
    """
    Fetch models from xAI using their official SDK.

    Uses the xai-sdk Python library to interact with xAI's Grok API.
    Falls back to OpenAI SDK with custom base URL if official SDK is not available.
    If API fails or returns no models, uses a fallback list of known xAI models.
    """
    try:
        from src.config import Config

        if not _check_api_key(Config.XAI_API_KEY, "xAI"):
            return None

        # Try using the official xAI SDK first
        try:
            from xai_sdk import Client

            client = Client(api_key=Config.XAI_API_KEY)

            # Check if the SDK has models.list() method, otherwise fallback immediately
            # The xAI SDK Client doesn't have these methods, so we'll fallback to OpenAI SDK
            if not (hasattr(client, "models") and hasattr(client.models, "list")) and not hasattr(
                client, "list_models"
            ):
                raise AttributeError("xAI SDK Client doesn't support model listing")

            # The SDK's list_models() or models.list() returns a list of model objects
            try:
                models_response = client.models.list()
            except AttributeError:
                models_response = client.list_models()

            # Convert to list if it's an iterator/generator
            if hasattr(models_response, "__iter__") and not isinstance(
                models_response, list | dict
            ):
                raw_models = list(models_response)
            else:
                raw_models = (
                    models_response if isinstance(models_response, list) else [models_response]
                )

            # Extract data array if response is wrapped
            if raw_models and isinstance(raw_models[0], dict) and "data" in raw_models[0]:
                raw_models = raw_models[0].get("data", [])

            # Convert SDK model objects to dicts if needed
            models_list = [_convert_model_to_dict(model) for model in raw_models]

            if models_list:
                logger.info(f"Fetched {len(models_list)} models from xAI SDK")
            else:
                logger.warning("xAI SDK returned empty model list, using fallback")
                raise ValueError("Empty model list from SDK")

        except (ImportError, ValueError, AttributeError):
            # Fallback to OpenAI SDK with xAI base URL
            try:
                logger.info(
                    "xAI SDK not available or returned no models, using OpenAI SDK with xAI base URL"
                )
                from openai import OpenAI

                client = OpenAI(
                    base_url="https://api.x.ai/v1",
                    api_key=Config.XAI_API_KEY,
                )

                models_response = client.models.list()
                models_list = [_convert_model_to_dict(model) for model in models_response.data]

                if not models_list:
                    logger.warning("No models returned from xAI API, using fallback models")
                    raise ValueError("Empty model list from API")

            except Exception as openai_error:
                # Fallback to known xAI models
                logger.warning(f"xAI API failed: {openai_error}. Using fallback xAI model list.")
                models_list = XAI_FALLBACK_MODELS

        return _cache_normalized_models(models_list, "xai", _xai_models_cache)

    except Exception as e:
        logger.error(f"Failed to fetch models from xAI: {e}", exc_info=True)
        # Return fallback models even on complete failure
        logger.info("Using fallback xAI models due to error")
        return _cache_normalized_models(XAI_FALLBACK_MODELS, "xai", _xai_models_cache)


def fetch_models_from_novita():
    """
    Fetch models from Novita using OpenAI SDK.

    Novita AI provides an OpenAI-compatible API at https://api.novita.ai/v3/openai
    Uses the OpenAI Python SDK with a custom base URL.
    """
    from src.config import Config

    return _fetch_openai_compatible_models(
        provider_name="Novita",
        base_url="https://api.novita.ai/v3/openai",
        api_key=Config.NOVITA_API_KEY,
        cache_dict=_novita_models_cache,
    )


def fetch_models_from_hug_via_portkey():
    """Fetch models from Hugging Face by filtering Portkey unified catalog"""
    try:
        # Hugging Face models include "llava-hf" and similar patterns
        filtered_models = _filter_portkey_models_by_patterns(["llava-hf", "hugging", "hf/"], "hug")

        if not filtered_models:
            logger.warning("No Hugging Face models found in Portkey catalog")
            return None

        return _cache_normalized_models(filtered_models, "hug", _huggingface_models_cache)

    except Exception as e:
        logger.error(f"Failed to fetch models from Hugging Face: {e}", exc_info=True)
        return None


def normalize_portkey_provider_model(model: dict, provider: str) -> dict:
    """
    Normalize model from provider API to catalog schema.

    Used for both Portkey-filtered models and direct provider API responses.
    Model IDs are formatted as @provider/model-id for consistency across all providers.
    """
    try:
        model_id = model.get("id") or model.get("name", "")
        if not model_id:
            return {"source_gateway": provider, f"raw_{provider}": model}

        # Format: @provider/model-id (Portkey compatible format)
        # Check if model_id already has the @provider/ prefix to avoid duplication
        if model_id.startswith(f"@{provider}/"):
            slug = model_id
        else:
            slug = f"@{provider}/{model_id}"
        display_name = (
            model.get("display_name") or model_id.replace("-", " ").replace("_", " ").title()
        )
        description = model.get("description") or f"{provider.title()} hosted model: {model_id}"
        context_length = model.get("context_length") or 0

        pricing = {
            "prompt": None,
            "completion": None,
            "request": None,
            "image": None,
            "web_search": None,
            "internal_reasoning": None,
        }

        # Try to extract pricing if available
        if "pricing" in model:
            pricing_info = model.get("pricing", {})
            if isinstance(pricing_info, dict):
                pricing["prompt"] = pricing_info.get("prompt") or pricing_info.get("input")
                pricing["completion"] = pricing_info.get("completion") or pricing_info.get("output")

        architecture = {
            "modality": model.get("modality", "text->text"),
            "input_modalities": model.get("input_modalities") or ["text"],
            "output_modalities": model.get("output_modalities") or ["text"],
            "tokenizer": None,
            "instruct_type": None,
        }

        normalized = {
            "id": slug,
            "slug": slug,
            "canonical_slug": slug,
            "hugging_face_id": None,
            "name": display_name,
            "created": model.get("created"),
            "description": description,
            "context_length": context_length,
            "architecture": architecture,
            "pricing": pricing,
            "top_provider": None,
            "per_request_limits": None,
            "supported_parameters": model.get("supported_parameters") or [],
            "default_parameters": model.get("default_parameters") or {},
            "provider_slug": provider,
            "provider_site_url": None,
            "model_logo_url": None,
            "source_gateway": provider,
            f"raw_{provider}": model,
        }

        return enrich_model_with_pricing(normalized, provider)

    except Exception as e:
        logger.error(f"Error normalizing {provider} model: {e}")
        return {"source_gateway": provider, f"raw_{provider}": model}


# Common generation methods for Gemini models
_GEMINI_GENERATION_METHODS = ["generateContent", "streamGenerateContent"]


def fetch_models_from_google_vertex():
    """
    Fetch available models from Google Vertex AI using the official SDK.

    Returns a list of normalized models available in Google Vertex AI.
    This uses the google-cloud-aiplatform SDK to list models from the
    Vertex AI Model Registry.

    Returns:
        List of normalized model dictionaries, or None if fetch fails
    """
    try:
        import google.auth
        from google.auth.transport.requests import Request
        from google.cloud import aiplatform
        from google.oauth2.service_account import Credentials

        from src.config import Config

        logger.info("Fetching models from Google Vertex AI Model Registry")

        # Get credentials
        if Config.GOOGLE_APPLICATION_CREDENTIALS:
            credentials = Credentials.from_service_account_file(
                Config.GOOGLE_APPLICATION_CREDENTIALS
            )
            credentials.refresh(Request())
        else:
            credentials, _ = google.auth.default()
            if not credentials.valid:
                credentials.refresh(Request())

        # Initialize Model Registry client
        aiplatform.init(
            project=Config.GOOGLE_PROJECT_ID,
            location=Config.GOOGLE_VERTEX_LOCATION,
            credentials=credentials,
        )

        # Common Google Vertex AI models
        # These are the officially supported models available in Vertex AI
        vertex_models = [
            {
                "id": "gemini-2.5-flash-lite",
                "display_name": "Gemini 2.5 Flash Lite (GA)",
                "description": "Lightweight, cost-effective model for high-throughput applications (stable version)",
                "max_input_tokens": 1000000,
                "max_output_tokens": 8192,
                "modalities": ["text", "image", "audio", "video"],
                "supported_generation_methods": _GEMINI_GENERATION_METHODS,
            },
            {
                "id": "gemini-2.5-flash-lite-preview-09-2025",
                "display_name": "Gemini 2.5 Flash Lite Preview (Sep 2025)",
                "description": "Preview version with improved performance (887 tokens/sec) and enhanced reasoning capabilities",
                "max_input_tokens": 1000000,
                "max_output_tokens": 8192,
                "modalities": ["text", "image", "audio", "video"],
                "supported_generation_methods": _GEMINI_GENERATION_METHODS,
            },
            {
                "id": "gemini-2.0-flash",
                "display_name": "Gemini 2.0 Flash",
                "description": "Fast, efficient model optimized for real-time applications",
                "max_input_tokens": 1000000,
                "max_output_tokens": 100000,
                "modalities": ["text", "image", "audio", "video"],
                "supported_generation_methods": _GEMINI_GENERATION_METHODS,
            },
            {
                "id": "gemini-2.0-flash-thinking",
                "display_name": "Gemini 2.0 Flash Thinking",
                "description": "Extended thinking variant for complex reasoning tasks",
                "max_input_tokens": 1000000,
                "max_output_tokens": 100000,
                "modalities": ["text"],
                "supported_generation_methods": _GEMINI_GENERATION_METHODS,
            },
            {
                "id": "gemini-2.0-pro",
                "display_name": "Gemini 2.0 Pro",
                "description": "Advanced reasoning model for complex tasks",
                "max_input_tokens": 1000000,
                "max_output_tokens": 4096,
                "modalities": ["text", "image", "audio", "video"],
                "supported_generation_methods": _GEMINI_GENERATION_METHODS,
            },
            {
                "id": "gemini-1.5-pro",
                "display_name": "Gemini 1.5 Pro",
                "description": "Advanced reasoning model with multimodal support",
                "max_input_tokens": 1000000,
                "max_output_tokens": 8192,
                "modalities": ["text", "image", "audio", "video"],
                "supported_generation_methods": _GEMINI_GENERATION_METHODS,
            },
            {
                "id": "gemini-1.5-flash",
                "display_name": "Gemini 1.5 Flash",
                "description": "Fast model for speed-focused applications",
                "max_input_tokens": 1000000,
                "max_output_tokens": 8192,
                "modalities": ["text", "image", "audio", "video"],
                "supported_generation_methods": _GEMINI_GENERATION_METHODS,
            },
            {
                "id": "gemini-1.0-pro",
                "display_name": "Gemini 1.0 Pro",
                "description": "Previous generation pro model",
                "max_input_tokens": 32000,
                "max_output_tokens": 8192,
                "modalities": ["text"],
                "supported_generation_methods": _GEMINI_GENERATION_METHODS,
            },
        ]

        logger.info(f"Loaded {len(vertex_models)} Google Vertex AI models")

        # Normalize the models - use custom normalization for Vertex-specific fields
        normalized_models = []
        for model in vertex_models:
            try:
                normalized = {
                    "id": model.get("id"),
                    "name": model.get("id"),
                    "display_name": model.get("display_name", model.get("id")),
                    "description": model.get("description", ""),
                    "architecture": {
                        "modality": (
                            "multimodal" if len(model.get("modalities", [])) > 1 else "text"
                        ),
                        "tokenizer": "unknown",
                        "instruct_type": "chat",
                    },
                    "pricing": {
                        "prompt": 0.00,  # Pricing varies by model and region
                        "completion": 0.00,
                        "request": 0.00,
                        "image": None,
                    },
                    "top_provider": "Google",
                    "max_context_length": model.get("max_input_tokens", 1000000),
                    "max_tokens": model.get("max_output_tokens", 8192),
                    "per_request_limits": None,
                    "modality": model.get("modalities", ["text"]),
                    "provider_slug": "google-vertex",
                    "source_gateway": "google-vertex",
                    "raw_google_vertex": model,
                }

                enriched = enrich_model_with_pricing(normalized, "google-vertex")
                normalized_models.append(enriched)

            except Exception as model_error:
                logger.warning(
                    f"Failed to normalize Google Vertex model {model.get('id')}: {model_error}"
                )
                continue

        if not normalized_models:
            logger.warning("No models were successfully normalized from Google Vertex AI")
            return None

        return _cache_normalized_models(
            normalized_models, "google-vertex", _google_vertex_models_cache
        )

    except Exception as e:
        logger.error(f"Failed to fetch models from Google Vertex AI: {e}", exc_info=True)
        return None
