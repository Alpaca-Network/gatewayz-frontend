"""
Portkey Provider Integration Functions

These functions fetch models directly from Portkey provider integrations
using the /integrations/{slug}/models endpoint.

Supports:
- google
- cerebras
- nebius
- xai
- novita
- huggingface (hug)
"""

import logging
from datetime import datetime, timezone
import httpx

from src.cache import (
    _google_models_cache,
    _cerebras_models_cache,
    _nebius_models_cache,
    _xai_models_cache,
    _novita_models_cache,
    _hug_models_cache,
)
from src.config import Config
from src.services.pricing_lookup import enrich_model_with_pricing

logger = logging.getLogger(__name__)

# Portkey integration slugs for each provider
PORTKEY_INTEGRATION_SLUGS = {
    'google': 'google',
    'cerebras': 'cerebras',
    'nebius': 'nebius',
    'xai': 'xai',
    'novita': 'novita',
    'hug': 'huggingface',
}


def _fetch_models_from_portkey_integration(slug: str, provider_name: str):
    """
    Fetch models directly from a Portkey provider integration.

    Args:
        slug: Portkey integration slug (e.g., 'google', 'cerebras')
        provider_name: Internal provider name (e.g., 'google', 'cerebras')

    Returns:
        List of models or None
    """
    try:
        if not Config.PORTKEY_API_KEY:
            logger.error(f"PORTKEY_API_KEY not configured for {provider_name}")
            return None

        headers = {
            'x-portkey-api-key': Config.PORTKEY_API_KEY,
            'Content-Type': 'application/json',
        }

        url = f"https://api.portkey.ai/v1/integrations/{slug}/models"

        logger.info(f"Fetching {provider_name} models from Portkey integration: {url}")

        response = httpx.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        data = response.json()
        models = data.get('models', [])

        if not models:
            logger.warning(f"No models returned from Portkey integration {slug}")
            return None

        logger.info(f"Fetched {len(models)} models from {provider_name} integration")

        # Normalize models to standard schema
        normalized_models = []
        for model in models:
            try:
                normalized = normalize_portkey_provider_model(model, provider_name)
                normalized_models.append(normalized)
            except Exception as e:
                logger.warning(f"Failed to normalize {provider_name} model: {e}")
                continue

        return normalized_models if normalized_models else None

    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching {provider_name} models: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch {provider_name} models from Portkey integration: {e}", exc_info=True)
        return None


def fetch_models_from_google():
    """Fetch models from Google Portkey integration"""
    try:
        models = _fetch_models_from_portkey_integration('google', 'google')

        if not models:
            logger.warning("No Google models found from Portkey integration")
            return None

        _google_models_cache["data"] = models
        _google_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(models)} Google models from Portkey integration")
        return _google_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Google: {e}", exc_info=True)
        return None


def fetch_models_from_cerebras():
    """Fetch models from Cerebras Portkey integration"""
    try:
        models = _fetch_models_from_portkey_integration('cerebras', 'cerebras')

        if not models:
            logger.warning("No Cerebras models found from Portkey integration")
            return None

        _cerebras_models_cache["data"] = models
        _cerebras_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(models)} Cerebras models from Portkey integration")
        return _cerebras_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Cerebras: {e}", exc_info=True)
        return None


def fetch_models_from_nebius():
    """Fetch models from Nebius Portkey integration"""
    try:
        models = _fetch_models_from_portkey_integration('nebius', 'nebius')

        if not models:
            logger.warning("No Nebius models found from Portkey integration")
            return None

        _nebius_models_cache["data"] = models
        _nebius_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(models)} Nebius models from Portkey integration")
        return _nebius_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Nebius: {e}", exc_info=True)
        return None


def fetch_models_from_xai():
    """Fetch models from Xai Portkey integration"""
    try:
        models = _fetch_models_from_portkey_integration('xai', 'xai')

        if not models:
            logger.warning("No Xai models found from Portkey integration")
            return None

        _xai_models_cache["data"] = models
        _xai_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(models)} Xai models from Portkey integration")
        return _xai_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Xai: {e}", exc_info=True)
        return None


def fetch_models_from_novita():
    """Fetch models from Novita Portkey integration"""
    try:
        models = _fetch_models_from_portkey_integration('novita', 'novita')

        if not models:
            logger.warning("No Novita models found from Portkey integration")
            return None

        _novita_models_cache["data"] = models
        _novita_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(models)} Novita models from Portkey integration")
        return _novita_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Novita: {e}", exc_info=True)
        return None


def fetch_models_from_hug():
    """Fetch models from Hugging Face Portkey integration"""
    try:
        models = _fetch_models_from_portkey_integration('huggingface', 'hug')

        if not models:
            logger.warning("No Hugging Face models found from Portkey integration")
            return None

        _hug_models_cache["data"] = models
        _hug_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(models)} Hugging Face models from Portkey integration")
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
