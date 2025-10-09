import datetime
import logging
import json
import os
from pathlib import Path

from src.config import Config
from src.cache import _huggingface_cache, _models_cache, _portkey_models_cache, _featherless_models_cache, _chutes_models_cache
from fastapi import APIRouter
from datetime import datetime, timezone

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

        if gateway == "all":
            openrouter_models = get_cached_models("openrouter") or []
            portkey_models = get_cached_models("portkey") or []
            featherless_models = get_cached_models("featherless") or []
            chutes_models = get_cached_models("chutes") or []
            return openrouter_models + portkey_models + featherless_models + chutes_models

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

        response = httpx.get("https://api.portkey.ai/v1/models", headers=headers, timeout=20.0)
        response.raise_for_status()

        payload = response.json()
        raw_models = payload.get("data", [])
        normalized_models = [normalize_portkey_model(model) for model in raw_models if model]

        _portkey_models_cache["data"] = normalized_models
        _portkey_models_cache["timestamp"] = datetime.now(timezone.utc)

        return _portkey_models_cache["data"]
    except httpx.HTTPStatusError as e:
        logger.error(f"Portkey HTTP error: {e.response.status_code} - {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch models from Portkey: {e}")
        return None


def normalize_portkey_model(portkey_model: dict) -> dict:
    """Normalize Portkey catalog entries to resemble OpenRouter model shape"""
    slug = portkey_model.get("slug") or portkey_model.get("canonical_slug") or portkey_model.get("id")
    if not slug:
        return {"source_gateway": "portkey", "raw_portkey": portkey_model or {}}

    provider_slug = slug.split("/")[0] if "/" in slug else slug
    provider_slug = provider_slug.lstrip("@")

    model_handle = slug.split("/")[-1]
    display_name = model_handle.replace("-", " ").replace("_", " ").title()

    description = f"Portkey catalog entry for {slug}. Additional metadata sync is pending."

    pricing = {
        "prompt": "0",
        "completion": "0",
        "request": "0",
        "image": "0",
        "web_search": "0",
        "internal_reasoning": "0"
    }

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

    description = f"Featherless catalog entry for {model_id}. Additional metadata sync is pending."

    pricing = {
        "prompt": "0",
        "completion": "0",
        "request": "0",
        "image": "0",
        "web_search": "0",
        "internal_reasoning": "0"
    }

    architecture = {
        "modality": "text->text",
        "input_modalities": ["text"],
        "output_modalities": ["text"],
        "tokenizer": None,
        "instruct_type": None
    }

    return {
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

    return {
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

