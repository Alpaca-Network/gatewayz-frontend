# Frontend Integration Guide: Portkey SDK Provider Updates

## Overview

The backend has migrated from a unified Portkey gateway (500-model limit) to individual provider support using the Portkey Python SDK. This provides access to each provider's full model catalog without limits.

## New Gateways Available

### Previously Available (Unchanged)
- `openrouter` - OpenRouter (339 models)
- `featherless` - Featherless (6,418 models)
- `deepinfra` - DeepInfra (182 models)
- `chutes` - Chutes.ai (104 models)
- `groq` - Groq (19 models)
- `fireworks` - Fireworks (38 models)
- `together` - Together.ai (100 models)

### NEW - Individual Portkey Providers
These were previously part of the unified "portkey" gateway (500 models total). Now available individually:

| Gateway | Provider | Expected Models | Status |
|---------|----------|-----------------|--------|
| `google` | Google via Portkey | TBD | Testing |
| `cerebras` | Cerebras via Portkey | TBD | Testing |
| `nebius` | Nebius via Portkey | TBD | Testing |
| `xai` | Xai via Portkey | TBD | Testing |
| `novita` | Novita via Portkey | TBD | Testing |
| `hug` | Hugging Face via Portkey | TBD | Testing |

### DEPRECATED
- ~~`portkey`~~ - **DEPRECATED** - Unified Portkey gateway (500 models)
  - **Migration**: Use individual provider gateways instead (google, cerebras, nebius, xai, novita, hug)

## API Endpoints Updates

### /models Endpoint

**Previous Behavior:**
```
GET /models?gateway=portkey
Returns: 500 aggregated models from all Portkey providers
```

**New Behavior:**
```
GET /models?gateway=google         # Google models via Portkey
GET /models?gateway=cerebras       # Cerebras models via Portkey
GET /models?gateway=nebius         # Nebius models via Portkey
GET /models?gateway=xai            # Xai models via Portkey
GET /models?gateway=novita         # Novita models via Portkey
GET /models?gateway=hug            # Hugging Face models via Portkey
GET /models?gateway=all            # All providers (including new ones)
```

### /chat/completions Endpoint

**Model Format:**
Models from new providers follow this format:
```
{provider_slug}/{model_id}

Examples:
- google/gpt-4-turbo
- cerebras/llm-inference
- nebius/mistral-large
- xai/grok-2
- novita/qwen-turbo
- hug/meta-llama/llama-2-70b
```

**Usage Example:**
```bash
curl -X POST https://api.gatewayz.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gpt-4-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Frontend Changes Required

### 1. Model Selection Dropdown / Selector

**Update Provider List:**
```javascript
const providers = [
  { value: 'openrouter', label: 'OpenRouter (339)' },
  { value: 'portkey', label: 'Portkey (DEPRECATED - see below)' },
  { value: 'featherless', label: 'Featherless (6,418)' },
  { value: 'deepinfra', label: 'DeepInfra (182)' },
  { value: 'google', label: 'Google via Portkey (NEW)' },
  { value: 'cerebras', label: 'Cerebras via Portkey (NEW)' },
  { value: 'nebius', label: 'Nebius via Portkey (NEW)' },
  { value: 'xai', label: 'Xai via Portkey (NEW)' },
  { value: 'novita', label: 'Novita via Portkey (NEW)' },
  { value: 'hug', label: 'Hugging Face via Portkey (NEW)' },
  { value: 'chutes', label: 'Chutes.ai (104)' },
  { value: 'groq', label: 'Groq (19)' },
  { value: 'fireworks', label: 'Fireworks (38)' },
  { value: 'together', label: 'Together.ai (100)' },
  { value: 'all', label: 'All Providers' },
];
```

**Show Migration Warning for Portkey:**
```javascript
if (selectedProvider === 'portkey') {
  showWarning(
    'Portkey gateway is deprecated. Please select an individual provider: ' +
    'Google, Cerebras, Nebius, Xai, Novita, or Hugging Face'
  );
}
```

### 2. Gateway Selection Component

**Update Gateway Documentation:**
```javascript
const gatewayInfo = {
  google: {
    label: 'Google',
    description: 'Google AI models accessed via Portkey SDK',
    status: 'new',
    category: 'portkey_providers'
  },
  cerebras: {
    label: 'Cerebras',
    description: 'Cerebras models accessed via Portkey SDK',
    status: 'new',
    category: 'portkey_providers'
  },
  nebius: {
    label: 'Nebius',
    description: 'Nebius models accessed via Portkey SDK',
    status: 'new',
    category: 'portkey_providers'
  },
  xai: {
    label: 'Xai',
    description: 'Xai models accessed via Portkey SDK',
    status: 'new',
    category: 'portkey_providers'
  },
  novita: {
    label: 'Novita',
    description: 'Novita models accessed via Portkey SDK',
    status: 'new',
    category: 'portkey_providers'
  },
  hug: {
    label: 'Hugging Face',
    description: 'Hugging Face models accessed via Portkey SDK',
    status: 'new',
    category: 'portkey_providers'
  },
  portkey: {
    label: 'Portkey (DEPRECATED)',
    description: 'Use individual providers instead',
    status: 'deprecated',
    category: 'deprecated'
  }
};
```

### 3. Model List Fetching

**Update /models API Calls:**
```javascript
// Old way (deprecated)
// const response = await fetch(`/models?gateway=portkey`);

// New way - fetch individual providers
async function fetchModelsForProvider(provider) {
  const response = await fetch(`/models?gateway=${provider}`);
  const data = await response.json();
  return data.data; // Returns array of models
}

// Example usage
const googleModels = await fetchModelsForProvider('google');
const cerebasModels = await fetchModelsForProvider('cerebras');

// Or fetch all (will include new providers)
const allModels = await fetch('/models?gateway=all');
```

### 4. Model ID Format Updates

**New Model ID Format:**
```javascript
// New providers use: {provider_slug}/{model_id}
const modelId = 'google/gpt-4-turbo';

// Parse new format
function parseModelId(modelId) {
  const [provider, ...modelParts] = modelId.split('/');
  return {
    provider,
    model: modelParts.join('/'),
    fullId: modelId
  };
}

// Example
parseModelId('google/gpt-4-turbo');
// Returns: { provider: 'google', model: 'gpt-4-turbo', fullId: 'google/gpt-4-turbo' }

parseModelId('hug/meta-llama/llama-2-70b');
// Returns: { provider: 'hug', model: 'meta-llama/llama-2-70b', fullId: 'hug/meta-llama/llama-2-70b' }
```

### 5. Chat Completions Request

**Send Model with Provider Prefix:**
```javascript
// Old way (with some Portkey models)
const response = await fetch('/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: '@google/gpt-4-turbo',  // Old format
    messages: [/* ... */]
  })
});

// New way (recommended)
const response = await fetch('/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'google/gpt-4-turbo',  // New format
    messages: [/* ... */]
  })
});
```

## Error Handling

### New Error Cases

**Provider Not Available:**
```javascript
try {
  const models = await fetch('/models?gateway=google');
  if (models.status === 503) {
    console.error('Google provider temporarily unavailable');
    // Show user-friendly error
  }
} catch (error) {
  console.error('Failed to fetch models:', error);
}
```

**Invalid Model ID:**
```javascript
// If user tries to use old format
if (modelId.includes('@')) {
  console.warn('Old Portkey format detected. Converting...');
  const newFormat = modelId.replace('@', '');
  // Use newFormat instead
}
```

## Migration Checklist

### Frontend Updates Required
- [ ] Add new providers to gateway list (google, cerebras, nebius, xai, novita, hug)
- [ ] Update /models endpoint calls to support new gateways
- [ ] Add deprecation warning for 'portkey' gateway
- [ ] Update model ID parsing for new format
- [ ] Update chat completions request to use new model format
- [ ] Test model listing for each new provider
- [ ] Test chat completions with new model IDs
- [ ] Add error handling for provider unavailability
- [ ] Update UI labels and descriptions
- [ ] Update API documentation

### Testing Checklist
- [ ] Fetch models from each new provider
- [ ] Verify model counts are greater than before (no 500-model limit)
- [ ] Send chat message with each provider's model
- [ ] Handle errors gracefully
- [ ] Verify backward compatibility with other providers
- [ ] Test "all" gateway aggregation

## Backward Compatibility

### What Still Works
- All existing direct providers (OpenRouter, DeepInfra, Featherless, etc.)
- Model transformation and provider auto-detection
- Chat completion routing
- API key authentication
- Rate limiting
- Credit deduction

### What Changed
- Portkey gateway is now individual providers
- Model ID format for Portkey models changed to `{provider}/{model_id}`
- New gateways available in /models endpoint

### Deprecation Timeline
- **Now**: New providers available, old "portkey" gateway deprecated
- **Phase-out**: "portkey" gateway may be removed in future release
- **Migration**: Encourage users to switch to individual providers

## Support & Testing

### Backend Status
- ✅ Portkey SDK integrated
- ✅ Provider fetchers implemented
- ✅ Cache layer updated
- ⏳ Routes need final testing
- ⏳ Frontend integration ready for implementation

### Available Endpoints
```
GET /models?gateway=google
GET /models?gateway=cerebras
GET /models?gateway=nebius
GET /models?gateway=xai
GET /models?gateway=novita
GET /models?gateway=hug
GET /models?gateway=all          # Includes new providers
POST /v1/chat/completions        # Supports new model IDs
```

### Documentation References
- Backend: `src/services/portkey_sdk.py`
- Backend: `src/services/portkey_providers.py`
- Backend: `src/services/models.py`
- Backend: `src/cache.py`

## Questions or Issues?

- Check backend logs for: `"Fetching {provider} models via Portkey SDK"`
- Verify model counts: `/models?gateway={provider}&limit=1`
- Test provider connection: Check for successful cache population
- Review error responses from 503 status codes

## Timeline

- **Backend Complete**: October 16, 2025
- **Frontend Ready**: Ready for implementation
- **Testing**: Can begin immediately after frontend updates
- **Production**: After successful testing of new providers
