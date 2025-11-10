"""Cache module for storing model and provider data"""

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# FAL cache initialization messages
_FAL_CACHE_INIT_DEFERRED = "FAL cache initialization deferred"

# Cache dictionaries for models and providers
_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL
    "stale_ttl": 7200,  # 2 hours stale-while-revalidate
}

# Unified multi-provider catalog cache (canonical + provider adapters)
_multi_provider_catalog_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 900,  # 15 minutes TTL for aggregated catalog snapshots
    "stale_ttl": 1800,
}

_portkey_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800,  # 30 minute TTL for Portkey catalog
    "stale_ttl": 3600,
}

_featherless_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL for Featherless catalog
    "stale_ttl": 7200,
}

_huggingface_cache = {"data": {}, "timestamp": None, "ttl": 3600, "stale_ttl": 7200}  # 1 hour TTL

_provider_cache = {"data": None, "timestamp": None, "ttl": 3600, "stale_ttl": 7200}  # 1 hour TTL

_chutes_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL for Chutes catalog
    "stale_ttl": 7200,
}

_groq_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800,  # 30 minute TTL for Groq catalog
    "stale_ttl": 3600,
}

_fireworks_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800,  # 30 minute TTL for Fireworks catalog
    "stale_ttl": 3600,
}

_together_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800,  # 30 minute TTL for Together catalog
    "stale_ttl": 3600,
}

# Modelz cache (for token data)
_modelz_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800,  # 30 minute TTL for Modelz token data
    "stale_ttl": 3600,
}


# DeepInfra cache (individual models only)
_deepinfra_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL
    "stale_ttl": 7200,
}

# Portkey-based individual provider caches
_cerebras_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL
    "stale_ttl": 7200,
}

_nebius_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL
    "stale_ttl": 7200,
}

_xai_models_cache = {"data": None, "timestamp": None, "ttl": 3600, "stale_ttl": 7200}  # 1 hour TTL

_novita_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL
    "stale_ttl": 7200,
}

_huggingface_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL
    "stale_ttl": 7200,
}

_aimo_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL for AIMO catalog
    "stale_ttl": 7200,
}

_near_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL for Near AI catalog
    "stale_ttl": 7200,
}

_fal_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL for Fal.ai catalog
    "stale_ttl": 7200,
}

_google_vertex_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL for Google Vertex AI models
    "stale_ttl": 7200,
}

_vercel_ai_gateway_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL for Vercel AI Gateway catalog
    "stale_ttl": 7200,
}

_helicone_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL for Helicone AI Gateway catalog
    "stale_ttl": 7200,
}

_aihubmix_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL for AiHubMix catalog
    "stale_ttl": 7200,
}

_anannas_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL for Anannas catalog
    "stale_ttl": 7200,
}

# BACKWARD COMPATIBILITY: Alias for old cache name
# Some deployed modules may still reference the old name
_hug_models_cache = _huggingface_models_cache


# Cache access functions
def get_models_cache(gateway: str):
    """Get cache for a specific gateway"""
    cache_map = {
        "openrouter": _models_cache,
        "portkey": _portkey_models_cache,
        "featherless": _featherless_models_cache,
        "deepinfra": _deepinfra_models_cache,
        "chutes": _chutes_models_cache,
        "groq": _groq_models_cache,
        "fireworks": _fireworks_models_cache,
        "together": _together_models_cache,
        "google-vertex": _google_vertex_models_cache,
        "cerebras": _cerebras_models_cache,
        "nebius": _nebius_models_cache,
        "xai": _xai_models_cache,
        "novita": _novita_models_cache,
        "huggingface": _huggingface_models_cache,
        "hug": _huggingface_models_cache,  # Alias for backward compatibility
        "aimo": _aimo_models_cache,
        "near": _near_models_cache,
        "fal": _fal_models_cache,
        "vercel-ai-gateway": _vercel_ai_gateway_models_cache,
        "helicone": _helicone_models_cache,
        "aihubmix": _aihubmix_models_cache,
        "anannas": _anannas_models_cache,
        "modelz": _modelz_cache,
    }
    return cache_map.get(gateway.lower())


def get_providers_cache():
    """Get the providers cache"""
    return _provider_cache


def clear_models_cache(gateway: str):
    """Clear cache for a specific gateway"""
    cache_map = {
        "openrouter": _models_cache,
        "portkey": _portkey_models_cache,
        "featherless": _featherless_models_cache,
        "deepinfra": _deepinfra_models_cache,
        "chutes": _chutes_models_cache,
        "groq": _groq_models_cache,
        "fireworks": _fireworks_models_cache,
        "together": _together_models_cache,
        "google-vertex": _google_vertex_models_cache,
        "cerebras": _cerebras_models_cache,
        "nebius": _nebius_models_cache,
        "xai": _xai_models_cache,
        "novita": _novita_models_cache,
        "huggingface": _huggingface_models_cache,
        "hug": _huggingface_models_cache,  # Alias for backward compatibility
        "helicone": _helicone_models_cache,
        "aimo": _aimo_models_cache,
        "near": _near_models_cache,
        "fal": _fal_models_cache,
        "vercel-ai-gateway": _vercel_ai_gateway_models_cache,
        "aihubmix": _aihubmix_models_cache,
        "anannas": _anannas_models_cache,
        "modelz": _modelz_cache,
    }
    cache = cache_map.get(gateway.lower())
    if cache:
        cache["data"] = None
        cache["timestamp"] = None


def clear_providers_cache():
    """Clear the providers cache"""
    _provider_cache["data"] = None
    _provider_cache["timestamp"] = None


def get_modelz_cache():
    """Get the Modelz cache"""
    return _modelz_cache


def clear_modelz_cache():
    """Clear the Modelz cache"""
    _modelz_cache["data"] = None
    _modelz_cache["timestamp"] = None


def is_cache_fresh(cache: dict) -> bool:
    """Check if cache is within fresh TTL
    
    Note: Only checks timestamp, not data value. This allows empty lists []
    to be treated as valid cached values (representing "no models found").
    """
    if cache.get("timestamp") is None:
        return False
    cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
    return cache_age < cache.get("ttl", 3600)


def is_cache_stale_but_usable(cache: dict) -> bool:
    """Check if cache is stale but within stale-while-revalidate window
    
    Note: Only checks timestamp, not data value. This allows empty lists []
    to be treated as valid cached values (representing "no models found").
    """
    if cache.get("timestamp") is None:
        return False
    cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
    ttl = cache.get("ttl", 3600)
    stale_ttl = cache.get("stale_ttl", ttl * 2)
    return ttl <= cache_age < stale_ttl


def should_revalidate_in_background(cache: dict) -> bool:
    """Check if cache should trigger background revalidation"""
    return not is_cache_fresh(cache) and is_cache_stale_but_usable(cache)


def initialize_fal_cache_from_catalog():
    """Load and initialize FAL models cache directly from static catalog

    Avoids circular imports by loading catalog directly without normalizer.
    Raw models are stored in cache; normalization happens on first access.
    """
    try:
        from src.services.fal_image_client import load_fal_models_catalog

        # Load raw models from catalog
        raw_models = load_fal_models_catalog()

        if not raw_models:
            logger.debug("No FAL models found in catalog")
            return

        # Store raw models temporarily - will be normalized on first access
        # This avoids circular import with models.py
        _fal_models_cache["data"] = raw_models
        _fal_models_cache["timestamp"] = datetime.now(timezone.utc)
        logger.debug(f"Preloaded {len(raw_models)} FAL models from catalog")

    except (ImportError, OSError) as error:
        # Log failure but continue - models will be loaded on first request
        logger.debug(f"{_FAL_CACHE_INIT_DEFERRED}: {type(error).__name__}")


def initialize_featherless_cache_from_catalog():
    """Load and initialize Featherless models cache from static catalog export

    Unlike FAL which has a static JSON catalog, Featherless uses CSV exports.
    This function attempts to load from available CSV exports and initializes
    the cache structure even if no data is found (to enable lazy loading).
    """
    try:
        from src.services.models import load_featherless_catalog_export

        # Try to load from CSV export
        raw_models = load_featherless_catalog_export()

        if raw_models and len(raw_models) > 0:
            # Successfully loaded from export
            _featherless_models_cache["data"] = raw_models
            _featherless_models_cache["timestamp"] = datetime.now(timezone.utc)
            logger.debug(f"Preloaded {len(raw_models)} Featherless models from catalog export")
        else:
            # No export available - initialize empty to enable lazy loading via API
            _featherless_models_cache["data"] = []
            _featherless_models_cache["timestamp"] = None
            logger.debug("Featherless cache initialized empty - will load from API on first request")

    except (ImportError, OSError) as error:
        # Log failure but continue - initialize empty cache for lazy loading
        _featherless_models_cache["data"] = []
        _featherless_models_cache["timestamp"] = None
        logger.debug(f"Featherless cache init deferred: {type(error).__name__}")
