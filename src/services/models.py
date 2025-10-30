import datetime
import logging
import json
import os
from pathlib import Path
import csv
from typing import Optional

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
    _deepinfra_models_cache,
    _google_models_cache,
    _cerebras_models_cache,
    _nebius_models_cache,
    _xai_models_cache,
    _novita_models_cache,
    _huggingface_models_cache,
    _aimo_models_cache,
    _near_models_cache,
)
from fastapi import APIRouter
from datetime import datetime, timezone
from src.services.pricing_lookup import enrich_model_with_pricing
from src.services.portkey_providers import (
    fetch_models_from_google,
    fetch_models_from_cerebras,
    fetch_models_from_nebius,
    fetch_models_from_xai,
    fetch_models_from_novita,
)
from src.services.huggingface_models import fetch_models_from_hug, get_huggingface_model_info
from src.services.model_transformations import detect_provider_from_model_id

import httpx


def sanitize_pricing(pricing: dict) -> dict:
    """
    Sanitize pricing data by converting negative values to 0.
    
    OpenRouter uses -1 to indicate dynamic pricing (e.g., for auto-routing models).
    We convert these to 0 to avoid issues in cost calculations.
    
    Args:
        pricing: Pricing dictionary from API
        
    Returns:
        Sanitized pricing dictionary
    """
    if not pricing or not isinstance(pricing, dict):
        return pricing
    
    sanitized = pricing.copy()
    for key in ['prompt', 'completion', 'request', 'image', 'web_search', 'internal_reasoning']:
        if key in sanitized:
            try:
                value = sanitized[key]
                if value is not None:
                    # Convert to float and check if negative
                    float_value = float(value)
                    if float_value < 0:
                        sanitized[key] = "0"
                        logger.debug(f"Converted negative pricing {key}={value} to 0")
            except (ValueError, TypeError):
                # Keep the original value if conversion fails
                pass
    
    return sanitized

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()


def load_featherless_catalog_export() -> list:
    """
    Load Featherless models from a static export CSV if available.
    Returns a list of normalized model records or None.
    """
    try:
        repo_root = Path(__file__).resolve().parents[2]
        export_candidates = [
            repo_root / "models_export_2025-10-16_202520.csv",
            repo_root / "models_export_2025-10-16_202501.csv",
        ]

        for csv_path in export_candidates:
            if not csv_path.exists():
                continue

            logger.info(f"Loading Featherless catalog export from {csv_path}")
            with csv_path.open("r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                rows = [row for row in reader if (row.get("gateway") or "").lower() == "featherless"]

            if not rows:
                logger.warning(f"No Featherless rows found in export {csv_path}")
                continue

            normalized = []
            for row in rows:
                model_id = row.get("id")
                if not model_id:
                    continue

                try:
                    context_length = int(float(row.get("context_length", 0) or 0))
                except (TypeError, ValueError):
                    context_length = 0

                def parse_price(value: str) -> str:
                    try:
                        if value is None or value == "":
                            return "0"
                        return str(float(value))
                    except (TypeError, ValueError):
                        return "0"

                prompt_price = parse_price(row.get("prompt_price"))
                completion_price = parse_price(row.get("completion_price"))

                normalized.append(
                    {
                        "id": model_id,
                        "slug": model_id,
                        "canonical_slug": model_id,
                        "hugging_face_id": None,
                        "name": row.get("name") or model_id,
                        "created": None,
                        "description": row.get("description") or f"Featherless catalog entry for {model_id}.",
                        "context_length": context_length,
                        "architecture": {
                            "modality": row.get("modality") or "text->text",
                            "input_modalities": ["text"],
                            "output_modalities": ["text"],
                            "tokenizer": None,
                            "instruct_type": None,
                        },
                        "pricing": {
                            "prompt": prompt_price,
                            "completion": completion_price,
                            "request": "0",
                            "image": "0",
                            "web_search": "0",
                            "internal_reasoning": "0",
                        },
                        "top_provider": None,
                        "per_request_limits": None,
                        "supported_parameters": [],
                        "default_parameters": {},
                        "provider_slug": row.get("provider_slug") or (model_id.split("/")[0] if "/" in model_id else "featherless"),
                        "provider_site_url": None,
                        "model_logo_url": None,
                        "source_gateway": "featherless",
                        "raw_featherless": row,
                    }
                )

            logger.info(f"Loaded {len(normalized)} Featherless models from export {csv_path}")
            return normalized
        return None
    except Exception as exc:
        logger.error(f"Failed to load Featherless catalog export: {exc}", exc_info=True)
        return None


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

        if gateway == "deepinfra":
            cache = _deepinfra_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_deepinfra()

        if gateway == "google":
            cache = _google_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_google()

        if gateway == "cerebras":
            cache = _cerebras_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_cerebras()

        if gateway == "nebius":
            cache = _nebius_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_nebius()

        if gateway == "xai":
            cache = _xai_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_xai()

        if gateway == "novita":
            cache = _novita_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_novita()

        if gateway == "hug" or gateway == "huggingface":
            from src.services.huggingface_models import ESSENTIAL_MODELS

            cache = _huggingface_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    # Validate cache has reasonable number of models (should be 500+, not just 9)
                    cache_size = len(cache["data"])
                    if cache_size < 100:
                        logger.warning(f"⚠️  Hugging Face cache is suspiciously small ({cache_size} models). This might indicate a failed fetch or incomplete data. Refetching...")
                    else:
                        cached_ids = {model.get("id", "").lower() for model in cache["data"]}
                        essential_missing = any(model_id.lower() not in cached_ids for model_id in ESSENTIAL_MODELS)
                        if not essential_missing:
                            logger.debug(f"Using cached Hugging Face models ({cache_size} models, age: {cache_age:.0f}s)")
                            return cache["data"]
                        logger.info("Hugging Face cache missing essential models; refetching catalog")

            logger.info("Fetching fresh Hugging Face models catalog...")
            result = fetch_models_from_hug()

            # Validate result
            if result:
                logger.info(f"✅ Successfully loaded {len(result)} Hugging Face models")
            else:
                logger.error("❌ Failed to fetch Hugging Face models - API may be unavailable or rate limited")

            # WORKAROUND: Explicitly update cache in case of module import issues
            if result and not cache["data"]:
                logger.info("Manually updating HuggingFace cache after fetch")
                _huggingface_models_cache["data"] = result
                _huggingface_models_cache["timestamp"] = datetime.now(timezone.utc)

            return result

        if gateway == "aimo":
            cache = _aimo_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_aimo()

        if gateway == "near":
            cache = _near_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_near()

        if gateway == "all":
            openrouter_models = get_cached_models("openrouter") or []
            portkey_models = get_cached_models("portkey") or []
            featherless_models = get_cached_models("featherless") or []
            deepinfra_models = get_cached_models("deepinfra") or []
            google_models = get_cached_models("google") or []
            cerebras_models = get_cached_models("cerebras") or []
            nebius_models = get_cached_models("nebius") or []
            xai_models = get_cached_models("xai") or []
            novita_models = get_cached_models("novita") or []
            hug_models = get_cached_models("hug") or []
            chutes_models = get_cached_models("chutes") or []
            groq_models = get_cached_models("groq") or []
            fireworks_models = get_cached_models("fireworks") or []
            together_models = get_cached_models("together") or []
            aimo_models = get_cached_models("aimo") or []
            near_models = get_cached_models("near") or []
            return openrouter_models + portkey_models + featherless_models + deepinfra_models + google_models + cerebras_models + nebius_models + xai_models + novita_models + hug_models + chutes_models + groq_models + fireworks_models + together_models + aimo_models + near_models

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
            # Sanitize pricing to convert negative values (e.g., -1 for autorouter) to 0
            if "pricing" in model:
                model["pricing"] = sanitize_pricing(model["pricing"])
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
            "x-portkey-api-key": Config.PORTKEY_API_KEY,
            "Content-Type": "application/json"
        }

        # Portkey API returns all models in a single request (no pagination support)
        url = "https://api.portkey.ai/v1/models"
        logger.info(f"Fetching Portkey models from {url}")

        response = httpx.get(url, headers=headers, timeout=20.0)
        response.raise_for_status()

        payload = response.json()
        logger.info(f"Portkey API response structure: {json.dumps({k: type(v).__name__ for k, v in payload.items()}, indent=2)}")

        raw_models = payload.get("data", [])
        logger.info(f"Fetched {len(raw_models)} models from Portkey")

        # Get OpenRouter models for pricing cross-reference
        openrouter_models = get_cached_models("openrouter") or []

        normalized_models = [normalize_portkey_model(model, openrouter_models) for model in raw_models if model]

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


def fetch_models_from_deepinfra():
    """Fetch models from DeepInfra API and normalize to the catalog schema"""
    try:
        if not Config.DEEPINFRA_API_KEY:
            logger.error("DeepInfra API key not configured - please set DEEPINFRA_API_KEY environment variable")
            return None

        # Log that we're attempting to fetch
        api_key_preview = Config.DEEPINFRA_API_KEY[:5] + "***" if Config.DEEPINFRA_API_KEY else "NONE"
        logger.info(f"DeepInfra API key found (preview: {api_key_preview})")

        headers = {
            "Authorization": f"Bearer {Config.DEEPINFRA_API_KEY}",
            "Content-Type": "application/json"
        }

        # DeepInfra API - use /models/list endpoint which has better model data
        url = "https://api.deepinfra.com/models/list"
        logger.info(f"Fetching DeepInfra models from {url}")

        response = httpx.get(url, headers=headers, timeout=20.0)

        logger.info(f"DeepInfra API response status: {response.status_code}")
        response.raise_for_status()

        payload = response.json()

        # DeepInfra /models/list returns array directly, not wrapped in an object
        if isinstance(payload, list):
            raw_models = payload
        else:
            raw_models = payload.get("data", [])

        logger.info(f"Fetched {len(raw_models)} models from DeepInfra")

        normalized_models = [normalize_deepinfra_model(model) for model in raw_models if model]

        _deepinfra_models_cache["data"] = normalized_models
        _deepinfra_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Successfully cached {len(normalized_models)} DeepInfra models")
        return _deepinfra_models_cache["data"]
    except httpx.HTTPStatusError as e:
        logger.error(f"DeepInfra HTTP error: {e.response.status_code} - {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch models from DeepInfra: {e}", exc_info=True)
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
                pricing = sanitize_pricing(or_model.get("pricing"))
                description_suffix = "Pricing from OpenRouter (exact match)."
                break

            # Strategy 2: Match without prefixes/suffixes
            if or_slug_clean.lower() == clean_slug.lower():
                pricing = sanitize_pricing(or_model.get("pricing"))
                description_suffix = "Pricing from OpenRouter (approximate match)."
                break

            # Strategy 3: Match canonical slug
            or_canonical = or_model.get("canonical_slug", "")
            if or_canonical and or_canonical.lower() == clean_slug.lower():
                pricing = sanitize_pricing(or_model.get("pricing"))
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
    """Fetch models from Featherless API and normalize to the catalog schema

    Note: Featherless API ignores the 'limit' and 'offset' parameters and returns
    ALL models (~6,452) in a single request. We only need one API call.
    """
    try:
        if not Config.FEATHERLESS_API_KEY:
            logger.error("Featherless API key not configured")
            return None

        headers = {
            "Authorization": f"Bearer {Config.FEATHERLESS_API_KEY}"
        }

        # Featherless API returns all models in a single request (ignores pagination params)
        url = "https://api.featherless.ai/v1/models"

        logger.info("Fetching all models from Featherless API (single request)")

        response = httpx.get(url, headers=headers, params={"limit": 10000}, timeout=30.0)
        response.raise_for_status()

        payload = response.json()
        all_models = payload.get("data", [])

        if not all_models:
            logger.warning("No models returned from Featherless API")
            return None

        logger.info(f"Fetched {len(all_models)} total models from Featherless")

        normalized_models = [normalize_featherless_model(model) for model in all_models if model]

        if len(normalized_models) < 6000:
            logger.warning(f"Featherless API returned {len(normalized_models)} models; loading extended catalog export for completeness")
            export_models = load_featherless_catalog_export()
            if export_models:
                combined = {model["id"]: model for model in normalized_models if model.get("id")}
                for export_model in export_models:
                    combined[export_model["id"]] = export_model
                normalized_models = list(combined.values())
                logger.info(f"Combined Featherless catalog now includes {len(normalized_models)} models from API + export")

        _featherless_models_cache["data"] = normalized_models
        _featherless_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Normalized and cached {len(normalized_models)} Featherless models")
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

    description = featherless_model.get("description") or f"Featherless catalog entry for {model_id}. Pricing data not available from Featherless API."

    # Use null for unknown pricing (Featherless API doesn't provide pricing)
    pricing = {
        "prompt": featherless_model.get("prompt_price"),
        "completion": featherless_model.get("completion_price"),
        "request": featherless_model.get("request_price"),
        "image": featherless_model.get("image_price"),
        "web_search": featherless_model.get("web_search_price"),
        "internal_reasoning": featherless_model.get("internal_reasoning_price")
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
    """Fetch specific model data from OpenRouter by searching cached models"""
    try:
        # Construct the model ID
        model_id = f"{provider_name}/{model_name}"
        model_id_lower = model_id.lower()

        # First check cache
        openrouter_models = get_cached_models("openrouter")
        if openrouter_models:
            for model in openrouter_models:
                if model.get("id", "").lower() == model_id_lower:
                    return model

        # If not in cache, try to fetch fresh data
        fresh_models = fetch_models_from_openrouter()
        if fresh_models:
            for model in fresh_models:
                if model.get("id", "").lower() == model_id_lower:
                    return model

        logger.warning(f"Model {model_id} not found in OpenRouter catalog")
        return None
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


def fetch_models_from_aimo():
    """Fetch models from AIMO Network API

    Note: AIMO is a decentralized AI marketplace with OpenAI-compatible API.
    Models are fetched from the marketplace endpoint if available.
    """
    try:
        if not Config.AIMO_API_KEY:
            logger.error("AIMO API key not configured")
            return None

        headers = {
            "Authorization": f"Bearer {Config.AIMO_API_KEY}",
            "Content-Type": "application/json",
        }

        # Try to fetch models from AIMO marketplace
        # Note: Using standard OpenAI-compatible /models endpoint
        response = httpx.get(
            "https://devnet.aimo.network/api/v1/models",
            headers=headers,
            timeout=20.0,
        )
        response.raise_for_status()

        payload = response.json()
        raw_models = payload.get("data", [])

        if not raw_models:
            logger.warning("No models returned from AIMO API")
            return []

        # Normalize models and filter out None values (models without providers)
        normalized_models = [
            normalized for model in raw_models
            if model and (normalized := normalize_aimo_model(model)) is not None
        ]

        _aimo_models_cache["data"] = normalized_models
        _aimo_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Fetched {len(normalized_models)} AIMO models")
        return _aimo_models_cache["data"]
    except httpx.HTTPStatusError as e:
        logger.error(f"AIMO HTTP error: {e.response.status_code} - {e.response.text}")
        return []
    except Exception as e:
        logger.error(f"Failed to fetch models from AIMO: {e}")
        return []


def normalize_aimo_model(aimo_model: dict) -> dict:
    """Normalize AIMO catalog entries to resemble OpenRouter model shape

    AIMO models use format: provider_pubkey:model_name
    Model data structure:
    - name: base model name (e.g., "DeepSeek-V3-1")
    - display_name: human-readable name
    - providers: list of provider objects with id, name, and pricing
    """
    model_name = aimo_model.get("name")
    if not model_name:
        logger.warning(f"AIMO model missing 'name' field: {aimo_model}")
        return None

    # Get provider information (use first provider if multiple)
    providers = aimo_model.get("providers", [])
    if not providers:
        logger.warning(f"AIMO model '{model_name}' has no providers")
        return None

    # For now, use the first provider
    provider = providers[0]
    provider_id = provider.get("id")
    provider_name = provider.get("name", "unknown")

    # Construct model ID in AIMO format: provider_pubkey:model_name
    model_id = f"{provider_id}:{model_name}"

    slug = model_id
    # Extract provider from model ID (format: provider_pubkey:model_name)
    provider_slug = "aimo"
    if ":" in model_id:
        provider_slug = model_id.split(":")[0]

    display_name = aimo_model.get("display_name") or model_name.replace("-", " ").title()
    base_description = f"AIMO Network decentralized model {model_name} provided by {provider_name}."
    description = base_description

    context_length = aimo_model.get("context_length", 0)

    # Extract pricing from provider object
    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
        "web_search": None,
        "internal_reasoning": None,
    }

    # AIMO provider pricing
    provider_pricing = provider.get("pricing", {})
    if provider_pricing:
        prompt_price = provider_pricing.get("prompt")
        completion_price = provider_pricing.get("completion")
        # Convert to string if not None
        pricing["prompt"] = str(prompt_price) if prompt_price is not None else None
        pricing["completion"] = str(completion_price) if completion_price is not None else None

    # Extract architecture from AIMO model
    aimo_arch = aimo_model.get("architecture", {})
    input_modalities = aimo_arch.get("input_modalities", ["text"])
    output_modalities = aimo_arch.get("output_modalities", ["text"])

    # Determine modality string
    if input_modalities == ["text"] and output_modalities == ["text"]:
        modality = "text->text"
    else:
        modality = "multimodal"

    architecture = {
        "modality": modality,
        "input_modalities": input_modalities,
        "output_modalities": output_modalities,
        "tokenizer": None,
        "instruct_type": None,
    }

    normalized = {
        "id": slug,
        "slug": slug,
        "canonical_slug": slug,
        "hugging_face_id": None,
        "name": display_name,
        "created": aimo_model.get("created"),
        "description": description,
        "context_length": context_length,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": [],
        "default_parameters": {},
        "provider_slug": provider_slug,
        "provider_site_url": "https://aimo.network",
        "model_logo_url": None,
        "source_gateway": "aimo",
        "raw_aimo": aimo_model,
    }

    return enrich_model_with_pricing(normalized, "aimo")


def fetch_models_from_near():
    """Fetch models from Near AI API

    Note: Near AI is a decentralized AI infrastructure providing private, verifiable, and user-owned AI services.
    Models are fetched from the OpenAI-compatible /models endpoint.
    If the API doesn't return models, fallback to known Near AI models.
    """
    try:
        if not Config.NEAR_API_KEY:
            logger.error("Near AI API key not configured")
            return None

        headers = {
            "Authorization": f"Bearer {Config.NEAR_API_KEY}",
            "Content-Type": "application/json",
        }

        try:
            # Try to fetch models from Near AI
            # Note: Using standard OpenAI-compatible /models endpoint
            response = httpx.get(
                "https://cloud-api.near.ai/v1/models",
                headers=headers,
                timeout=20.0,
            )
            response.raise_for_status()

            payload = response.json()
            raw_models = payload.get("data", [])

            if raw_models:
                # Normalize models
                normalized_models = [
                    normalize_near_model(model) for model in raw_models if model
                ]

                _near_models_cache["data"] = normalized_models
                _near_models_cache["timestamp"] = datetime.now(timezone.utc)

                logger.info(f"Fetched {len(normalized_models)} Near AI models from API")
                return _near_models_cache["data"]
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning(f"Near AI API request failed: {e}. Using fallback model list.")

        # Fallback to known Near AI models if API doesn't return results
        logger.info("Using fallback Near AI model list")
        fallback_models = [
            {"id": "deepseek-chat-v3-0324", "owned_by": "DeepSeek"},
            {"id": "gpt-oss-120b", "owned_by": "GPT"},
            {"id": "llama-3-70b", "owned_by": "Meta"},
            {"id": "qwen-2-72b", "owned_by": "Alibaba"},
        ]

        normalized_models = [
            normalize_near_model(model) for model in fallback_models if model
        ]

        _near_models_cache["data"] = normalized_models
        _near_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Using {len(normalized_models)} fallback Near AI models")
        return _near_models_cache["data"]
    except Exception as e:
        logger.error(f"Failed to fetch models from Near AI: {e}")
        return []


def normalize_near_model(near_model: dict) -> dict:
    """Normalize Near AI catalog entries to resemble OpenRouter model shape

    Near AI features:
    - Private, verifiable AI infrastructure
    - Decentralized execution
    - User-owned AI services
    - Cryptographic verification and on-chain auditing
    """
    model_id = near_model.get("id")
    if not model_id:
        logger.warning(f"Near AI model missing 'id' field: {near_model}")
        return None

    slug = f"near/{model_id}"
    provider_slug = "near"

    display_name = near_model.get("display_name") or model_id.replace("-", " ").replace("_", " ").title()
    owned_by = near_model.get("owned_by", "Near Protocol")

    # Highlight security features in description
    base_description = near_model.get("description") or f"Near AI hosted model {model_id}."
    security_features = " Security: Private AI inference with decentralized execution, cryptographic verification, and on-chain auditing."
    description = f"{base_description}{security_features}"

    metadata = near_model.get("metadata") or {}
    context_length = metadata.get("context_length") or near_model.get("context_length") or 0

    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
        "web_search": None,
        "internal_reasoning": None,
    }

    # Extract pricing if available from Near AI
    pricing_info = near_model.get("pricing", {})
    if pricing_info:
        pricing["prompt"] = str(pricing_info.get("prompt")) if pricing_info.get("prompt") is not None else None
        pricing["completion"] = str(pricing_info.get("completion")) if pricing_info.get("completion") is not None else None

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
        "hugging_face_id": metadata.get("huggingface_repo"),
        "name": display_name,
        "created": near_model.get("created"),
        "description": description,
        "context_length": context_length,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": metadata.get("supported_parameters", []),
        "default_parameters": metadata.get("default_parameters", {}),
        "provider_slug": provider_slug,
        "provider_site_url": "https://near.ai",
        "model_logo_url": None,
        "source_gateway": "near",
        "raw_near": near_model,
        # Highlight security features as metadata
        "security_features": {
            "private_inference": True,
            "decentralized": True,
            "verifiable": True,
            "on_chain_auditing": True,
            "user_owned": True,
        },
    }

    return enrich_model_with_pricing(normalized, "near")


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
    # DeepInfra /models/list uses 'model_name' instead of 'id'
    model_id = deepinfra_model.get("model_name") or deepinfra_model.get("id", "")
    if not model_id:
        return {"source_gateway": "deepinfra", "raw_deepinfra": deepinfra_model or {}}

    provider_slug = model_id.split("/")[0] if "/" in model_id else "deepinfra"
    display_name = model_id.replace("-", " ").replace("_", " ").title()

    # Get model type to determine modality
    model_type = deepinfra_model.get("type") or deepinfra_model.get("reported_type") or "text"

    # Build description with deprecation notice if applicable
    base_description = deepinfra_model.get("description") or f"DeepInfra hosted model: {model_id}."
    if deepinfra_model.get("deprecated"):
        replaced_by = deepinfra_model.get("replaced_by")
        if replaced_by:
            base_description = f"{base_description} Note: This model is deprecated and has been replaced by {replaced_by}."
        else:
            base_description = f"{base_description} Note: This model is deprecated."
    description = f"{base_description} Pricing data may vary by region and usage."

    # Extract pricing information
    pricing_info = deepinfra_model.get("pricing", {})
    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
        "web_search": None,
        "internal_reasoning": None
    }

    # If pricing is time-based (for image generation), convert to image pricing
    if pricing_info.get("type") == "time" and model_type in ("text-to-image", "image"):
        cents_per_sec = pricing_info.get("cents_per_sec", 0)
        # Convert cents per second to dollars per image (assume ~5 seconds per image)
        pricing["image"] = str(cents_per_sec * 5 / 100) if cents_per_sec else None

    # Determine modality based on model type
    modality = "text->text"
    input_modalities = ["text"]
    output_modalities = ["text"]

    if model_type in ("text-to-image", "image"):
        modality = "text->image"
        input_modalities = ["text"]
        output_modalities = ["image"]
    elif model_type in ("text-to-speech", "tts"):
        modality = "text->audio"
        input_modalities = ["text"]
        output_modalities = ["audio"]
    elif model_type in ("speech-to-text", "stt"):
        modality = "audio->text"
        input_modalities = ["audio"]
        output_modalities = ["text"]
    elif model_type == "multimodal":
        modality = "multimodal"
        input_modalities = ["text", "image"]
        output_modalities = ["text"]

    architecture = {
        "modality": modality,
        "input_modalities": input_modalities,
        "output_modalities": output_modalities,
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


def fetch_specific_model_from_huggingface(provider_name: str, model_name: str):
    """Fetch specific model data from Hugging Face by using direct lookup or cached models"""
    try:
        model_id = f"{provider_name}/{model_name}"
        model_id_lower = model_id.lower()

        # Try lightweight direct lookup first
        model_data = get_huggingface_model_info(model_id)
        if model_data:
            model_data.setdefault("source_gateway", "hug")
            return model_data

        # Fall back to cached catalog (may trigger a full fetch on first call)
        huggingface_models = get_cached_models("huggingface") or get_cached_models("hug")
        if huggingface_models:
            for model in huggingface_models:
                if model.get("id", "").lower() == model_id_lower:
                    return model

        logger.warning(f"Model {model_id} not found in Hugging Face catalog")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} from Hugging Face: {e}")
        return None


def detect_model_gateway(provider_name: str, model_name: str) -> str:
    """Detect which gateway a model belongs to by searching all caches
    
    Returns:
        Gateway name: 'openrouter', 'portkey', 'featherless', 'deepinfra', 'chutes', 'groq', 'fireworks', or None
    """
    try:
        model_id = f"{provider_name}/{model_name}".lower()
        
        # Check each gateway's cache
        gateways = [
            "openrouter",
            "portkey",
            "featherless",
            "deepinfra",
            "chutes",
            "groq",
            "fireworks",
            "together",
            "google",
            "cerebras",
            "nebius",
            "xai",
            "novita",
            "huggingface",
        ]
        
        for gateway in gateways:
            models = get_cached_models(gateway)
            if models:
                for model in models:
                    if model.get("id", "").lower() == model_id:
                        return "huggingface" if gateway in ("hug", "huggingface") else gateway
        
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
        model_id = f"{provider_name}/{model_name}"
        explicit_gateway = gateway is not None

        detected_gateway = (gateway or detect_model_gateway(provider_name, model_name) or "openrouter")
        detected_gateway = detected_gateway.lower()

        override_gateway = detect_provider_from_model_id(model_id)
        override_gateway = override_gateway.lower() if override_gateway else None

        def normalize_gateway(value: str) -> str:
            if not value:
                return None
            value = value.lower()
            if value == "hug":
                return "huggingface"
            return value

        candidate_gateways = []

        if explicit_gateway:
            normalized_override = normalize_gateway(override_gateway)
            if normalized_override:
                candidate_gateways.append(normalized_override)
            normalized_requested = normalize_gateway(detected_gateway)
            if normalized_requested and normalized_requested not in candidate_gateways:
                candidate_gateways.append(normalized_requested)
        else:
            primary = normalize_gateway(override_gateway) or normalize_gateway(detected_gateway)
            if primary:
                candidate_gateways.append(primary)

            fallback_detected = normalize_gateway(detected_gateway)
            if fallback_detected and fallback_detected not in candidate_gateways:
                candidate_gateways.append(fallback_detected)

            if "openrouter" not in candidate_gateways:
                candidate_gateways.append("openrouter")

        fetchers = {
            "openrouter": fetch_specific_model_from_openrouter,
            "portkey": fetch_specific_model_from_portkey,
            "featherless": fetch_specific_model_from_featherless,
            "deepinfra": fetch_specific_model_from_deepinfra,
            "chutes": fetch_specific_model_from_chutes,
            "groq": fetch_specific_model_from_groq,
            "fireworks": fetch_specific_model_from_fireworks,
            "together": fetch_specific_model_from_together,
            "huggingface": fetch_specific_model_from_huggingface,
        }

        for candidate in candidate_gateways:
            if not candidate:
                continue

            fetcher = fetchers.get(candidate, fetch_specific_model_from_openrouter)
            model_data = fetcher(provider_name, model_name)
            if model_data:
                if candidate == "huggingface":
                    model_data.setdefault("source_gateway", "hug")
                return model_data

        logger.warning(f"Model {model_id} not found after checking gateways: {candidate_gateways}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch specific model {provider_name}/{model_name} (gateways tried: {gateway}): {e}")
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


def _extract_model_provider_slug(model: dict) -> Optional[str]:
    """Determine provider slug from a model payload."""
    if not model:
        return None

    provider_slug = model.get("provider_slug")
    if provider_slug:
        provider_slug = str(provider_slug).lower().lstrip("@")
        if provider_slug:
            return provider_slug

    model_id = model.get("id", "")
    if isinstance(model_id, str) and "/" in model_id:
        provider_slug = model_id.split("/")[0].lower().lstrip("@")
        if provider_slug:
            return provider_slug

    source_gateway = model.get("source_gateway")
    if isinstance(source_gateway, str):
        provider_slug = source_gateway.lower().lstrip("@")
        if provider_slug:
            return provider_slug

    return None


def _normalize_provider_slug(provider: Any) -> Optional[str]:
    """Extract provider slug from a provider record."""
    if provider is None:
        return None

    if isinstance(provider, str):
        slug = provider
    else:
        slug = (
            provider.get("slug")
            or provider.get("id")
            or provider.get("provider_slug")
            or provider.get("name")
        )

    if not slug:
        return None

    return str(slug).lower().lstrip("@")


def get_model_count_by_provider(
    provider_or_models: Any, models_data: Optional[list] = None
) -> Union[int, Dict[str, int]]:
    """Return model counts.

    Backwards-compatible shim that supports two call styles:
    1. get_model_count_by_provider(\"openai\", models_list) -> int
    2. get_model_count_by_provider(models_list, providers_list) -> dict
    """
    try:
        # Legacy usage: provider slug string + models list -> integer count
        if isinstance(provider_or_models, str) or provider_or_models is None:
            provider_slug = (provider_or_models or "").lower().lstrip("@")
            models = models_data or []
            if not provider_slug or not models:
                return 0

            count = 0
            for model in models:
                model_provider = _extract_model_provider_slug(model)
                if model_provider == provider_slug:
                    count += 1
            return count

        # New usage: models list + providers list -> dict mapping provider->count
        models = provider_or_models or []
        providers = models_data or []

        counts: Dict[str, int] = {}

        for model in models:
            slug = _extract_model_provider_slug(model)
            if slug:
                counts[slug] = counts.get(slug, 0) + 1

        # Ensure all provided providers exist in result even if zero
        for provider in providers:
            slug = _normalize_provider_slug(provider)
            if slug and slug not in counts:
                counts[slug] = 0

        return counts
    except Exception as e:
        logger.error(f"Error counting models: {e}")
        return {} if not isinstance(provider_or_models, str) else 0


def enhance_model_with_provider_info(openrouter_model: dict, providers_data: list = None) -> dict:
    """Enhance OpenRouter model data with provider information and logo"""
    try:
        model_id = openrouter_model.get('id', '')

        # Extract provider slug from model id (e.g., "openai/gpt-4" -> "openai")
        provider_slug = None
        if '/' in model_id:
            provider_slug = model_id.split('/')[0]

        # Get provider information
        # Preserve existing provider_site_url if already set (e.g., from HuggingFace normalization)
        provider_site_url = openrouter_model.get('provider_site_url')
        if not provider_site_url and providers_data and provider_slug:
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
            "provider_slug": provider_slug if provider_slug else openrouter_model.get('provider_slug'),
            "provider_site_url": provider_site_url,
            "model_logo_url": model_logo_url
        }

        return enhanced_model
    except Exception as e:
        logger.error(f"Error enhancing model with provider info: {e}")
        return openrouter_model
