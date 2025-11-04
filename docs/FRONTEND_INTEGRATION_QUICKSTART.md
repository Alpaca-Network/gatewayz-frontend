# Frontend Integration - Quick Start (30 seconds)

## TL;DR

Vercel AI Gateway models are ready to display. Use these endpoints:

### Get Models
```javascript
// Fetch all Vercel models
fetch('/v1/models?gateway=vercel-ai-gateway')
  .then(r => r.json())
  .then(data => {
    console.log(`${data.total} models available`);
    console.log(data.data); // Array of models with pricing
  });
```

### Model Structure
```javascript
{
  "id": "openai/gpt-4",
  "name": "gpt-4",
  "source_gateway": "vercel-ai-gateway",
  "provider_slug": "openai",
  "context_length": 8192,
  "pricing": {
    "prompt": "0.003",      // $0.003 per 1M tokens
    "completion": "0.006"   // $0.006 per 1M tokens
  },
  "model_logo_url": "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/vercel.svg"
}
```

### Display in UI
```javascript
// Format price
const pricePerToken = parseFloat(pricing.prompt) / 1000000;
console.log(`$${pricePerToken.toFixed(9)}/token`);

// Filter by provider
const openaiModels = models.filter(m => m.provider_slug === 'openai');

// Sort by price
const affordable = models.sort((a, b) =>
  parseFloat(a.pricing.prompt) - parseFloat(b.pricing.prompt)
);
```

---

## What Changed in Backend

✅ **New Endpoints Available:**
- `GET /v1/models?gateway=vercel-ai-gateway` - Get all Vercel models
- `GET /v1/models/vercel-ai-gateway/{model_id}` - Get specific model
- `GET /v1/models/search?gateway=vercel-ai-gateway&...` - Search with filters

✅ **Models Include:**
- Provider information (OpenAI, Google, Anthropic, etc.)
- Actual provider pricing (cross-referenced)
- Context length and capabilities
- Vercel branding (logo URL)

✅ **Chat Integration:**
- Models work automatically with chat completions
- Use model ID from API: `openai/gpt-4` or `vercel/openai/gpt-4`
- Streaming supported
- Fallback to other providers if Vercel unavailable

---

## Key Data Points for Frontend

| Item | Value | Notes |
|------|-------|-------|
| **Gateway ID** | `vercel-ai-gateway` | Use in filter/query params |
| **Gateway Logo** | Vercel SVG icon | URL in model response |
| **Model Count** | 200+ | Growing as Vercel adds providers |
| **Pricing** | Per 1M tokens (string) | Convert to per-token as needed |
| **Cache** | 1 hour | Pricing updates hourly |
| **Model ID Format** | `provider/model-name` | e.g., `openai/gpt-4` |

---

## Integration Checklist

- [ ] Fetch models from `/v1/models?gateway=vercel-ai-gateway`
- [ ] Parse `data` array for models
- [ ] Display model name, provider, context length
- [ ] Display pricing (format: `prompt` and `completion` values)
- [ ] Show Vercel logo from `model_logo_url`
- [ ] Add "Source: Vercel AI Gateway" label/badge
- [ ] Test with different providers (OpenAI, Google, Anthropic, etc.)
- [ ] Test price formatting for different values
- [ ] Test filtering by provider or price
- [ ] Test pagination (limit/offset params)

---

## Common Tasks

### Show Models in Dropdown
```jsx
<select>
  {models.map(m => (
    <option key={m.id} value={m.id}>
      {m.provider_slug.toUpperCase()} - {m.name}
    </option>
  ))}
</select>
```

### Show Models in Table
```jsx
<table>
  <tr>
    <th>Model</th>
    <th>Provider</th>
    <th>Context</th>
    <th>Prompt Price/1M</th>
  </tr>
  {models.map(m => (
    <tr key={m.id}>
      <td>{m.name}</td>
      <td>{m.provider_slug}</td>
      <td>{m.context_length}</td>
      <td>${m.pricing.prompt}</td>
    </tr>
  ))}
</table>
```

### Filter by Provider
```javascript
const openaiModels = models.filter(m => m.provider_slug === 'openai');
const googleModels = models.filter(m => m.provider_slug === 'google');
```

### Sort by Price
```javascript
const sorted = models.sort((a, b) =>
  parseFloat(a.pricing.prompt) - parseFloat(b.pricing.prompt)
);
```

---

## Response Format

**Success (200):**
```json
{
  "data": [{ model objects }],
  "total": 200,
  "returned": 50,
  "offset": 0,
  "limit": 50,
  "gateway": "vercel-ai-gateway",
  "timestamp": "2025-10-31T20:35:00.000Z"
}
```

**Error (5xx or timeout):**
```json
{
  "error": "message",
  "data": null
}
```

---

## No Action Required If...

- ✅ Your current UI just needs to **add Vercel to the provider list** (similar to OpenRouter, Portkey, etc.)
- ✅ You're using an existing models API client/hook that calls `/v1/models`
- ✅ You already support dynamic gateway selection

Just add `vercel-ai-gateway` to your list of gateways!

---

## Full Documentation

For complete details including:
- All query parameters and filters
- Detailed data structure reference
- React component examples
- Pricing strategy explanation
- Error handling
- Testing instructions

See: `FRONTEND_INTEGRATION_GUIDE.md`

---

## Questions?

1. Check `FRONTEND_INTEGRATION_GUIDE.md` for detailed docs
2. Check `GATEWAY_INTEGRATION_GUIDE.md` for backend implementation details
3. Test the API directly: `curl http://localhost:8000/v1/models?gateway=vercel-ai-gateway`
