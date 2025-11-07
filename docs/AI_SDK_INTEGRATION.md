# Vercel AI SDK Integration

## Overview

This document describes the integration of Vercel AI SDK support with the Gatewayz Universal Inference API. The integration provides a dedicated endpoint for AI SDK-compatible requests, routing them through our OpenRouter integration for model execution.

## What is the Vercel AI SDK?

The [Vercel AI SDK](https://ai-sdk.dev/) is a TypeScript/JavaScript toolkit for building AI-powered applications. It provides:

- **Unified Interface**: Single API for accessing models from multiple providers
- **Framework Support**: Works with React, Next.js, Vue, Svelte, Node.js, and more
- **Features**: Chat completions, structured data generation, tool calling, streaming, and more
- **Provider Agnostic**: Supports OpenAI, Anthropic, Google, xAI, and 15+ others

Since the Vercel AI SDK is primarily a TypeScript/JavaScript library, this Python backend provides compatibility through a dedicated endpoint.

## Architecture

### Request Flow

```
┌─────────────────────┐
│  AI SDK Client      │
│  (TypeScript/JS)    │
└──────────┬──────────┘
           │ POST /api/chat/ai-sdk
           ▼
┌──────────────────────────────────┐
│  Gatewayz API Gateway (Python)   │
├──────────────────────────────────┤
│ Route: /api/chat/ai-sdk          │
│ Handler: routes/ai_sdk.py        │
│ Service: services/ai_sdk_client  │
└──────────┬───────────────────────┘
           │ OpenAI-compatible request
           ▼
┌──────────────────────────────────┐
│  Vercel AI Gateway               │
│  Base URL: ai-gateway.vercel.sh  │
│  Official unified AI platform    │
└──────────┬───────────────────────┘
           │ Model inference
           ▼
┌──────────────────────────────────┐
│  AI Model Providers              │
│  - OpenAI (GPT-5, GPT-4o)        │
│  - Anthropic (Claude)            │
│  - Google (Gemini)               │
│  - xAI (Grok)                    │
│  - Meta (Llama)                  │
│  - DeepSeek, Mistral, and more   │
└──────────────────────────────────┘
```

## Endpoint

### POST /api/chat/ai-sdk

**Description**: AI SDK-compatible chat completion endpoint

**URL**: `https://api.gatewayz.ai/api/chat/ai-sdk`

**Authentication**: Via `AI_SDK_API_KEY` environment variable (backend configuration)

### Request Format

```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how can you help me?"
    }
  ],
  "max_tokens": 1024,
  "temperature": 0.7,
  "top_p": 0.9,
  "frequency_penalty": 0,
  "presence_penalty": 0,
  "stream": false
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model identifier (e.g., "gpt-4", "claude-3-opus") |
| `messages` | array | Yes | Array of message objects with `role` and `content` |
| `max_tokens` | integer | No | Maximum tokens to generate (1-4096) |
| `temperature` | number | No | Sampling temperature (0.0-2.0), default 1.0 |
| `top_p` | number | No | Top-p sampling (0.0-1.0) |
| `frequency_penalty` | number | No | Frequency penalty (-2.0 to 2.0) |
| `presence_penalty` | number | No | Presence penalty (-2.0 to 2.0) |
| `stream` | boolean | No | Enable streaming response, default false |

### Response Format (Non-Streaming)

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "I'd be happy to help! What would you like assistance with?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 18,
    "total_tokens": 33
  }
}
```

### Response Format (Streaming)

Streaming responses use Server-Sent Events (SSE) format:

```
data: {"choices":[{"delta":{"role":"assistant","content":"I"}}]}

data: {"choices":[{"delta":{"role":"assistant","content":"'d"}}]}

data: {"choices":[{"delta":{"role":"assistant","content":" be"}}]}

...

data: {"choices":[{"finish_reason":"stop"}]}

data: [DONE]
```

## Configuration

### Environment Variables

**Required**:
- `AI_SDK_API_KEY`: Your Vercel AI Gateway API key for model access

**How to Get Your API Key**:
1. Go to https://vercel.com/ai-gateway
2. Sign up or log in to your Vercel account
3. Create a new AI Gateway project
4. Generate an API key
5. Use this key as your `AI_SDK_API_KEY`

**Optional**:
- Set in your deployment environment (Railway, Vercel, Docker, etc.)

### Examples

#### Local Development
```bash
export AI_SDK_API_KEY="your-vercel-ai-gateway-key"
python src/main.py
```

#### Railway
Add environment variable in Railway dashboard:
```
AI_SDK_API_KEY=your-vercel-ai-gateway-key
```

#### Vercel
Add to `vercel.json` or environment variables:
```json
{
  "env": {
    "AI_SDK_API_KEY": "@ai_sdk_api_key"
  }
}
```

#### Docker
```dockerfile
ENV AI_SDK_API_KEY=your-vercel-ai-gateway-key
```

#### .env File
```bash
AI_SDK_API_KEY=your-vercel-ai-gateway-key
```

## Usage Examples

### Python Backend Example

```python
import httpx
import asyncio

async def chat_with_ai_sdk():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.gatewayz.ai/api/chat/ai-sdk",
            json={
                "model": "openai/gpt-5",  # Use Vercel AI Gateway model format
                "messages": [
                    {"role": "user", "content": "Explain quantum computing"}
                ],
                "max_tokens": 500,
                "temperature": 0.7
            }
        )

        result = response.json()
        print(result["choices"][0]["message"]["content"])

asyncio.run(chat_with_ai_sdk())
```

### Node.js/TypeScript Example

You can use the Vercel AI SDK directly with the Vercel AI Gateway:

```typescript
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const client = createOpenAI({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.AI_SDK_API_KEY,
});

const { text } = await generateText({
  model: client('openai/gpt-5'),  // Use Vercel AI Gateway model format
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ],
});

console.log(text);
```

Or call the Gatewayz endpoint directly as a compatible fallback:

```typescript
const response = await fetch(
  'https://api.gatewayz.ai/api/chat/ai-sdk',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-5',  // Use Vercel AI Gateway model format
      messages: [
        { role: 'user', content: 'Explain quantum computing' }
      ],
      max_tokens: 500
    })
  }
);

const data = await response.json();
console.log(data.choices[0].message.content);
```

### Streaming Example

```python
import httpx
import json

def stream_chat():
    with httpx.stream(
        "POST",
        "https://api.gatewayz.ai/api/chat/ai-sdk",
        json={
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Tell a story"}],
            "stream": True
        }
    ) as response:
        for line in response.iter_lines():
            if line.startswith("data: "):
                data = json.loads(line[6:])
                if "delta" in data.get("choices", [{}])[0]:
                    print(data["choices"][0]["delta"]["content"], end="", flush=True)
```

## Supported Models

Through the Vercel AI Gateway integration, the following model categories are supported:

### OpenAI Models
- `openai/gpt-5`
- `openai/gpt-5-mini`
- `openai/gpt-4o`
- `openai/gpt-4-turbo`
- `openai/gpt-4-mini`
- And more OpenAI models

### Anthropic Models
- `anthropic/claude-haiku-4.5`
- `anthropic/claude-sonnet-4.5`
- `anthropic/claude-sonnet-4`
- `anthropic/claude-opus`
- And more Anthropic models

### Google Models
- `google/gemini-2.5-pro`
- `google/gemini-2.5-flash`
- `google/gemini-2.0-flash`
- And more Google models

### xAI Models
- `xai/grok-2-latest`
- `xai/grok-3`
- And more xAI models

### Meta Models
- `meta/llama-3.1-70b`
- `meta/llama-3.1-8b`
- And more Meta models

### Other Models
- DeepSeek models
- Mistral models
- Cohere models
- Perplexity models
- And more...

**Note**: Model format is `provider/model-name` (e.g., `openai/gpt-5`, `anthropic/claude-sonnet-4.5`)

For the complete, up-to-date list of available models, visit https://vercel.com/ai-gateway/models

## Error Handling

### Configuration Error (500)
```json
{
  "detail": "AI_SDK_API_KEY not configured"
}
```

**Fix**: Ensure `AI_SDK_API_KEY` environment variable is set.

### Invalid Request (422)
```json
{
  "detail": [
    {
      "loc": ["body", "messages"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Fix**: Ensure all required fields (`model`, `messages`) are provided.

### Model Not Found (400)
```json
{
  "detail": "Model not found in provider"
}
```

**Fix**: Check `/v1/catalog/models` for available models.

### API Error (500)
```json
{
  "detail": "Failed to process AI SDK request"
}
```

**Fix**: Check logs for detailed error information. May indicate provider API issues.

## Features

### ✅ Supported
- [x] Chat completions (non-streaming and streaming)
- [x] Multiple message roles (system, user, assistant)
- [x] Token counting (via usage field)
- [x] Temperature and top-p sampling
- [x] Frequency and presence penalties
- [x] Max tokens parameter
- [x] Server-Sent Events (SSE) streaming
- [x] Error handling with detailed messages

### 🔄 In Development
- [ ] Function calling / Tool use
- [ ] Vision/image support
- [ ] Embeddings endpoint
- [ ] Batch processing

### ❌ Not Supported (API SDK limitation)
- File uploads (use /v1/images for image generation instead)
- Fine-tuning (use provider directly)
- Organization-level API keys

## Implementation Details

### Files Modified/Created

1. **src/config/config.py**
   - Added `AI_SDK_API_KEY` configuration variable

2. **src/services/ai_sdk_client.py** (new)
   - Core AI SDK client implementation
   - OpenRouter integration
   - Request/response processing

3. **src/routes/ai_sdk.py** (new)
   - HTTP endpoint handler
   - Request validation
   - Streaming support
   - Error handling

4. **src/main.py**
   - Registered AI SDK route with app

5. **tests/routes/test_ai_sdk.py** (new)
   - Comprehensive test suite
   - Mocking and validation tests

### Design Decisions

1. **OpenRouter as Backend**: OpenRouter provides the widest selection of models and best compatibility with the OpenAI chat completion format
2. **Dedicated Endpoint**: Separate endpoint allows specific AI SDK handling and makes debugging easier
3. **Streaming Support**: Full streaming support via SSE for real-time responses
4. **Error Messages**: Detailed error messages help users quickly identify configuration issues

## Troubleshooting

### Issue: "AI_SDK_API_KEY not configured"
**Solution**: Ensure the environment variable is set in your deployment:
```bash
export AI_SDK_API_KEY="your-openrouter-api-key"
```

### Issue: 500 Error on Request
**Solution**: Check application logs for detailed error message. Common causes:
- Invalid API key
- Model not available through OpenRouter
- Network connectivity issues

### Issue: Streaming Not Working
**Solution**: Ensure `stream: true` is set in request and client supports Server-Sent Events.

## Performance Considerations

- **Latency**: Typically 1-5 seconds depending on model
- **Timeout**: Set to 60 seconds by default
- **Rate Limiting**: Depends on OpenRouter plan
- **Concurrency**: Unlimited concurrent requests (depends on backend)

## Security Notes

- The `AI_SDK_API_KEY` should never be exposed in frontend code
- Keep API key secret in environment variables
- Monitor usage regularly via the OpenRouter dashboard
- Consider rate limiting for public deployments

## Testing

Run the test suite:

```bash
# All AI SDK tests
pytest tests/routes/test_ai_sdk.py -v

# Specific test
pytest tests/routes/test_ai_sdk.py::TestAISDKEndpoint::test_ai_sdk_chat_completion_success -v

# With coverage
pytest tests/routes/test_ai_sdk.py --cov=src.routes.ai_sdk --cov=src.services.ai_sdk_client
```

## Related Documentation

- [Vercel AI Gateway](https://vercel.com/ai-gateway) - Official unified AI platform
- [Vercel AI Gateway Models](https://vercel.com/ai-gateway/models) - Complete model catalog
- [Vercel AI SDK Docs](https://ai-sdk.dev/docs) - TypeScript/JavaScript SDK documentation
- [AI Gateway Documentation](https://vercel.com/docs/ai-gateway) - Official API documentation
- [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat/create) - OpenAI API reference
- [Gatewayz API Documentation](./api.md) - Gatewayz API reference

## Support

For issues or questions:
1. Check the [troubleshooting](#troubleshooting) section above
2. Review application logs for error details
3. Verify environment variables are correctly set
4. Check OpenRouter provider status dashboard

---

**Last Updated**: November 2024
**Version**: 1.0
**Status**: Production Ready
