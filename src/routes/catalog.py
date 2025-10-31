import datetime
import json
import logging
import asyncio
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Query, Response
from datetime import datetime, timezone

from fastapi import  HTTPException

from src.services.models import get_cached_models, enhance_model_with_provider_info, \
    get_model_count_by_provider, enhance_model_with_huggingface_data, fetch_specific_model
from src.services.providers import get_cached_providers, \
    enhance_providers_with_logos_and_sites
from src.db.gateway_analytics import (
    get_provider_stats, get_gateway_stats, get_trending_models,
    get_all_gateways_summary, get_top_models_by_provider
)
from src.services.modelz_client import (
    fetch_modelz_tokens, get_modelz_model_ids, check_model_exists_on_modelz,
    get_modelz_model_details
)


# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

# Single router for all model catalog endpoints
router = APIRouter()


def normalize_developer_segment(value: Optional[str]) -> Optional[str]:
    """Align developer/provider identifiers with Hugging Face style slugs."""
    if value is None:
        return None
    # Convert to string if it's a Query object or other type
    value = str(value) if not isinstance(value, str) else value
    normalized = value.strip()
    if not normalized:
        return None
    # Remove leading @ that some gateways include (e.g., Portkey)
    normalized = normalized.lstrip("@")
    return normalized


def normalize_model_segment(value: Optional[str]) -> Optional[str]:
    """Normalize model identifiers without altering intentional casing."""
    if value is None:
        return None
    # Convert to string if it's a Query object or other type
    value = str(value) if not isinstance(value, str) else value
    normalized = value.strip()
    return normalized or None


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


def derive_providers_from_models(models: List[dict], gateway_name: str) -> List[dict]:
    """
    Generic function to derive provider list from model list for any gateway.
    Used for gateways that don't have a dedicated provider endpoint.
    """
    providers: Dict[str, dict] = {}
    for model in models or []:
        # Try different fields to get provider name
        provider_slug = None
        
        # Try provider_slug field
        provider_slug = model.get("provider_slug") or model.get("provider")
        
        # Try extracting from model ID (format: provider/model-name)
        if not provider_slug:
            model_id = model.get("id", "")
            if "/" in model_id:
                provider_slug = model_id.split("/")[0]
        
        # Try name field
        if not provider_slug:
            name = model.get("name", "")
            if "/" in name:
                provider_slug = name.split("/")[0]
        
        if not provider_slug:
            continue
        
        # Clean up slug
        provider_slug = provider_slug.lstrip("@").lower()
        
        if provider_slug not in providers:
            providers[provider_slug] = {
                "slug": provider_slug,
                "site_url": model.get("provider_site_url"),
                "logo_url": model.get("model_logo_url") or model.get("logo_url"),
                "moderated_by_openrouter": False,
                "source_gateway": gateway_name,
                "source_gateways": [gateway_name],
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


def merge_models_by_slug(*model_lists: List[dict]) -> List[dict]:
    """Merge multiple model lists by slug, avoiding duplicates"""
    merged = []
    seen = set()
    for model_list in model_lists:
        for model in model_list or []:
            key = (model.get("canonical_slug") or model.get("id") or "").lower()
            if key in seen:
                continue
            seen.add(key)
            merged.append(model)
    return merged


# Provider and Models Information Endpoints
@router.get("/v1/provider", tags=["providers"])
async def get_providers(
    moderated_only: bool = Query(False, description="Filter for moderated providers only"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
    gateway: Optional[str] = Query(
        "openrouter",
        description="Gateway to use: 'openrouter', 'portkey', 'featherless', 'deepinfra', 'chutes', 'groq', 'fireworks', 'together', 'google', 'cerebras', 'nebius', 'xai', 'novita', 'huggingface' (or 'hug'), 'aimo', 'near', 'fal', or 'all'",
    ),
):
    """Get all available provider list with detailed metric data including model count and logo URLs"""
    try:
        gateway_value = (gateway or "openrouter").lower()
        # Support both 'huggingface' and 'hug' as aliases
        if gateway_value == "huggingface":
            gateway_value = "hug"

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

        # Add support for other gateways
        other_gateways = ["featherless", "deepinfra", "chutes", "groq", "fireworks", "together", "fal"]
        all_models = {}  # Track models for each gateway

        for gw in other_gateways:
            if gateway_value in (gw, "all"):
                gw_models = get_cached_models(gw) or []
                all_models[gw] = gw_models
                if gw_models:
                    derived_providers = derive_providers_from_models(gw_models, gw)
                    provider_groups.append(derived_providers)
                elif gateway_value == gw:
                    # Only raise error if specifically requesting this gateway
                    raise HTTPException(status_code=503, detail=f"{gw.capitalize()} models data unavailable")

        if not provider_groups:
            raise HTTPException(status_code=503, detail="Provider data unavailable")

        combined_providers = merge_provider_lists(*provider_groups)

        models_for_counts: List[dict] = []
        if gateway_value in ("openrouter", "all"):
            models_for_counts.extend(openrouter_models)
        if gateway_value in ("portkey", "all"):
            models_for_counts.extend(portkey_models)
        # Add models from other gateways for counting
        for gw, models in all_models.items():
            if gateway_value in (gw, "all"):
                models_for_counts.extend(models)

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


# ============================================================================
# INTERNAL HELPER FUNCTIONS (Used by public API endpoints below)
# These functions contain the actual logic but are not directly exposed as routes
# ============================================================================

async def get_models(
    provider: Optional[str] = Query(None, description="Filter models by provider"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
    include_huggingface: bool = Query(
        True, description="Include Hugging Face metrics for models that have hugging_face_id"
    ),
    gateway: Optional[str] = Query(
        "openrouter",
        description="Gateway to use: 'openrouter', 'portkey', 'featherless', 'deepinfra', 'chutes', 'groq', 'fireworks', 'together', 'google', 'cerebras', 'nebius', 'xai', 'novita', 'huggingface' (or 'hug'), 'aimo', 'near', 'fal', or 'all'",
    ),
):
    """Get all metric data of available models with optional filtering, pagination, Hugging Face integration, and provider logos"""

    try:
        provider = normalize_developer_segment(provider)
        logger.error(f"/models endpoint called with gateway parameter: {repr(gateway)}")
        gateway_value = (gateway or "openrouter").lower()
        # Support both 'huggingface' and 'hug' as aliases
        if gateway_value == "huggingface":
            gateway_value = "hug"
        logger.info(
            f"Getting models with provider={provider}, limit={limit}, offset={offset}, gateway={gateway_value}"
        )

        openrouter_models: List[dict] = []
        portkey_models: List[dict] = []
        featherless_models: List[dict] = []
        deepinfra_models: List[dict] = []
        chutes_models: List[dict] = []
        groq_models: List[dict] = []
        fireworks_models: List[dict] = []
        together_models: List[dict] = []
        google_models: List[dict] = []
        cerebras_models: List[dict] = []
        nebius_models: List[dict] = []
        xai_models: List[dict] = []
        novita_models: List[dict] = []
        hug_models: List[dict] = []
        aimo_models: List[dict] = []
        near_models: List[dict] = []
        fal_models: List[dict] = []

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

        if gateway_value in ("featherless", "all"):
            featherless_models = get_cached_models("featherless") or []
            if gateway_value == "featherless" and not featherless_models:
                logger.error("No Featherless models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("deepinfra", "all"):
            deepinfra_models = get_cached_models("deepinfra") or []
            if gateway_value == "deepinfra" and not deepinfra_models:
                logger.error("No DeepInfra models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("chutes", "all"):
            chutes_models = get_cached_models("chutes") or []
            if gateway_value == "chutes" and not chutes_models:
                logger.error("No Chutes models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("groq", "all"):
            groq_models = get_cached_models("groq") or []
            if gateway_value == "groq" and not groq_models:
                logger.error("No Groq models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("fireworks", "all"):
            fireworks_models = get_cached_models("fireworks") or []
            if gateway_value == "fireworks" and not fireworks_models:
                logger.error("No Fireworks models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("together", "all"):
            together_models = get_cached_models("together") or []
            if gateway_value == "together" and not together_models:
                logger.error("No Together models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("google", "all"):
            google_models = get_cached_models("google") or []
            if gateway_value == "google" and not google_models:
                logger.error("No Google models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("cerebras", "all"):
            cerebras_models = get_cached_models("cerebras") or []
            if gateway_value == "cerebras" and not cerebras_models:
                logger.error("No Cerebras models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("nebius", "all"):
            nebius_models = get_cached_models("nebius") or []
            if gateway_value == "nebius" and not nebius_models:
                logger.error("No Nebius models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("xai", "all"):
            xai_models = get_cached_models("xai") or []
            if gateway_value == "xai" and not xai_models:
                logger.error("No Xai models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("novita", "all"):
            novita_models = get_cached_models("novita") or []
            if gateway_value == "novita" and not novita_models:
                logger.error("No Novita models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("hug", "all"):
            hug_models = get_cached_models("hug") or []
            if gateway_value == "hug" and not hug_models:
                logger.error("No Hugging Face models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("aimo", "all"):
            aimo_models = get_cached_models("aimo") or []
            if gateway_value == "aimo" and not aimo_models:
                logger.error("No AIMO models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("near", "all"):
            near_models = get_cached_models("near") or []
            if gateway_value == "near" and not near_models:
                logger.error("No Near models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value in ("fal", "all"):
            fal_models = get_cached_models("fal") or []
            if gateway_value == "fal" and not fal_models:
                logger.error("No Fal models data available from cache")
                raise HTTPException(status_code=503, detail="Models data unavailable")

        if gateway_value == "openrouter":
            models = openrouter_models
        elif gateway_value == "portkey":
            models = portkey_models
        elif gateway_value == "featherless":
            models = featherless_models
        elif gateway_value == "deepinfra":
            models = deepinfra_models
        elif gateway_value == "chutes":
            models = chutes_models
        elif gateway_value == "groq":
            models = groq_models
        elif gateway_value == "fireworks":
            models = fireworks_models
        elif gateway_value == "together":
            models = together_models
        elif gateway_value == "google":
            models = google_models
        elif gateway_value == "cerebras":
            models = cerebras_models
        elif gateway_value == "nebius":
            models = nebius_models
        elif gateway_value == "xai":
            models = xai_models
        elif gateway_value == "novita":
            models = novita_models
        elif gateway_value == "hug":
            models = hug_models
        elif gateway_value == "aimo":
            models = aimo_models
        elif gateway_value == "near":
            models = near_models
        elif gateway_value == "fal":
            models = fal_models
        else:
            # For "all" gateway, merge all models but avoid duplicates from Portkey-based providers
            # Note: google, cerebras, nebius, xai, novita, hug are filtered FROM Portkey models,
            # so we DON'T include them separately in the merge to avoid counting them twice
            models = merge_models_by_slug(openrouter_models, portkey_models, featherless_models, deepinfra_models, chutes_models, groq_models, fireworks_models, together_models, aimo_models, near_models, fal_models)

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

        if gateway_value in ("featherless", "all"):
            models_for_providers = featherless_models if gateway_value == "all" else models
            featherless_providers = derive_portkey_providers(models_for_providers)
            annotated_featherless = annotate_provider_sources(featherless_providers, "featherless")
            provider_groups.append(annotated_featherless)

        if gateway_value in ("deepinfra", "all"):
            models_for_providers = deepinfra_models if gateway_value == "all" else models
            deepinfra_providers = derive_providers_from_models(models_for_providers, "deepinfra")
            annotated_deepinfra = annotate_provider_sources(deepinfra_providers, "deepinfra")
            provider_groups.append(annotated_deepinfra)

        if gateway_value in ("chutes", "all"):
            models_for_providers = chutes_models if gateway_value == "all" else models
            chutes_providers = derive_portkey_providers(models_for_providers)
            annotated_chutes = annotate_provider_sources(chutes_providers, "chutes")
            provider_groups.append(annotated_chutes)

        if gateway_value in ("groq", "all"):
            models_for_providers = groq_models if gateway_value == "all" else models
            groq_providers = derive_portkey_providers(models_for_providers)
            annotated_groq = annotate_provider_sources(groq_providers, "groq")
            provider_groups.append(annotated_groq)

        if gateway_value in ("fireworks", "all"):
            models_for_providers = fireworks_models if gateway_value == "all" else models
            fireworks_providers = derive_portkey_providers(models_for_providers)
            annotated_fireworks = annotate_provider_sources(fireworks_providers, "fireworks")
            provider_groups.append(annotated_fireworks)

        if gateway_value in ("together", "all"):
            models_for_providers = together_models if gateway_value == "all" else models
            together_providers = derive_portkey_providers(models_for_providers)
            annotated_together = annotate_provider_sources(together_providers, "together")
            provider_groups.append(annotated_together)

        if gateway_value in ("google", "all"):
            models_for_providers = google_models if gateway_value == "all" else models
            google_providers = derive_providers_from_models(models_for_providers, "google")
            annotated_google = annotate_provider_sources(google_providers, "google")
            provider_groups.append(annotated_google)

        if gateway_value in ("cerebras", "all"):
            models_for_providers = cerebras_models if gateway_value == "all" else models
            cerebras_providers = derive_providers_from_models(models_for_providers, "cerebras")
            annotated_cerebras = annotate_provider_sources(cerebras_providers, "cerebras")
            provider_groups.append(annotated_cerebras)

        if gateway_value in ("nebius", "all"):
            models_for_providers = nebius_models if gateway_value == "all" else models
            nebius_providers = derive_providers_from_models(models_for_providers, "nebius")
            annotated_nebius = annotate_provider_sources(nebius_providers, "nebius")
            provider_groups.append(annotated_nebius)

        if gateway_value in ("xai", "all"):
            models_for_providers = xai_models if gateway_value == "all" else models
            xai_providers = derive_providers_from_models(models_for_providers, "xai")
            annotated_xai = annotate_provider_sources(xai_providers, "xai")
            provider_groups.append(annotated_xai)

        if gateway_value in ("novita", "all"):
            models_for_providers = novita_models if gateway_value == "all" else models
            novita_providers = derive_providers_from_models(models_for_providers, "novita")
            annotated_novita = annotate_provider_sources(novita_providers, "novita")
            provider_groups.append(annotated_novita)

        if gateway_value in ("hug", "all"):
            models_for_providers = hug_models if gateway_value == "all" else models
            hug_providers = derive_providers_from_models(models_for_providers, "hug")
            annotated_hug = annotate_provider_sources(hug_providers, "hug")
            provider_groups.append(annotated_hug)

        if gateway_value in ("aimo", "all"):
            models_for_providers = aimo_models if gateway_value == "all" else models
            aimo_providers = derive_providers_from_models(models_for_providers, "aimo")
            annotated_aimo = annotate_provider_sources(aimo_providers, "aimo")
            provider_groups.append(annotated_aimo)

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

        # Ensure offset and limit are integers
        try:
            offset_int = int(str(offset)) if offset else 0
            limit_int = int(str(limit)) if limit else None
        except (ValueError, TypeError):
            offset_int = 0
            limit_int = None

        if offset_int:
            models = models[offset_int:]
            logger.info(f"Applied offset {offset_int}: {len(models)} models remaining")
        if limit_int and gateway_value != "all":
            logger.debug("Ignoring limit=%s for gateway '%s' to return full catalog", limit_int, gateway_value)
            limit_int = None

        if limit_int:
            models = models[:limit_int]
            logger.info(f"Applied limit {limit_int}: {len(models)} models remaining")

        # Optimize model enhancement for fast response
        # Only enhance with provider info (fast operation)
        enhanced_models = []
        for model in models:
            enhanced_model = enhance_model_with_provider_info(model, enhanced_providers)
            enhanced_models.append(enhanced_model)

        # If HuggingFace data requested, fetch it asynchronously in background
        # This allows the response to return immediately without waiting
        if include_huggingface:
            # Schedule background task to enrich with HF data
            # Note: In production, this would use a background task queue
            # For now, we'll enrich a limited subset to avoid blocking
            for i, model in enumerate(enhanced_models[:10]):  # Only enrich first 10 to keep response fast
                try:
                    enhanced_models[i] = enhance_model_with_huggingface_data(model)
                except Exception as e:
                    logger.debug(f"Failed to enrich model {model.get('id')} with HF data: {e}")
                    # Continue without HF data if fetch fails

        note = {
            "openrouter": "OpenRouter catalog",
            "portkey": "Portkey catalog",
            "featherless": "Featherless catalog",
            "deepinfra": "DeepInfra catalog",
            "chutes": "Chutes.ai catalog",
            "groq": "Groq catalog",
            "fireworks": "Fireworks catalog",
            "together": "Together catalog",
            "google": "Google catalog",
            "cerebras": "Cerebras catalog",
            "nebius": "Nebius catalog",
            "xai": "Xai catalog",
            "novita": "Novita catalog",
            "hug": "Hugging Face catalog",
            "aimo": "AIMO Network catalog",
            "near": "Near AI catalog",
            "fal": "Fal.ai catalog",
            "all": "Combined OpenRouter, Portkey, Featherless, DeepInfra, Chutes, Groq, Fireworks, Together, Google, Cerebras, Nebius, Xai, Novita, Hugging Face, AIMO, Near AI, and Fal.ai catalogs",
        }.get(gateway_value, "OpenRouter catalog")

        result = {
            "data": enhanced_models,
            "total": total_models,
            "returned": len(enhanced_models),
            "offset": offset_int,
            "limit": limit_int,
            "include_huggingface": include_huggingface,
            "gateway": gateway_value,
            "note": note,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        logger.error(f"Returning /models response with keys: {list(result.keys())}, gateway={gateway_value}, first_model={enhanced_models[0]['id'] if enhanced_models else 'none'}")

        # Return response with cache headers for browser/CDN caching
        # Cache for 5 minutes since data changes infrequently (1 hour TTL on backend)
        return Response(
            content=json.dumps(result),
            media_type="application/json",
            headers={
                "Cache-Control": "public, max-age=300",  # 5 minute browser cache
                "ETag": f'"{hash(json.dumps(enhanced_models[:5]))}"',  # Simple ETag for validation
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get models: {e}")
        raise HTTPException(status_code=500, detail="Failed to get models")


async def get_specific_model(
    provider_name: str,
    model_name: str,
    include_huggingface: bool = Query(True, description="Include Hugging Face metrics if available"),
    gateway: Optional[str] = Query(
        None,
        description="Gateway to use: 'openrouter', 'portkey', 'featherless', 'deepinfra', 'chutes', 'groq', 'fireworks', 'together', 'google', 'cerebras', 'nebius', 'xai', 'novita', 'huggingface' (or 'hug'), 'aimo', 'near', 'fal', or auto-detect if not specified",
    ),
):
    """Get specific model data of a given provider with detailed information from any gateway
    
    This endpoint supports fetching model data from multiple model providers:
    - OpenRouter: Full model endpoint data including performance metrics
    - Portkey: Model catalog data with cross-referenced pricing
    - Featherless: Model catalog data  
    - DeepInfra: Model catalog data from DeepInfra's API
    - Chutes: Model catalog data from Chutes.ai
    - Fal.ai: Image/video/audio generation models (e.g., fal-ai/stable-diffusion-v15)
    - Hugging Face: Open-source models from Hugging Face Hub
    - And other gateways: groq, fireworks, together, google, cerebras, nebius, xai, novita, aimo, near
    
    If gateway is not specified, it will automatically detect which gateway the model belongs to.
    
    Examples:
        GET /v1/models/openai/gpt-4?gateway=openrouter
        GET /v1/models/anthropic/claude-3?gateway=portkey
        GET /v1/models/meta-llama/llama-3?gateway=featherless
        GET /v1/models/fal-ai/stable-diffusion-v15?gateway=fal
        GET /v1/models/fal-ai/stable-diffusion-v15 (auto-detects fal gateway)
    """
    # Prevent this route from catching /v1/* API endpoints
    normalized_provider = normalize_developer_segment(provider_name) or provider_name
    normalized_model = normalize_model_segment(model_name) or model_name

    provider_name = normalized_provider
    model_name = normalized_model

    if provider_name == "v1":
        raise HTTPException(status_code=404, detail=f"Model {provider_name}/{model_name} not found")

    try:
        # Fetch model data from appropriate gateway
        model_data = fetch_specific_model(provider_name, model_name, gateway)
        
        if not model_data:
            gateway_msg = f" from gateway '{gateway}'" if gateway else ""
            raise HTTPException(
                status_code=404, 
                detail=f"Model {provider_name}/{model_name} not found{gateway_msg}"
            )

        # Determine which gateway was used
        detected_gateway = model_data.get("source_gateway", gateway or "openrouter")

        # Get enhanced providers data for all gateways
        provider_groups: List[List[dict]] = []
        
        # Always try to get OpenRouter providers for cross-reference
        openrouter_providers = get_cached_providers()
        if openrouter_providers:
            enhanced_openrouter = annotate_provider_sources(
                enhance_providers_with_logos_and_sites(openrouter_providers),
                "openrouter",
            )
            provider_groups.append(enhanced_openrouter)
        
        # Add providers from other gateways based on detected gateway
        if detected_gateway in ["portkey", "featherless", "deepinfra", "chutes", "groq", "fireworks", "together"]:
            # Get models from the detected gateway to derive providers
            gateway_models = get_cached_models(detected_gateway)
            if gateway_models:
                derived_providers = derive_portkey_providers(gateway_models)
                annotated_providers = annotate_provider_sources(derived_providers, detected_gateway)
                provider_groups.append(annotated_providers)
        
        # Merge all provider data
        enhanced_providers = merge_provider_lists(*provider_groups) if provider_groups else []

        # Enhance with provider information and logos
        if isinstance(model_data, dict):
            model_data = enhance_model_with_provider_info(model_data, enhanced_providers)

            # Then enhance with Hugging Face data if requested
            if include_huggingface and model_data.get('hugging_face_id'):
                model_data = enhance_model_with_huggingface_data(model_data)

        return {
            "data": model_data,
            "provider": provider_name,
            "model": model_name,
            "gateway": detected_gateway,
            "include_huggingface": include_huggingface,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get specific model {provider_name}/{model_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get model data")


async def get_developer_models(
    developer_name: str,
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
    include_huggingface: bool = Query(True, description="Include Hugging Face metrics"),
    gateway: Optional[str] = Query("all", description="Gateway: 'openrouter', 'portkey', or 'all'"),
):
    """
    Get all models from a specific developer/provider (e.g., anthropic, openai, google)

    Args:
        developer_name: Provider/developer name (e.g., 'anthropic', 'openai', 'google', 'meta')
        limit: Maximum number of models to return
        offset: Number of models to skip (for pagination)
        include_huggingface: Whether to include HuggingFace metrics
        gateway: Which gateway to query ('openrouter', 'portkey', or 'all')

    Returns:
        JSON response with:
        - models: List of model objects from the developer
        - developer: Developer name
        - total: Total number of models found
        - count: Number of models returned (after pagination)

    Example:
        GET /catalog/developer/anthropic/models
        GET /catalog/developer/openai/models?limit=10
    """
    try:
        developer_name = normalize_developer_segment(developer_name) or developer_name
        logger.info(f"Getting models for developer: {developer_name}")

        # Get models from specified gateway
        gateway_value = (gateway or "all").lower()
        models = get_cached_models(gateway_value)

        if not models:
            raise HTTPException(status_code=503, detail="Models data unavailable")

        # Filter models by developer/provider
        developer_lower = developer_name.lower()
        filtered_models = []

        for model in models:
            model_id = (model.get("id") or "").lower()
            provider_slug = (model.get("provider_slug") or "").lower()

            # Check if model ID starts with developer name (e.g., "anthropic/claude-3")
            # or if provider_slug matches
            if model_id.startswith(f"{developer_lower}/") or provider_slug == developer_lower:
                filtered_models.append(model)

        if not filtered_models:
            logger.warning(f"No models found for developer: {developer_name}")
            return {
                "developer": developer_name,
                "models": [],
                "total": 0,
                "count": 0,
                "offset": offset,
                "limit": limit
            }

        total_models = len(filtered_models)
        logger.info(f"Found {total_models} models for developer '{developer_name}'")

        # Apply pagination
        if offset:
            filtered_models = filtered_models[offset:]
        if limit:
            filtered_models = filtered_models[:limit]

        # Enhance models with provider info and HuggingFace data
        providers = get_cached_providers()
        enhanced_providers = enhance_providers_with_logos_and_sites(providers or [])

        enhanced_models = []
        for model in filtered_models:
            enhanced_model = enhance_model_with_provider_info(model, enhanced_providers)
            if include_huggingface and enhanced_model.get('hugging_face_id'):
                enhanced_model = enhance_model_with_huggingface_data(enhanced_model)
            enhanced_models.append(enhanced_model)

        return {
            "developer": developer_name,
            "models": enhanced_models,
            "total": total_models,
            "count": len(enhanced_models),
            "offset": offset,
            "limit": limit,
            "gateway": gateway_value
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get models for developer {developer_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get developer models: {str(e)}")


# ==================== NEW: Gateway & Provider Statistics Endpoints ====================

@router.get("/v1/provider/{provider_name}/stats", tags=["statistics"])
async def get_provider_statistics(
    provider_name: str,
    gateway: Optional[str] = Query(None, description="Filter by specific gateway"),
    time_range: str = Query("24h", description="Time range: '1h', '24h', '7d', '30d', 'all'")
):
    """
    Get comprehensive statistics for a specific provider
    
    This endpoint provides usage statistics for a provider across all or a specific gateway.
    **This fixes the "Total Tokens: 0" and "Top Model: N/A" issues in your UI!**
    
    Args:
        provider_name: Provider name (e.g., 'openai', 'anthropic', 'meta-llama')
        gateway: Optional gateway filter
        time_range: Time range for statistics
    
    Returns:
        Provider statistics including:
        - Total requests and tokens
        - Total cost and averages
        - Top model used
        - Model breakdown
        - Speed metrics
        
    Example:
        GET /catalog/provider/openai/stats?time_range=24h
        GET /catalog/provider/anthropic/stats?gateway=portkey&time_range=7d
    """
    try:
        logger.info(f"Fetching stats for provider: {provider_name}, gateway: {gateway}, time_range: {time_range}")
        
        stats = get_provider_stats(
            provider_name=provider_name,
            gateway=gateway,
            time_range=time_range
        )
        
        if "error" in stats:
            raise HTTPException(status_code=500, detail=stats["error"])
        
        return {
            "success": True,
            "data": stats,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get provider stats for {provider_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get provider statistics: {str(e)}")


@router.get("/v1/gateway/{gateway}/stats", tags=["statistics"])
async def get_gateway_statistics(
    gateway: str,
    time_range: str = Query("24h", description="Time range: '1h', '24h', '7d', '30d', 'all'")
):
    """
    Get comprehensive statistics for a specific gateway
    
    This endpoint provides usage statistics for a gateway (e.g., openrouter, portkey, groq, deepinfra).
    **This fixes the "Top Provider: N/A" issue in your UI!**
    
    Args:
        gateway: Gateway name ('openrouter', 'portkey', 'featherless', 'deepinfra', 'chutes', 'groq')
        time_range: Time range for statistics
        
    Returns:
        Gateway statistics including:
        - Total requests, tokens, and cost
        - Unique users, models, and providers
        - Top provider used through this gateway
        - Provider breakdown
        - Performance metrics
        
    Example:
        GET /catalog/gateway/openrouter/stats?time_range=24h
        GET /catalog/gateway/deepinfra/stats?time_range=7d
    """
    try:
        logger.info(f"Fetching stats for gateway: {gateway}, time_range: {time_range}")
        
        # Validate gateway
        valid_gateways = ["openrouter", "portkey", "featherless", "deepinfra", "chutes", "groq", "fireworks", "together"]
        if gateway.lower() not in valid_gateways:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid gateway. Must be one of: {', '.join(valid_gateways)}"
            )
        
        stats = get_gateway_stats(
            gateway=gateway,
            time_range=time_range
        )
        
        if "error" in stats:
            raise HTTPException(status_code=500, detail=stats["error"])
        
        return {
            "success": True,
            "data": stats,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get gateway stats for {gateway}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get gateway statistics: {str(e)}")


async def get_trending_models_endpoint(
    gateway: Optional[str] = Query("all", description="Gateway filter or 'all'"),
    time_range: str = Query("24h", description="Time range: '1h', '24h', '7d', '30d'"),
    limit: int = Query(10, description="Number of models to return", ge=1, le=100),
    sort_by: str = Query("requests", description="Sort by: 'requests', 'tokens', 'users'")
):
    """
    Get trending models based on usage
    
    This endpoint returns the most popular models sorted by usage metrics.
    **This helps populate "Top Model" in your UI!**
    
    Args:
        gateway: Gateway filter ('all' for all gateways)
        time_range: Time range for trending calculation
        limit: Number of models to return
        sort_by: Sort criteria ('requests', 'tokens', 'users')
        
    Returns:
        List of trending models with statistics
        
    Example:
        GET /catalog/models/trending?time_range=24h&limit=10
        GET /catalog/models/trending?gateway=deepinfra&sort_by=tokens
    """
    try:
        logger.info(f"Fetching trending models: gateway={gateway}, time_range={time_range}, sort_by={sort_by}")
        
        # Validate sort_by
        valid_sort = ["requests", "tokens", "users"]
        if sort_by not in valid_sort:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid sort_by. Must be one of: {', '.join(valid_sort)}"
            )
        
        trending = get_trending_models(
            gateway=gateway,
            time_range=time_range,
            limit=limit,
            sort_by=sort_by
        )
        
        return {
            "success": True,
            "data": trending,
            "count": len(trending),
            "gateway": gateway,
            "time_range": time_range,
            "sort_by": sort_by,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get trending models: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get trending models: {str(e)}")


@router.get("/v1/gateways/summary", tags=["statistics"])
async def get_all_gateways_summary_endpoint(
    time_range: str = Query("24h", description="Time range: '1h', '24h', '7d', '30d', 'all'")
):
    """
    Get summary statistics for all gateways
    
    This endpoint provides a comprehensive overview of usage across all gateways.
    **Perfect for dashboard overview showing all providers!**
    
    Args:
        time_range: Time range for statistics
        
    Returns:
        Dictionary with statistics for each gateway and overall totals
        
    Example:
        GET /catalog/gateways/summary?time_range=24h
    """
    try:
        logger.info(f"Fetching summary for all gateways: time_range={time_range}")
        
        summary = get_all_gateways_summary(time_range=time_range)
        
        if "error" in summary:
            raise HTTPException(status_code=500, detail=summary["error"])
        
        return {
            "success": True,
            "data": summary,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get gateways summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get gateways summary: {str(e)}")


@router.get("/v1/provider/{provider_name}/top-models", tags=["statistics"])
async def get_provider_top_models_endpoint(
    provider_name: str,
    limit: int = Query(5, description="Number of models to return", ge=1, le=20),
    time_range: str = Query("24h", description="Time range: '1h', '24h', '7d', '30d', 'all'")
):
    """
    Get top models for a specific provider
    
    This endpoint returns the most used models from a provider.
    
    Args:
        provider_name: Provider name (e.g., 'openai', 'anthropic')
        limit: Number of models to return
        time_range: Time range for statistics
        
    Returns:
        List of top models with usage statistics
        
    Example:
        GET /catalog/provider/openai/top-models?limit=5&time_range=7d
    """
    try:
        provider_name = normalize_developer_segment(provider_name) or provider_name
        logger.info(f"Fetching top models for provider: {provider_name}")
        
        top_models = get_top_models_by_provider(
            provider_name=provider_name,
            limit=limit,
            time_range=time_range
        )
        
        return {
            "success": True,
            "provider": provider_name,
            "data": top_models,
            "count": len(top_models),
            "time_range": time_range,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get top models for {provider_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get top models: {str(e)}")


# ==================== NEW: Model Comparison Endpoints ====================

async def compare_model_across_gateways(
    provider_name: str,
    model_name: str,
    gateways: Optional[str] = Query("all", description="Comma-separated gateways or 'all'")
):
    """
    Compare the same model across different gateways
    
    This endpoint fetches the same model from multiple gateways and compares:
    - Pricing (if available)
    - Availability
    - Features/capabilities
    - Provider information
    
    Args:
        provider_name: Provider name (e.g., 'openai', 'anthropic')
        model_name: Model name (e.g., 'gpt-4', 'claude-3')
        gateways: Comma-separated list of gateways or 'all'
        
    Returns:
        Comparison data across gateways with recommendation
        
    Example:
        GET /catalog/model/openai/gpt-4/compare
        GET /catalog/model/anthropic/claude-3/compare?gateways=openrouter,portkey
    """
    try:
        provider_name = normalize_developer_segment(provider_name) or provider_name
        model_name = normalize_model_segment(model_name) or model_name
        logger.info(f"Comparing model {provider_name}/{model_name} across gateways")
        
        # Parse gateways list
        if gateways and gateways.lower() != "all":
            gateway_list = [g.strip().lower() for g in gateways.split(",")]
        else:
            gateway_list = ["openrouter", "portkey", "featherless", "deepinfra", "chutes", "groq", "fireworks", "together"]
        
        model_id = f"{provider_name}/{model_name}"
        comparisons = []
        
        # Fetch model from each gateway
        for gateway in gateway_list:
            try:
                model_data = fetch_specific_model(provider_name, model_name, gateway)
                
                if model_data:
                    # Extract relevant comparison data
                    pricing = model_data.get("pricing", {})
                    
                    comparison = {
                        "gateway": gateway,
                        "available": True,
                        "model_id": model_data.get("id"),
                        "name": model_data.get("name"),
                        "pricing": {
                            "prompt": pricing.get("prompt"),
                            "completion": pricing.get("completion"),
                            "prompt_cost_per_1m": pricing.get("prompt"),
                            "completion_cost_per_1m": pricing.get("completion")
                        },
                        "context_length": model_data.get("context_length", 0),
                        "architecture": model_data.get("architecture", {}),
                        "provider_site_url": model_data.get("provider_site_url"),
                        "source_gateway": model_data.get("source_gateway")
                    }
                    
                    comparisons.append(comparison)
                else:
                    comparisons.append({
                        "gateway": gateway,
                        "available": False,
                        "model_id": model_id,
                        "name": f"{provider_name}/{model_name}",
                        "pricing": None,
                        "context_length": None,
                        "architecture": None,
                        "provider_site_url": None,
                        "source_gateway": gateway
                    })
                    
            except Exception as e:
                logger.warning(f"Failed to fetch model from {gateway}: {e}")
                comparisons.append({
                    "gateway": gateway,
                    "available": False,
                    "error": str(e),
                    "model_id": model_id
                })
        
        # Calculate recommendation based on pricing
        recommendation = _calculate_recommendation(comparisons)
        
        # Calculate potential savings
        savings_info = _calculate_savings(comparisons)
        
        return {
            "success": True,
            "model_id": model_id,
            "provider": provider_name,
            "model": model_name,
            "comparisons": comparisons,
            "recommendation": recommendation,
            "savings": savings_info,
            "available_count": sum(1 for c in comparisons if c.get("available")),
            "total_gateways_checked": len(comparisons),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to compare model {provider_name}/{model_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to compare model: {str(e)}")


async def batch_compare_models(
    model_ids: List[str] = Query(..., description="List of model IDs (e.g., ['openai/gpt-4', 'anthropic/claude-3'])"),
    criteria: str = Query("price", description="Comparison criteria: 'price', 'context', 'availability'")
):
    """
    Compare multiple models at once
    
    This endpoint allows comparing multiple models based on specific criteria.
    
    Args:
        model_ids: List of model IDs in format "provider/model"
        criteria: Comparison criteria
        
    Returns:
        Comparison data for all models
        
    Example:
        POST /catalog/models/batch-compare?model_ids=openai/gpt-4&model_ids=anthropic/claude-3&criteria=price
    """
    try:
        logger.info(f"Batch comparing {len(model_ids)} models by {criteria}")
        
        results = []
        
        for model_id in model_ids:
            # Parse model_id
            if "/" not in model_id:
                results.append({
                    "model_id": model_id,
                    "error": "Invalid model ID format. Expected 'provider/model'"
                })
                continue
            
            provider_part, model_part = model_id.split("/", 1)
            provider_name = normalize_developer_segment(provider_part) or provider_part.strip()
            model_name = normalize_model_segment(model_part) or model_part.strip()
            normalized_model_id = f"{provider_name}/{model_name}"
            
            try:
                # Get model from all gateways
                all_gateways = ["openrouter", "portkey", "featherless", "groq", "fireworks", "together"]
                models_data = []
                
                for gateway in all_gateways:
                    model_data = fetch_specific_model(provider_name, model_name, gateway)
                    if model_data:
                        models_data.append({
                            "gateway": gateway,
                            "data": model_data
                        })
                
                if models_data:
                    # Extract comparison data based on criteria
                    if criteria == "price":
                        comparison_data = _extract_price_comparison(models_data)
                    elif criteria == "context":
                        comparison_data = _extract_context_comparison(models_data)
                    elif criteria == "availability":
                        comparison_data = _extract_availability_comparison(models_data, all_gateways)
                    else:
                        comparison_data = {"error": f"Unknown criteria: {criteria}"}
                    
                    results.append({
                        "model_id": normalized_model_id,
                        "comparison": comparison_data,
                        "gateways_available": len(models_data)
                    })
                else:
                    results.append({
                        "model_id": normalized_model_id,
                        "error": "Model not found in any gateway"
                    })
                    
            except Exception as e:
                logger.error(f"Error comparing {normalized_model_id}: {e}")
                results.append({
                    "model_id": normalized_model_id,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "criteria": criteria,
            "models_compared": len(model_ids),
            "results": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed batch comparison: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to batch compare models: {str(e)}")


# ============================================================================
# PUBLIC API ENDPOINTS - Unified /models routes
# These are the actual FastAPI route handlers exposed to clients
# ============================================================================

@router.get("/v1/models", tags=["models"])
async def get_all_models(
    provider: Optional[str] = Query(None, description="Filter models by provider"),
    limit: Optional[int] = Query(50, description="Limit number of results (default: 50 for fast load)"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
    include_huggingface: bool = Query(
        False, description="Include Hugging Face metrics for models that have hugging_face_id (slower, default: false)"
    ),
    gateway: Optional[str] = Query(
        "openrouter",
        description="Gateway to use: 'openrouter', 'portkey', 'featherless', 'deepinfra', 'chutes', 'groq', 'fireworks', 'together', 'google', 'cerebras', 'nebius', 'xai', 'novita', 'huggingface' (or 'hug'), 'aimo', 'near', 'fal', or 'all'",
    ),
):
    return await get_models(
        provider=provider,
        limit=limit,
        offset=offset,
        include_huggingface=include_huggingface,
        gateway=gateway,
    )


@router.get("/v1/models/trending", tags=["statistics"])
async def get_trending_models_api(
    gateway: Optional[str] = Query("all", description="Gateway filter or 'all'"),
    time_range: str = Query("24h", description="Time range: '1h', '24h', '7d', '30d'"),
    limit: int = Query(10, description="Number of models to return", ge=1, le=100),
    sort_by: str = Query("requests", description="Sort by: 'requests', 'tokens', 'users'"),
):
    return await get_trending_models_endpoint(
        gateway=gateway,
        time_range=time_range,
        limit=limit,
        sort_by=sort_by,
    )


@router.post("/models/batch-compare", tags=["comparison"])
async def batch_compare_models_api(
    model_ids: List[str] = Query(..., description="List of model IDs (e.g., ['openai/gpt-4', 'anthropic/claude-3'])"),
    criteria: str = Query("price", description="Comparison criteria: 'price', 'context', 'availability'"),
):
    return await batch_compare_models(model_ids=model_ids, criteria=criteria)


@router.get("/v1/models/{provider_name}/{model_name:path}/compare", tags=["comparison"])
async def compare_model_gateways_api(
    provider_name: str,
    model_name: str,
    gateways: Optional[str] = Query("all", description="Comma-separated gateways or 'all'"),
):
    return await compare_model_across_gateways(
        provider_name=provider_name,
        model_name=model_name,
        gateways=gateways,
    )


@router.get("/v1/models/{provider_name}/{model_name:path}", tags=["models"])
async def get_specific_model_api(
    provider_name: str,
    model_name: str,
    include_huggingface: bool = Query(True, description="Include Hugging Face metrics if available"),
    gateway: Optional[str] = Query(
        None,
        description="Gateway to use: 'openrouter', 'portkey', 'featherless', 'deepinfra', 'chutes', 'groq', 'fireworks', 'together', 'google', 'cerebras', 'nebius', 'xai', 'novita', 'huggingface' (or 'hug'), 'aimo', 'near', 'fal', or auto-detect if not specified",
    ),
):
    return await get_specific_model(
        provider_name=provider_name,
        model_name=model_name,
        include_huggingface=include_huggingface,
        gateway=gateway,
    )


@router.get("/models/{provider_name}/{model_name:path}", tags=["models"])
async def get_specific_model_api_legacy(
    provider_name: str,
    model_name: str,
    include_huggingface: bool = Query(True, description="Include Hugging Face metrics if available"),
    gateway: Optional[str] = Query(
        None,
        description="Gateway to use: 'openrouter', 'portkey', 'featherless', 'deepinfra', 'chutes', 'groq', 'fireworks', 'together', 'google', 'cerebras', 'nebius', 'xai', 'novita', 'huggingface' (or 'hug'), 'aimo', 'near', 'fal', or auto-detect if not specified",
    ),
):
    """Legacy endpoint without /v1/ prefix for backward compatibility"""
    return await get_specific_model(
        provider_name=provider_name,
        model_name=model_name,
        include_huggingface=include_huggingface,
        gateway=gateway,
    )


@router.get("/v1/models/{developer_name}", tags=["models"])
async def get_developer_models_api(
    developer_name: str,
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
    include_huggingface: bool = Query(True, description="Include Hugging Face metrics"),
    gateway: Optional[str] = Query("all", description="Gateway: 'openrouter', 'portkey', or 'all'"),
):
    return await get_developer_models(
        developer_name=developer_name,
        limit=limit,
        offset=offset,
        include_huggingface=include_huggingface,
        gateway=gateway,
    )


@router.get("/v1/models/search", tags=["models"])
async def search_models(
    q: Optional[str] = Query(None, description="Search query (searches in model name, provider, description)"),
    modality: Optional[str] = Query(None, description="Filter by modality: text, image, audio, video, multimodal"),
    min_context: Optional[int] = Query(None, description="Minimum context window size (tokens)"),
    max_context: Optional[int] = Query(None, description="Maximum context window size (tokens)"),
    min_price: Optional[float] = Query(None, description="Minimum price per token (USD)"),
    max_price: Optional[float] = Query(None, description="Maximum price per token (USD)"),
    gateway: Optional[str] = Query("all", description="Gateway filter: openrouter, portkey, featherless, deepinfra, chutes, groq, fireworks, together, or all"),
    sort_by: str = Query("price", description="Sort by: price, context, popularity, name"),
    order: str = Query("asc", description="Sort order: asc or desc"),
    limit: int = Query(20, description="Number of results", ge=1, le=100),
    offset: int = Query(0, description="Pagination offset", ge=0)
):
    """
    Advanced model search with multiple filters.
    
    This endpoint allows you to search and filter models across all gateways
    with powerful query capabilities.
    
    **Examples:**
    - Search for cheap models: `?max_price=0.0001&sort_by=price`
    - Find models with large context: `?min_context=100000&sort_by=context&order=desc`
    - Search by name: `?q=gpt-4&gateway=openrouter`
    - Filter by modality: `?modality=image&sort_by=popularity`
    
    **Returns:**
    - List of models matching the criteria
    - Total count of matching models
    - Applied filters
    """
    try:
        # Get all models from specified gateways
        all_models = []
        gateway_value = gateway.lower() if gateway else "all"
        
        # Fetch from selected gateways
        if gateway_value in ("openrouter", "all"):
            openrouter_models = get_cached_models("openrouter") or []
            all_models.extend(openrouter_models)
        
        if gateway_value in ("portkey", "all"):
            portkey_models = get_cached_models("portkey") or []
            all_models.extend(portkey_models)
        
        if gateway_value in ("featherless", "all"):
            featherless_models = get_cached_models("featherless") or []
            all_models.extend(featherless_models)
        
        if gateway_value in ("deepinfra", "all"):
            deepinfra_models = get_cached_models("deepinfra") or []
            all_models.extend(deepinfra_models)
        
        if gateway_value in ("chutes", "all"):
            chutes_models = get_cached_models("chutes") or []
            all_models.extend(chutes_models)
        
        if gateway_value in ("groq", "all"):
            groq_models = get_cached_models("groq") or []
            all_models.extend(groq_models)
        
        if gateway_value in ("fireworks", "all"):
            fireworks_models = get_cached_models("fireworks") or []
            all_models.extend(fireworks_models)
        
        if gateway_value in ("together", "all"):
            together_models = get_cached_models("together") or []
            all_models.extend(together_models)
        
        # Apply filters
        filtered_models = all_models
        
        # Text search filter
        if q:
            q_lower = q.lower()
            filtered_models = [
                m for m in filtered_models
                if (q_lower in m.get("id", "").lower() or
                    q_lower in m.get("name", "").lower() or
                    q_lower in m.get("description", "").lower() or
                    q_lower in str(m.get("provider", "")).lower())
            ]
        
        # Modality filter
        if modality:
            modality_lower = modality.lower()
            filtered_models = [
                m for m in filtered_models
                if modality_lower in str(m.get("modality", "text")).lower() or
                   modality_lower in str(m.get("architecture", {}).get("modality", "text")).lower()
            ]
        
        # Context window filters
        if min_context is not None:
            filtered_models = [
                m for m in filtered_models
                if m.get("context_length", 0) >= min_context
            ]
        
        if max_context is not None:
            filtered_models = [
                m for m in filtered_models
                if m.get("context_length", float('inf')) <= max_context
            ]
        
        # Price filters (check pricing data)
        if min_price is not None or max_price is not None:
            def get_model_price(model):
                pricing = model.get("pricing", {})
                if isinstance(pricing, dict):
                    prompt_price = pricing.get("prompt")
                    completion_price = pricing.get("completion")
                    if prompt_price and completion_price:
                        # Return average price
                        return (float(prompt_price) + float(completion_price)) / 2
                return None
            
            if min_price is not None:
                filtered_models = [
                    m for m in filtered_models
                    if (price := get_model_price(m)) is not None and price >= min_price
                ]
            
            if max_price is not None:
                filtered_models = [
                    m for m in filtered_models
                    if (price := get_model_price(m)) is not None and price <= max_price
                ]
        
        # Sorting
        def get_sort_key(model):
            if sort_by == "price":
                pricing = model.get("pricing", {})
                if isinstance(pricing, dict):
                    prompt = pricing.get("prompt", 0)
                    completion = pricing.get("completion", 0)
                    if prompt and completion:
                        return (float(prompt) + float(completion)) / 2
                return float('inf')  # Put models without pricing at the end
            
            elif sort_by == "context":
                return model.get("context_length", 0)
            
            elif sort_by == "popularity":
                # Use ranking if available, otherwise 0
                return model.get("rank", model.get("ranking", 0))
            
            elif sort_by == "name":
                return model.get("name", model.get("id", ""))
            
            return 0
        
        # Sort
        reverse = (order.lower() == "desc")
        if sort_by == "name":
            # String sorting
            filtered_models.sort(key=get_sort_key, reverse=reverse)
        else:
            # Numeric sorting
            filtered_models.sort(key=get_sort_key, reverse=reverse)
        
        # Apply pagination
        total_count = len(filtered_models)
        paginated_models = filtered_models[offset:offset + limit]
        
        return {
            "success": True,
            "data": paginated_models,
            "meta": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "returned": len(paginated_models),
                "filters_applied": {
                    "query": q,
                    "modality": modality,
                    "min_context": min_context,
                    "max_context": max_context,
                    "min_price": min_price,
                    "max_price": max_price,
                    "gateway": gateway,
                    "sort_by": sort_by,
                    "order": order
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to search models: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search models: {str(e)}")


# Helper functions for model comparison

def _calculate_recommendation(comparisons: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate which gateway is recommended based on pricing"""
    available = [c for c in comparisons if c.get("available")]
    
    if not available:
        return {"gateway": None, "reason": "Model not available in any gateway"}
    
    # Filter out comparisons without pricing
    with_pricing = [
        c for c in available 
        if c.get("pricing") and c["pricing"].get("prompt") and c["pricing"].get("completion")
    ]
    
    if not with_pricing:
        return {
            "gateway": available[0]["gateway"],
            "reason": "First available gateway (pricing data not available)"
        }
    
    # Calculate total cost (prompt + completion) for comparison
    for comp in with_pricing:
        try:
            prompt_price = float(comp["pricing"]["prompt"]) if comp["pricing"]["prompt"] else 0
            completion_price = float(comp["pricing"]["completion"]) if comp["pricing"]["completion"] else 0
            comp["_total_cost"] = prompt_price + completion_price
        except (ValueError, TypeError):
            comp["_total_cost"] = float('inf')
    
    # Find cheapest
    cheapest = min(with_pricing, key=lambda x: x.get("_total_cost", float('inf')))
    
    return {
        "gateway": cheapest["gateway"],
        "reason": f"Lowest pricing (${cheapest['_total_cost']}/1M tokens combined)",
        "pricing": cheapest["pricing"]
    }


def _calculate_savings(comparisons: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate potential savings"""
    available = [c for c in comparisons if c.get("available") and c.get("pricing")]
    
    if len(available) < 2:
        return {
            "potential_savings": 0.0,
            "most_expensive_gateway": None,
            "cheapest_gateway": None
        }
    
    # Calculate total costs
    costs = []
    for comp in available:
        try:
            pricing = comp["pricing"]
            if pricing and pricing.get("prompt") and pricing.get("completion"):
                prompt = float(pricing["prompt"])
                completion = float(pricing["completion"])
                total = prompt + completion
                costs.append({
                    "gateway": comp["gateway"],
                    "total_cost": total
                })
        except (ValueError, TypeError):
            continue
    
    if len(costs) < 2:
        return {
            "potential_savings": 0.0,
            "most_expensive_gateway": None,
            "cheapest_gateway": None
        }
    
    cheapest = min(costs, key=lambda x: x["total_cost"])
    most_expensive = max(costs, key=lambda x: x["total_cost"])
    
    savings_amount = most_expensive["total_cost"] - cheapest["total_cost"]
    savings_percent = (savings_amount / most_expensive["total_cost"]) * 100 if most_expensive["total_cost"] > 0 else 0
    
    return {
        "potential_savings_per_1m_tokens": round(savings_amount, 4),
        "savings_percentage": round(savings_percent, 2),
        "cheapest_gateway": cheapest["gateway"],
        "cheapest_cost": round(cheapest["total_cost"], 4),
        "most_expensive_gateway": most_expensive["gateway"],
        "most_expensive_cost": round(most_expensive["total_cost"], 4)
    }


def _extract_price_comparison(models_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Extract price comparison data"""
    prices = {}
    for item in models_data:
        gateway = item["gateway"]
        model = item["data"]
        pricing = model.get("pricing", {})
        prices[gateway] = {
            "prompt": pricing.get("prompt"),
            "completion": pricing.get("completion")
        }
    return prices


def _extract_context_comparison(models_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Extract context length comparison data"""
    contexts = {}
    for item in models_data:
        gateway = item["gateway"]
        model = item["data"]
        contexts[gateway] = model.get("context_length", 0)
    return contexts


def _extract_availability_comparison(models_data: List[Dict[str, Any]], all_gateways: List[str]) -> Dict[str, bool]:
    """Extract availability comparison data"""
    availability = {gateway: False for gateway in all_gateways}
    for item in models_data:
        availability[item["gateway"]] = True
    return availability


# ============================================================================
# MODELZ INTEGRATION ENDPOINTS
# ============================================================================

@router.get("/modelz/models")
async def get_modelz_models(
    is_graduated: Optional[bool] = Query(
        None, 
        description="Filter for graduated (singularity) models: true=graduated only, false=non-graduated only, null=all models"
    )
):
    """
    Get models that exist on Modelz with optional graduation filter.
    
    This endpoint bridges Gatewayz with Modelz by fetching model token data
    from the Modelz API and applying the same filters as the original Modelz API.
    
    Query Parameters:
    - is_graduated: Filter for graduated models
      - true: Only graduated/singularity models
      - false: Only non-graduated models  
      - null: All models (default)
    
    Returns:
    - List of models with their token data from Modelz
    - Includes model IDs, graduation status, and other metadata
    """
    try:
        logger.info(f"Fetching Modelz models with is_graduated={is_graduated}")
        
        # Fetch token data from Modelz API
        tokens = await fetch_modelz_tokens(is_graduated)
        
        # Transform the data to a consistent format
        models = []
        for token in tokens:
            model_data = {
                "model_id": (
                    token.get("Token") or
                    token.get("model_id") or 
                    token.get("modelId") or 
                    token.get("id") or 
                    token.get("name") or
                    token.get("model")
                ),
                "is_graduated": token.get("isGraduated") or token.get("is_graduated"),
                "token_data": token,
                "source": "modelz",
                "has_token": True
            }
            
            # Only include models with valid model IDs
            if model_data["model_id"]:
                models.append(model_data)
        
        logger.info(f"Successfully processed {len(models)} models from Modelz")
        
        return {
            "models": models,
            "total_count": len(models),
            "filter": {
                "is_graduated": is_graduated,
                "description": (
                    "All models" if is_graduated is None else
                    "Graduated models only" if is_graduated else
                    "Non-graduated models only"
                )
            },
            "source": "modelz",
            "api_reference": "https://backend.alpacanetwork.ai/api/tokens"
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions from the client
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_modelz_models: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch models from Modelz: {str(e)}"
        )


@router.get("/modelz/ids")
async def get_modelz_model_ids_endpoint(
    is_graduated: Optional[bool] = Query(
        None, 
        description="Filter for graduated models: true=graduated only, false=non-graduated only, null=all models"
    )
):
    """
    Get a list of model IDs that exist on Modelz.
    
    This is a lightweight endpoint that returns only the model IDs,
    useful for checking which models have tokens on Modelz.
    
    Query Parameters:
    - is_graduated: Filter for graduated models (same as /models/modelz)
    
    Returns:
    - List of model IDs from Modelz
    """
    try:
        logger.info(f"Fetching Modelz model IDs with is_graduated={is_graduated}")
        
        model_ids = await get_modelz_model_ids(is_graduated)
        
        return {
            "model_ids": model_ids,
            "total_count": len(model_ids),
            "filter": {
                "is_graduated": is_graduated,
                "description": (
                    "All models" if is_graduated is None else
                    "Graduated models only" if is_graduated else
                    "Non-graduated models only"
                )
            },
            "source": "modelz"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_modelz_model_ids_endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch model IDs from Modelz: {str(e)}"
        )


@router.get("/modelz/check/{model_id}")
async def check_model_on_modelz(
    model_id: str,
    is_graduated: Optional[bool] = Query(
        None, 
        description="Filter for graduated models when checking"
    )
):
    """
    Check if a specific model exists on Modelz.
    
    Path Parameters:
    - model_id: The model ID to check
    
    Query Parameters:
    - is_graduated: Filter for graduated models when checking
    
    Returns:
    - Boolean indicating if model exists on Modelz
    - Additional model details if found
    """
    try:
        logger.info(f"Checking if model '{model_id}' exists on Modelz with is_graduated={is_graduated}")
        
        exists = await check_model_exists_on_modelz(model_id, is_graduated)
        
        result = {
            "model_id": model_id,
            "exists_on_modelz": exists,
            "filter": {
                "is_graduated": is_graduated,
                "description": (
                    "All models" if is_graduated is None else
                    "Graduated models only" if is_graduated else
                    "Non-graduated models only"
                )
            },
            "source": "modelz"
        }
        
        # If model exists, get additional details
        if exists:
            model_details = await get_modelz_model_details(model_id)
            if model_details:
                result["model_details"] = model_details
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in check_model_on_modelz: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check model on Modelz: {str(e)}"
        )
