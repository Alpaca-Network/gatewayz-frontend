# Gateway Integration Guide

This guide explains how to add a new AI gateway/provider to the Gatewayz platform. Follow these steps to ensure complete integration across the entire codebase.

## Overview

Adding a new gateway requires changes to several files across the backend to ensure the gateway is properly supported in:
- Model caching
- API endpoints
- Catalog retrieval
- Provider statistics
- Frontend display

## Integration Checklist

Use this checklist when adding a new gateway to ensure nothing is missed:

- [ ] Add cache configuration
- [ ] Create model fetching function
- [ ] Create model normalization function
- [ ] Register gateway in cache getter
- [ ] Add to parallel/sequential fetchers
- [ ] Add to gateway health dashboard
- [ ] Update catalog endpoints
- [ ] Update API documentation
- [ ] Add tests
- [ ] Update this guide with gateway-specific notes

## Step-by-Step Integration

### 1. Add Cache Configuration (`src/cache.py`)

Add a new cache dictionary for your gateway:

```python
_your_gateway_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL (adjust based on gateway update frequency)
    "stale_ttl": 7200  # 2 hours stale-while-revalidate
}
```

**Important:** Update the cache mapping functions:

```python
def get_models_cache(gateway: str):
    """Get cache for a specific gateway"""
    cache_map = {
        # ... existing gateways ...
        "your_gateway": _your_gateway_models_cache,  # ADD THIS LINE
    }
    return cache_map.get(gateway.lower())
```

```python
def clear_models_cache(gateway: str):
    """Clear cache for a specific gateway"""
    cache_map = {
        # ... existing gateways ...
        "your_gateway": _your_gateway_models_cache,  # ADD THIS LINE
    }
    cache = cache_map.get(gateway.lower())
    if cache:
        cache["data"] = None
        cache["timestamp"] = None
```

### 2. Import Cache in Models Module (`src/services/models.py`)

Add your cache import:

```python
from src.cache import (
    _huggingface_cache,
    _models_cache,
    # ... other caches ...
    _your_gateway_models_cache,  # ADD THIS LINE
    is_cache_fresh,
    should_revalidate_in_background,
)
```

### 3. Create Model Fetching Function (`src/services/models.py`)

Create a function to fetch models from your gateway:

```python
def fetch_models_from_your_gateway():
    """Fetch models from Your Gateway API

    Description of what makes this gateway unique, its features, etc.
    """
    try:
        # Method 1: Fetch from API
        if not Config.YOUR_GATEWAY_API_KEY:
            logger.error("Your Gateway API key not configured")
            return []

        headers = {
            "Authorization": f"Bearer {Config.YOUR_GATEWAY_API_KEY}",
            "Content-Type": "application/json",
        }

        response = httpx.get(
            "https://api.your-gateway.com/v1/models",
            headers=headers,
            timeout=20.0,
        )
        response.raise_for_status()

        payload = response.json()
        raw_models = payload.get("data", []) or payload.get("models", [])

        # Method 2: Load from static catalog file (like Fal.ai)
        # from src.services.your_gateway_client import get_your_gateway_models
        # raw_models = get_your_gateway_models()

        if not raw_models:
            logger.warning("No models found from Your Gateway")
            return []

        # Normalize models to standard format
        normalized_models = [
            normalize_your_gateway_model(model) for model in raw_models if model
        ]

        # Update cache
        _your_gateway_models_cache["data"] = normalized_models
        _your_gateway_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Fetched {len(normalized_models)} models from Your Gateway")
        return _your_gateway_models_cache["data"]

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error fetching from Your Gateway: {e.response.status_code}")
        return []
    except Exception as e:
        logger.error(f"Failed to fetch models from Your Gateway: {e}")
        return []
```

### 4. Create Model Normalization Function (`src/services/models.py`)

Normalize your gateway's model format to match the OpenRouter schema:

```python
def normalize_your_gateway_model(gateway_model: dict) -> dict:
    """Normalize Your Gateway model entries to resemble OpenRouter model shape

    Your Gateway features:
    - Feature 1
    - Feature 2
    - Feature 3
    """
    model_id = gateway_model.get("id") or gateway_model.get("model_id")
    if not model_id:
        logger.warning(f"Your Gateway model missing 'id' field: {gateway_model}")
        return None

    # Extract provider from model ID (e.g., "provider/model-name")
    provider_slug = model_id.split("/")[0] if "/" in model_id else "your-gateway"

    # Use name or derive from ID
    display_name = gateway_model.get("name") or model_id.split("/")[-1]

    # Get description
    description = gateway_model.get("description", f"Your Gateway {display_name} model")

    # Determine modality (text, image, video, audio, etc.)
    modality = gateway_model.get("modality", "text->text")

    # Parse input/output modalities
    if "->" in modality:
        input_mod, output_mod = modality.split("->")
    else:
        input_mod, output_mod = "text", "text"

    # Build architecture object
    architecture = {
        "modality": modality,
        "input_modalities": [input_mod],
        "output_modalities": [output_mod],
        "tokenizer": gateway_model.get("tokenizer"),
        "instruct_type": gateway_model.get("instruct_type"),
    }

    # Get context length
    context_length = gateway_model.get("context_length") or gateway_model.get("max_tokens", 4096)

    # Parse pricing (adjust field names based on your gateway's API)
    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
    }

    if "pricing" in gateway_model:
        pricing_data = gateway_model["pricing"]
        pricing["prompt"] = str(pricing_data.get("input")) if pricing_data.get("input") is not None else None
        pricing["completion"] = str(pricing_data.get("output")) if pricing_data.get("output") is not None else None

    # Build normalized model object
    normalized = {
        "id": model_id,
        "slug": model_id,
        "canonical_slug": model_id,
        "hugging_face_id": gateway_model.get("huggingface_repo"),
        "name": display_name,
        "created": gateway_model.get("created"),
        "description": description,
        "context_length": context_length,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": gateway_model.get("supported_parameters", []),
        "default_parameters": gateway_model.get("default_parameters", {}),
        "provider_slug": provider_slug,
        "provider_site_url": "https://your-gateway.com",
        "model_logo_url": gateway_model.get("logo_url"),
        "source_gateway": "your_gateway",
        "raw_your_gateway": gateway_model,  # Keep original data for debugging
    }

    return enrich_model_with_pricing(normalized, "your_gateway")
```

### 5. Register Gateway in Cache Getter (`src/services/models.py`)

Add your gateway to the `get_cached_models()` function:

```python
def get_cached_models(gateway: str = "openrouter"):
    """Get cached models or fetch from the requested gateway if cache is expired"""
    try:
        gateway = (gateway or "openrouter").lower()

        # ... existing gateway checks ...

        if gateway == "your_gateway":
            cache = _your_gateway_models_cache
            if cache["data"] and cache["timestamp"]:
                cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
                if cache_age < cache["ttl"]:
                    return cache["data"]
            return fetch_models_from_your_gateway()

        if gateway == "all":
            # Fetch all gateways in parallel for improved performance
            return get_all_models_parallel()
```

### 6. Add to Parallel/Sequential Fetchers (`src/services/models.py`)

**Update `get_all_models_parallel()`:**

```python
def get_all_models_parallel():
    """Fetch models from all gateways in parallel for improved performance"""
    try:
        gateways = [
            "openrouter", "portkey", "featherless", "deepinfra",
            "google", "cerebras", "nebius", "xai", "novita",
            "hug", "chutes", "groq", "fireworks", "together",
            "aimo", "near", "fal",
            "your_gateway"  # ADD THIS LINE
        ]
```

**Update `get_all_models_sequential()`:**

```python
def get_all_models_sequential():
    """Fallback sequential fetching (original implementation)"""
    openrouter_models = get_cached_models("openrouter") or []
    # ... other gateways ...
    fal_models = get_cached_models("fal") or []
    your_gateway_models = get_cached_models("your_gateway") or []  # ADD THIS LINE

    return openrouter_models + portkey_models + ... + fal_models + your_gateway_models  # ADD YOUR GATEWAY
```

### 7. Add to Gateway Health Dashboard (`check_and_fix_gateway_models.py`)

The gateway health dashboard at `/health/gateways/dashboard` monitors all gateways. Add your gateway to the configuration:

**a. Import the cache:**

```python
from src.cache import (
    _models_cache,
    # ... other caches ...
    _your_gateway_models_cache,  # ADD THIS LINE
)
```

**b. Add to GATEWAY_CONFIG:**

```python
GATEWAY_CONFIG = {
    # ... existing gateways ...
    'your_gateway': {
        'name': 'Your Gateway',
        'url': 'https://api.your-gateway.com/v1/models',  # Or None for static catalogs
        'api_key_env': 'YOUR_GATEWAY_API_KEY',
        'api_key': Config.YOUR_GATEWAY_API_KEY,
        'cache': _your_gateway_models_cache,
        'min_expected_models': 10,  # Minimum expected model count
        'header_type': 'bearer'  # or 'portkey', 'google', etc.
    },
}
```

**Notes:**
- If your gateway uses a static catalog (no live API), set `url` to `None`
- For static catalogs, you can use a dummy API key like `'static_catalog'`
- The dashboard will show cache status even without a live API endpoint

### 8. Update System Routes Dashboard (`src/routes/system.py`)

The system routes also include a simpler health check dashboard. Update the gateway lists:

```python
# In get_cache_status() function
gateways = ["openrouter", "portkey", ..., "fal", "your_gateway"]  # ADD YOUR GATEWAY

# In refresh_gateway_cache() function
valid_gateways = ["openrouter", "portkey", ..., "fal", "your_gateway"]  # ADD YOUR GATEWAY

# In clear_all_caches() function
gateways = ["openrouter", "portkey", ..., "fal", "your_gateway"]  # ADD YOUR GATEWAY

# In check_all_gateways() function, add your gateway configuration
gateway_endpoints = {
    # ... existing gateways ...
    "your_gateway": {
        "url": "https://api.your-gateway.com/v1/models",
        "api_key": Config.YOUR_GATEWAY_API_KEY,
        "headers": {"Authorization": f"Bearer {Config.YOUR_GATEWAY_API_KEY}"} if Config.YOUR_GATEWAY_API_KEY else {}
    }
}
```

### 9. Update Catalog Endpoints (`src/routes/catalog.py`)

#### a. Update Gateway Parameter Descriptions

Find all occurrences of the `gateway` Query parameter and add your gateway:

```python
gateway: Optional[str] = Query(
    "openrouter",
    description="Gateway to use: 'openrouter', 'portkey', ..., 'fal', 'your_gateway', or 'all'",
),
```

**Tip:** Use replace_all if there are multiple occurrences.

#### b. Add Model Variable in `get_models()` Function

```python
async def get_models(
    # ... parameters ...
):
    # ... existing code ...

    fal_models: List[dict] = []
    your_gateway_models: List[dict] = []  # ADD THIS LINE
```

#### c. Add Fetching Logic

```python
    if gateway_value in ("your_gateway", "all"):
        your_gateway_models = get_cached_models("your_gateway") or []
        if gateway_value == "your_gateway" and not your_gateway_models:
            logger.error("No Your Gateway models data available from cache")
            raise HTTPException(status_code=503, detail="Models data unavailable")
```

#### d. Add to Gateway Selection Chain

```python
    elif gateway_value == "fal":
        models = fal_models
    elif gateway_value == "your_gateway":  # ADD THIS BLOCK
        models = your_gateway_models
    else:
        # For "all" gateway, merge all models
        models = merge_models_by_slug(
            openrouter_models, portkey_models, ..., fal_models, your_gateway_models  # ADD YOUR GATEWAY
        )
```

#### e. Add to Response Notes

```python
    note = {
        "openrouter": "OpenRouter catalog",
        # ... other gateways ...
        "fal": "Fal.ai catalog",
        "your_gateway": "Your Gateway catalog",  # ADD THIS LINE
        "all": "Combined OpenRouter, ..., Fal.ai, and Your Gateway catalogs",  # UPDATE THIS
    }.get(gateway_value, "OpenRouter catalog")
```

#### f. Update Provider Endpoints

In the `get_providers()` function:

```python
    # Add support for other gateways
    other_gateways = ["featherless", "deepinfra", "chutes", "groq", "fireworks", "together", "fal", "your_gateway"]  # ADD YOUR GATEWAY
```

### 8. Update API Configuration (if needed)

If your gateway requires API keys or configuration, add to `src/config/config.py`:

```python
class Config:
    # ... existing config ...

    # Your Gateway Configuration
    YOUR_GATEWAY_API_KEY = os.getenv("YOUR_GATEWAY_API_KEY")
    YOUR_GATEWAY_BASE_URL = os.getenv("YOUR_GATEWAY_BASE_URL", "https://api.your-gateway.com")
```

And update `.env.example`:

```bash
# Your Gateway
YOUR_GATEWAY_API_KEY=your_api_key_here
```

### 10. Add Tests

Create a test file `tests/services/test_your_gateway_client.py`:

```python
import pytest
from src.services.models import fetch_models_from_your_gateway, normalize_your_gateway_model


class TestYourGatewayIntegration:
    """Tests for Your Gateway models catalog functionality"""

    def test_fetch_models_from_your_gateway(self):
        """Test fetching models from Your Gateway"""
        models = fetch_models_from_your_gateway()

        assert models is not None
        assert isinstance(models, list)

        if models:
            # Check first model has required fields
            model = models[0]
            assert "id" in model
            assert "name" in model
            assert "source_gateway" in model
            assert model["source_gateway"] == "your_gateway"

    def test_normalize_your_gateway_model(self):
        """Test normalization of Your Gateway model data"""
        raw_model = {
            "id": "provider/model-name",
            "name": "Test Model",
            "description": "A test model",
            "context_length": 8192,
        }

        normalized = normalize_your_gateway_model(raw_model)

        assert normalized is not None
        assert normalized["id"] == "provider/model-name"
        assert normalized["name"] == "Test Model"
        assert normalized["source_gateway"] == "your_gateway"
        assert normalized["context_length"] == 8192
```

### 11. Update Documentation

Add gateway-specific information to:
- `README.md` - Add to list of supported gateways
- `docs/API.md` - Document gateway-specific endpoints
- This file - Add to "Gateway-Specific Notes" section below

## Common Patterns

### Static Catalog vs API Fetching

**API Fetching (Most Gateways):**
```python
def fetch_models_from_gateway():
    response = httpx.get("https://api.gateway.com/models", headers=headers)
    raw_models = response.json()["data"]
    # normalize and return
```

**Static Catalog (like Fal.ai):**
```python
def fetch_models_from_gateway():
    from src.services.gateway_client import get_gateway_models
    raw_models = get_gateway_models()  # Loads from JSON file
    # normalize and return
```

### Pricing Field Mapping

Different gateways use different field names for pricing:

| Gateway | Input Price Field | Output Price Field |
|---------|------------------|-------------------|
| OpenRouter | `pricing.prompt` | `pricing.completion` |
| Portkey | `pricing.input` | `pricing.output` |
| DeepInfra | `input_cost` | `output_cost` |
| Your Gateway | ??? | ??? |

Map accordingly in your normalization function.

### Modality Mapping

For image/video/audio gateways, set the modality correctly:

```python
modality_map = {
    "text-to-image": "text->image",
    "text-to-video": "text->video",
    "image-to-image": "image->image",
    "image-to-video": "image->video",
    "video-to-video": "video->video",
    "text-to-audio": "text->audio",
    "text-to-speech": "text->audio",
    "audio-to-audio": "audio->audio",
    "image-to-3d": "image->3d",
    "vision": "image->text",
}
```

## Verification Checklist

After completing all steps, verify:

1. **Compilation:** `python3 -m py_compile src/cache.py src/services/models.py src/routes/catalog.py check_and_fix_gateway_models.py`
2. **Tests Pass:** `pytest tests/services/test_your_gateway_client.py`
3. **API Endpoint Works:**
   - `curl http://localhost:8000/catalog/v1/models?gateway=your_gateway`
   - `curl http://localhost:8000/catalog/v1/models?gateway=all`
4. **Dashboard Shows Gateway:** Visit `https://api.gatewayz.ai/health/gateways/dashboard` and verify your gateway appears
5. **No 0 Models Warning:** Check frontend console for "⚠️ Gateways with 0 models"
6. **Frontend Display:** Models appear in the frontend catalog

## Gateway-Specific Notes

### Fal.ai
- Uses static catalog from `src/data/fal_catalog.json`
- 69 curated models from 839+ available on fal.ai
- Supports image, video, audio, and 3D generation models
- No pricing exposed in catalog (set to null)
- Modality mapped from `type` field
- **Dashboard Configuration:**
  - URL set to `None` (no live API endpoint)
  - Uses dummy API key `'static_catalog'` to mark as configured
  - Min expected models: 50
  - Dashboard shows cache status only (no endpoint test)

### Near AI
- Decentralized AI infrastructure with private, verifiable services
- Uses OpenAI-compatible /models endpoint
- Falls back to known models if API doesn't return results
- Includes security features metadata

### AIMO
- AI model marketplace with token-based economics
- Fetches from OpenAI-compatible endpoint
- Includes governance and staking metadata

### [Your Gateway]
- [Add notes about your gateway implementation here]
- [Special considerations, API quirks, etc.]

## Troubleshooting

### Gateway Shows 0 Models

**Symptoms:** Frontend logs show `⚠️ Gateways with 0 models: ['your_gateway']`

**Causes & Solutions:**

1. **Not added to parallel/sequential fetchers**
   - Check `get_all_models_parallel()` includes your gateway
   - Check `get_all_models_sequential()` includes your gateway

2. **Fetch function returns empty array**
   - Check API key is configured
   - Check API endpoint is accessible
   - Add logging to fetch function

3. **Cache not registered**
   - Check `get_models_cache()` includes mapping
   - Check cache was imported in models.py

4. **Normalization function returns None**
   - Check model data has required fields
   - Add logging to normalization function

### Models Not Appearing in "All" Gateway

Check the `merge_models_by_slug()` call includes your gateway models.

### API Returns 503 Error

Check the conditional block for your gateway doesn't raise an exception when models are empty.

## Examples

### Example 1: OpenRouter (API-based)
- File: `src/services/models.py` (lines 425-456)
- Uses direct API calls
- Comprehensive pricing and metadata

### Example 2: Fal.ai (Catalog-based)
- File: `src/services/models.py` (lines 1523-1636)
- Loads from static JSON catalog
- Supports multiple modalities

### Example 3: Near AI (Hybrid with Fallback)
- File: `src/services/models.py` (lines 1372-1520)
- Tries API first, falls back to known models
- Includes custom metadata

## Reference Files

Key files to review when adding a gateway:

1. `src/cache.py` - Cache configuration
2. `src/services/models.py` - Model fetching and normalization
3. `src/routes/catalog.py` - Catalog API endpoints
4. `src/routes/system.py` - System health and cache endpoints
5. `check_and_fix_gateway_models.py` - Gateway health dashboard
6. `src/config/config.py` - Configuration
7. `tests/services/test_*_client.py` - Tests

## Questions?

If you encounter issues not covered in this guide:
1. Check existing gateway implementations for reference
2. Search codebase for gateway name (e.g., `grep -r "fal" --include="*.py"`)
3. Ask in team chat or create a GitHub issue
4. Update this guide with your findings!

---

**Last Updated:** 2025-10-31
**Maintainer:** Terragon Labs
**Version:** 1.0
