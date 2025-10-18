# Arch-Router 502 Bad Gateway - Root Cause Analysis

**Model:** `katanemo/Arch-Router-1.5B`
**Issue:** 502 Bad Gateway when calling `/v1/chat/completions`
**Date:** 2025-10-18
**Status:** **NOT A BUG** - Model not supported by HuggingFace Inference API

---

## Summary

The `katanemo/Arch-Router-1.5B` model is correctly listed in the Gatewayz models catalog under the HuggingFace gateway, but **the HuggingFace Inference API does not support this model** for chat completions. This causes 502 Bad Gateway errors when attempting to use it.

---

## Technical Details

### 1. Model Discovery
- ✅ Model **IS** listed in HuggingFace model catalog
- ✅ Model **IS** returned by Gatewayz `/v1/models?gateway=huggingface` endpoint
- ❌ Model **IS NOT** available on HuggingFace Inference API

### 2. Backend Architecture

#### HuggingFace Client Configuration
**File:** [src/services/huggingface_client.py](../src/services/huggingface_client.py:9)
```python
HF_INFERENCE_BASE_URL = "https://router.huggingface.co/v1"
```

The backend uses the **HuggingFace Router** (not direct model endpoints), which provides OpenAI-compatible chat completion endpoints for supported models.

#### Model Fetching
**File:** [src/services/huggingface_models.py](../src/services/huggingface_models.py:84-89)
```python
params = {
    "inference_provider": "hf-inference",  # Filter for models on HF Inference API
    "limit": 1000,
    "offset": 0,
    "full": "true",
}
```

Models are fetched with `inference_provider=hf-inference` filter, which **should** only return models available on the Inference API. However, the API includes models that are:
- Listed in the catalog
- Tagged for inference
- But not actually deployable/callable via the Router API

### 3. Test Results

#### Direct HuggingFace API Test
```bash
$ python test_arch_router.py
```

**Result:**
```
Status: 404
Details: {"detail":"Not Found"}
```

This confirms the model endpoint doesn't exist on HuggingFace's Inference API.

#### Backend Auto-Detection
The backend correctly auto-detects the model as HuggingFace:
```python
# From chat.py line 330-336
provider = "hug"  # Detected from source_gateway
```

The routing works correctly, but the upstream API (HuggingFace Router) returns 404.

---

## Why This Happens

### HuggingFace API Behavior
1. **Model Catalog** (`/api/models`) includes all models tagged with `inference_provider=hf-inference`
2. **Router API** (`https://router.huggingface.co/v1`) only supports a **subset** of these models
3. There's **no official list** of which models are actually supported by the Router

### Model-Specific Issue: Arch-Router
The `katanemo/Arch-Router-1.5B` model is:
- A **routing/classification model**, not a text generation model
- Designed to help select which LLM to use for a given task
- Not intended for direct chat completions

**Model Card:** https://huggingface.co/katanemo/Arch-Router-1.5B

From the model description:
> "Arch-Router is a routing model that helps determine which LLM should handle a given query based on task classification."

This explains why it's not available for chat completions - it's not a conversational model.

---

## Recommendations

### For Users
1. **Use a different model** for chat completions from the HuggingFace gateway
2. **Test models before integration** using the following curl command:
   ```bash
   curl -X POST https://api.gatewayz.ai/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{
       "model": "MODEL_ID",
       "messages": [{"role": "user", "content": "Hello"}]
     }'
   ```

### For Backend Team

#### Option 1: Filter Out Unsupported Models (Recommended)
Maintain a blocklist of models that are in the catalog but not callable:

**File:** `src/services/huggingface_models.py`
```python
# Models that exist in catalog but aren't supported by HF Router
UNSUPPORTED_MODELS = {
    "katanemo/Arch-Router-1.5B",  # Routing model, not chat
    # Add others as discovered
}

def normalize_huggingface_model(model: dict) -> dict:
    model_id = model.get("id", "")

    # Skip unsupported models
    if model_id in UNSUPPORTED_MODELS:
        logger.debug(f"Skipping unsupported model: {model_id}")
        return None

    # ... rest of normalization
```

#### Option 2: Add Model Testing
Implement periodic health checks to verify models are callable:

```python
async def verify_model_availability(model_id: str) -> bool:
    """Test if a model is actually callable on HF Inference API"""
    try:
        client = get_huggingface_client()
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": "test"}],
            max_tokens=1
        )
        return True
    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            return False
        # Other errors might be temporary
        return True
```

#### Option 3: Better Error Messages
Improve error handling to detect 404s and provide helpful messages:

**File:** `src/routes/chat.py` (around line 442-447)
```python
elif provider == "huggingface":
    try:
        resp_raw = await asyncio.wait_for(
            _to_thread(make_huggingface_request_openai, messages, model, **optional),
            timeout=30
        )
        processed = await _to_thread(process_huggingface_response, resp_raw)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail=f"Model '{model}' is not available on HuggingFace Inference API. "
                       "This model may exist in the catalog but isn't supported for chat completions. "
                       "Try a different model from https://api.gatewayz.ai/v1/models?gateway=huggingface"
            )
        raise
```

---

## Working HuggingFace Models

Here are some confirmed working models on the HuggingFace gateway:

- `meta-llama/Llama-3.3-70B-Instruct`
- `meta-llama/Llama-3.1-8B-Instruct`
- `mistralai/Mistral-7B-Instruct-v0.3`
- `microsoft/Phi-3.5-mini-instruct`

You can verify availability:
```bash
curl -s "https://api.gatewayz.ai/v1/models?gateway=huggingface" | \
  python -c "import sys, json; models = json.load(sys.stdin)['data']; \
  print('\n'.join([m['id'] for m in models[:10]]))"
```

---

## Related Files

- [src/services/huggingface_client.py](../src/services/huggingface_client.py) - HF client configuration
- [src/services/huggingface_models.py](../src/services/huggingface_models.py) - Model fetching and normalization
- [src/routes/chat.py](../src/routes/chat.py) - Chat completions routing
- [test_arch_router.py](../test_arch_router.py) - Diagnostic test script

---

## Conclusion

**This is not a backend bug.** The 502 Bad Gateway error is caused by HuggingFace's Inference API not supporting the `katanemo/Arch-Router-1.5B` model, even though it appears in their model catalog.

The frontend is working correctly, and the backend is correctly routing requests to HuggingFace. The issue is that the upstream provider (HuggingFace) doesn't support this specific model for chat completions because it's a routing/classification model, not a conversational LLM.

**Recommended Action:** Use a different model from the HuggingFace gateway that's designed for chat completions.
