# AI Gateway Integration Guide

This guide provides comprehensive instructions for integrating new AI Gateway providers into the system. Follow these steps to ensure complete and consistent integration across all backend systems and frontend UI.

## Overview

The system supports multiple AI gateway providers (OpenRouter, Portkey, Featherless, Vercel AI Gateway, etc.). Each provider requires implementation in several areas:

1. **Backend API Client** - Handle requests/responses with the provider's API
2. **Chat Routes** - Integrate into streaming and non-streaming chat endpoints
3. **Model Catalog** - Expose available models to the frontend
4. **Provider Metadata** - Display branding and provider information
5. **Failover Chain** - Position provider in fallback priority order
6. **Testing** - Comprehensive test coverage with mocks

---

## Step 1: Create Provider Client Module

**Location**: `src/services/{provider}_client.py`

**Purpose**: Implement all API communication with the gateway

### Key Components:

#### 1.1 Initialize Client Function

```python
def get_{provider}_client():
    """Initialize and return authenticated client for {provider}"""
    api_key = Config.{PROVIDER}_API_KEY
    if not api_key:
        # Provide placeholder for testing
        api_key = "placeholder-key"
        logger.warning("{Provider} API key not configured, using placeholder")

    # Use OpenAI SDK for OpenAI-compatible APIs
    return OpenAI(
        base_url="https://{api_endpoint}",
        api_key=api_key
    )
```

#### 1.2 Non-Streaming Request Handler

```python
def make_{provider}_request_openai(messages, model, **kwargs):
    """Make non-streaming chat completion request"""
    client = get_{provider}_client()
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        **kwargs
    )
    return response
```

#### 1.3 Streaming Request Handler

```python
def make_{provider}_request_openai_stream(messages, model, **kwargs):
    """Make streaming chat completion request"""
    client = get_{provider}_client()
    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
        **kwargs
    )
    return stream
```

#### 1.4 Response Processor

```python
def process_{provider}_response(response):
    """Convert provider response object to dict format"""
    return {
        "id": response.id,
        "object": response.object,
        "created": response.created,
        "model": response.model,
        "choices": [
            {
                "index": choice.index,
                "message": {
                    "role": choice.message.role,
                    "content": choice.message.content
                },
                "finish_reason": choice.finish_reason
            }
            for choice in response.choices
        ],
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens
        }
    }
```

---

## Step 2: Add Configuration

**Location**: `src/config/config.py`

Add environment variable for provider API key:

```python
{PROVIDER}_API_KEY = os.environ.get("{PROVIDER}_API_KEY")
```

---

## Step 3: Integrate into Chat Routes

**Location**: `src/routes/chat.py`

### 3.1 Add Imports

```python
from src.services.{provider}_client import (
    make_{provider}_request_openai,
    process_{provider}_response,
    make_{provider}_request_openai_stream
)
```

### 3.2 Add Streaming Handler (around line 560)

```python
elif attempt_provider == "{provider}":
    stream = await _to_thread(
        make_{provider}_request_openai_stream, messages, request_model, **optional
    )
```

### 3.3 Add Non-Streaming Handler (around line 703)

```python
elif attempt_provider == "{provider}":
    resp_raw = await asyncio.wait_for(
        _to_thread(make_{provider}_request_openai, messages, request_model, **optional),
        timeout=request_timeout,
    )
    processed = await _to_thread(process_{provider}_response, resp_raw)
```

---

## Step 4: Add Model Transformations

**Location**: `src/services/model_transformations.py`

### 4.1 Add to Provider List

Add provider to the `detect_provider_from_model_id()` detection loop.

### 4.2 Add Model Mappings

```python
"{provider}": {
    # If provider has specific model ID mappings, add them here
    # Format: "provider_model_id": "normalized_model_id"

    # If provider uses pass-through model IDs (any model is supported),
    # leave empty or add comments explaining this
}
```

**Important**: Use minimal or empty mappings if the provider supports pass-through model IDs. This prevents auto-detection conflicts where one provider's models are incorrectly routed to another.

---

## Step 5: Add to Provider Failover Chain

**Location**: `src/services/provider_failover.py`

Update `FALLBACK_PROVIDER_PRIORITY` tuple:

```python
FALLBACK_PROVIDER_PRIORITY: tuple[str, ...] = (
    "primary_provider_1",
    "primary_provider_2",
    "{provider}",  # Add here with appropriate priority
    "fallback_provider_1",
    "fallback_provider_2",
)
```

**Priority Guidelines**:
- Position 1-2: Most reliable/full-featured providers
- Position 3-5: Reliable backup providers
- Position 6+: Last-resort fallbacks

---

## Step 6: Add Provider Metadata

**Location**: `src/services/providers.py`

Add provider to `MANUAL_LOGO_DB`:

```python
MANUAL_LOGO_DB = {
    # ... existing entries ...
    '{provider_slug}': '{logo_url}',
}
```

Use SVG URLs for best quality:
- Simple Icons: `https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/{slug}.svg`
- Company favicons: `https://www.google.com/s2/favicons?domain={domain}&sz=128`

---

## Step 7: Expose Models in Catalog

**Location**: `src/cache.py`, `src/services/models.py`

### 7.1 Add Cache Definition

In `src/cache.py`:

```python
_{provider}_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600,  # 1 hour TTL
    "stale_ttl": 7200  # 2 hour stale-while-revalidate window
}
```

### 7.2 Register Cache in Lookup Functions

In `src/cache.py` in `get_models_cache()` and `clear_models_cache()`:

```python
"{provider}": _{provider}_models_cache,
```

### 7.3 Add to Imports

In `src/services/models.py`:

```python
from src.cache import (
    # ... existing imports ...
    _{provider}_models_cache,
)
```

### 7.4 Implement Fetch Function

In `src/services/models.py`:

```python
def fetch_models_from_{provider}():
    """Fetch models from {Provider} API"""
    try:
        from src.services.{provider}_client import get_{provider}_client

        client = get_{provider}_client()
        response = client.models.list()

        if not response or not hasattr(response, 'data'):
            logger.warning("No models returned from {Provider}")
            return []

        # Normalize models to catalog schema
        normalized_models = [
            normalize_{provider}_model(model) for model in response.data if model
        ]

        _{provider}_models_cache["data"] = normalized_models
        _{provider}_models_cache["timestamp"] = datetime.now(timezone.utc)

        logger.info(f"Fetched {len(normalized_models)} models from {Provider}")
        return _{provider}_models_cache["data"]
    except Exception as e:
        logger.error(f"Failed to fetch models from {Provider}: {e}")
        return []
```

### 7.5 Implement Normalization Function

```python
def normalize_{provider}_model(model) -> dict:
    """Normalize {Provider} model to catalog schema"""
    model_id = getattr(model, 'id', None)
    if not model_id:
        logger.warning(f"{Provider} model missing 'id': {model}")
        return None

    # Fetch pricing (if available from provider API)
    pricing = get_{provider}_model_pricing(model_id)

    normalized = {
        "id": model_id,
        "slug": f"{provider}/{model_id}",
        "canonical_slug": f"{provider}/{model_id}",
        "hugging_face_id": None,
        "name": getattr(model, 'name', model_id),
        "created": getattr(model, 'created_at', None),
        "description": getattr(model, 'description', f"Model from {Provider}"),
        "context_length": getattr(model, 'context_length', 4096),
        "architecture": {
            "modality": "text->text",
            "input_modalities": ["text"],
            "output_modalities": ["text"],
            "instruct_type": "chat"
        },
        "pricing": pricing,  # Now dynamically fetched
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": [],
        "default_parameters": {},
        "provider_slug": "provider",
        "provider_site_url": "https://provider.com",
        "model_logo_url": "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/provider.svg",
        "source_gateway": "{provider}",
    }

    return normalized

def get_{provider}_model_pricing(model_id: str) -> dict:
    """Fetch pricing for {Provider} model

    This function should:
    1. Try to fetch from provider API pricing endpoint (if available)
    2. Fall back to manual pricing data (if maintained)
    3. Return default zero pricing if unavailable

    Returns:
        dict with 'prompt', 'completion', 'request', 'image' fields
    """
    try:
        from src.services.{provider}_client import fetch_model_pricing_{provider}

        pricing_data = fetch_model_pricing_{provider}(model_id)
        if pricing_data:
            return {
                "prompt": str(pricing_data.get("prompt", "0")),
                "completion": str(pricing_data.get("completion", "0")),
                "request": str(pricing_data.get("request", "0")),
                "image": str(pricing_data.get("image", "0")),
            }
    except Exception as e:
        logger.debug(f"Failed to fetch pricing for {model_id}: {e}")

    # Fallback: default zero pricing
    return {
        "prompt": "0",
        "completion": "0",
        "request": "0",
        "image": "0",
    }
```

### 7.6 Register in get_cached_models()

In `src/services/models.py` in `get_cached_models()`:

```python
if gateway == "{provider}":
    cache = _{provider}_models_cache
    if cache["data"] and cache["timestamp"]:
        cache_age = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
        if cache_age < cache["ttl"]:
            return cache["data"]
    return fetch_models_from_{provider}()
```

---

## Step 8: Create Comprehensive Tests

**Location**: `tests/routes/test_chat_comprehensive.py`

### 8.1 Add Provider Mocks

```python
def mock_{provider}_request(messages, model, **kwargs):
    """Mock {Provider} non-streaming request"""
    usage_obj = MagicMock()
    usage_obj.prompt_tokens = 10
    usage_obj.completion_tokens = 15
    usage_obj.total_tokens = 25

    return MagicMock(
        id="chatcmpl-{provider}123",
        object="chat.completion",
        created=1234567890,
        model=model,
        choices=[
            MagicMock(
                index=0,
                message=MagicMock(role="assistant", content="Test response from {Provider}."),
                finish_reason="stop"
            )
        ],
        usage=usage_obj
    )

def mock_{provider}_stream(messages, model, **kwargs):
    """Mock {Provider} streaming request"""
    chunk = MagicMock()
    chunk.choices = [MagicMock(delta=MagicMock(content="Test"))]

    return iter([chunk])

def mock_process_{provider}_response(response):
    """Mock {Provider} response processor"""
    return {
        "id": response.id,
        "object": response.object,
        "created": response.created,
        "model": response.model,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": response.choices[0].message.content},
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens
        }
    }
```

### 8.2 Register Mocks in Test Fixture

```python
# In test fixture or conftest.py
monkeypatch.setattr(chat_module, "make_{provider}_request_openai", mock_{provider}_request)
monkeypatch.setattr(chat_module, "process_{provider}_response", mock_process_{provider}_response)
monkeypatch.setattr(chat_module, "make_{provider}_request_openai_stream", mock_{provider}_stream)
```

### 8.3 Create Integration Tests

```python
def test_{provider}_integration():
    """Test {Provider} integration in catalog"""
    models = get_cached_models("{provider}")
    assert models is not None
    assert len(models) > 0
    assert all(m.get("source_gateway") == "{provider}" for m in models)
```

---

## Step 9: Documentation

### 9.1 Update Provider List

Add to any provider documentation or README files:
- Provider name and logo
- Key features
- Link to official documentation

### 9.2 Model Catalog Notes

If provider uses pass-through model IDs, document:
- Why minimal model mappings are used
- How to add custom model mappings if needed
- Pricing information (if provider doesn't expose it)

---

## Pricing Implementation Strategies

When integrating a new provider, you need to decide how to handle pricing data:

### Strategy 1: Provider API Exposes Pricing
**Best for**: Providers like OpenRouter that include pricing in their models API

```python
def fetch_model_pricing_provider(model_id: str):
    """Fetch pricing from provider API models endpoint"""
    # Pricing already included in model data from fetch_models_from_provider()
    # Just extract and normalize
    return {
        "prompt": model_data.get("pricing", {}).get("prompt", "0"),
        "completion": model_data.get("pricing", {}).get("completion", "0"),
    }
```

### Strategy 2: Cross-Reference with System Pricing
**Best for**: Providers like Vercel that route to other providers

```python
def fetch_model_pricing_provider(model_id: str):
    """Cross-reference with other providers' pricing"""
    # Vercel routes to OpenAI, Google, Anthropic, etc.
    # Extract provider prefix and look up in system pricing
    provider_prefix = model_id.split("/")[0]

    from src.services.pricing import get_model_pricing
    pricing = get_model_pricing(model_id)

    if pricing and pricing.get("found"):
        return pricing
    return None
```

### Strategy 3: Manual Pricing JSON
**Best for**: Providers that don't expose pricing via API (Groq, Fireworks, etc.)

```python
def fetch_model_pricing_provider(model_id: str):
    """Fetch from manual_pricing.json"""
    from src.services.pricing_lookup import get_model_pricing

    pricing = get_model_pricing("provider", model_id)
    return pricing
```

### Strategy 4: Hybrid Approach
**Best for**: Providers with partial API pricing + manual overrides

```python
def fetch_model_pricing_provider(model_id: str):
    """Try API pricing, fall back to manual"""
    # 1. Try API pricing first
    api_pricing = get_pricing_from_api(model_id)
    if api_pricing:
        return api_pricing

    # 2. Fall back to manual pricing
    from src.services.pricing_lookup import get_model_pricing
    return get_model_pricing("provider", model_id)
```

### Pricing Data Structure
All pricing should be normalized to this structure:

```python
{
    "prompt": "0.000005",        # Per token (string format)
    "completion": "0.000015",    # Per token (string format)
    "request": "0",               # Per request (if applicable)
    "image": "0",                 # Per image (if applicable)
}
```

**Important Notes**:
- All values stored as strings (JSON compatibility)
- Units: per 1 million tokens (unless specified)
- Currency: USD
- Default to "0" if pricing unavailable
- Handle negative values gracefully (some providers use -1 for dynamic pricing)

---

## Common Patterns

### OpenAI-Compatible Providers

For providers with OpenAI SDK compatibility:

```python
# In client module
from openai import OpenAI

def get_provider_client():
    return OpenAI(
        base_url="https://api.provider.com/v1",
        api_key=Config.PROVIDER_API_KEY
    )
```

### REST API Providers

For providers with custom REST APIs:

```python
import httpx

def fetch_models_from_provider():
    headers = {"Authorization": f"Bearer {api_key}"}
    response = httpx.get("https://api.provider.com/models", headers=headers)
    models = response.json()["data"]
    return normalize_models(models)
```

### CSV/Static Data Providers

For providers with static model lists:

```python
def load_provider_catalog_export():
    csv_path = Path(__file__).parent / "provider_models.csv"
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        models = [normalize_csv_model(row) for row in reader]
    return models
```

---

## Troubleshooting

### Issue: Tests Failing with 400 Bad Request

**Cause**: Chat routes importing provider functions but tests not mocking them

**Solution**: Add all provider function mocks to test fixture before running tests

### Issue: Wrong Provider Selected for Model

**Cause**: Explicit model mappings causing auto-detection conflicts

**Solution**: Use minimal or empty model mappings. Provider should still work in failover chain.

### Issue: Empty Response Dictionary

**Cause**: Missing pricing mock in chat_module

**Solution**: Add `monkeypatch.setattr(chat_module, "calculate_cost", mock_calculate_cost)` to test

### Issue: Models Not Appearing in Frontend

**Cause**: Provider not registered in `get_models_cache()` or `clear_models_cache()`

**Solution**: Verify all three cache registration steps completed:
1. Cache definition in `cache.py`
2. Entry in `get_models_cache()` lookup
3. Entry in `clear_models_cache()` lookup

---

## Verification Checklist

- [ ] Client module created and tested
- [ ] Configuration variable added
- [ ] Chat routes updated (both streaming and non-streaming)
- [ ] Model transformations added
- [ ] Failover chain updated
- [ ] Provider metadata added
- [ ] Cache definition created
- [ ] Cache registered in lookup functions
- [ ] Fetch function implemented
- [ ] Normalization function implemented
- [ ] Model function registered in `get_cached_models()`
- [ ] Comprehensive tests created and passing
- [ ] All GitHub CI checks passing
- [ ] Documentation updated

---

## Real-World Example: Vercel AI Gateway

This guide was created while integrating Vercel AI Gateway. Here's how it maps:

| Step | File | Change |
|------|------|--------|
| 1 | `src/services/vercel_ai_gateway_client.py` | Created client with OpenAI SDK + pricing functions |
| 2 | `src/config/config.py` | Added `VERCEL_AI_GATEWAY_API_KEY` |
| 3 | `src/routes/chat.py` | Added streaming and non-streaming handlers |
| 4 | `src/services/model_transformations.py` | Added empty model mappings (pass-through) |
| 5 | `src/services/provider_failover.py` | Added at priority 3 |
| 6 | `src/services/providers.py` | Added Vercel logo URL |
| 7a | `src/cache.py` | Added `_vercel_ai_gateway_models_cache` |
| 7b-f | `src/services/models.py` | Added fetch, normalize, and pricing functions; registered in `get_cached_models()` |
| 8 | `tests/routes/test_chat_comprehensive.py` | Added comprehensive mocks |
| 9 | This file | Created integration guide for future reference |

### Vercel Pricing Implementation Details

Vercel AI Gateway uses **Strategy 2: Cross-Reference with System Pricing**

Because Vercel routes requests to underlying providers (OpenAI, Google, Anthropic, etc.), we determine pricing by:

1. **Extract Provider Prefix**: From model ID like `openai/gpt-4` → `openai`
2. **API Endpoint Check**: Attempt to fetch from `https://ai-gateway.vercel.sh/v1/pricing` (if available)
3. **Cross-Reference**: Look up the underlying provider's pricing in system cache
4. **Fallback**: Return zero pricing if unavailable

**Implementation**:
- `fetch_model_pricing_from_vercel()` - Attempts Vercel API and cross-references
- `get_provider_pricing_for_vercel_model()` - Cross-references with system pricing
- `get_vercel_model_pricing()` - Normalizes and applies fallback
- `normalize_vercel_model()` - Calls pricing function during model normalization

**Result**: Frontend sees actual provider pricing for Vercel-routed models (e.g., OpenAI's GPT-4 pricing when routed through Vercel)

---

## Support

For questions about integrating a new provider:
1. Review this guide step-by-step
2. Compare with existing provider implementations
3. Use Vercel AI Gateway as a reference implementation
4. Check GitHub checks for test failures and error messages
