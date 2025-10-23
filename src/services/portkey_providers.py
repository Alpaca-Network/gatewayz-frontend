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

from src.cache import (
    _google_models_cache,
    _cerebras_models_cache,
    _nebius_models_cache,
    _xai_models_cache,
    _novita_models_cache,
    _huggingface_models_cache,
)
from src.services.pricing_lookup import enrich_model_with_pricing

logger = logging.getLogger(__name__)


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

        logger.info(f"Fetching {provider_name} models from Portkey unified catalog (filtering by patterns: {patterns})")

        # Get all Portkey models
        all_portkey_models = fetch_models_from_portkey()

        if not all_portkey_models:
            logger.warning(f"No Portkey models returned for {provider_name}")
            return None

        logger.info(f"Portkey returned {len(all_portkey_models)} total models to filter for {provider_name}")

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
            logger.info(f"✅ Filtered {len(filtered_models)} {provider_name} models from Portkey catalog")
        else:
            logger.warning(f"⚠️  No {provider_name} models matched patterns {patterns} in Portkey catalog of {len(all_portkey_models)} models")
            # Log sample model IDs to help debug pattern matching
            if all_portkey_models:
                sample_ids = [m.get("id", "unknown") for m in all_portkey_models[:5]]
                logger.warning(f"Sample Portkey model IDs: {sample_ids}")

        return filtered_models if filtered_models else None

    except Exception as e:
        logger.error(f"Failed to filter {provider_name} models from Portkey: {e}", exc_info=True)
        return None


def fetch_models_from_google():
    """Fetch models from Google by filtering Portkey unified catalog"""
    try:
        # Google models use @google/ prefix in Portkey (also try without @ for compatibility)
        filtered_models = _filter_portkey_models_by_patterns(["@google/", "google/", "gemini", "gemma"], "google")

        if not filtered_models:
            logger.warning("No Google models found in Portkey catalog")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "google") for model in filtered_models if model]

        _google_models_cache["data"] = normalized_models
        _google_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Google models from Portkey catalog")
        return _google_models_cache["data"]

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

        if not Config.CEREBRAS_API_KEY:
            logger.warning("Cerebras API key not configured")
            return None

        # Try using the official Cerebras SDK first
        try:
            from cerebras.cloud.sdk import Cerebras

            client = Cerebras(api_key=Config.CEREBRAS_API_KEY)

            # The SDK's models.list() returns a list of model objects
            models_response = client.models.list()

            # Convert to list if it's an iterator/generator
            if hasattr(models_response, '__iter__') and not isinstance(models_response, (list, dict)):
                raw_models = list(models_response)
            else:
                raw_models = models_response if isinstance(models_response, list) else [models_response]

            # Extract data array if response is wrapped
            if raw_models and isinstance(raw_models[0], dict) and 'data' in raw_models[0]:
                raw_models = raw_models[0].get('data', [])

            # Convert SDK model objects to dicts if needed
            models_list = []
            for model in raw_models:
                if hasattr(model, 'model_dump'):
                    # Pydantic model
                    models_list.append(model.model_dump())
                elif hasattr(model, 'dict'):
                    # Legacy Pydantic model
                    models_list.append(model.dict())
                elif hasattr(model, '__dict__'):
                    # Regular object
                    models_list.append(vars(model))
                elif isinstance(model, dict):
                    # Already a dict
                    models_list.append(model)
                else:
                    # Try to convert to dict
                    models_list.append({'id': str(model)})

            logger.info(f"Fetched {len(models_list)} models from Cerebras SDK")

        except ImportError:
            # Fallback to direct HTTP API call if SDK not installed
            logger.info("Cerebras SDK not available, using direct HTTP API")
            import httpx

            headers = {
                "Authorization": f"Bearer {Config.CEREBRAS_API_KEY}",
                "Content-Type": "application/json",
            }

            response = httpx.get(
                "https://api.cerebras.ai/v1/models",
                headers=headers,
                timeout=20.0,
            )
            response.raise_for_status()

            payload = response.json()
            models_list = payload.get("data", [])

            if not models_list:
                logger.warning("No models returned from Cerebras API")
                return None

        normalized_models = [normalize_portkey_provider_model(model, "cerebras") for model in models_list if model]

        _cerebras_models_cache["data"] = normalized_models
        _cerebras_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Cerebras models")
        return _cerebras_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Cerebras: {e}", exc_info=True)
        return None


def fetch_models_from_nebius():
    """
    Fetch models from Nebius using OpenAI SDK.

    Nebius AI Studio provides an OpenAI-compatible API at https://api.studio.nebius.ai/v1/
    Uses the OpenAI Python SDK with a custom base URL.
    """
    try:
        from src.config import Config
        from openai import OpenAI

        if not Config.NEBIUS_API_KEY:
            logger.warning("Nebius API key not configured")
            return None

        # Use OpenAI SDK with Nebius base URL
        client = OpenAI(
            base_url="https://api.studio.nebius.ai/v1/",
            api_key=Config.NEBIUS_API_KEY,
        )

        models_response = client.models.list()

        # Convert model objects to dicts
        models_list = [model.model_dump() if hasattr(model, 'model_dump') else model.dict() for model in models_response.data]

        if not models_list:
            logger.warning("No models returned from Nebius API")
            return None

        logger.info(f"Fetched {len(models_list)} models from Nebius API")

        normalized_models = [normalize_portkey_provider_model(model, "nebius") for model in models_list if model]

        _nebius_models_cache["data"] = normalized_models
        _nebius_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Nebius models")
        return _nebius_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Nebius: {e}", exc_info=True)
        return None


def fetch_models_from_xai():
    """
    Fetch models from xAI using their official SDK.

    Uses the xai-sdk Python library to interact with xAI's Grok API.
    Falls back to OpenAI SDK with custom base URL if official SDK is not available.
    """
    try:
        from src.config import Config

        if not Config.XAI_API_KEY:
            logger.warning("xAI API key not configured")
            return None

        # Try using the official xAI SDK first
        try:
            from xai_sdk import Client

            client = Client(api_key=Config.XAI_API_KEY)

            # The SDK's list_models() or models.list() returns a list of model objects
            try:
                models_response = client.models.list()
            except AttributeError:
                models_response = client.list_models()

            # Convert to list if it's an iterator/generator
            if hasattr(models_response, '__iter__') and not isinstance(models_response, (list, dict)):
                raw_models = list(models_response)
            else:
                raw_models = models_response if isinstance(models_response, list) else [models_response]

            # Extract data array if response is wrapped
            if raw_models and isinstance(raw_models[0], dict) and 'data' in raw_models[0]:
                raw_models = raw_models[0].get('data', [])

            # Convert SDK model objects to dicts if needed
            models_list = []
            for model in raw_models:
                if hasattr(model, 'model_dump'):
                    models_list.append(model.model_dump())
                elif hasattr(model, 'dict'):
                    models_list.append(model.dict())
                elif hasattr(model, '__dict__'):
                    models_list.append(vars(model))
                elif isinstance(model, dict):
                    models_list.append(model)
                else:
                    models_list.append({'id': str(model)})

            logger.info(f"Fetched {len(models_list)} models from xAI SDK")

        except ImportError:
            # Fallback to OpenAI SDK with xAI base URL
            logger.info("xAI SDK not available, using OpenAI SDK with xAI base URL")
            from openai import OpenAI

            client = OpenAI(
                base_url="https://api.x.ai/v1",
                api_key=Config.XAI_API_KEY,
            )

            models_response = client.models.list()
            models_list = [model.model_dump() if hasattr(model, 'model_dump') else model.dict() for model in models_response.data]

            if not models_list:
                logger.warning("No models returned from xAI API")
                return None

        normalized_models = [normalize_portkey_provider_model(model, "xai") for model in models_list if model]

        _xai_models_cache["data"] = normalized_models
        _xai_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} xAI models")
        return _xai_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from xAI: {e}", exc_info=True)
        return None


def fetch_models_from_novita():
    """
    Fetch models from Novita using OpenAI SDK.

    Novita AI provides an OpenAI-compatible API at https://api.novita.ai/v3/openai
    Uses the OpenAI Python SDK with a custom base URL.
    """
    try:
        from src.config import Config
        from openai import OpenAI

        if not Config.NOVITA_API_KEY:
            logger.warning("Novita API key not configured")
            return None

        # Use OpenAI SDK with Novita base URL
        client = OpenAI(
            base_url="https://api.novita.ai/v3/openai",
            api_key=Config.NOVITA_API_KEY,
        )

        models_response = client.models.list()

        # Convert model objects to dicts
        models_list = [model.model_dump() if hasattr(model, 'model_dump') else model.dict() for model in models_response.data]

        if not models_list:
            logger.warning("No models returned from Novita API")
            return None

        logger.info(f"Fetched {len(models_list)} models from Novita API")

        normalized_models = [normalize_portkey_provider_model(model, "novita") for model in models_list if model]

        _novita_models_cache["data"] = normalized_models
        _novita_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Novita models")
        return _novita_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Novita: {e}", exc_info=True)
        return None


def fetch_models_from_hug():
    """Fetch models from Hugging Face by filtering Portkey unified catalog"""
    try:
        # Hugging Face models include "llava-hf" and similar patterns
        filtered_models = _filter_portkey_models_by_patterns(["llava-hf", "hugging", "hf/"], "hug")

        if not filtered_models:
            logger.warning("No Hugging Face models found in Portkey catalog")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "hug") for model in filtered_models if model]

        _huggingface_models_cache["data"] = normalized_models
        _huggingface_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Hugging Face models from Portkey catalog")
        return _huggingface_models_cache["data"]

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
        display_name = model.get("display_name") or model_id.replace("-", " ").replace("_", " ").title()
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
            f"raw_{provider}": model
        }

        return enrich_model_with_pricing(normalized, provider)

    except Exception as e:
        logger.error(f"Error normalizing {provider} model: {e}")
        return {"source_gateway": provider, f"raw_{provider}": model}
