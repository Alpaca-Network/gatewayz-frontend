# Frontend Integration Guide - Vercel AI Gateway

This document provides all necessary information for integrating Vercel AI Gateway into the frontend models page.

## Quick Summary

**Vercel AI Gateway is now fully integrated into the backend catalog system.** The frontend can discover and display Vercel models through existing API endpoints.

---

## API Endpoints

### 1. Get All Vercel Models

```
GET /v1/models?gateway=vercel-ai-gateway
```

**Query Parameters:**
- `gateway` (required): `vercel-ai-gateway`
- `limit` (optional): Number of results per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "data": [
    {
      "id": "openai/gpt-4",
      "slug": "vercel/openai/gpt-4",
      "canonical_slug": "vercel/openai/gpt-4",
      "name": "gpt-4",
      "description": "Model available through Vercel AI Gateway",
      "source_gateway": "vercel-ai-gateway",
      "provider_slug": "openai",
      "provider_site_url": "https://vercel.com/ai-gateway",
      "model_logo_url": "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/vercel.svg",
      "context_length": 8192,
      "created": "2023-03-14",
      "architecture": {
        "modality": "text->text",
        "input_modalities": ["text"],
        "output_modalities": ["text"],
        "instruct_type": "chat"
      },
      "pricing": {
        "prompt": "0.003",
        "completion": "0.006",
        "request": "0",
        "image": "0"
      },
      "hugging_face_id": null,
      "top_provider": null,
      "per_request_limits": null,
      "supported_parameters": [],
      "default_parameters": {}
    }
  ],
  "total": 200,
  "returned": 50,
  "offset": 0,
  "limit": 50,
  "gateway": "vercel-ai-gateway",
  "timestamp": "2025-10-31T20:35:00.000Z"
}
```

### 2. Get Specific Model Details

```
GET /v1/models/vercel-ai-gateway/{model_id}
```

**Example:**
```
GET /v1/models/vercel-ai-gateway/openai/gpt-4
```

**Response:**
```json
{
  "id": "openai/gpt-4",
  "slug": "vercel/openai/gpt-4",
  "name": "gpt-4",
  "pricing": {
    "prompt": "0.003",
    "completion": "0.006",
    "request": "0",
    "image": "0"
  },
  "context_length": 8192,
  "source_gateway": "vercel-ai-gateway",
  "provider_slug": "openai"
}
```

### 3. Search Models with Filters

```
GET /v1/models/search?gateway=vercel-ai-gateway&min_context=8000&max_price=0.01
```

**Query Parameters:**
- `gateway`: `vercel-ai-gateway`
- `min_context`: Minimum context length (optional)
- `max_context`: Maximum context length (optional)
- `min_price`: Minimum prompt price (optional)
- `max_price`: Maximum prompt price (optional)
- `modality`: Filter by modality e.g., `text->text` (optional)

### 4. Get All Models (Including Vercel)

```
GET /v1/models?gateway=all
```

This returns models from all providers including Vercel AI Gateway mixed together.

---

## Model Data Structure

Every Vercel model includes:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Original model ID from provider | `openai/gpt-4` |
| `slug` | string | URL-safe identifier | `vercel/openai/gpt-4` |
| `canonical_slug` | string | Canonical form of ID | `vercel/openai/gpt-4` |
| `name` | string | Display name | `gpt-4` |
| `description` | string | Model description | `Model available through Vercel AI Gateway` |
| `source_gateway` | string | Source provider | `vercel-ai-gateway` |
| `provider_slug` | string | Underlying provider | `openai`, `google`, `anthropic`, etc. |
| `provider_site_url` | string | Gateway link | `https://vercel.com/ai-gateway` |
| `model_logo_url` | string | Vercel logo URL | `https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/vercel.svg` |
| `context_length` | integer | Token limit | `8192` |
| `created` | string | Model release date (ISO 8601) | `2023-03-14` |
| `architecture` | object | Model capabilities | See below |
| `pricing` | object | Per-token costs | See below |

### Architecture Object

```json
{
  "modality": "text->text",
  "input_modalities": ["text"],
  "output_modalities": ["text"],
  "instruct_type": "chat"
}
```

### Pricing Object

```json
{
  "prompt": "0.003",        // Cost per 1M prompt tokens (string)
  "completion": "0.006",    // Cost per 1M completion tokens (string)
  "request": "0",           // Per-request cost (if applicable)
  "image": "0"              // Per-image cost (if applicable)
}
```

**Note**: All pricing values are strings representing USD costs per 1 million tokens.

---

## Key Characteristics

### Pricing Strategy

Vercel AI Gateway models display **actual provider pricing** because:

1. **Vercel routes requests to underlying providers** (OpenAI, Google, Anthropic, etc.)
2. **We cross-reference provider pricing** in the system cache
3. **Pricing matches what that provider charges** when accessed through Vercel
4. **No Vercel markup** (Vercel doesn't add additional costs)

**Examples:**
- `openai/gpt-4` through Vercel shows OpenAI's GPT-4 pricing
- `google/gemini-pro` through Vercel shows Google's Gemini pricing
- `anthropic/claude-3-sonnet` through Vercel shows Anthropic's Claude pricing

### Model ID Format

Vercel models use a **provider-prefixed format**:
- `openai/gpt-4`
- `google/gemini-pro`
- `anthropic/claude-3-sonnet`
- `anthropic/claude-3-opus`

This makes it easy to:
- Identify the underlying provider
- Group models by provider
- Cross-reference with native provider pricing

### Gateway Identifier

All Vercel models have:
- `source_gateway`: `vercel-ai-gateway`
- `provider_site_url`: `https://vercel.com/ai-gateway`
- `model_logo_url`: Vercel icon

Use these to:
- Filter/identify Vercel models
- Display appropriate branding
- Differentiate from other gateways (OpenRouter, Portkey, etc.)

---

## Display Recommendations

### Models List/Table

Show these columns for best user experience:

```
Model Name | Provider | Context | Input Price | Output Price | Source
-----------|----------|---------|------------|-------------|--------
gpt-4      | OpenAI   | 8,192   | $0.003     | $0.006     | Vercel
gemini-pro | Google   | 30,000  | $0.000125  | $0.000375  | Vercel
claude-3   | Anthropic| 200,000 | $0.003     | $0.015     | Vercel
```

### Price Display

Convert prices for readability:
- `0.003` USD per 1M tokens → `$0.000003` per token
- `0.003` USD per 1M tokens → `$0.003` per 1K tokens
- `0.003` USD per 1M tokens → `$0.003` per 1M tokens

### Provider Branding

- Show **Vercel logo** for gateway identifier (in provider column or badge)
- Show **underlying provider logo** next to model name (OpenAI, Google, etc.)
- Use `provider_site_url` for "Learn more" link

**Example Component:**
```tsx
<ModelRow>
  <ProviderBadge
    gateway="vercel-ai-gateway"
    gatewayLogo="vercel.svg"
    provider="openai"
    providerLogo="openai.svg"
  />
  <ModelName>{model.name}</ModelName>
  <Context>{model.context_length.toLocaleString()}</Context>
  <Pricing>{formatPrice(model.pricing.prompt)}</Pricing>
</ModelRow>
```

---

## Filtering & Search

### Filter by Gateway

```javascript
// Show only Vercel models
const vercelModels = models.filter(m => m.source_gateway === 'vercel-ai-gateway');

// Show only OpenAI models through Vercel
const openaiViaVercel = models.filter(
  m => m.source_gateway === 'vercel-ai-gateway' && m.provider_slug === 'openai'
);
```

### Filter by Context Length

```javascript
// Models with 100K+ context
const longContext = models.filter(m => m.context_length >= 100000);
```

### Filter by Price

```javascript
// Budget-friendly models under $0.001 per 1M tokens
const budgetFriendly = models.filter(
  m => parseFloat(m.pricing.prompt) < 0.001
);
```

### Sort Options

```javascript
// Sort by price (ascending)
models.sort((a, b) =>
  parseFloat(a.pricing.prompt) - parseFloat(b.pricing.prompt)
);

// Sort by context length (descending)
models.sort((a, b) => b.context_length - a.context_length);

// Sort by model name
models.sort((a, b) => a.name.localeCompare(b.name));
```

---

## Chat Completion Integration

Once a user selects a Vercel model, the chat endpoint handles it automatically:

```
POST /v1/chat/completions
{
  "model": "vercel/openai/gpt-4",  // Use the full slug or model ID
  "messages": [...],
  "temperature": 0.7,
  ...
}
```

**The backend automatically:**
1. Recognizes `vercel-ai-gateway` from the model ID or explicit gateway parameter
2. Routes to Vercel AI Gateway
3. Calculates pricing based on provider rates
4. Handles streaming if requested
5. Falls back to other providers if Vercel is unavailable

---

## Provider Logo URLs

### Gateway Logo
- **Vercel**: `https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/vercel.svg`

### Underlying Provider Logos
- **OpenAI**: `https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/openai.svg`
- **Google**: `https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/google.svg`
- **Anthropic**: Direct download or use company logo
- **Meta**: `https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/meta.svg`
- **Other**: Fallback to Google Favicon API: `https://www.google.com/s2/favicons?domain={domain}&sz=128`

---

## Caching Strategy

**Vercel models are cached server-side** with:
- **Fresh TTL**: 1 hour
- **Stale-while-revalidate**: 2 hours
- **Cache key**: `gateway=vercel-ai-gateway`

**For frontend:**
- Models list updates every 1 hour
- Pricing updates every 1 hour
- Cache is transparent to frontend (handled by backend)

---

## Error Handling

If Vercel models fail to load:

```javascript
try {
  const response = await fetch('/v1/models?gateway=vercel-ai-gateway');
  const data = await response.json();

  if (!data.data || data.data.length === 0) {
    console.warn('No Vercel models available');
    // Show fallback message or use other gateways
  }
} catch (error) {
  console.error('Failed to load Vercel models:', error);
  // Handle error gracefully - show other gateways
}
```

**Common scenarios:**
- Vercel API temporarily unavailable → Falls back to zero pricing
- No models returned → API may be rate-limited, retry after delay
- Pricing unavailable → Defaults to "$0" (free) until pricing loads

---

## Code Examples

### React Component - Model Selector

```jsx
import { useState, useEffect } from 'react';

export function VercelModelSelector() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/v1/models?gateway=vercel-ai-gateway&limit=100');
        const data = await response.json();
        setModels(data.data || []);
      } catch (error) {
        console.error('Failed to fetch Vercel models:', error);
        setModels([]);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  if (loading) return <div>Loading models...</div>;
  if (models.length === 0) return <div>No Vercel models available</div>;

  return (
    <select value={selectedModel?.id || ''} onChange={(e) => {
      const model = models.find(m => m.id === e.target.value);
      setSelectedModel(model);
    }}>
      <option value="">Select a model...</option>
      {models.map(model => (
        <option key={model.id} value={model.id}>
          {model.provider_slug.toUpperCase()} - {model.name}
          {model.pricing.prompt !== '0' &&
            ` ($${model.pricing.prompt}/1M tokens)`
          }
        </option>
      ))}
    </select>
  );
}
```

### React Component - Model Table

```jsx
export function VercelModelsTable() {
  const [models, setModels] = useState([]);

  useEffect(() => {
    fetch('/v1/models?gateway=vercel-ai-gateway')
      .then(r => r.json())
      .then(data => setModels(data.data || []))
      .catch(e => console.error(e));
  }, []);

  return (
    <table>
      <thead>
        <tr>
          <th>Model</th>
          <th>Provider</th>
          <th>Context</th>
          <th>Prompt Price</th>
          <th>Completion Price</th>
        </tr>
      </thead>
      <tbody>
        {models.map(model => (
          <tr key={model.id}>
            <td>{model.name}</td>
            <td>{model.provider_slug}</td>
            <td>{model.context_length.toLocaleString()}</td>
            <td>${model.pricing.prompt}/1M</td>
            <td>${model.pricing.completion}/1M</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Utility Function - Format Price

```javascript
export function formatPrice(pricePerMillion) {
  const num = parseFloat(pricePerMillion);
  if (num === 0) return 'Free';
  if (num < 0.001) return `$${(num / 1000000).toFixed(9)}/token`;
  if (num < 1) return `$${(num / 1000).toFixed(6)}/1K tokens`;
  return `$${num.toFixed(2)}/1M tokens`;
}

// Usage
console.log(formatPrice('0.003')); // "$0.000003/token"
console.log(formatPrice('0.003')); // "$0.003/1K tokens"
console.log(formatPrice('0')); // "Free"
```

---

## Testing Integration

### Test API Access

```bash
# Get Vercel models
curl "http://localhost:8000/v1/models?gateway=vercel-ai-gateway" | jq '.data | length'

# Should return 200+ models
```

### Test Specific Model

```bash
# Get gpt-4 through Vercel
curl "http://localhost:8000/v1/models/vercel-ai-gateway/openai/gpt-4" | jq '.pricing'

# Should show:
# {
#   "prompt": "0.003",
#   "completion": "0.006",
#   ...
# }
```

### Test Chat Completion

```bash
# Send message using Vercel model
curl -X POST "http://localhost:8000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vercel/openai/gpt-4",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

---

## Frequently Asked Questions

### Q: Why does pricing show actual provider costs instead of Vercel costs?

**A:** Vercel doesn't add markup. When you use a model through Vercel, you pay exactly what that provider charges. So showing OpenAI's pricing for `openai/gpt-4` is accurate whether accessed directly or through Vercel.

### Q: How often does pricing update?

**A:** Models and pricing are cached for 1 hour on the backend. To force a refresh, clear the browser cache or wait 1 hour for automatic refresh.

### Q: Can I use model IDs without the `vercel/` prefix?

**A:** Yes. Both work in chat completions:
- `vercel/openai/gpt-4` (full slug)
- `openai/gpt-4` (will be routed to Vercel)

The backend automatically handles routing.

### Q: What happens if Vercel API is down?

**A:** The backend gracefully handles failures:
1. Returns cached models if available
2. Sets pricing to "$0" (free) as fallback
3. Still allows chat requests (routed through failover chain)

### Q: Can I mix Vercel models with other gateways?

**A:** Yes! You can show models from all gateways together:
```javascript
const allModels = await fetch('/v1/models?gateway=all');
// Shows OpenRouter, Portkey, Vercel, Featherless, etc. all together
```

---

## Support & Issues

If models aren't appearing in the frontend:

1. **Check backend is running**: `curl http://localhost:8000/v1/models?gateway=vercel-ai-gateway`
2. **Verify API key**: Ensure `VERCEL_AI_GATEWAY_API_KEY` is set (or use placeholder)
3. **Check browser console**: Look for fetch errors
4. **Check network tab**: Verify API response status and data
5. **Verify endpoint URL**: Should match your backend URL

For more details, see `GATEWAY_INTEGRATION_GUIDE.md` for backend implementation details.
