"""
Hugging Face Models Provider

This module fetches models directly from the Hugging Face Models API Hub.

APPROACH:
  Instead of filtering Portkey's unified catalog, this module fetches models
  directly from Hugging Face's official API at https://huggingface.co/api/models

  This provides:
  - Real-time model data from Hugging Face
  - Accurate model metadata (downloads, likes, pipeline info)
  - No dependency on Portkey's limited pattern matching
  - Direct access to thousands of available models

FEATURES:
  - Fetches latest models from Hugging Face Hub
  - Filters by model type (text generation, conversational, etc.)
  - Caches results with TTL
  - Normalizes to internal catalog schema
  - Supports full-text search and filtering
"""

import logging
from datetime import datetime, timezone
import httpx
import time

from src.cache import _hug_models_cache
from src.services.pricing_lookup import enrich_model_with_pricing
from src.config import Config

logger = logging.getLogger(__name__)


def fetch_models_from_huggingface_api(
    search: str = None,
    task: str = "text-generation",
    limit: int = None,
    direction: str = "-1",
    sort: str = "downloads",
    use_cache: bool = True
):
    """
    Fetch models directly from Hugging Face Models API Hub.

    Args:
        search: Optional search query to filter models
        task: Filter by task type (default: text-generation)
              Other options: conversational, question-answering, etc.
        limit: Maximum number of models to fetch (None = fetch all)
        direction: Sort direction (-1 for descending, 1 for ascending)
        sort: Sort field (downloads, likes, created_at, etc.)
        use_cache: Whether to use and update cache

    Returns:
        List of normalized model dictionaries or None on error
    """
    try:
        # Check cache first
        if use_cache and _hug_models_cache["data"] and _hug_models_cache["timestamp"]:
            cache_age = (datetime.now(timezone.utc) - _hug_models_cache["timestamp"]).total_seconds()
            if cache_age < _hug_models_cache["ttl"]:
                logger.info(f"Using cached Hugging Face models ({len(_hug_models_cache['data'])} models, age: {cache_age:.0f}s)")
                return _hug_models_cache["data"]

        logger.info("Fetching models from Hugging Face Models API Hub")

        models = []
        seen_model_ids = set()  # Track unique model IDs to detect duplicates
        offset = 0
        batch_size = 100  # HF API supports up to 100 per request
        total_fetched = 0
        consecutive_duplicates = 0  # Count consecutive batches with no new models

        # If no limit specified, fetch all available models (~50,000+ with hf-inference filter)
        # Use a high number to ensure we get everything available
        max_total = limit or 50000  # Will fetch until API returns no more models

        # Fetch in batches
        while total_fetched < max_total:
            params = {
                "inference_provider": "hf-inference",  # Only models available on HF Inference API
                "limit": min(batch_size, max_total - total_fetched),
                "offset": offset,
            }

            # Note: sort and direction don't work reliably with inference_provider filter
            # so we fetch all available and handle sorting client-side if needed

            # Only add task filter if explicitly specified and not "all"
            if task and task != "all":
                params["task"] = task

            if search:
                params["search"] = search

            url = "https://huggingface.co/api/models"
            logger.debug(f"Fetching batch from offset {offset} with params: {params}")

            # Add authentication headers if HF token is available
            headers = {}
            if Config.HUG_API_KEY:
                headers["Authorization"] = f"Bearer {Config.HUG_API_KEY}"
                logger.debug("Using Hugging Face API token for authentication")

            response = httpx.get(url, params=params, headers=headers, timeout=30.0)
            response.raise_for_status()

            batch_models = response.json()

            if not batch_models:
                logger.info(f"No more models returned from Hugging Face API at offset {offset}")
                break

            # Track all models (allow deduplication per batch but continue fetching all)
            for model in batch_models:
                model_id = model.get("id")
                if model_id and model_id not in seen_model_ids:
                    seen_model_ids.add(model_id)
                    models.append(model)

            logger.info(f"Fetched batch from offset {offset}: {len(batch_models)} models, {len(seen_model_ids)} total unique so far")

            total_fetched += len(batch_models)
            offset += batch_size

            # If we got fewer models than requested, we've reached the end
            if len(batch_models) < batch_size:
                logger.info(f"Batch returned fewer models ({len(batch_models)} < {batch_size}), reached end of available models")
                break

            # Add a small delay between requests to avoid rate limiting
            # Only add delay if HF_API_KEY is not provided (unauthenticated requests are more limited)
            if not Config.HUG_API_KEY and total_fetched < max_total:
                time.sleep(0.5)  # 500ms delay between requests

        if not models:
            logger.warning("No Hugging Face models returned from API")
            return None

        logger.info(f"Fetched {len(models)} total models from Hugging Face API")

        # Normalize models to our schema
        normalized_models = [normalize_huggingface_model(model) for model in models if model]

        # Filter out any None results from normalization
        normalized_models = [m for m in normalized_models if m]

        logger.info(f"Normalized {len(normalized_models)} models")

        # Cache the results
        if use_cache:
            _hug_models_cache["data"] = normalized_models
            _hug_models_cache["timestamp"] = datetime.now(timezone.utc)
            logger.info(f"Cached {len(normalized_models)} Hugging Face models with TTL {_hug_models_cache['ttl']}s")

        return normalized_models

    except httpx.HTTPStatusError as e:
        logger.error(f"Hugging Face API HTTP error: {e.response.status_code} - {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch models from Hugging Face API: {e}", exc_info=True)
        return None


def normalize_huggingface_model(hf_model: dict) -> dict:
    """
    Normalize a Hugging Face model to our internal catalog schema.

    Args:
        hf_model: Raw model data from Hugging Face API

    Returns:
        Normalized model dictionary or None if invalid
    """
    try:
        # Extract model ID (repository ID)
        model_id = hf_model.get("id") or hf_model.get("modelId")
        if not model_id:
            logger.warning(f"Model missing ID: {hf_model}")
            return None

        # Extract metadata
        author = hf_model.get("author", {})
        if isinstance(author, dict):
            author_name = author.get("name", "Unknown")
        else:
            author_name = str(author) if author else "Unknown"

        # Model info
        display_name = model_id.split("/")[-1].replace("-", " ").replace("_", " ").title()
        description = hf_model.get("description") or f"Hugging Face model: {model_id}"

        # Pipeline/task type
        pipeline_tag = hf_model.get("pipeline_tag", "text-generation")

        # Metrics
        downloads = hf_model.get("downloads", 0)
        likes = hf_model.get("likes", 0)
        created_at = hf_model.get("createdAt")
        last_modified = hf_model.get("lastModified")

        # Model size info
        num_parameters = hf_model.get("numParameters")

        # Gated/Private status
        gated = hf_model.get("gated", False)
        private = hf_model.get("private", False)

        if private:
            logger.debug(f"Skipping private model: {model_id}")
            return None

        # Build architecture info
        modality_map = {
            "text-generation": "text->text",
            "conversational": "text->text",
            "question-answering": "text->text",
            "summarization": "text->text",
            "translation": "text->text",
            "image-to-text": "image->text",
            "text-to-image": "text->image",
            "image-classification": "image->text",
            "object-detection": "image->text",
            "token-classification": "text->text",
            "feature-extraction": "text->embedding",
            "fill-mask": "text->text",
            "table-question-answering": "text->text",
            "visual-question-answering": "image->text",
            "document-question-answering": "image->text",
            "video-classification": "video->text",
        }

        modality = modality_map.get(pipeline_tag, "text->text")

        # Determine input/output modalities
        input_modalities = ["text"]
        output_modalities = ["text"]

        if "image" in pipeline_tag.lower():
            if "to-image" in pipeline_tag:
                output_modalities = ["image"]
            else:
                input_modalities = ["image"]
        elif "audio" in pipeline_tag.lower():
            input_modalities = ["audio"]
        elif "video" in pipeline_tag.lower():
            input_modalities = ["video"]

        # Default pricing (Hugging Face pricing varies by region/model)
        pricing = {
            "prompt": None,
            "completion": None,
            "request": None,
            "image": None,
            "web_search": None,
            "internal_reasoning": None,
        }

        architecture = {
            "modality": modality,
            "input_modalities": input_modalities,
            "output_modalities": output_modalities,
            "tokenizer": None,
            "instruct_type": None,
        }

        # Build normalized model
        normalized = {
            "id": model_id,
            "slug": model_id,
            "canonical_slug": model_id,
            "hugging_face_id": model_id,  # Store HF repo ID
            "name": display_name,
            "created": created_at,
            "description": description,
            "context_length": 0,
            "architecture": architecture,
            "pricing": pricing,
            "top_provider": None,
            "per_request_limits": None,
            "supported_parameters": [],
            "default_parameters": {},
            "provider_slug": author_name,
            "provider_site_url": f"https://huggingface.co/{model_id}",
            "model_logo_url": None,
            "source_gateway": "hug",
            "huggingface_metrics": {
                "downloads": downloads,
                "likes": likes,
                "pipeline_tag": pipeline_tag,
                "num_parameters": num_parameters,
                "gated": gated,
                "private": private,
                "last_modified": last_modified,
                "author": author_name,
                "url": f"https://huggingface.co/{model_id}",
            },
            "raw_huggingface": hf_model
        }

        # Enrich with pricing if available from our lookup table
        return enrich_model_with_pricing(normalized, "huggingface")

    except Exception as e:
        logger.error(f"Error normalizing Hugging Face model: {e}", exc_info=True)
        return None


def search_huggingface_models(query: str, limit: int = 50) -> list:
    """
    Search for Hugging Face models by name or description.

    Args:
        query: Search query
        limit: Maximum results to return

    Returns:
        List of normalized models matching the query
    """
    try:
        logger.info(f"Searching Hugging Face models for: '{query}'")

        params = {
            "search": query,
            "limit": limit,
            "sort": "downloads",
            "direction": "-1",
        }

        # Add authentication headers if HF token is available
        headers = {}
        if Config.HUG_API_KEY:
            headers["Authorization"] = f"Bearer {Config.HUG_API_KEY}"

        url = "https://huggingface.co/api/models"
        response = httpx.get(url, params=params, headers=headers, timeout=30.0)
        response.raise_for_status()

        models = response.json()
        logger.info(f"Found {len(models)} models matching '{query}'")

        # Normalize results
        normalized_models = [normalize_huggingface_model(model) for model in models if model]
        return [m for m in normalized_models if m]

    except Exception as e:
        logger.error(f"Failed to search Hugging Face models for '{query}': {e}")
        return []


def get_huggingface_model_info(model_id: str) -> dict:
    """
    Get detailed information about a specific Hugging Face model.

    Args:
        model_id: Hugging Face model repository ID (e.g., "meta-llama/Llama-2-7b")

    Returns:
        Model information dictionary or None if not found
    """
    try:
        logger.info(f"Fetching details for Hugging Face model: {model_id}")

        # Add authentication headers if HF token is available
        headers = {}
        if Config.HUG_API_KEY:
            headers["Authorization"] = f"Bearer {Config.HUG_API_KEY}"

        url = f"https://huggingface.co/api/models/{model_id}"
        response = httpx.get(url, headers=headers, timeout=10.0)
        response.raise_for_status()

        model_data = response.json()
        logger.info(f"Retrieved model info for {model_id}")

        return normalize_huggingface_model(model_data)

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.warning(f"Hugging Face model {model_id} not found")
        else:
            logger.error(f"HTTP error fetching Hugging Face model {model_id}: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch Hugging Face model {model_id}: {e}")
        return None


def fetch_models_from_hug():
    """
    Fetch models from Hugging Face using the direct API integration.

    This replaces the old Portkey pattern-based filtering approach with
    direct API calls to get all models available on Hugging Face Inference API.

    Fetches all available models on HF Inference (hf-inference filter).
    Currently ~50,000+ models available through the API.

    Returns:
        List of normalized Hugging Face models or None on error
    """
    return fetch_models_from_huggingface_api(
        task=None,  # Fetch all models available on HF Inference
        limit=None,  # Fetch all available (~50,000+ models)
        direction="-1",
        sort="likes"  # Sort by popularity/likes
    )
