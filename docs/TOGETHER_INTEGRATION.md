# Together.ai Integration

This document describes the integration of Together.ai as a model provider in the Gatewayz backend.

## Overview

Together.ai is an AI inference platform that provides access to various AI models through an OpenAI-compatible API. The integration supports 100+ models including DeepSeek v3.1, Llama models, and more.

## Configuration

### Environment Variables

Add your Together API key to the `.env` file:

```env
TOGETHER_API_KEY=tgp_v1_your_api_key_here
```

The API key can be obtained from [Together.ai](https://api.together.xyz).

### Example Configuration

```env
# Together.ai Configuration
TOGETHER_API_KEY=tgp_v1_QATbNpiLZItdUCEf7OBk5qBTLY-wX9p5_If4jIN9vnM
```

## API Endpoints

### Base URL
```
https://api.together.xyz/v1
```

### Supported Endpoints
- `/models` - List available models (returns plain array)
- `/chat/completions` - Chat completion requests

## Usage

### Direct API Call

```bash
curl -X POST "https://api.together.xyz/v1/chat/completions" \
  -H "Authorization: Bearer $TOGETHER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-ai/DeepSeek-V3.1",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
  }'
```

### Through Gatewayz Gateway

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_gatewayz_api_key" \
  -d '{
    "model": "deepseek-ai/DeepSeek-V3.1",
    "provider": "together",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Streaming Response

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_gatewayz_api_key" \
  -d '{
    "model": "deepseek-ai/DeepSeek-V3.1",
    "provider": "together",
    "messages": [
      {"role": "user", "content": "Write a story"}
    ],
    "stream": true
  }'
```

## Model Catalog

### Fetching Together Models

```bash
# Get all Together models
curl http://localhost:8000/catalog/models?gateway=together

# Get specific model
curl http://localhost:8000/catalog/model/deepseek-ai/DeepSeek-V3.1?gateway=together
```

### Auto-Detection

The gateway will automatically detect when a model belongs to Together based on the model catalog:

```bash
# Provider parameter is optional if model is in Together catalog
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_gatewayz_api_key" \
  -d '{
    "model": "deepseek-ai/DeepSeek-V3.1",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Available Models (100+)

Together.ai provides access to various model types:

- **Chat Models**: DeepSeek v3.1, Llama 3.x, Mistral, Qwen, etc.
- **Image Models**: FLUX, Stable Diffusion
- **Audio Models**: Cartesia Sonic
- **Code Models**: Qwen Coder, DeepSeek Coder
- **Embedding Models**: Various embedding models

To see the complete list:

```bash
curl http://localhost:8000/catalog/models?gateway=together
```

## Features

### Supported Parameters

Together supports standard OpenAI parameters:
- `model` - Model identifier
- `messages` - Array of message objects
- `max_tokens` - Maximum tokens to generate
- `temperature` - Sampling temperature
- `top_p` - Nucleus sampling parameter
- `stream` - Enable streaming responses

### Streaming Support

Both regular and streaming responses are fully supported:

```python
from src.services.together_client import make_together_request_openai_stream

messages = [{"role": "user", "content": "Hello"}]
stream = make_together_request_openai_stream(messages, "deepseek-ai/DeepSeek-V3.1")

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### Pricing

Together.ai provides pricing information in the model catalog:
- Input pricing (per token)
- Output pricing (per token)
- Hourly rates for some models

The pricing is automatically extracted and normalized to the standard format.

## Implementation Details

### Client Service

The Together client is implemented in [`src/services/together_client.py`](../src/services/together_client.py) and provides:

- `get_together_client()` - Initialize OpenAI-compatible client
- `make_together_request_openai()` - Non-streaming requests
- `make_together_request_openai_stream()` - Streaming requests
- `process_together_response()` - Response normalization

### Model Catalog Integration

Together models are integrated into the catalog system in [`src/services/models.py`](../src/services/models.py):

- `fetch_models_from_together()` - Fetch model list from Together API
- `normalize_together_model()` - Normalize to standard format
- `fetch_specific_model_from_together()` - Fetch specific model details

**Important**: Together.ai returns models as a plain array, not wrapped in `{data: [...]}` like most other providers. The fetch function handles both formats.

### Caching

Model data is cached for 30 minutes (1800 seconds):

```python
_together_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800  # 30 minute TTL for Together catalog
}
```

## Error Handling

The integration includes comprehensive error handling:

- **401/403** - Authentication errors (invalid API key)
- **429** - Rate limiting
- **404** - Model not found
- **500+** - Upstream service errors

## Testing

### Unit Tests

Run the Together client tests:

```bash
pytest tests/services/test_together_client.py -v
```

### Integration Testing

Test the complete integration:

```bash
# Test model listing
curl http://localhost:8000/catalog/models?gateway=together

# Test chat completion
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "model": "deepseek-ai/DeepSeek-V3.1",
    "provider": "together",
    "messages": [{"role": "user", "content": "Test"}]
  }'
```

## Server Restart Required

**Important**: After adding Together.ai integration, restart the server to load the new provider:

```bash
# Stop the server (Ctrl+C if running in foreground)
# Then restart:
uvicorn src.main:app --reload
```

Or if using the start script:
```bash
./start.sh
```

## Monitoring

Usage through Together is tracked in the activity logs with:
- Gateway: `together`
- Model: Full model identifier
- Tokens used
- Cost (if available from Together pricing data)
- Speed metrics

Query logs:

```bash
curl http://localhost:8000/catalog/gateway/together/stats?time_range=24h
```

## Troubleshooting

### Common Issues

1. **"Together API key not configured"**
   - Ensure `TOGETHER_API_KEY` is set in your `.env` file
   - Restart the server after adding the key

2. **"Models data unavailable" (503 error)**
   - Server needs to be restarted to load the new provider
   - Check that the API key is valid
   - Verify network connectivity to Together.ai

3. **Model not found**
   - Verify the model ID is correct
   - Check available models: `curl http://localhost:8000/catalog/models?gateway=together`

4. **Authentication errors**
   - Verify your API key is valid
   - Check if the key has the correct prefix (`tgp_v1_`)

## Best Practices

1. **API Key Security**
   - Never commit API keys to version control
   - Use environment variables
   - Rotate keys periodically

2. **Model Selection**
   - Choose models based on your use case
   - Consider pricing differences
   - Check context length requirements

3. **Error Handling**
   - Implement retry logic for transient failures
   - Handle rate limiting gracefully
   - Log errors for debugging

4. **Performance**
   - Use streaming for long responses
   - Cache model lists (30-minute TTL)
   - Monitor response times

## Resources

- [Together.ai Documentation](https://docs.together.ai/)
- [Together.ai Models](https://api.together.xyz/models)
- [OpenAI API Compatibility](https://docs.together.ai/docs/openai-api-compatibility)

## Support

For issues specific to the Gatewayz integration:
- Check the [troubleshooting section](#troubleshooting)
- Review logs in the application
- File an issue in the repository

For Together.ai specific questions:
- Visit [Together.ai Docs](https://docs.together.ai/)