"""Cache module for storing model and provider data"""

# Cache dictionaries for models and providers
_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600  # 1 hour TTL
}

_portkey_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800  # 30 minute TTL for Portkey catalog
}

_featherless_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600  # 1 hour TTL for Featherless catalog
}

_huggingface_cache = {
    "data": {},
    "timestamp": None,
    "ttl": 3600  # 1 hour TTL
}

_provider_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600  # 1 hour TTL
}

_chutes_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600  # 1 hour TTL for Chutes catalog
}

_groq_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800  # 30 minute TTL for Groq catalog
}

_fireworks_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800  # 30 minute TTL for Fireworks catalog
}

_together_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800  # 30 minute TTL for Together catalog
}

# Modelz cache (for token data)
_modelz_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800  # 30 minute TTL for Modelz token data
}


# DeepInfra cache (individual models only)
_deepinfra_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600  # 1 hour TTL
}


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
        "modelz": _modelz_cache
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
        "modelz": _modelz_cache
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