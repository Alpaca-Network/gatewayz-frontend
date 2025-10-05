import datetime
import logging
from typing import Dict, List, Optional

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


def annotate_provider_sources(providers: List[dict], source: str) -> List[dict]:
    annotated = []
    for provider in providers or []:
        entry = provider.copy()
        entry.setdefault("source_gateway", source)
        entry.setdefault("source_gateways", [source])
        if source not in entry["source_gateways"]:
            entry["source_gateways"].append(source)
        annotated.append(entry)
    return annotated


def derive_portkey_providers(models: List[dict]) -> List[dict]:
    providers: Dict[str, dict] = {}
    for model in models or []:
        provider_slug = model.get("provider_slug")
        if not provider_slug:
            model_id = model.get("id", "")
            if "/" in model_id:
                provider_slug = model_id.split("/")[0]
        if not provider_slug:
            continue
        provider_slug = provider_slug.lstrip("@")
        if provider_slug not in providers:
            providers[provider_slug] = {
                "slug": provider_slug,
                "site_url": model.get("provider_site_url"),
                "logo_url": model.get("model_logo_url"),
                "moderated_by_openrouter": False,
                "source_gateway": "portkey",
                "source_gateways": ["portkey"],
            }
    return list(providers.values())


def merge_provider_lists(*provider_lists: List[List[dict]]) -> List[dict]:
    merged: Dict[str, dict] = {}
    for providers in provider_lists:
        for provider in providers or []:
            slug = provider.get("slug")
            if not slug:
                continue
            if slug not in merged:
                copied = provider.copy()
                sources = list(copied.get("source_gateways", []) or [])
                source = copied.get("source_gateway")
                if source and source not in sources:
                    sources.append(source)
                copied["source_gateways"] = sources
                merged[slug] = copied
            else:
                existing = merged[slug]
                sources = existing.get("source_gateways", [])
                for src in provider.get("source_gateways", []) or []:
                    if src and src not in sources:
                        sources.append(src)
                source = provider.get("source_gateway")
                if source and source not in sources:
                    sources.append(source)
                existing["source_gateways"] = sources
    return list(merged.values())


def merge_models_by_slug(primary: List[dict], secondary: List[dict]) -> List[dict]:
    merged = []
    seen = set()
    for model in primary or []:
        key = (model.get("canonical_slug") or model.get("id") or "").lower()
        seen.add(key)
        merged.append(model)
    for model in secondary or []:
        key = (model.get("canonical_slug") or model.get("id") or "").lower()
        if key in seen:
            continue
        seen.add(key)
        merged.append(model)
    return merged


# Provider and Models Information Endpoints
@router.get("/provider", tags=["providers"])
async def get_providers(
    moderated_only: bool = Query(False, description="Filter for moderated providers only"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
    gateway: Optional[str] = Query(
        "openrouter",
        description="Gateway to use: 'openrouter', 'portkey', or 'all'",
    ),
):
    """Get all available provider list with detailed metric data including model count and logo URLs"""
    try:
        gateway_value = (gateway or "openrouter").lower()

        openrouter_models = []
        portkey_models = []
        provider_groups: List[List[dict]] = []

        if gateway_value in ("openrouter", "all"):
            raw_providers = get_cached_providers()
            if not raw_providers and gateway_value == "openrouter":
                raise HTTPException(status_code=503, detail="Provider data unavailable")

            enhanced_openrouter = annotate_provider_sources(
                enhance_providers_with_logos_and_sites(raw_providers or []),
                "openrouter",
            )
            provider_groups.append(enhanced_openrouter)
            openrouter_models = get_cached_models("openrouter") or []

        if gateway_value in ("portkey", "all"):
            portkey_models = get_cached_models("portkey") or []
            provider_groups.append(derive_portkey_providers(portkey_models))
            if gateway_value == "portkey" and not portkey_models:
                raise HTTPException(status_code=503, detail="Portkey models data unavailable")

        if not provider_groups:
            raise HTTPException(status_code=503, detail="Provider data unavailable")

        combined_providers = merge_provider_lists(*provider_groups)

        models_for_counts: List[dict] = []
        if gateway_value in ("openrouter", "all"):
            models_for_counts.extend(openrouter_models)
        if gateway_value in ("portkey", "all"):
            models_for_counts.extend(portkey_models)

        if moderated_only:
            combined_providers = [
                provider for provider in combined_providers if provider.get("moderated_by_openrouter")
            ]

        total_providers = len(combined_providers)
        if offset:
            combined_providers = combined_providers[offset:]
        if limit:
            combined_providers = combined_providers[:limit]

        for provider in combined_providers:
            provider_slug = provider.get("slug")
            provider["model_count"] = get_model_count_by_provider(provider_slug, models_for_counts)

        return {
            "data": combined_providers,
            "total": total_providers,
            "returned": len(combined_providers),
            "offset": offset or 0,
            "limit": limit,
            "gateway": gateway_value,
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
    gateway: Optional[str] = Query(
        "openrouter",
        description="Gateway to use: 'openrouter', 'portkey', or 'all'",
    ),
):
    """Get all metric data of available models with optional filtering, pagination, Hugging Face integration, and provider logos"""

    try:
        logger.error(f"/models endpoint called with gateway parameter: {repr(gateway)}")
        gateway_value = (gateway or "openrouter").lower()
        logger.info(
            f"Getting models with provider={provider}, limit={limit}, offset={offset}, gateway={gateway_value}"
        )

        openrouter_models: List[dict] = []
        portkey_models: List[dict] = []

        if gateway_value in ("openrouter", "all"):
            openrouter_models = get_cached_models("openrouter") or []
            if gateway_value == "openrouter" and not openrouter_models:
                logger.error("No OpenRouter models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("portkey", "all"):
            portkey_models = get_cached_models("portkey") or []
            if gateway_value == "portkey" and not portkey_models:
                logger.error("No Portkey models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value == "openrouter":
            models = openrouter_models
        elif gateway_value == "portkey":
            models = portkey_models
        else:
            models = merge_models_by_slug(openrouter_models, portkey_models)

        if not models:
            logger.error("No models data available after applying gateway selection")
            raise HTTPException(status_code=503, detail="Models data unavailable")

        provider_groups: List[List[dict]] = []

        if gateway_value in ("openrouter", "all"):
            providers = get_cached_providers()
            if not providers and gateway_value == "openrouter":
                raise HTTPException(status_code=503, detail="Provider data unavailable")
            enhanced_providers = annotate_provider_sources(
                enhance_providers_with_logos_and_sites(providers or []),
                "openrouter",
            )
            provider_groups.append(enhanced_providers)

        if gateway_value in ("portkey", "all"):
            models_for_providers = portkey_models if gateway_value == "all" else models
            provider_groups.append(derive_portkey_providers(models_for_providers))

        enhanced_providers = merge_provider_lists(*provider_groups)
        logger.info(f"Retrieved {len(enhanced_providers)} enhanced providers from cache")

        if provider:
            provider_lower = provider.lower()
            original_count = len(models)
            filtered_models = []
            for model in models:
                model_id = (model.get("id") or "").lower()
                provider_slug = (model.get("provider_slug") or "").lower()
                if provider_lower in model_id or provider_lower == provider_slug:
                    filtered_models.append(model)
            models = filtered_models
            logger.info(
                f"Filtered models by provider '{provider}': {original_count} -> {len(models)}"
            )

        total_models = len(models)

        if offset:
            models = models[offset:]
            logger.info(f"Applied offset {offset}: {len(models)} models remaining")
        if limit:
            models = models[:limit]
            logger.info(f"Applied limit {limit}: {len(models)} models remaining")

        enhanced_models = []
        for model in models:
            enhanced_model = enhance_model_with_provider_info(model, enhanced_providers)
            if include_huggingface:
                enhanced_model = enhance_model_with_huggingface_data(enhanced_model)
            enhanced_models.append(enhanced_model)

        note = {
            "openrouter": "OpenRouter catalog",
            "portkey": "Portkey catalog",
            "all": "Combined OpenRouter and Portkey catalog",
        }.get(gateway_value, "OpenRouter catalog")

        result = {
            "data": enhanced_models,
            "total": total_models,
            "returned": len(enhanced_models),
            "offset": offset or 0,
            "limit": limit,
            "include_huggingface": include_huggingface,
            "gateway": gateway_value,
            "note": note,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        logger.error(f"Returning /models response with keys: {list(result.keys())}, gateway={gateway_value}, first_model={enhanced_models[0]['id'] if enhanced_models else 'none'}")
        return result

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
