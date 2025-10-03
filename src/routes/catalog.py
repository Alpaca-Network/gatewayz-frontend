import datetime
import logging
from typing import Optional

from fastapi import APIRouter, Query
from datetime import datetime, timezone

from fastapi import  HTTPException

from src.services.models import get_cached_models, enhance_model_with_provider_info, \
    get_model_count_by_provider, enhance_model_with_huggingface_data, fetch_specific_model_from_openrouter
from src.services.providers import get_cached_providers, \
    enhance_providers_with_logos_and_sites


# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()
# Provider and Models Information Endpoints
@router.get("/provider", tags=["providers"])
async def get_providers(
    moderated_only: bool = Query(False, description="Filter for moderated providers only"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
):
    """Get all available provider list with detailed metric data including model count and logo URLs"""
    try:
        providers = get_cached_providers()
        if not providers:
            raise HTTPException(status_code=503, detail="Provider data unavailable")

        # Get models data for counting
        models = get_cached_models()

        # Apply moderation filter if specified
        if moderated_only:
            providers = [p for p in providers if p.get("moderated_by_openrouter", False)]

        # Apply pagination
        total_providers = len(providers)
        if offset:
            providers = providers[offset:]
        if limit:
            providers = providers[:limit]

        # Enhance provider data with additional metrics
        enhanced_providers = enhance_providers_with_logos_and_sites(providers)

        # Add a model count to each provider
        for provider in enhanced_providers:
            model_count = get_model_count_by_provider(provider.get("slug"), models)
            provider["model_count"] = model_count

        return {
            "data": enhanced_providers,
            "total": total_providers,
            "returned": len(enhanced_providers),
            "offset": offset or 0,
            "limit": limit,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get providers: {e}")
        raise HTTPException(status_code=500, detail="Failed to get providers")


@router.get("/models", tags=["models"])
async def get_models(
    provider: Optional[str] = Query(None, description="Filter models by provider"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
    include_huggingface: bool = Query(
        True, description="Include Hugging Face metrics for models that have hugging_face_id"
    ),
):
    """Get all metric data of available models with optional filtering, pagination, Hugging Face integration, and provider logos"""
    try:
        logger.info(f"Getting models with provider={provider}, limit={limit}, offset={offset}")

        models = get_cached_models()
        logger.info(f"Retrieved {len(models) if models else 0} models from cache")

        if not models:
            logger.error("No models data available from cache")
            raise HTTPException(status_code=503, detail="Models data unavailable")

        # Get enhanced providers data (same as /provider endpoint)
        providers = get_cached_providers()
        if not providers:
            raise HTTPException(status_code=503, detail="Provider data unavailable")

        # Enhance provider data with site_url and logo_url (same logic as /provider endpoint)
        enhanced_providers = enhance_providers_with_logos_and_sites(providers)

        logger.info(f"Retrieved {len(enhanced_providers)} enhanced providers from cache")

        # Apply provider filter if specified
        if provider:
            original_count = len(models)
            models = [model for model in models if provider.lower() in model.get("id", "").lower()]
            logger.info(f"Filtered models by provider '{provider}': {original_count} -> {len(models)}")

        # Apply pagination
        total_models = len(models)
        if offset:
            models = models[offset:]
            logger.info(f"Applied offset {offset}: {len(models)} models remaining")
        if limit:
            models = models[:limit]
            logger.info(f"Applied limit {limit}: {len(models)} models remaining")

        # Enhance models with provider information and logos
        enhanced_models = []
        for model in models:
            # First, enhance with provider info (logos, slugs, etc.)
            enhanced_model = enhance_model_with_provider_info(model, enhanced_providers)

            # Then enhance with Hugging Face data if requested
            if include_huggingface:
                enhanced_model = enhance_model_with_huggingface_data(enhanced_model)

            enhanced_models.append(enhanced_model)

        models = enhanced_models
        logger.info(f"Enhanced {len(models)} models with provider info and logos")

        return {
            "data": models,
            "total": total_models,
            "returned": len(models),
            "offset": offset or 0,
            "limit": limit,
            "include_huggingface": include_huggingface,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get models: {e}")
        raise HTTPException(status_code=500, detail="Failed to get models")


@router.get("/{provider_name}/{model_name}", tags=["models"])
async def get_specific_model(
    provider_name: str,
    model_name: str,
    include_huggingface: bool = Query(True, description="Include Hugging Face metrics if available"),
):
    """Get specific model data of a given provider with detailed information"""
    try:
        model_data = fetch_specific_model_from_openrouter(provider_name, model_name)
        if not model_data:
            raise HTTPException(status_code=404, detail=f"Model {provider_name}/{model_name} not found")

        # Get enhanced providers data (same as /provider endpoint)
        providers = get_cached_providers()
        if not providers:
            raise HTTPException(status_code=503, detail="Provider data unavailable")

        # Enhance provider data with site_url and logo_url (same logic as /provider endpoint)
        enhanced_providers = enhance_providers_with_logos_and_sites(providers)

        # Enhance with provider information and logos
        if isinstance(model_data, dict):
            model_data = enhance_model_with_provider_info(model_data, enhanced_providers)

            # Then enhance with Hugging Face data if requested
            if include_huggingface:
                model_data = enhance_model_with_huggingface_data(model_data)

        return {
            "data": model_data,
            "provider": provider_name,
            "model": model_name,
            "include_huggingface": include_huggingface,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get specific model {provider_name}/{model_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get model data")
