# Frontend Quick Start: Portkey SDK Integration

## Changes You Need to Make

### 1. Provider List Update (in your provider dropdown)

```javascript
const PROVIDERS = [
  // Existing providers (no changes)
  { id: 'openrouter', name: 'OpenRouter', models: 339 },
  { id: 'featherless', name: 'Featherless', models: 6418 },
  { id: 'deepinfra', name: 'DeepInfra', models: 182 },
  { id: 'chutes', name: 'Chutes.ai', models: 104 },
  { id: 'groq', name: 'Groq', models: 19 },
  { id: 'fireworks', name: 'Fireworks', models: 38 },
  { id: 'together', name: 'Together.ai', models: 100 },

  // NEW PROVIDERS - Add these
  { id: 'google', name: 'Google (via Portkey)', models: 'TBD', NEW: true },
  { id: 'cerebras', name: 'Cerebras (via Portkey)', models: 'TBD', NEW: true },
  { id: 'nebius', name: 'Nebius (via Portkey)', models: 'TBD', NEW: true },
  { id: 'xai', name: 'Xai (via Portkey)', models: 'TBD', NEW: true },
  { id: 'novita', name: 'Novita (via Portkey)', models: 'TBD', NEW: true },
  { id: 'hug', name: 'Hugging Face (via Portkey)', models: 'TBD', NEW: true },

  // DEPRECATED - Keep for backward compat but show warning
  { id: 'portkey', name: 'Portkey (DEPRECATED)', models: 500, DEPRECATED: true },

  // Aggregation
  { id: 'all', name: 'All Providers', models: 'All' },
];
```

### 2. Fetch Models (No API change, just new gateways)

```javascript
// This already works, just use new gateway IDs
async function fetchModels(gateway) {
  const response = await fetch(`/models?gateway=${gateway}`);
  return response.json();
}

// Usage
const googleModels = await fetchModels('google');
const cerebasModels = await fetchModels('cerebras');
```

### 3. Model ID Format (Updated)

When displaying/sending model IDs from new providers:

```javascript
// New format (used by all new Portkey providers)
const newFormatModel = 'google/gpt-4-turbo';
const newFormatModel2 = 'cerebras/llm-inference';
const newFormatModel3 = 'hug/meta-llama/llama-2-70b';

// Old format (may still appear in Portkey unified gateway if not removed)
const oldFormatModel = '@google/gpt-4-turbo';  // Deprecated

// Function to normalize/handle both
function normalizeModelId(modelId) {
  // If old format, convert to new
  if (modelId.startsWith('@')) {
    return modelId.substring(1); // Remove @ prefix
  }
  return modelId;
}
```

### 4. Chat Completions (Use new format)

```javascript
async function sendChatMessage(modelId, messages, apiKey) {
  const response = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: normalizeModelId(modelId),  // Use normalized ID
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

### 5. UI Updates (Visual changes)

```javascript
// Show badge for new providers
function renderProviderOption(provider) {
  let badge = '';

  if (provider.NEW) {
    badge = ' <span class="badge badge-primary">NEW</span>';
  } else if (provider.DEPRECATED) {
    badge = ' <span class="badge badge-danger">DEPRECATED</span>';
  }

  return `${provider.name}${badge}`;
}

// Show warning when user selects deprecated provider
function onProviderChange(provider) {
  if (provider.DEPRECATED) {
    showAlert(
      'warning',
      'This provider is deprecated. Please choose a specific Portkey provider instead: ' +
      'Google, Cerebras, Nebius, Xai, Novita, or Hugging Face'
    );
  }
}
```

### 6. Error Handling (New scenarios)

```javascript
async function getModelsWithErrorHandling(gateway) {
  try {
    const response = await fetch(`/models?gateway=${gateway}`);

    // New error case: Provider unavailable
    if (response.status === 503) {
      console.warn(`Provider ${gateway} temporarily unavailable`);
      return [];
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];

  } catch (error) {
    console.error(`Error fetching models for ${gateway}:`, error);
    return [];
  }
}
```

## Files to Update

### Components/Pages
- [ ] Model selector dropdown
- [ ] Provider selection UI
- [ ] Chat message component (model selection)
- [ ] Settings/Configuration page

### Services/Utils
- [ ] API client (if exists)
- [ ] Model ID normalization
- [ ] Error handling utilities
- [ ] Cache/state management

### Constants
- [ ] Provider list
- [ ] Gateway configurations
- [ ] Model format templates

## Testing Endpoints

### Test individual providers
```bash
curl https://api.gatewayz.ai/models?gateway=google&limit=1
curl https://api.gatewayz.ai/models?gateway=cerebras&limit=1
curl https://api.gatewayz.ai/models?gateway=nebius&limit=1
curl https://api.gatewayz.ai/models?gateway=xai&limit=1
curl https://api.gatewayz.ai/models?gateway=novita&limit=1
curl https://api.gatewayz.ai/models?gateway=hug&limit=1
```

### Test chat with new model
```bash
curl -X POST https://api.gatewayz.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gpt-4-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Expected Responses

### Model List Response
```json
{
  "data": [
    {
      "id": "google/gpt-4-turbo",
      "name": "GPT-4 Turbo",
      "description": "...",
      "provider_slug": "google",
      "source_gateway": "google",
      "pricing": { "prompt": null, "completion": null },
      ...
    }
  ],
  "total": 150,
  "returned": 1
}
```

### Chat Response (Same as before)
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Response text..."
      }
    }
  ]
}
```

## Quick Checklist

- [ ] Add 6 new providers to provider list
- [ ] Update model fetching to support new gateways
- [ ] Update model ID parsing for new format
- [ ] Add deprecation warning for old "portkey" gateway
- [ ] Test model list from each new provider
- [ ] Test chat completions with new model IDs
- [ ] Update UI to show "NEW" badge on new providers
- [ ] Add error handling for 503 responses
- [ ] Test backward compatibility with existing providers
- [ ] Deploy and monitor for errors

## Need Help?

See full documentation:
- `docs/FRONTEND_INTEGRATION_PORTKEY_SDK.md` - Complete guide
- `PORTKEY_SDK_MIGRATION_SUMMARY.md` - Quick reference

Backend commits:
- **bdb3490**: Portkey SDK + caching foundation
- **b097878**: Provider fetch functions
- **4e405b0**: Frontend documentation

## Timeline

✅ Backend ready for testing
⏳ Frontend implementation (your turn!)
⏳ Integration testing
⏳ Production deployment
