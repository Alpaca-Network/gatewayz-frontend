# DeepInfra Models via Portkey - 502 Fix

## Issue Summary
The model `jondurbin/airoboros-l2-70b-gpt4-1.4.1` and other DeepInfra models were returning **502 Bad Gateway** errors when accessed through the Portkey provider.

### Root Cause
The Portkey client only had provider mappings for OpenAI and Anthropic, but DeepInfra models require a specific `portkey_provider: "deepinfra"` configuration.

## ✅ Backend Fix Applied

### Changes Made
1. **Added DeepInfra support to Portkey client** (`src/services/portkey_client.py`)
   - Added `deepinfra` to provider mapping
   - Uses existing `DEEPINFRA_API_KEY` from config

2. **Updated documentation** (`docs/PORTKEY_TESTING_GUIDE.md`)
   - Added DeepInfra configuration examples
   - Added test case for jondurbin/airoboros model

### What's Fixed
✅ Backend now routes DeepInfra models correctly through Portkey
✅ No more 502 errors for DeepInfra models
✅ Proper authentication with DeepInfra API

## 🔧 Frontend Action Required

The frontend needs to detect DeepInfra models and send the correct `portkey_provider` parameter.

### How to Identify DeepInfra Models

DeepInfra models have the prefix `@deepinfra/` in their ID:

```json
{
  "id": "@deepinfra/jondurbin/airoboros-l2-70b-gpt4-1.4.1",
  "slug": "jondurbin/airoboros-l2-70b-gpt4-1.4.1",
  "canonical_slug": "jondurbin/airoboros-l2-70b-gpt4-1.4.1"
}
```

### Frontend Implementation

When a user selects a DeepInfra model, the frontend must include:

```javascript
// Check if model is from DeepInfra
const isDeepInfraModel = model.id?.startsWith('@deepinfra/');

// Build request
const requestBody = {
  model: model.slug || model.id,  // Use slug like "jondurbin/airoboros-l2-70b-gpt4-1.4.1"
  provider: "portkey",
  portkey_provider: isDeepInfraModel ? "deepinfra" : "openai",  // Set provider!
  messages: [...]
};
```

### Example: Complete Frontend Code

```typescript
interface Model {
  id: string;
  slug?: string;
  canonical_slug?: string;
}

function getPortkeyProvider(model: Model): string {
  // Extract provider from model ID prefix
  if (model.id?.startsWith('@deepinfra/')) return 'deepinfra';
  if (model.id?.startsWith('@openai/')) return 'openai';
  if (model.id?.startsWith('@anthropic/')) return 'anthropic';

  // Default to openai if no prefix
  return 'openai';
}

async function sendChatMessage(model: Model, messages: Message[]) {
  const portkeyProvider = getPortkeyProvider(model);

  const response = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model.slug || model.canonical_slug || model.id,
      provider: 'portkey',
      portkey_provider: portkeyProvider,  // Critical!
      messages
    })
  });

  return await response.json();
}
```

### Provider Detection Logic

```javascript
// Map model ID prefix to Portkey provider
const PROVIDER_MAP = {
  '@deepinfra/': 'deepinfra',
  '@openai/': 'openai',
  '@anthropic/': 'anthropic',
  '@xai/': 'xai',
  '@nebius/': 'nebius',
  '@cerebras/': 'cerebras',
  '@novita/': 'novita',
  // Add more as needed
};

function getProviderFromModelId(modelId: string): string {
  for (const [prefix, provider] of Object.entries(PROVIDER_MAP)) {
    if (modelId.startsWith(prefix)) {
      return provider;
    }
  }
  return 'openai'; // Default fallback
}
```

## 📝 API Request Format

### Correct Request (Works Now!)

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "jondurbin/airoboros-l2-70b-gpt4-1.4.1",
    "provider": "portkey",
    "portkey_provider": "deepinfra",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Incorrect Request (502 Error)

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "jondurbin/airoboros-l2-70b-gpt4-1.4.1",
    "provider": "portkey",
    // ❌ Missing portkey_provider!
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## 🧪 Testing

### Test DeepInfra Model

```bash
curl -X POST 'http://localhost:8000/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "jondurbin/airoboros-l2-70b-gpt4-1.4.1",
    "provider": "portkey",
    "portkey_provider": "deepinfra",
    "messages": [
      {"role": "user", "content": "Introduce yourself in one sentence."}
    ],
    "max_tokens": 100
  }'
```

**Expected Response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "model": "jondurbin/airoboros-l2-70b-gpt4-1.4.1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I'm Airoboros, an AI assistant..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 15,
    "total_tokens": 27
  }
}
```

## 📋 All DeepInfra Models

DeepInfra models available through Portkey (all require `portkey_provider: "deepinfra"`):

### Popular Models
- `meta-llama/Meta-Llama-3.1-405B-Instruct`
- `meta-llama/Meta-Llama-3.1-70B-Instruct`
- `meta-llama/Meta-Llama-3.1-8B-Instruct`
- `meta-llama/Llama-3.3-70B-Instruct`
- `mistralai/Mixtral-8x7B-Instruct-v0.1`
- `mistralai/Mistral-7B-Instruct-v0.3`
- `jondurbin/airoboros-l2-70b-gpt4-1.4.1`
- `microsoft/WizardLM-2-8x22B`
- `google/gemma-2-27b-it`
- `Qwen/Qwen2.5-72B-Instruct`

Check `portkey_models.json` for the complete list.

## 🔍 Troubleshooting

### Still Getting 502 Errors?

1. **Check request body** - Ensure `portkey_provider: "deepinfra"` is included
2. **Verify API key** - Ensure `DEEPINFRA_API_KEY` is set in `.env`
3. **Check model slug** - Use the model's `slug` field, not the `id` with prefix
4. **Review logs** - Check backend logs for detailed error messages

### CORS Errors?

CORS errors are a **symptom** of the 502 error. Fix the 502 (missing `portkey_provider`) and CORS will resolve.

## 📚 Documentation

- **Portkey Testing Guide:** `docs/PORTKEY_TESTING_GUIDE.md`
- **API Documentation:** http://localhost:8000/docs
- **Implementation:** `src/services/portkey_client.py`

## ✅ Summary

**Backend:** ✅ Fixed - DeepInfra support added
**Frontend:** ⚠️ Update required - Add provider detection logic

Once the frontend is updated to send `portkey_provider: "deepinfra"` for DeepInfra models, all 502 errors will be resolved!
