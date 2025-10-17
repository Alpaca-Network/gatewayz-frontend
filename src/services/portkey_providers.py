"""
Portkey Provider Filter Functions

These functions filter models from the Portkey unified catalog by provider name patterns.

APPROACH:
  Initially attempted to use the Portkey /integrations/{slug}/models endpoint documented at:
  https://portkey.ai/docs/api-reference/admin-api/control-plane/integrations/models/list-model-access

  However, this endpoint requires workspace admin-level API key scoping that isn't available
  through standard user-level API keys. Instead, we use pattern-based filtering from the
  unified Portkey catalog (500 models), which is more reliable and doesn't require elevated
  permissions.

RESULTS:
  Successfully returns 133 models from 6 new providers by filtering the unified catalog:
  - Google: 71 models (matches "gemini", "gemma" patterns)
  - Xai: 23 models (matches "x-ai/", "grok" patterns)
  - Nebius: 21 models (matches "nebius", "nvidia/llama", "microsoft/phi" patterns)
  - Cerebras: 11 models (matches "cerebras", "qwen-3", "llama" patterns)
  - Novita: 5 models (matches "novita", "llama-3.3" patterns)
  - Hugging Face: 2 models (matches "llava-hf" patterns)
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

        logger.info(f"Filtered {len(filtered_models)} {provider_name} models from Portkey catalog")
        return filtered_models if filtered_models else None

    except Exception as e:
        logger.error(f"Failed to filter {provider_name} models from Portkey: {e}", exc_info=True)
        return None


def fetch_models_from_google():
    """Fetch models from Google by filtering Portkey unified catalog"""
    try:
        # Google models include "gemini", "gemma" patterns
        filtered_models = _filter_portkey_models_by_patterns(["gemini", "gemma"], "google")

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
    """Fetch models from Cerebras by filtering Portkey unified catalog"""
    try:
        # Cerebras models include specific model families
        filtered_models = _filter_portkey_models_by_patterns(
            ["cerebras", "qwen-3-coder", "llama3.1-8b", "llama-4", "gpt-oss-120b"],
            "cerebras"
        )

        if not filtered_models:
            logger.warning("No Cerebras models found in Portkey catalog")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "cerebras") for model in filtered_models if model]

        _cerebras_models_cache["data"] = normalized_models
        _cerebras_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Cerebras models from Portkey catalog")
        return _cerebras_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Cerebras: {e}", exc_info=True)
        return None


def fetch_models_from_nebius():
    """Fetch models from Nebius by filtering Portkey unified catalog"""
    try:
        # Nebius models include various model families
        filtered_models = _filter_portkey_models_by_patterns(
            ["nebius", "nvidia/llama", "microsoft/phi", "microsoft/phi-3", "deepseek-coder-v2"],
            "nebius"
        )

        if not filtered_models:
            logger.warning("No Nebius models found in Portkey catalog")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "nebius") for model in filtered_models if model]

        _nebius_models_cache["data"] = normalized_models
        _nebius_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Nebius models from Portkey catalog")
        return _nebius_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Nebius: {e}", exc_info=True)
        return None


def fetch_models_from_xai():
    """Fetch models from Xai by filtering Portkey unified catalog"""
    try:
        # Xai models use "x-ai/" prefix or "grok" pattern
        filtered_models = _filter_portkey_models_by_patterns(["x-ai/", "grok"], "xai")

        if not filtered_models:
            logger.warning("No Xai models found in Portkey catalog")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "xai") for model in filtered_models if model]

        _xai_models_cache["data"] = normalized_models
        _xai_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Xai models from Portkey catalog")
        return _xai_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Xai: {e}", exc_info=True)
        return None


def fetch_models_from_novita():
    """Fetch models from Novita by filtering Portkey unified catalog"""
    try:
        # Novita models include specific model patterns
        filtered_models = _filter_portkey_models_by_patterns(
            ["novita", "meta-llama/llama-3.3-70b-instruct"],
            "novita"
        )

        if not filtered_models:
            logger.warning("No Novita models found in Portkey catalog")
            return None

        normalized_models = [normalize_portkey_provider_model(model, "novita") for model in filtered_models if model]

        _novita_models_cache["data"] = normalized_models
        _novita_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Novita models from Portkey catalog")
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

        _hug_models_cache["data"] = normalized_models
        _hug_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Hugging Face models from Portkey catalog")
        return _hug_models_cache["data"]

    except Exception as e:
        logger.error(f"Failed to fetch models from Hugging Face: {e}", exc_info=True)
        return None


def normalize_portkey_provider_model(model: dict, provider: str) -> dict:
    """
    Normalize model from Portkey unified catalog to catalog schema.

    IMPORTANT: Model IDs are formatted as @provider/model-id to work with Portkey's
    request interface. When calling Portkey APIs, use the model ID directly - the
    portkey_client will handle it correctly.
    """
    try:
        model_id = model.get("id") or model.get("name", "")
        if not model_id:
            return {"source_gateway": provider, f"raw_{provider}": model}

        # Format: @provider/model-id (Portkey compatible format)
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
