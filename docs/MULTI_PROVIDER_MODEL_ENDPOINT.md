# Multi-Provider Model Endpoint Enhancement

## Overview

The `/catalog/model/{provider_name}/{model_name}` endpoint has been enhanced to support fetching model data from multiple model providers including OpenRouter, Portkey, Featherless, DeepInfra, and Chutes.ai.

## Supported Providers

### 1. OpenRouter
- **API Endpoint**: `https://openrouter.ai/api/v1/models`
- **Features**: Full model endpoint data including performance metrics, pricing, and provider information
- **API Key Required**: `OPENROUTER_API_KEY`

### 2. Portkey
- **API Endpoint**: `https://api.portkey.ai/v1/models`
- **Features**: Model catalog with cross-referenced OpenRouter pricing
- **API Key Required**: `PORTKEY_API_KEY`
- **Header**: `x-portkey-api-key`

### 3. Featherless
- **API Endpoint**: `https://api.featherless.ai/v1/models`
- **Features**: OpenAI-compatible model catalog
- **API Key Required**: `FEATHERLESS_API_KEY`
- **Header**: `Authorization: Bearer {token}`

### 4. DeepInfra
- **API Endpoint**: `https://api.deepinfra.com/v1/openai/models`
- **Features**: OpenAI-compatible model catalog with DeepInfra-hosted models
- **API Key Required**: `DEEPINFRA_API_KEY`
- **Header**: `Authorization: Bearer {token}`

### 5. Chutes.ai
- **API Endpoint**: Static catalog from `src/data/chutes_catalog.json`
- **Features**: Multi-modal model catalog (LLM, Image Generation, TTS, STT, Video, Music)
- **API Key Required**: `CHUTES_API_KEY` (optional, uses static catalog by default)

## API Endpoint

### GET `/catalog/model/{provider_name}/{model_name}`

Fetch specific model data from any supported gateway.

#### Path Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `provider_name` | string | Provider/developer name (e.g., 'openai', 'anthropic', 'meta-llama') | Yes |
| `model_name` | string | Model identifier (e.g., 'gpt-4', 'claude-3', 'llama-3.1-8b') | Yes |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `gateway` | string | Auto-detect | Gateway to use: 'openrouter', 'portkey', 'featherless', 'deepinfra', 'chutes' |
| `include_huggingface` | boolean | true | Include HuggingFace metrics if model has `hugging_face_id` |

#### Response Schema

```json
{
  "data": {
    "id": "string",
    "slug": "string",
    "canonical_slug": "string",
    "name": "string",
    "description": "string",
    "context_length": "number",
    "architecture": {
      "modality": "string",
      "input_modalities": ["string"],
      "output_modalities": ["string"],
      "tokenizer": "string",
      "instruct_type": "string"
    },
    "pricing": {
      "prompt": "string",
      "completion": "string",
      "request": "string",
      "image": "string"
    },
    "provider_slug": "string",
    "provider_site_url": "string",
    "model_logo_url": "string",
    "source_gateway": "string",
    "huggingface_metrics": {
      "downloads": "number",
      "likes": "number",
      "pipeline_tag": "string"
    }
  },
  "provider": "string",
  "model": "string",
  "gateway": "string",
  "include_huggingface": "boolean",
  "timestamp": "string"
}
```

## Usage Examples

### Example 1: Auto-detect Gateway
```bash
# Automatically detects which gateway has this model
curl -X GET "https://api.yourdomain.com/catalog/model/openai/gpt-4" \
  -H "accept: application/json"
```

### Example 2: Specify OpenRouter Gateway
```bash
# Fetch from OpenRouter with full endpoint data
curl -X GET "https://api.yourdomain.com/catalog/model/openai/gpt-4?gateway=openrouter" \
  -H "accept: application/json"
```

### Example 3: Fetch from Portkey
```bash
# Fetch from Portkey catalog
curl -X GET "https://api.yourdomain.com/catalog/model/anthropic/claude-3-opus?gateway=portkey" \
  -H "accept: application/json"
```

### Example 4: Fetch from Featherless
```bash
# Fetch from Featherless catalog
curl -X GET "https://api.yourdomain.com/catalog/model/meta-llama/llama-3.1-8b?gateway=featherless" \
  -H "accept: application/json"
```

### Example 5: Fetch from DeepInfra
```bash
# Fetch from DeepInfra catalog
curl -X GET "https://api.yourdomain.com/catalog/model/meta-llama/Meta-Llama-3.1-8B-Instruct?gateway=deepinfra" \
  -H "accept: application/json"
```

### Example 6: Fetch from Chutes
```bash
# Fetch from Chutes catalog
curl -X GET "https://api.yourdomain.com/catalog/model/stability-ai/sdxl?gateway=chutes" \
  -H "accept: application/json"
```

### Example 7: Disable HuggingFace Metrics
```bash
# Fetch without HuggingFace enhancement
curl -X GET "https://api.yourdomain.com/catalog/model/openai/gpt-4?include_huggingface=false" \
  -H "accept: application/json"
```

## Gateway Auto-Detection

When the `gateway` parameter is not specified, the system automatically detects which gateway the model belongs to by:

1. Searching through cached models from all gateways
2. Matching the model ID (`provider_name/model_name`)
3. Returning data from the first gateway that has the model
4. Defaulting to OpenRouter if not found in any cache

## Model Data Enhancement

The endpoint enhances raw model data with:

1. **Provider Information**: Adds provider slug, site URL, and logo URL
2. **HuggingFace Metrics**: Adds download counts, likes, and other metrics (if available)
3. **Cross-Gateway Pricing**: For Portkey models, attempts to cross-reference OpenRouter pricing
4. **Normalized Schema**: Ensures consistent response format across all gateways

## Client Service Architecture

Each provider has a dedicated client service:

- `src/services/openrouter_client.py` - OpenRouter API integration
- `src/services/portkey_client.py` - Portkey API integration
- `src/services/featherless_client.py` - Featherless API integration
- `src/services/deepinfra_client.py` - DeepInfra API integration (NEW)
- `src/services/chutes_client.py` - Chutes.ai API integration (NEW)

## Model Fetching Functions

Located in `src/services/models.py`:

- `fetch_specific_model(provider_name, model_name, gateway)` - Main entry point
- `detect_model_gateway(provider_name, model_name)` - Auto-detection logic
- `fetch_specific_model_from_openrouter()` - OpenRouter-specific fetching
- `fetch_specific_model_from_portkey()` - Portkey-specific fetching
- `fetch_specific_model_from_featherless()` - Featherless-specific fetching
- `fetch_specific_model_from_deepinfra()` - DeepInfra-specific fetching (NEW)
- `fetch_specific_model_from_chutes()` - Chutes-specific fetching (NEW)

## Error Handling

The endpoint handles various error scenarios:

1. **Model Not Found (404)**: When model doesn't exist in specified gateway
2. **Gateway Unavailable (503)**: When gateway API is unreachable
3. **Invalid Gateway**: Defaults to OpenRouter with warning log
4. **API Key Missing**: Returns configuration error
5. **Network Errors**: Gracefully handles timeouts and connection issues

## Caching Strategy

- Models are cached per gateway with configurable TTL
- Cache is automatically refreshed when expired
- Fresh data is fetched if model not found in cache
- HuggingFace data is cached separately by model ID

## Environment Variables Required

```env
# Required for OpenRouter
OPENROUTER_API_KEY=your_openrouter_key

# Required for Portkey
PORTKEY_API_KEY=your_portkey_key

# Required for Featherless
FEATHERLESS_API_KEY=your_featherless_key

# Required for DeepInfra
DEEPINFRA_API_KEY=your_deepinfra_key

# Optional for Chutes (uses static catalog if not set)
CHUTES_API_KEY=your_chutes_key
```

## Testing

Test the endpoint with different providers:

```bash
# Test OpenRouter
curl "http://localhost:8000/catalog/model/openai/gpt-4?gateway=openrouter"

# Test Portkey
curl "http://localhost:8000/catalog/model/anthropic/claude-3?gateway=portkey"

# Test Featherless
curl "http://localhost:8000/catalog/model/meta-llama/llama-3?gateway=featherless"

# Test DeepInfra
curl "http://localhost:8000/catalog/model/meta-llama/Meta-Llama-3.1-8B-Instruct?gateway=deepinfra"

# Test Chutes
curl "http://localhost:8000/catalog/model/stability-ai/sdxl?gateway=chutes"

# Test auto-detection
curl "http://localhost:8000/catalog/model/openai/gpt-4"
```

## Performance Considerations

1. **Caching**: Models are cached to reduce API calls
2. **Auto-detection**: Searches caches sequentially (OpenRouter → Portkey → Featherless → Chutes)
3. **Provider Enhancement**: Cross-references multiple provider data sources
4. **HuggingFace**: Optional enhancement reduces response time when disabled

## Migration Notes

### Breaking Changes
- Endpoint now requires `/catalog` prefix: `/catalog/model/{provider}/{model}`
- Response includes new `gateway` field indicating data source

### Backward Compatibility
- Existing OpenRouter requests work without changes
- Default behavior (no gateway specified) auto-detects gateway
- Response schema is backward compatible with additional fields

## Future Enhancements

Potential improvements for future releases:

1. **Caching API**: Dedicated cache management endpoints
2. **Provider Weights**: Prioritize certain gateways in auto-detection
3. **Fallback Chain**: Try multiple gateways if primary fails
4. **Model Comparison**: Compare same model across different gateways
5. **Real-time Pricing**: Live pricing updates from provider APIs
6. **Performance Metrics**: Track latency and availability per gateway

## Support

For issues or questions:
- Check logs for detailed error messages
- Verify API keys are correctly configured
- Ensure gateway-specific endpoints are accessible
- Review provider-specific API documentation

