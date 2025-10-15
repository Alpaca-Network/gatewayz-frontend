# Fireworks.ai Integration

This document describes the integration of Fireworks.ai as a model provider in the Gatewayz backend.

## Overview

Fireworks.ai is a fast inference platform that provides access to various AI models. The integration follows the same pattern as other providers (Featherless, DeepInfra, Chutes) by utilizing the OpenAI-compatible API interface.

## Configuration

### Environment Variables

Add your Fireworks API key to the `.env` file:

```env
FIREWORKS_API_KEY=fw_your_api_key_here
```

The API key can be obtained from [Fireworks.ai](https://fireworks.ai).

### Example Configuration

```env
# Fireworks Configuration
FIREWORKS_API_KEY=fw_3ZeXf1gzksiisA9c29eKcprp
```

## API Endpoints

### Base URL
```
https://api.fireworks.ai/inference/v1
```

### Supported Endpoints
- `/models` - List available models
- `/chat/completions` - Chat completion requests

## Usage

### Direct API Call

```bash
curl --request POST \
  --url https://api.fireworks.ai/inference/v1/chat/completions \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer fw_your_api_key_here' \
  --data '{
    "model": "accounts/fireworks/models/deepseek-v3p1",
    "max_tokens": 20480,
    "top_p": 1,
    "top_k": 40,
    "presence_penalty": 0,
    "frequency_penalty": 0,
    "temperature": 0.6,
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
    "model": "accounts/fireworks/models/deepseek-v3p1",
    "provider": "fireworks",
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
    "model": "accounts/fireworks/models/deepseek-v3p1",
    "provider": "fireworks",
    "messages": [
      {"role": "user", "content": "Write a story"}
    ],
    "stream": true
  }'
```

## Model Catalog

### Fetching Fireworks Models

```bash
# Get all Fireworks models
curl http://localhost:8000/api/catalog/models?gateway=fireworks

# Get specific model
curl http://localhost:8000/api/catalog/model/accounts/fireworks/deepseek-v3p1?gateway=fireworks
```

### Auto-Detection

The gateway will automatically detect when a model belongs to Fireworks based on the model catalog:

```bash
# Provider parameter is optional if model is in Fireworks catalog
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_gatewayz_api_key" \
  -d '{
    "model": "accounts/fireworks/models/deepseek-v3p1",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Features

### Supported Parameters

Fireworks supports the following parameters:
- `model` - Model identifier
- `messages` - Array of message objects
- `max_tokens` - Maximum tokens to generate
- `temperature` - Sampling temperature (0.0 to 2.0)
- `top_p` - Nucleus sampling parameter
- `top_k` - Top-k sampling parameter
- `presence_penalty` - Presence penalty
- `frequency_penalty` - Frequency penalty
- `stream` - Enable streaming responses

### Streaming Support

Both regular and streaming responses are fully supported:

```python
from src.services.fireworks_client import make_fireworks_request_openai_stream

messages = [{"role": "user", "content": "Hello"}]
stream = make_fireworks_request_openai_stream(messages, "accounts/fireworks/models/deepseek-v3p1")

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

## Implementation Details

### Client Service

The Fireworks client is implemented in [`src/services/fireworks_client.py`](../src/services/fireworks_client.py) and provides:

- `get_fireworks_client()` - Initialize OpenAI-compatible client
- `make_fireworks_request_openai()` - Non-streaming requests
- `make_fireworks_request_openai_stream()` - Streaming requests
- `process_fireworks_response()` - Response normalization

### Model Catalog Integration

Fireworks models are integrated into the catalog system in [`src/services/models.py`](../src/services/models.py):

- `fetch_models_from_fireworks()` - Fetch model list from Fireworks API
- `normalize_fireworks_model()` - Normalize to standard format
- `fetch_specific_model_from_fireworks()` - Fetch specific model details

### Caching

Model data is cached for 30 minutes (1800 seconds) to reduce API calls:

```python
_fireworks_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 1800  # 30 minute TTL for Fireworks catalog
}
```

## Available Models

Fireworks provides access to various models including:

- DeepSeek v3.1
- Llama models
- Mixtral models
- And many more

To see the complete list of available models:

```bash
curl http://localhost:8000/api/catalog/models?gateway=fireworks
```

## Error Handling

The integration includes comprehensive error handling:

- **401/403** - Authentication errors (invalid API key)
- **429** - Rate limiting
- **404** - Model not found
- **500+** - Upstream service errors

Example error response:

```json
{
  "error": {
    "message": "Fireworks API key not configured",
    "type": "configuration_error"
  }
}
```

## Testing

### Unit Tests

Run the Fireworks client tests:

```bash
pytest tests/services/test_fireworks_client.py -v
```

### Integration Testing

Test the complete integration:

```bash
# Test model listing
curl http://localhost:8000/api/catalog/models?gateway=fireworks

# Test chat completion
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "model": "accounts/fireworks/models/deepseek-v3p1",
    "provider": "fireworks",
    "messages": [{"role": "user", "content": "Test"}]
  }'
```

## Monitoring

Usage through Fireworks is tracked in the activity logs with:
- Gateway: `fireworks`
- Model: Full model identifier
- Tokens used
- Cost (if available)
- Speed metrics

Query logs:

```bash
curl http://localhost:8000/api/catalog/gateway/fireworks/stats?time_range=24h
```

## Troubleshooting

### Common Issues

1. **"Fireworks API key not configured"**
   - Ensure `FIREWORKS_API_KEY` is set in your `.env` file
   - Restart the server after adding the key

2. **"Model not found"**
   - Verify the model ID is correct
   - Check available models: `curl http://localhost:8000/api/catalog/models?gateway=fireworks`

3. **Authentication errors**
   - Verify your API key is valid
   - Check if the key has the correct prefix (`fw_`)

4. **Rate limiting**
   - Fireworks has rate limits; implement backoff strategies
   - Check your plan limits on the Fireworks dashboard

## Best Practices

1. **API Key Security**
   - Never commit API keys to version control
   - Use environment variables
   - Rotate keys periodically

2. **Model Selection**
   - Choose models based on your use case
   - Consider context length requirements
   - Check pricing for different models

3. **Error Handling**
   - Implement retry logic for transient failures
   - Handle rate limiting gracefully
   - Log errors for debugging

4. **Performance**
   - Use streaming for long responses
   - Cache model lists when possible
   - Monitor response times

## Resources

- [Fireworks.ai Documentation](https://docs.fireworks.ai/)
- [Fireworks.ai Models](https://fireworks.ai/models)
- [OpenAI API Compatibility](https://docs.fireworks.ai/api-reference/introduction)

## Support

For issues specific to the Gatewayz integration:
- Check the [troubleshooting section](#troubleshooting)
- Review logs in the application
- File an issue in the repository

For Fireworks.ai specific questions:
- Visit [Fireworks.ai Support](https://fireworks.ai/support)
- Check their documentation