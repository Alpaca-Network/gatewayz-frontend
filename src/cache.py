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
