# HuggingFace Provider Setup for Portkey

## Current Status

**Status:** ❌ Not Working  
**Error:** `404 - Invalid response received from huggingface: {"html-message":"Not Found"}`

All tested HuggingFace models return the same error, indicating a configuration issue rather than model-specific problems.

## What Needs to Be Done

### 1. Configure HuggingFace Virtual Key in Portkey Dashboard

The HuggingFace provider requires a **virtual key** to be set up in your Portkey dashboard:

**Steps:**
1. Go to [Portkey Dashboard](https://app.portkey.ai)
2. Navigate to **Virtual Keys** section
3. Click **"Create Virtual Key"**
4. Select **"HuggingFace"** as the provider
5. Enter your **HuggingFace API Token**
   - Get your token from: https://huggingface.co/settings/tokens
   - Create a new token with **Inference API** permissions
6. Save the virtual key

### 2. Verify HuggingFace API Token

Before adding to Portkey, verify your HuggingFace token works:

```bash
curl https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct \
  -H "Authorization: Bearer YOUR_HF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs": "Hello"}'
```

### 3. Check Model Availability

Not all HuggingFace models are available via Inference API. Verify the model:

**Requirements:**
- Model must have Inference API enabled
- Model must be publicly accessible or you have access
- Some gated models (like Llama) require accepting the license first

**How to check:**
1. Visit the model page on HuggingFace (e.g., https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct)
2. Look for "Inference API" widget on the right side
3. If you see "This model is currently loading", wait a few minutes
4. If you see "Model is private" or "Gated model", you need access

### 4. Accept Gated Model Licenses

For Meta Llama models:
1. Go to https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct
2. Click **"Access repository"** button
3. Accept the license agreement
4. Wait for approval (usually instant)

### 5. Alternative: Use HuggingFace Inference Endpoints

If the free Inference API doesn't work, consider:

**Option A: Dedicated Inference Endpoints**
- Create a dedicated endpoint on HuggingFace
- More reliable than free tier
- Costs: ~$0.60/hour for small models

**Option B: Use Different Providers**
- DeepInfra hosts many HuggingFace models (✅ Working)
- Novita AI hosts HuggingFace models (✅ Working)
- These are already working in our tests

## Troubleshooting

### Error: "Model not found"
**Solution:** Ensure the model exists and you have access. Check model URL on HuggingFace.

### Error: "Invalid response from huggingface"
**Solution:** 
1. Check if virtual key is configured in Portkey dashboard
2. Verify your HuggingFace API token is valid
3. Ensure model has Inference API enabled

### Error: "Rate limited"
**Solution:** HuggingFace free tier has rate limits. Consider:
- Waiting a few minutes
- Upgrading to Pro account
- Using dedicated inference endpoints

## Recommended Models (If/When HuggingFace Works)

Once configured, these models should work:

```python
# Small models (faster, free tier friendly)
"@hug/google/gemma-2-2b-it"
"@hug/Qwen/Qwen2.5-7B-Instruct"

# Medium models (may require Pro)
"@hug/meta-llama/Llama-3.2-3B-Instruct"
"@hug/mistralai/Mistral-7B-Instruct-v0.3"

# Large models (require dedicated endpoints)
"@hug/meta-llama/Meta-Llama-3-8B-Instruct"
```

## Alternative Solutions (Working Now)

Since HuggingFace is not working, use these **working alternatives**:

### DeepInfra (✅ Working)
```python
model = "@deepinfra/meta-llama/Meta-Llama-3.1-8B-Instruct"
# Same models as HuggingFace, but working through DeepInfra
```

### Novita (✅ Working)
```python
model = "@novita/meta-llama/llama-3.1-8b-instruct"
# Another provider hosting HuggingFace models
```

### Cerebras (✅ Working)
```python
model = "@cerebras/llama3.1-8b"
# Ultra-fast inference on Cerebras hardware
```

## Testing HuggingFace

Once you've configured the virtual key, test with:

```bash
pytest tests/test_portkey.py -v -k huggingface
```

Or run the debug script:
```bash
python test_hug_debug.py
```

## Summary

**To enable HuggingFace:**
1. ✅ Create HuggingFace account and API token
2. ✅ Accept model licenses (for gated models)
3. ✅ Create virtual key in Portkey dashboard
4. ✅ Test the integration

**Current Workaround:**
Use DeepInfra, Novita, or Cerebras for accessing the same models - all are working with 100% success rate.