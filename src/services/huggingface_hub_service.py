"""
HuggingFace Hub SDK Service

This module provides utilities using the official huggingface_hub SDK for:
- Model discovery and search
- Model metadata retrieval
- Model card access
- Repository information
- Advanced model filtering

This complements huggingface_models.py which focuses on inference routing
and uses direct API calls. The SDK approach here is better for metadata
operations and model discovery.
"""

import logging
from typing import Any, Dict, List, Optional

from huggingface_hub import HfApi, hf_hub_download, list_models
from huggingface_hub.utils import RepositoryNotFoundError

from src.config import Config
from src.services.pricing_lookup import enrich_model_with_pricing

logger = logging.getLogger(__name__)


def get_hf_api_client() -> HfApi:
    """
    Get an authenticated HuggingFace API client.

    Returns:
        HfApi: Authenticated API client
    """
    return HfApi(token=Config.HUG_API_KEY if Config.HUG_API_KEY else None)


def list_huggingface_models(
    task: Optional[str] = "text-generation",
    filter_kwargs: Optional[Dict[str, Any]] = None,
    limit: int = 50,
    sort: str = "likes",
    direction: int = -1,
) -> List[Dict[str, Any]]:
    """
    List HuggingFace models using the SDK with advanced filtering.

    This is useful for discovery and exploration, complementing the direct
    API approach in huggingface_models.py which is optimized for throughput.

    Args:
        task: Model task type (e.g., "text-generation", "text2text-generation")
        filter_kwargs: Additional filter kwargs for HfApi.list_models()
        limit: Maximum number of models to return
        sort: Sort field ("likes", "downloads", "created_at")
        direction: Sort direction (1 for ascending, -1 for descending)

    Returns:
        List of model dictionaries with metadata
    """
    try:
        logger.info(f"Listing HuggingFace models with task={task}, sort={sort}")

        api = get_hf_api_client()

        # Build filter
        filters = {}
        if task:
            filters["task"] = task

        # Add any additional filters
        if filter_kwargs:
            filters.update(filter_kwargs)

        # Query models
        models = list_models(
            limit=limit,
            sort=sort,
            direction=direction,
            **filters,
        )

        result = []
        for model in models:
            try:
                model_info = normalize_model_info(model)
                if model_info:
                    result.append(model_info)
            except Exception as e:
                logger.warning(f"Failed to process model {model.id}: {e}")
                continue

        logger.info(f"Retrieved {len(result)} models from HuggingFace Hub")
        return result

    except Exception as e:
        logger.error(f"Failed to list HuggingFace models: {e}")
        return []


def search_models_by_query(
    query: str,
    task: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Search for HuggingFace models by query.

    Args:
        query: Search query (model name, description, etc.)
        task: Optional task filter
        limit: Maximum results to return

    Returns:
        List of matching model dictionaries
    """
    try:
        logger.info(f"Searching HuggingFace models for: '{query}'")

        api = get_hf_api_client()

        filters = {}
        if task:
            filters["task"] = task

        models = list_models(
            search=query,
            limit=limit,
            **filters,
        )

        result = []
        for model in models:
            try:
                model_info = normalize_model_info(model)
                if model_info:
                    result.append(model_info)
            except Exception as e:
                logger.warning(f"Failed to process model {model.id}: {e}")
                continue

        logger.info(f"Found {len(result)} models matching '{query}'")
        return result

    except Exception as e:
        logger.error(f"Failed to search HuggingFace models: {e}")
        return []


def get_model_details(model_id: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed information about a specific model.

    Uses the SDK's model_info() to get comprehensive metadata including
    model card, library info, and processor details.

    Args:
        model_id: HuggingFace model repository ID

    Returns:
        Model details dictionary or None if not found
    """
    try:
        logger.info(f"Fetching details for model: {model_id}")

        api = get_hf_api_client()
        model_info = api.model_info(model_id=model_id)

        return normalize_model_info(model_info)

    except RepositoryNotFoundError:
        logger.warning(f"Model not found: {model_id}")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch model details for {model_id}: {e}")
        return None


def get_model_card(model_id: str) -> Optional[str]:
    """
    Download and retrieve the model card (README) for a model.

    This provides the human-readable documentation and usage instructions
    for a model directly from the HuggingFace Hub.

    Args:
        model_id: HuggingFace model repository ID

    Returns:
        Model card content as string, or None if not found/error
    """
    try:
        logger.info(f"Fetching model card for: {model_id}")

        # Download the README file from the model repo
        readme_path = hf_hub_download(
            repo_id=model_id,
            filename="README.md",
            repo_type="model",
            token=Config.HUG_API_KEY if Config.HUG_API_KEY else None,
        )

        with open(readme_path, "r", encoding="utf-8") as f:
            card_content = f.read()

        logger.info(f"Successfully retrieved model card for {model_id}")
        return card_content

    except Exception as e:
        logger.warning(f"Failed to fetch model card for {model_id}: {e}")
        return None


def list_models_by_author(
    author: str,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    List all models from a specific author/organization.

    Args:
        author: Author username or organization name
        limit: Maximum models to return

    Returns:
        List of author's models
    """
    try:
        logger.info(f"Fetching models from author: {author}")

        api = get_hf_api_client()
        models = api.list_models(author=author, limit=limit)

        result = []
        for model in models:
            try:
                model_info = normalize_model_info(model)
                if model_info:
                    result.append(model_info)
            except Exception as e:
                logger.warning(f"Failed to process model {model.id}: {e}")
                continue

        logger.info(f"Found {len(result)} models from author {author}")
        return result

    except Exception as e:
        logger.error(f"Failed to list models for author {author}: {e}")
        return []


def get_model_files(model_id: str) -> Optional[List[Dict[str, Any]]]:
    """
    Get information about all files in a model repository.

    This is useful for understanding what files are available in the model repo
    (weights, configs, tokenizers, etc.)

    Args:
        model_id: HuggingFace model repository ID

    Returns:
        List of file information dicts with name, size, etc.
    """
    try:
        logger.info(f"Fetching files for model: {model_id}")

        api = get_hf_api_client()
        repo_info = api.repo_info(repo_id=model_id, repo_type="model")

        files = []
        if hasattr(repo_info, "siblings") and repo_info.siblings:
            for file_info in repo_info.siblings:
                files.append(
                    {
                        "name": file_info.rfilename,
                        "size": getattr(file_info, "size", None),
                        "blob_id": getattr(file_info, "blob_id", None),
                    }
                )

        logger.info(f"Found {len(files)} files in {model_id}")
        return files

    except Exception as e:
        logger.error(f"Failed to fetch files for {model_id}: {e}")
        return None


def check_model_inference_availability(model_id: str) -> bool:
    """
    Check if a model is available on the HuggingFace Inference API.

    Args:
        model_id: HuggingFace model repository ID

    Returns:
        True if model is available for inference, False otherwise
    """
    try:
        model_info = get_model_details(model_id)
        if not model_info:
            return False

        # Check if model has inference_provider info or is not gated
        is_available = not model_info.get("gated", False) and not model_info.get(
            "private", False
        )

        logger.info(f"Model {model_id} inference availability: {is_available}")
        return is_available

    except Exception as e:
        logger.error(f"Failed to check inference availability for {model_id}: {e}")
        return False


def normalize_model_info(model_info: Any) -> Optional[Dict[str, Any]]:
    """
    Normalize HuggingFace SDK model info to our internal schema.

    Args:
        model_info: Model info object from HfApi or list_models()

    Returns:
        Normalized model dictionary or None if invalid
    """
    try:
        model_id = model_info.id
        if not model_id:
            return None

        # Skip private/gated models
        if getattr(model_info, "private", False) or getattr(model_info, "gated", False):
            logger.debug(f"Skipping private/gated model: {model_id}")
            return None

        # Extract metadata
        display_name = model_id.split("/")[-1].replace("-", " ").replace("_", " ").title()
        description = getattr(model_info, "description", None) or f"HuggingFace model: {model_id}"

        # Task/pipeline
        pipeline_tag = getattr(model_info, "pipeline_tag", "text-generation") or "text-generation"

        # Metrics
        downloads = getattr(model_info, "downloads", 0) or 0
        likes = getattr(model_info, "likes", 0) or 0
        created_at = getattr(model_info, "createdAt", None) or getattr(
            model_info, "created_at", None
        )
        last_modified = getattr(model_info, "lastModified", None) or getattr(
            model_info, "last_modified", None
        )

        # Model parameters
        num_parameters = None
        if hasattr(model_info, "siblings"):
            # Try to extract from config.json if available
            pass

        # Library/framework
        library_name = getattr(model_info, "library_name", None)

        # Build architecture info
        modality_map = {
            "text-generation": "text->text",
            "text2text-generation": "text->text",
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
        }

        modality = modality_map.get(pipeline_tag, "text->text")

        # Input/output modalities
        input_modalities = ["text"]
        output_modalities = ["text"]

        if "image" in pipeline_tag.lower():
            if "to-image" in pipeline_tag:
                output_modalities = ["image"]
            else:
                input_modalities = ["image"]

        # Default pricing
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
            "tokenizer": library_name,
            "instruct_type": None,
        }

        # Extract author
        author = model_id.split("/")[0] if "/" in model_id else "Unknown"

        # Build normalized model
        normalized = {
            "id": model_id,
            "slug": model_id,
            "canonical_slug": model_id,
            "hugging_face_id": model_id,
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
            "provider_slug": author,
            "provider_site_url": f"https://huggingface.co/{model_id}",
            "model_logo_url": None,
            "source_gateway": "hug",
            "huggingface_metrics": {
                "downloads": downloads,
                "likes": likes,
                "pipeline_tag": pipeline_tag,
                "num_parameters": num_parameters,
                "gated": getattr(model_info, "gated", False),
                "private": getattr(model_info, "private", False),
                "last_modified": last_modified,
                "author": author,
                "url": f"https://huggingface.co/{model_id}",
                "library_name": library_name,
            },
        }

        # Enrich with pricing if available
        return enrich_model_with_pricing(normalized, "huggingface")

    except Exception as e:
        logger.error(f"Error normalizing model info: {e}", exc_info=True)
        return None
