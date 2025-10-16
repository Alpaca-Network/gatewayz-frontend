import datetime
import logging
import json
import os
from pathlib import Path

from src.config import Config
from src.cache import (
    _huggingface_cache,
    _models_cache,
    _portkey_models_cache,
    _featherless_models_cache,
    _chutes_models_cache,
    _groq_models_cache,
    _fireworks_models_cache,
    _together_models_cache,
)
from fastapi import APIRouter
from datetime import datetime, timezone
from src.services.pricing_lookup import enrich_model_with_pricing

import httpx

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()


def get_cached_models(gateway: str = "openrouter"):
    """Get cached models or fetch from the requested gateway if cache is expired"""
    try:
        gateway = (gateway or "openrouter").lower()

        if gateway == "portkey":
            cache = _portkey_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_portkey()

        if gateway == "featherless":
            cache = _featherless_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_featherless()

        if gateway == "chutes":
            cache = _chutes_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_chutes()

        if gateway == "groq":
            cache = _groq_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_groq()

        if gateway == "fireworks":
            cache = _fireworks_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_fireworks()

        if gateway == "together":
            cache = _together_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_together()

        if gateway == "all":
            openrouter_models = get_cached_models("openrouter") or []
            portkey_models = get_cached_models("portkey") or []
            featherless_models = get_cached_models("featherless") or []
            chutes_models = get_cached_models("chutes") or []
            groq_models = get_cached_models("groq") or []
            fireworks_models = get_cached_models("fireworks") or []
            together_models = get_cached_models("together") or []
            return openrouter_models + portkey_models + featherless_models + chutes_models + groq_models + fireworks_models + together_models

        # Default to OpenRouter
        if _models_cache["data"] and _models_cache["timestamp"]:
            cache_age = (datetime.now(timezone.utc) - _models_cache["timestamp"]).total_seconds()
            if cache_age < _models_cache["ttl"]:
                return _models_cache["data"]

        # Cache expired or empty, fetch fresh data
        return fetch_models_from_openrouter()
    except Exception as e:
        logger.error(f"Error getting cached models for gateway '{gateway}': {e}")
        return None


def fetch_models_from_openrouter():
    """Fetch models from OpenRouter API"""
    try:
        if not Config.OPENROUTER_API_KEY:
            logger.error("OpenRouter API key not configured")
            return None

        headers = {
            "Authorization": f"Bearer {Config.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }

        response = httpx.get("https://openrouter.ai/api/v1/models", headers=headers)
        response.raise_for_status()

        models_data = response.json()
        models = models_data.get("data", [])
        for model in models:
            model.setdefault("source_gateway", "openrouter")
        _models_cache["data"] = models
        _models_cache["timestamp"] = datetime.now(timezone.utc)

        return _models_cache["data"]
    except Exception as e:
        logger.error(f"Failed to fetch models from OpenRouter: {e}")
        return None



def fetch_models_from_portkey():
    """Fetch models from Portkey API and normalize to the catalog schema"""
    try:
        if not Config.PORTKEY_API_KEY:
            logger.error("Portkey API key not configured")
            return None

        headers = {
            "x-portkey-api-key": Config.PORTKEY_API_KEY
        }

        # Fetch all pages of models
        all_raw_models = []
        limit = 500  # Max per page
        offset = 0
        max_iterations = 20  # Safety limit to prevent infinite loops
        iteration = 0

        while iteration < max_iterations:
            url = f"https://api.portkey.ai/v1/models?limit={limit}&offset={offset}"
            logger.info(f"Fetching Portkey models: offset={offset}, limit={limit}")

            response = httpx.get(url, headers=headers, timeout=20.0)
            response.raise_for_status()

            payload = response.json()
            logger.debug(f"Portkey API response keys: {list(payload.keys())}")

            raw_models = payload.get("data", [])

            # Debug: log response structure
            if iteration == 0:
                logger.info(f"Portkey API response structure: {json.dumps({k: type(v).__name__ for k, v in payload.items()}, indent=2)}")

            if not raw_models:
                # No more models to fetch
                logger.info(f"No more models to fetch at offset {offset}")
                break

            all_raw_models.extend(raw_models)
            logger.info(f"Fetched {len(raw_models)} models (total so far: {len(all_raw_models)})")

            # Check if there are more models to fetch
            if len(raw_models) < limit:
                # Last page (fewer models than limit)
                logger.info(f"Reached last page: got {len(raw_models)} models (limit: {limit})")
                break

            offset += limit
            iteration += 1

        logger.info(f"Finished fetching Portkey models: {len(all_raw_models)} total models across {iteration + 1} pages")

        # Get OpenRouter models for pricing cross-reference
        openrouter_models = get_cached_models("openrouter") or []

        normalized_models = [normalize_portkey_model(model, openrouter_models) for model in all_raw_models if model]

        _portkey_models_cache["data"] = normalized_models
        _portkey_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Cached {len(normalized_models)} Portkey models with pricing cross-reference")
        return _portkey_models_cache["data"]
    except httpx.HTTPStatusError as e:
        logger.error(f"Portkey HTTP error: {e.response.status_code} - {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch models from Portkey: {e}", exc_info=True)
        return None


def normalize_portkey_model(portkey_model: dict, openrouter_models: list = None) -> dict:
    """Normalize Portkey catalog entries to resemble OpenRouter model shape"""
    slug = portkey_model.get("slug") or portkey_model.get("canonical_slug") or portkey_model.get("id")
    if not slug:
        return {"source_gateway": "portkey", "raw_portkey": portkey_model or {}}

    provider_slug = slug.split("/")[0] if "/" in slug else slug
    provider_slug = provider_slug.lstrip("@")

    model_handle = slug.split("/")[-1]
    display_name = model_handle.replace("-", " ").replace("_", " ").title()

    # Try to find matching OpenRouter model for pricing
    pricing = None
    description_suffix = "Pricing data not available from Portkey API."

    if openrouter_models:
        # Clean up the slug for matching
        clean_slug = slug.lstrip("@").split(":")[0]  # Remove @ prefix and :free/:extended suffixes

        # Try multiple matching strategies
        for or_model in openrouter_models:
            or_slug = or_model.get("id", "")
            or_slug_clean = or_slug.split(":")[0]

            # Strategy 1: Exact match
            if or_slug.lower() == slug.lower():
                pricing = or_model.get("pricing")
                description_suffix = "Pricing from OpenRouter (exact match)."
                break

            # Strategy 2: Match without prefixes/suffixes
            if or_slug_clean.lower() == clean_slug.lower():
                pricing = or_model.get("pricing")
                description_suffix = "Pricing from OpenRouter (approximate match)."
                break

            # Strategy 3: Match canonical slug
            or_canonical = or_model.get("canonical_slug", "")
            if or_canonical and or_canonical.lower() == clean_slug.lower():
                pricing = or_model.get("pricing")
                description_suffix = "Pricing from OpenRouter (canonical match)."
                break

    # If no match found, use null
    if not pricing:
        pricing = {
            "prompt": None,
            "completion": None,
            "request": None,
            "image": None,
            "web_search": None,
            "internal_reasoning": None
        }

    description = f"Portkey catalog entry for {slug}. {description_suffix}"

    architecture = {
        "modality": "text->text",
        "input_modalities": ["text"],
        "output_modalities": ["text"],
        "tokenizer": None,
        "instruct_type": None
    }

    return {
        "id": slug,
        "slug": slug,
        "canonical_slug": slug,
        "hugging_face_id": None,
        "name": display_name,
        "created": None,
        "description": description,
        "context_length": 0,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": [],
        "default_parameters": {},
        "provider_slug": provider_slug,
        "provider_site_url": None,
        "model_logo_url": None,
        "source_gateway": "portkey",
        "raw_portkey": portkey_model
    }


def fetch_models_from_featherless():
    """Fetch models from Featherless API and normalize to the catalog schema"""
    try:
        if not Config.FEATHERLESS_API_KEY:
            logger.error("Featherless API key not configured")
            return None

        headers = {
            "Authorization": f"Bearer {Config.FEATHERLESS_API_KEY}"
        }

        response = httpx.get("https://api.featherless.ai/v1/models", headers=headers, timeout=30.0)
        response.raise_for_status()

        payload = response.json()
        raw_models = payload.get("data", [])
        normalized_models = [normalize_featherless_model(model) for model in raw_models if model]

        _featherless_models_cache["data"] = normalized_models
        _featherless_models_cache["timestamp"] = datetime.now(timezone.utc)

        return _featherless_models_cache["data"]
    except httpx.HTTPStatusError as e:
        logger.error(f"Featherless HTTP error: {e.response.status_code} - {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch models from Featherless: {e}")
        return None


def normalize_featherless_model(featherless_model: dict) -> dict:
    """Normalize Featherless catalog entries to resemble OpenRouter model shape"""
    model_id = featherless_model.get("id", "")
    if not model_id:
        return {"source_gateway": "featherless", "raw_featherless": featherless_model or {}}

    # Extract provider slug (everything before the last slash)
    provider_slug = model_id.split("/")[0] if "/" in model_id else "featherless"

    # Model handle is the full ID
    model_handle = model_id
    display_name = model_id.replace("-", " ").replace("_", " ").title()

    description = f"Featherless catalog entry for {model_id}. Pricing data not available from Featherless API."

    # Use null for unknown pricing (Featherless API doesn't provide pricing)
    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
        "web_search": None,
        "internal_reasoning": None
    }

    architecture = {
        "modality": "text->text",
        "input_modalities": ["text"],
        "output_modalities": ["text"],
        "tokenizer": None,
        "instruct_type": None
    }

    normalized = {
        "id": model_id,
        "slug": model_id,
        "canonical_slug": model_id,
        "hugging_face_id": None,
        "name": display_name,
        "created": featherless_model.get("created"),
        "description": description,
        "context_length": 0,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": [],
        "default_parameters": {},
        "provider_slug": provider_slug,
        "provider_site_url": None,
        "model_logo_url": None,
        "source_gateway": "featherless",
        "raw_featherless": featherless_model
    }
    
    # Enrich with manual pricing if available
    return enrich_model_with_pricing(normalized, "featherless")


def fetch_models_from_chutes():
    """Fetch models from Chutes static catalog or API"""
    try:
        # First, try to load from static catalog file
        catalog_path = Path(__file__).parent.parent / "data" / "chutes_catalog.json"

        if catalog_path.exists():
            logger.info(f"Loading Chutes models from static catalog: {catalog_path}")
            with open(catalog_path, 'r') as f:
                raw_models = json.load(f)

            normalized_models = [normalize_chutes_model(model) for model in raw_models if model]

            _chutes_models_cache["data"] = normalized_models
            _chutes_models_cache["timestamp"] = datetime.now(timezone.utc)

            logger.info(f"Loaded {len(normalized_models)} models from Chutes static catalog")
            return _chutes_models_cache["data"]

        # If static catalog doesn't exist, try API (if key is configured)
        if Config.CHUTES_API_KEY:
            logger.info("Attempting to fetch Chutes models from API")
            return fetch_models_from_chutes_api()

        logger.warning("Chutes catalog file not found and no API key configured")
        return None

    except Exception as e:
        logger.error(f"Failed to fetch models from Chutes: {e}")
        return None


def fetch_models_from_chutes_api():
    """Fetch models from Chutes API (if available)"""
    try:
        if not Config.CHUTES_API_KEY:
            logger.error("Chutes API key not configured")
            return None

        # This is a placeholder for future API integration
        # For now, we're using the static catalog
        logger.warning("Chutes API integration not yet implemented, using static catalog")
        return None

    except Exception as e:
        logger.error(f"Failed to fetch models from Chutes API: {e}")
        return None


def fetch_models_from_groq():
    """Fetch models from Groq API and normalize to the catalog schema"""
    try:
        if not Config.GROQ_API_KEY:
            logger.error("Groq API key not configured")
            return None

        headers = {
            "Authorization": f"Bearer {Config.GROQ_API_KEY}",
            "Content-Type": "application/json",
        }

        response = httpx.get(
            "https://api.groq.com/openai/v1/models",
            headers=headers,
            timeout=20.0,
        )
        response.raise_for_status()

        payload = response.json()
        raw_models = payload.get("data", [])
        normalized_models = [normalize_groq_model(model) for model in raw_models if model]

        _groq_models_cache["data"] = normalized_models
        _groq_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Fetched {len(normalized_models)} Groq models")
        return _groq_models_cache["data"]
    except httpx.HTTPStatusError as e:
        logger.error(f"Groq HTTP error: {e.response.status_code} - {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch models from Groq: {e}")
        return None


def normalize_chutes_model(chutes_model: dict) -> dict:
    """Normalize Chutes catalog entries to resemble OpenRouter model shape"""
    model_id = chutes_model.get("id", "")
    if not model_id:
        return {"source_gateway": "chutes", "raw_chutes": chutes_model or {}}

    provider_slug = chutes_model.get("provider", "chutes")
    model_type = chutes_model.get("type", "LLM")
    pricing_per_hour = chutes_model.get("pricing_per_hour", 0.0)

    # Convert hourly pricing to per-token pricing (rough estimate)
    # Assume ~1M tokens per hour at average speed
    prompt_price = str(pricing_per_hour / 1000000) if pricing_per_hour > 0 else "0"

    display_name = chutes_model.get("name", model_id.replace("-", " ").replace("_", " ").title())

    description = f"Chutes.ai hosted {model_type} model: {model_id}. Pricing: ${pricing_per_hour}/hr."

    # Determine modality based on type
    modality_map = {
        "LLM": "text->text",
        "Image Generation": "text->image",
        "Text to Speech": "text->audio",
        "Speech to Text": "audio->text",
        "Video": "text->video",
        "Music Generation": "text->audio",
        "Embeddings": "text->embedding",
        "Content Moderation": "text->text",
        "Other": "multimodal"
    }

    modality = modality_map.get(model_type, "text->text")

    pricing = {
        "prompt": prompt_price,
        "completion": prompt_price,
        "request": "0",
        "image": str(pricing_per_hour) if model_type == "Image Generation" else "0",
        "web_search": "0",
        "internal_reasoning": "0",
        "hourly_rate": str(pricing_per_hour)
    }

    architecture = {
        "modality": modality,
        "input_modalities": ["text"],
        "output_modalities": ["text"],
        "tokenizer": None,
        "instruct_type": None
    }

    tags = chutes_model.get("tags", [])

    normalized = {
        "id": model_id,
        "slug": model_id,
        "canonical_slug": model_id,
        "hugging_face_id": None,
        "name": display_name,
        "created": None,
        "description": description,
        "context_length": 0,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": [],
        "default_parameters": {},
        "provider_slug": provider_slug,
        "provider_site_url": None,
        "model_logo_url": None,
        "source_gateway": "chutes",
        "model_type": model_type,
        "tags": tags,
        "raw_chutes": chutes_model
    }
    
    # Enrich with manual pricing if available (overrides hourly pricing)
    return enrich_model_with_pricing(normalized, "chutes")


def normalize_groq_model(groq_model: dict) -> dict:
    """Normalize Groq catalog entries to resemble OpenRouter model shape"""
    model_id = groq_model.get("id")
    if not model_id:
        return {"source_gateway": "groq", "raw_groq": groq_model or {}}

    slug = f"groq/{model_id}"
    provider_slug = "groq"

    display_name = groq_model.get("display_name") or model_id.replace("-", " ").replace("_", " ").title()
    owned_by = groq_model.get("owned_by")
    base_description = groq_model.get("description") or f"Groq hosted model {model_id}."
    if owned_by and owned_by.lower() not in base_description.lower():
        description = f"{base_description} Owned by {owned_by}."
    else:
        description = base_description

    metadata = groq_model.get("metadata") or {}
    hugging_face_id = metadata.get("huggingface_repo")

    context_length = metadata.get("context_length") or groq_model.get("context_length") or 0

    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
        "web_search": None,
        "internal_reasoning": None,
    }

    architecture = {
        "modality": metadata.get("modality", "text->text"),
        "input_modalities": metadata.get("input_modalities") or ["text"],
        "output_modalities": metadata.get("output_modalities") or ["text"],
        "tokenizer": metadata.get("tokenizer"),
        "instruct_type": metadata.get("instruct_type"),
    }

    normalized = {
        "id": slug,
        "slug": slug,
        "canonical_slug": slug,
        "hugging_face_id": hugging_face_id,
        "name": display_name,
        "created": groq_model.get("created"),
        "description": description,
        "context_length": context_length,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": metadata.get("supported_parameters", []),
        "default_parameters": metadata.get("default_parameters", {}),
        "provider_slug": provider_slug,
        "provider_site_url": "https://groq.com",
        "model_logo_url": metadata.get("model_logo_url"),
        "source_gateway": "groq",
        "raw_groq": groq_model,
    }

    return enrich_model_with_pricing(normalized, "groq")


def fetch_models_from_fireworks():
    """Fetch models from Fireworks API and normalize to the catalog schema"""
    try:
        if not Config.FIREWORKS_API_KEY:
            logger.error("Fireworks API key not configured")
            return None

        headers = {
            "Authorization": f"Bearer {Config.FIREWORKS_API_KEY}",
            "Content-Type": "application/json",
        }

        response = httpx.get(
            "https://api.fireworks.ai/inference/v1/models",
            headers=headers,
            timeout=20.0,
        )
        response.raise_for_status()

        payload = response.json()
        raw_models = payload.get("data", [])
        normalized_models = [normalize_fireworks_model(model) for model in raw_models if model]

        _fireworks_models_cache["data"] = normalized_models
        _fireworks_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Fetched {len(normalized_models)} Fireworks models")
        return _fireworks_models_cache["data"]
    except httpx.HTTPStatusError as e:
        logger.error(f"Fireworks HTTP error: {e.response.status_code} - {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch models from Fireworks: {e}")
        return None


def normalize_fireworks_model(fireworks_model: dict) -> dict:
    """Normalize Fireworks catalog entries to resemble OpenRouter model shape"""
    model_id = fireworks_model.get("id")
    if not model_id:
        return {"source_gateway": "fireworks", "raw_fireworks": fireworks_model or {}}

    # Fireworks uses format like "accounts/fireworks/models/deepseek-v3p1"
    # We'll keep the full ID as-is
    slug = model_id
    provider_slug = "fireworks"

    display_name = fireworks_model.get("display_name") or model_id.split("/")[-1].replace("-", " ").replace("_", " ").title()
    owned_by = fireworks_model.get("owned_by")
    base_description = fireworks_model.get("description") or f"Fireworks hosted model {model_id}."
    if owned_by and owned_by.lower() not in base_description.lower():
        description = f"{base_description} Owned by {owned_by}."
    else:
        description = base_description

    metadata = fireworks_model.get("metadata") or {}
    context_length = metadata.get("context_length") or fireworks_model.get("context_length") or 0

    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
        "web_search": None,
        "internal_reasoning": None,
    }

    architecture = {
        "modality": metadata.get("modality", "text->text"),
        "input_modalities": metadata.get("input_modalities") or ["text"],
        "output_modalities": metadata.get("output_modalities") or ["text"],
        "tokenizer": metadata.get("tokenizer"),
        "instruct_type": metadata.get("instruct_type"),
    }

    normalized = {
        "id": slug,
        "slug": slug,
        "canonical_slug": slug,
        "hugging_face_id": None,
        "name": display_name,
        "created": fireworks_model.get("created"),
        "description": description,
        "context_length": context_length,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": metadata.get("supported_parameters", []),
        "default_parameters": metadata.get("default_parameters", {}),
        "provider_slug": provider_slug,
        "provider_site_url": "https://fireworks.ai",
        "model_logo_url": None,
        "source_gateway": "fireworks",
        "raw_fireworks": fireworks_model,
    }

    return enrich_model_with_pricing(normalized, "fireworks")


def fetch_specific_model_from_openrouter(provider_name: str, model_name: str):
    """Fetch specific model data from OpenRouter API"""
    try:
        if not Config.OPENROUTER_API_KEY:
            logger.error("OpenRouter API key not configured")
            return None

        headers = {
            "Authorization": f"Bearer {Config.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }

        # Use the specific model endpoint
        url = f"https://openrouter.ai/api/v1/models/{provider_name}/{model_name}/endpoints"
        response = httpx.get(url, headers=headers)
        response.raise_for_status()

        model_data = response.json()
        return model_data.get("data")
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} from OpenRouter: {e}")
        return None



def fetch_models_from_together():
    """Fetch models from Together.ai API and normalize to the catalog schema"""
    try:
        if not Config.TOGETHER_API_KEY:
            logger.error("Together API key not configured")
            return None

        headers = {
            "Authorization": f"Bearer {Config.TOGETHER_API_KEY}",
            "Content-Type": "application/json",
        }

        response = httpx.get(
            "https://api.together.xyz/v1/models",
            headers=headers,
            timeout=20.0,
        )
        response.raise_for_status()

        payload = response.json()
        # Together API returns a list directly, not wrapped in {"data": [...]}
        raw_models = payload if isinstance(payload, list) else payload.get("data", [])
        normalized_models = [normalize_together_model(model) for model in raw_models if model]

        _together_models_cache["data"] = normalized_models
        _together_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Fetched {len(normalized_models)} Together models")
        return _together_models_cache["data"]
    except httpx.HTTPStatusError as e:
        logger.error(f"Together HTTP error: {e.response.status_code} - {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch models from Together: {e}")
        return None


def normalize_together_model(together_model: dict) -> dict:
    """Normalize Together catalog entries to resemble OpenRouter model shape"""
    model_id = together_model.get("id")
    if not model_id:
        return {"source_gateway": "together", "raw_together": together_model or {}}

    slug = model_id
    provider_slug = "together"

    display_name = together_model.get("display_name") or model_id.replace("/", " / ").replace("-", " ").replace("_", " ").title()
    owned_by = together_model.get("owned_by") or together_model.get("organization")
    base_description = together_model.get("description") or f"Together hosted model {model_id}."
    if owned_by and owned_by.lower() not in base_description.lower():
        description = f"{base_description} Owned by {owned_by}."
    else:
        description = base_description

    context_length = together_model.get("context_length", 0)

    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
        "web_search": None,
        "internal_reasoning": None,
    }

    # Extract pricing if available
    pricing_info = together_model.get("pricing", {})
    if pricing_info:
        pricing["prompt"] = pricing_info.get("input")
        pricing["completion"] = pricing_info.get("output")

    architecture = {
        "modality": "text->text",
        "input_modalities": ["text"],
        "output_modalities": ["text"],
        "tokenizer": together_model.get("config", {}).get("tokenizer"),
        "instruct_type": None,
    }

    normalized = {
        "id": slug,
        "slug": slug,
        "canonical_slug": slug,
        "hugging_face_id": None,
        "name": display_name,
        "created": together_model.get("created"),
        "description": description,
        "context_length": context_length,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": [],
        "default_parameters": {},
        "provider_slug": provider_slug,
        "provider_site_url": "https://together.ai",
        "model_logo_url": None,
        "source_gateway": "together",
        "raw_together": together_model,
    }

    return enrich_model_with_pricing(normalized, "together")


def fetch_specific_model_from_together(provider_name: str, model_name: str):
    """Fetch specific model data from Together by searching cached models"""
    try:
        model_id = f"{provider_name}/{model_name}"

        together_models = get_cached_models("together")
        if together_models:
            for model in together_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model

        fresh_models = fetch_models_from_together()
        if fresh_models:
            for model in fresh_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model

        logger.warning(f"Model {model_id} not found in Together catalog")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} from Together: {e}")
        return None
def fetch_specific_model_from_portkey(provider_name: str, model_name: str):
    """Fetch specific model data from Portkey by searching cached models"""
    try:
        # Construct the model ID
        model_id = f"{provider_name}/{model_name}"
        
        # First check cache
        portkey_models = get_cached_models("portkey")
        if portkey_models:
            for model in portkey_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model
        
        # If not in cache, try to fetch fresh data
        fresh_models = fetch_models_from_portkey()
        if fresh_models:
            for model in fresh_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model
        
        logger.warning(f"Model {model_id} not found in Portkey catalog")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} from Portkey: {e}")
        return None


def fetch_specific_model_from_featherless(provider_name: str, model_name: str):
    """Fetch specific model data from Featherless by searching cached models"""
    try:
        # Construct the model ID
        model_id = f"{provider_name}/{model_name}"
        
        # First check cache
        featherless_models = get_cached_models("featherless")
        if featherless_models:
            for model in featherless_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model
        
        # If not in cache, try to fetch fresh data
        fresh_models = fetch_models_from_featherless()
        if fresh_models:
            for model in fresh_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model
        
        logger.warning(f"Model {model_id} not found in Featherless catalog")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} from Featherless: {e}")
        return None


def fetch_specific_model_from_deepinfra(provider_name: str, model_name: str):
    """Fetch specific model data from DeepInfra API"""
    try:
        if not Config.DEEPINFRA_API_KEY:
            logger.error("DeepInfra API key not configured")
            return None

        headers = {
            "Authorization": f"Bearer {Config.DEEPINFRA_API_KEY}",
            "Content-Type": "application/json"
        }

        # Construct the model ID
        model_id = f"{provider_name}/{model_name}"

        # DeepInfra uses standard /v1/models endpoint
        response = httpx.get("https://api.deepinfra.com/v1/openai/models", headers=headers, timeout=20.0)
        response.raise_for_status()

        models_data = response.json()
        models = models_data.get("data", [])
        
        # Search for the specific model
        for model in models:
            if model.get("id", "").lower() == model_id.lower():
                # Normalize to our schema
                return normalize_deepinfra_model(model)
        
        logger.warning(f"Model {model_id} not found in DeepInfra catalog")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} from DeepInfra: {e}")
        return None


def normalize_deepinfra_model(deepinfra_model: dict) -> dict:
    """Normalize DeepInfra model to our schema"""
    model_id = deepinfra_model.get("id", "")
    if not model_id:
        return {"source_gateway": "deepinfra", "raw_deepinfra": deepinfra_model or {}}

    provider_slug = model_id.split("/")[0] if "/" in model_id else "deepinfra"
    display_name = model_id.replace("-", " ").replace("_", " ").title()

    description = f"DeepInfra hosted model: {model_id}. Pricing data may vary by region and usage."

    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
        "web_search": None,
        "internal_reasoning": None
    }

    architecture = {
        "modality": "text->text",
        "input_modalities": ["text"],
        "output_modalities": ["text"],
        "tokenizer": None,
        "instruct_type": None
    }

    normalized = {
        "id": model_id,
        "slug": model_id,
        "canonical_slug": model_id,
        "hugging_face_id": None,
        "name": display_name,
        "created": deepinfra_model.get("created"),
        "description": description,
        "context_length": 0,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": [],
        "default_parameters": {},
        "provider_slug": provider_slug,
        "provider_site_url": None,
        "model_logo_url": None,
        "source_gateway": "deepinfra",
        "raw_deepinfra": deepinfra_model
    }
    
    # Enrich with manual pricing if available
    return enrich_model_with_pricing(normalized, "deepinfra")


def fetch_specific_model_from_chutes(provider_name: str, model_name: str):
    """Fetch specific model data from Chutes by searching cached models"""
    try:
        # Construct the model ID
        model_id = f"{provider_name}/{model_name}"
        
        # First check cache
        chutes_models = get_cached_models("chutes")
        if chutes_models:
            for model in chutes_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model
        
        # If not in cache, try to fetch fresh data
        fresh_models = fetch_models_from_chutes()
        if fresh_models:
            for model in fresh_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model
        
        logger.warning(f"Model {model_id} not found in Chutes catalog")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} from Chutes: {e}")
        return None


def fetch_specific_model_from_groq(provider_name: str, model_name: str):
    """Fetch specific model data from Groq by searching cached models"""
    try:
        model_id = f"{provider_name}/{model_name}"

        groq_models = get_cached_models("groq")
        if groq_models:
            for model in groq_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model

        fresh_models = fetch_models_from_groq()
        if fresh_models:
            for model in fresh_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model

        logger.warning(f"Model {model_id} not found in Groq catalog")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} from Groq: {e}")
        return None


def fetch_specific_model_from_fireworks(provider_name: str, model_name: str):
    """Fetch specific model data from Fireworks by searching cached models"""
    try:
        model_id = f"{provider_name}/{model_name}"

        fireworks_models = get_cached_models("fireworks")
        if fireworks_models:
            for model in fireworks_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model

        fresh_models = fetch_models_from_fireworks()
        if fresh_models:
            for model in fresh_models:
                if model.get("id", "").lower() == model_id.lower():
                    return model

        logger.warning(f"Model {model_id} not found in Fireworks catalog")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} from Fireworks: {e}")
        return None


def detect_model_gateway(provider_name: str, model_name: str) -> str:
    """Detect which gateway a model belongs to by searching all caches
    
    Returns:
        Gateway name: 'openrouter', 'portkey', 'featherless', 'deepinfra', 'chutes', 'groq', 'fireworks', or None
    """
    try:
        model_id = f"{provider_name}/{model_name}".lower()
        
        # Check each gateway's cache
        gateways = ["openrouter", "portkey", "featherless", "chutes", "groq", "fireworks"]
        
        for gateway in gateways:
            models = get_cached_models(gateway)
            if models:
                for model in models:
                    if model.get("id", "").lower() == model_id:
                        return gateway
        
        # Default to openrouter if not found
        return "openrouter"
    except Exception as e:
        logger.error(f"Error detecting gateway for model {provider_name}/{model_name}: {e}")
        return "openrouter"


def fetch_specific_model(provider_name: str, model_name: str, gateway: str = None):
    """Fetch specific model from the appropriate gateway
    
    Args:
        provider_name: Provider name (e.g., 'openai', 'anthropic')
        model_name: Model name (e.g., 'gpt-4', 'claude-3')
        gateway: Optional gateway override. If not provided, auto-detects
        
    Returns:
        Model data dict or None if not found
    """
    try:
        # If gateway not specified, detect it
        if not gateway:
            gateway = detect_model_gateway(provider_name, model_name)
        
        gateway = gateway.lower()
        
        # Fetch from appropriate gateway
        if gateway == "openrouter":
            return fetch_specific_model_from_openrouter(provider_name, model_name)
        elif gateway == "portkey":
            return fetch_specific_model_from_portkey(provider_name, model_name)
        elif gateway == "featherless":
            return fetch_specific_model_from_featherless(provider_name, model_name)
        elif gateway == "deepinfra":
            return fetch_specific_model_from_deepinfra(provider_name, model_name)
        elif gateway == "chutes":
            return fetch_specific_model_from_chutes(provider_name, model_name)
        elif gateway == "groq":
            return fetch_specific_model_from_groq(provider_name, model_name)
        elif gateway == "fireworks":
            return fetch_specific_model_from_fireworks(provider_name, model_name)
        else:
            logger.warning(f"Unknown gateway: {gateway}, defaulting to OpenRouter")
            return fetch_specific_model_from_openrouter(provider_name, model_name)
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} from gateway {gateway}: {e}")
        return None


def get_cached_huggingface_model(hugging_face_id: str):
    """Get cached Hugging Face model data or fetch if not cached"""
    try:
        # Check if we have cached data for this specific model
        if hugging_face_id in _huggingface_cache["data"]:
            return _huggingface_cache["data"][hugging_face_id]

        # Fetch from Hugging Face API
        return fetch_huggingface_model(hugging_face_id)
    except Exception as e:
        logger.error(f"Error getting cached Hugging Face model {hugging_face_id}: {e}")
        return None


def fetch_huggingface_model(hugging_face_id: str):
    """Fetch model data from Hugging Face API"""
    try:
        # Hugging Face API endpoint for model info
        url = f"https://huggingface.co/api/models/{hugging_face_id}"

        response = httpx.get(url, timeout=10.0)
        response.raise_for_status()

        model_data = response.json()

        # Cache the result
        _huggingface_cache["data"][hugging_face_id] = model_data
        _huggingface_cache["timestamp"] = datetime.now(timezone.utc)

        return model_data
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.warning(f"Hugging Face model {hugging_face_id} not found")
            return None
        else:
            logger.error(f"HTTP error fetching Hugging Face model {hugging_face_id}: {e}")
            return None
    except Exception as e:
        logger.error(f"Failed to fetch Hugging Face model {hugging_face_id}: {e}")
        return None


def enhance_model_with_huggingface_data(openrouter_model: dict) -> dict:
    """Enhance OpenRouter model data with Hugging Face information"""
    try:
        hugging_face_id = openrouter_model.get('hugging_face_id')
        if not hugging_face_id:
            return openrouter_model

        # Get Hugging Face data
        hf_data = get_cached_huggingface_model(hugging_face_id)
        if not hf_data:
            return openrouter_model

        # Extract author data more robustly
        author_data = None
        if hf_data.get('author_data'):
            author_data = {
                "name": hf_data['author_data'].get('name'),
                "fullname": hf_data['author_data'].get('fullname'),
                "avatar_url": hf_data['author_data'].get('avatarUrl'),
                "follower_count": hf_data['author_data'].get('followerCount', 0)
            }
        elif hf_data.get('author'):
            # Fallback: create basic author data from author field
            author_data = {
                "name": hf_data.get('author'),
                "fullname": hf_data.get('author'),
                "avatar_url": None,
                "follower_count": 0
            }

        # Create enhanced model data
        enhanced_model = {
            **openrouter_model,
            "huggingface_metrics": {
                "downloads": hf_data.get('downloads', 0),
                "likes": hf_data.get('likes', 0),
                "pipeline_tag": hf_data.get('pipeline_tag'),
                "num_parameters": hf_data.get('numParameters'),
                "gated": hf_data.get('gated', False),
                "private": hf_data.get('private', False),
                "last_modified": hf_data.get('lastModified'),
                "author": hf_data.get('author'),
                "author_data": author_data,
                "available_inference_providers": hf_data.get('availableInferenceProviders', []),
                "widget_output_urls": hf_data.get('widgetOutputUrls', []),
                "is_liked_by_user": hf_data.get('isLikedByUser', False)
            }
        }

        return enhanced_model
    except Exception as e:
        logger.error(f"Error enhancing model with Hugging Face data: {e}")
        return openrouter_model


def get_model_count_by_provider(provider_slug: str, models_data: list = None) -> int:
    """Get count of models for a specific provider"""
    try:
        if not models_data or not provider_slug:
            return 0

        count = 0
        for model in models_data:
            model_id = model.get('id', '')
            if '/' in model_id:
                model_provider = model_id.split('/')[0]
                if model_provider == provider_slug:
                    count += 1

        return count
    except Exception as e:
        logger.error(f"Error counting models for provider {provider_slug}: {e}")
        return 0


def enhance_model_with_provider_info(openrouter_model: dict, providers_data: list = None) -> dict:
    """Enhance OpenRouter model data with provider information and logo"""
    try:
        model_id = openrouter_model.get('id', '')

        # Extract provider slug from model id (e.g., "openai/gpt-4" -> "openai")
        provider_slug = None
        if '/' in model_id:
            provider_slug = model_id.split('/')[0]

        # Get provider information
        provider_site_url = None
        if providers_data and provider_slug:
            for provider in providers_data:
                if provider.get('slug') == provider_slug:
                    provider_site_url = provider.get('site_url')
                    break

        # Generate model logo URL using Google favicon service
        model_logo_url = None
        if provider_site_url:
            # Clean the site URL for favicon service
            clean_url = provider_site_url.replace('https://', '').replace('http://', '')
            if clean_url.startswith('www.'):
                clean_url = clean_url[4:]
            model_logo_url = f"https://www.google.com/s2/favicons?domain={clean_url}&sz=128"
            logger.info(f"Generated model_logo_url: {model_logo_url}")

        # Add provider information to model
        enhanced_model = {
            **openrouter_model,
            "provider_slug": provider_slug,
            "provider_site_url": provider_site_url,
            "model_logo_url": model_logo_url
        }

        return enhanced_model
    except Exception as e:
        logger.error(f"Error enhancing model with provider info: {e}")
        return openrouter_model

