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
import time
from datetime import datetime, timezone

import httpx

from src.cache import _huggingface_models_cache
from src.config import Config
from src.services.pricing_lookup import enrich_model_with_pricing

logger = logging.getLogger(__name__)

# Reserved for models that are confirmed to NOT work with HF Inference Router
# Currently empty - all models fetched from HF API with inference_provider=hf-inference should work
UNSUPPORTED_MODELS = set()

# Models that must always be present in the normalized catalog even if they
# fall outside of the top-N API responses for likes/downloads/trending.
ESSENTIAL_MODELS = {
    "katanemo/Arch-Router-1.5B",
}


def fetch_models_from_huggingface_api(
    search: str = None,
    task: str = "text-generation",
    limit: int = None,
    direction: str = "-1",
    sort: str = "downloads",
    use_cache: bool = True,
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
        if (
            use_cache
            and _huggingface_models_cache["data"]
            and _huggingface_models_cache["timestamp"]
        ):
            cache_age = (datetime.now(timezone.utc) - _huggingface_models_cache["timestamp"]).total_seconds()
            if cache_age < _huggingface_models_cache["ttl"]:
                logger.info(
                    f"Using cached Hugging Face models ({len(_huggingface_models_cache['data'])} models, age: {cache_age:.0f}s)"
                )
                return _huggingface_models_cache["data"]

        logger.info("Fetching models from Hugging Face Models API Hub using multi-sort strategy")

        models = []
        seen_model_ids = (
            set()
        )  # Track unique model IDs to detect duplicates across all sort methods

        # Strategy: Use multiple sort methods to get different sets of models
        # The API caps at 1000 per request, but different sorts return different models
        # This allows us to fetch more than 1000 unique models by merging results
        # Hugging Face Models API supports 'likes' and 'downloads' as stable sort options.
        # 'trending' intermittently returns 400, so we stick to reliable sorts and rely
        # on ESSENTIAL_MODELS to pull in anything critical that falls outside the top results.
        sort_methods = ["likes", "downloads"]

        for sort_method_idx, sort_method in enumerate(sort_methods):
            logger.info(f"Fetching models with sort={sort_method}")

            params = {
                "inference_provider": "hf-inference",  # Only models available on HF Inference API
                "limit": 1000,  # HF API caps at 1000 models per request with full=true
                "full": "true",  # Enable full response to get up to 1000 models (vs 100 without this)
                "sort": sort_method,  # Use the current sort method
            }

            # Only add task filter if explicitly specified and not "all"
            if task and task != "all":
                params["task"] = task

            if search:
                params["search"] = search

            url = "https://huggingface.co/api/models"
            logger.debug(f"Fetching with sort={sort_method}, params: {params}")

            # Add authentication headers if HF token is available
            headers = {}
            if Config.HUG_API_KEY:
                headers["Authorization"] = f"Bearer {Config.HUG_API_KEY}"
                logger.debug("Using Hugging Face API token for authentication")

            # Retry logic for failed requests
            max_retries = 3
            retry_delay = 1.0  # Start with 1 second delay

            for attempt in range(max_retries):
                try:
                    response = httpx.get(url, params=params, headers=headers, timeout=30.0)
                    response.raise_for_status()
                    break  # Success, exit retry loop
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:  # Rate limited
                        if attempt < max_retries - 1:
                            logger.warning(
                                f"Rate limited (429) on sort={sort_method}, attempt {attempt + 1}/{max_retries}. Waiting {retry_delay}s before retry..."
                            )
                            time.sleep(retry_delay)
                            retry_delay *= 2  # Exponential backoff
                            continue
                    raise
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.warning(
                            f"Error fetching with sort={sort_method}, attempt {attempt + 1}/{max_retries}: {e}. Retrying..."
                        )
                        time.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    raise

            batch_models = response.json()

            if not batch_models:
                logger.warning(f"No models returned for sort={sort_method}")
                continue

            # Track unique models from this batch
            new_models_in_batch = 0
            duplicates_in_batch = 0

            for model in batch_models:
                model_id = model.get("id")
                if not model_id:
                    continue

                if model_id not in seen_model_ids:
                    seen_model_ids.add(model_id)
                    models.append(model)
                    new_models_in_batch += 1
                else:
                    duplicates_in_batch += 1

            logger.info(
                f"Sort={sort_method}: {len(batch_models)} returned, {new_models_in_batch} new, {duplicates_in_batch} duplicates, {len(models)} total unique"
            )

            # Add a delay between different sort requests to avoid rate limiting
            # Always add delay (required by HF API), but longer if no API key
            if sort_method_idx < len(sort_methods) - 1:  # Not the last request
                delay = 1.0 if Config.HUG_API_KEY else 2.0
                logger.debug(f"Waiting {delay}s before next sort request...")
                time.sleep(delay)

        if not models:
            logger.warning("No Hugging Face models returned from API")
            return None

        logger.info(f"Fetched {len(models)} total models from Hugging Face API")

        # Normalize models to our schema
        normalized_models = [normalize_huggingface_model(model) for model in models if model]

        # Filter out any None results from normalization
        normalized_models = [m for m in normalized_models if m]

        # Ensure essential models are always available even if they fall outside
        # the top results returned by the ranked API queries.
        normalized_ids = {m.get("id", "").lower() for m in normalized_models}
        for required_model in ESSENTIAL_MODELS:
            if required_model.lower() not in normalized_ids:
                logger.info(
                    f"Essential Hugging Face model '{required_model}' missing from ranked fetch; retrieving directly"
                )
                direct_model = get_huggingface_model_info(required_model)
                if direct_model:
                    normalized_models.append(direct_model)
                    normalized_ids.add(required_model.lower())
                else:
                    logger.warning(
                        f"Failed to retrieve essential Hugging Face model '{required_model}'"
                    )

        logger.info(f"Normalized {len(normalized_models)} models")

        # Cache the results
        if use_cache:
            _huggingface_models_cache["data"] = normalized_models
            _huggingface_models_cache["timestamp"] = datetime.now(timezone.utc)
            logger.info(
                f"Cached {len(normalized_models)} Hugging Face models with TTL {_huggingface_models_cache['ttl']}s"
            )

        return normalized_models

    except httpx.HTTPStatusError as e:
        error_body = e.response.text[:500] if e.response.text else "No response body"
        logger.error(f"Hugging Face API HTTP error {e.response.status_code}: {error_body}")

        if e.response.status_code == 401:
            logger.error("❌ Authentication failed - check your HUG_API_KEY environment variable")
        elif e.response.status_code == 403:
            logger.error(
                "❌ Access forbidden - your HF API key may not have the required permissions"
            )
        elif e.response.status_code == 429:
            logger.error(
                "❌ Rate limited by Hugging Face API - consider adding HUG_API_KEY or waiting"
            )
        elif e.response.status_code == 503:
            logger.error("❌ Hugging Face API is temporarily unavailable")

        return None
    except Exception as e:
        logger.error(
            f"Failed to fetch models from Hugging Face API: {type(e).__name__}: {e}", exc_info=True
        )
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

        # Skip models that are known to be unsupported by HF Inference Router
        if model_id in UNSUPPORTED_MODELS:
            logger.debug(
                f"Skipping unsupported model (not available for chat completions): {model_id}"
            )
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
            "raw_huggingface": hf_model,
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

    Uses multi-sort strategy to fetch 1204+ models by merging results from
    multiple sort methods (likes and downloads).

    Returns:
        List of normalized Hugging Face models or None on error
    """
    return fetch_models_from_huggingface_api(
        task=None,  # Fetch all models available on HF Inference
        limit=None,  # Uses multi-sort strategy internally
        use_cache=True,  # Cache results for performance
    )
