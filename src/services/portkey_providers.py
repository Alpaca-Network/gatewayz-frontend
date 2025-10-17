"""
Portkey SDK Provider Fetch Functions

These functions use the Portkey Python SDK to fetch models from individual
providers (Google, Cerebras, Nebius, Xai, Novita, Hug) instead of the unified
Portkey gateway which has a 500-model limit.
"""

import logging
from datetime import datetime, timezone

from src.cache import (
    _google_models_cache,
    _cerebras_models_cache,
    _nebius_models_cache,
    _xai_models_cache,
    _novita_models_cache,
    _hug_models_cache,
)
from src.services.pricing_lookup import enrich_model_with_pricing

logger = logging.getLogger(__name__)


def fetch_models_from_google():
    """Fetch models from Google via Portkey SDK"""
    try:
        from src.services.portkey_sdk import get_portkey_service

        logger.info("Fetching Google models via Portkey SDK")
        service = get_portkey_service()

        models = service.list_models("google")
        if not models:
            logger.warning("No Google models returned from Portkey SDK")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "google") for model in models if model]

        _google_models_cache["data"] = normalized_models
        _google_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Google models from Portkey SDK")
        return _google_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Google: {e}", exc_info=True)
        return None


def fetch_models_from_cerebras():
    """Fetch models from Cerebras via Portkey SDK"""
    try:
        from src.services.portkey_sdk import get_portkey_service

        logger.info("Fetching Cerebras models via Portkey SDK")
        service = get_portkey_service()

        models = service.list_models("cerebras")
        if not models:
            logger.warning("No Cerebras models returned from Portkey SDK")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "cerebras") for model in models if model]

        _cerebras_models_cache["data"] = normalized_models
        _cerebras_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Cerebras models from Portkey SDK")
        return _cerebras_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Cerebras: {e}", exc_info=True)
        return None


def fetch_models_from_nebius():
    """Fetch models from Nebius via Portkey SDK"""
    try:
        from src.services.portkey_sdk import get_portkey_service

        logger.info("Fetching Nebius models via Portkey SDK")
        service = get_portkey_service()

        models = service.list_models("nebius")
        if not models:
            logger.warning("No Nebius models returned from Portkey SDK")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "nebius") for model in models if model]

        _nebius_models_cache["data"] = normalized_models
        _nebius_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Nebius models from Portkey SDK")
        return _nebius_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Nebius: {e}", exc_info=True)
        return None


def fetch_models_from_xai():
    """Fetch models from Xai via Portkey SDK"""
    try:
        from src.services.portkey_sdk import get_portkey_service

        logger.info("Fetching Xai models via Portkey SDK")
        service = get_portkey_service()

        models = service.list_models("xai")
        if not models:
            logger.warning("No Xai models returned from Portkey SDK")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "xai") for model in models if model]

        _xai_models_cache["data"] = normalized_models
        _xai_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Xai models from Portkey SDK")
        return _xai_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Xai: {e}", exc_info=True)
        return None


def fetch_models_from_novita():
    """Fetch models from Novita via Portkey SDK"""
    try:
        from src.services.portkey_sdk import get_portkey_service

        logger.info("Fetching Novita models via Portkey SDK")
        service = get_portkey_service()

        models = service.list_models("novita")
        if not models:
            logger.warning("No Novita models returned from Portkey SDK")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "novita") for model in models if model]

        _novita_models_cache["data"] = normalized_models
        _novita_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Novita models from Portkey SDK")
        return _novita_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Novita: {e}", exc_info=True)
        return None


def fetch_models_from_hug():
    """Fetch models from Hugging Face via Portkey SDK"""
    try:
        from src.services.portkey_sdk import get_portkey_service

        logger.info("Fetching Hugging Face models via Portkey SDK")
        service = get_portkey_service()

        models = service.list_models("hug")
        if not models:
            logger.warning("No Hugging Face models returned from Portkey SDK")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "hug") for model in models if model]

        _hug_models_cache["data"] = normalized_models
        _hug_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Hugging Face models from Portkey SDK")
        return _hug_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Hugging Face: {e}", exc_info=True)
        return None


def normalize_portkey_provider_model(model: dict, provider: str) -> dict:
    """Normalize model from Portkey SDK provider to catalog schema"""
    try:
        model_id = model.get("id") or model.get("name", "")
        if not model_id:
            return {"source_gateway": provider, f"raw_{provider}": model}

        slug = f"{provider}/{model_id}"
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
