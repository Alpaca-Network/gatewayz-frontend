# Featherless.ai Integration Guide

## Overview
Featherless.ai is now integrated as a provider in Gatewayz! The integration uses OpenAI-compatible API endpoints for seamless compatibility.

## Integration Status
✅ **Fully Integrated** - Client initialized successfully and API connection verified

## Configuration

### Required Environment Variable
Add to your `.env` file:
```bash
FEATHERLESS_API_KEY=your_featherless_api_key
```

### API Key Requirements
⚠️ **Important**: Featherless.ai API keys require a subscription plan with API access enabled. Free tier keys may not have API access.

To upgrade your Featherless.ai plan:
1. Visit https://featherless.ai
2. Navigate to your account settings
3. Upgrade to a plan that includes API access

## Testing via API

### Non-Streaming Request

```bash
curl -X POST 'http://localhost:8000/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "provider": "featherless",
    "messages": [
      {"role": "user", "content": "Say hello in 5 words"}
    ],
    "max_tokens": 50
  }'
```

**Expected Response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello there, how are you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

### Streaming Request

```bash
curl -X POST 'http://localhost:8000/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "provider": "featherless",
    "messages": [
      {"role": "user", "content": "Write a haiku about code"}
    ],
    "stream": true
  }'
```

**Expected Response:**
```
data: {"id":"...","choices":[{"delta":{"role":"assistant"}...}]}

data: {"id":"...","choices":[{"delta":{"content":"Code"}...}]}

data: {"id":"...","choices":[{"delta":{"content":" flows"}...}]}

...

data: [DONE]
```

## Available Models

Featherless.ai supports a variety of open-source models. Popular options include:

### Meta Llama Models
- `meta-llama/Meta-Llama-3.1-8B-Instruct`
- `meta-llama/Meta-Llama-3.1-70B-Instruct`
- `meta-llama/Meta-Llama-3.1-405B-Instruct`
- `meta-llama/Llama-2-7b-chat-hf`
- `meta-llama/Llama-2-13b-chat-hf`
- `meta-llama/Llama-2-70b-chat-hf`

### Mistral Models
- `mistralai/Mistral-7B-Instruct-v0.2`
- `mistralai/Mixtral-8x7B-Instruct-v0.1`
- `mistralai/Mixtral-8x22B-Instruct-v0.1`

### Other Popular Models
- `Qwen/Qwen2.5-72B-Instruct`
- `Qwen/Qwen2.5-Coder-32B-Instruct`
- `google/gemma-2-9b-it`
- `google/gemma-2-27b-it`

Check https://featherless.ai/models for the complete list of available models.

## Request Parameters

### Required Parameters
- `model`: Model name (e.g., "meta-llama/Meta-Llama-3.1-8B-Instruct")
- `messages`: Array of message objects with `role` and `content`
- `provider`: Set to `"featherless"` to route through Featherless

### Optional Parameters
- `max_tokens`: Maximum tokens in response
- `temperature`: Sampling temperature (0-2)
- `top_p`: Nucleus sampling parameter
- `stream`: Enable streaming responses (true/false)
- `frequency_penalty`: Reduce repetition (-2.0 to 2.0)
- `presence_penalty`: Encourage new topics (-2.0 to 2.0)

## JavaScript/TypeScript Example

```typescript
async function chatViaFeatherless(
  apiKey: string,
  model: string,
  messages: Array<{role: string; content: string}>
) {
  const response = await fetch('http://localhost:8000/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      provider: 'featherless',
      messages,
    }),
  });

  return await response.json();
}

// Usage
const result = await chatViaFeatherless(
  'gw_live_...',
  'meta-llama/Meta-Llama-3.1-8B-Instruct',
  [{ role: 'user', content: 'Hello!' }]
);

console.log(result.choices[0].message.content);
```

## Python Example

```python
import httpx

async def chat_via_featherless(
    api_key: str,
    model: str,
    messages: list
):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "provider": "featherless",
                "messages": messages,
            },
        )
        return response.json()

# Usage
result = await chat_via_featherless(
    "gw_live_...",
    "meta-llama/Meta-Llama-3.1-8B-Instruct",
    [{"role": "user", "content": "Hello!"}]
)

print(result["choices"][0]["message"]["content"])
```

## Benefits of Using Featherless

1. **Open Source Models** - Access to the latest open-source LLMs
2. **Cost Effective** - Competitive pricing for model inference
3. **OpenAI Compatible** - Drop-in replacement for OpenAI API
4. **Multiple Models** - Wide selection of Llama, Mistral, Qwen, and more
5. **Unified Gateway** - Single API endpoint for all models through Gatewayz

## Troubleshooting

### Error: "Featherless API key not configured"
**Solution:** Set `FEATHERLESS_API_KEY` environment variable in your `.env` file

### Error: "The current subscription plan does not have API access enabled" (403)
**Solution:** Your Featherless.ai API key requires an upgraded subscription plan:
1. Visit https://featherless.ai
2. Log in to your account
3. Upgrade to a plan that includes API access
4. Use the new API key in your `.env` file

### Error: "Invalid model" or "Model not found"
**Solution:** Check https://featherless.ai/models for the current list of available models

### Error: Timeout (504)
**Solution:** Large models may take longer to respond. Consider:
- Using a smaller model
- Reducing max_tokens
- Increasing request timeout

## Implementation Files

### Core Files
- `src/services/featherless_client.py` - Featherless client implementation
- `src/config.py` - Configuration (FEATHERLESS_API_KEY)
- `src/routes/chat.py` - Chat routing with Featherless support

### Test Files
- `test_featherless_direct.py` - Direct integration test

## Direct Testing

To test the Featherless client directly (bypassing Gatewayz auth):

```bash
FEATHERLESS_API_KEY=your_key python3 test_featherless_direct.py
```

This will:
1. Initialize the Featherless client
2. Make a test chat completion request
3. Process and display the response
4. Report success or failure

## Next Steps

1. **Upgrade Featherless Plan** - Ensure your API key has API access enabled
2. **Test Integration** - Use the curl examples above to verify functionality
3. **Explore Models** - Try different Llama, Mistral, and Qwen models
4. **Monitor Usage** - Track usage through Featherless.ai dashboard
5. **Production Deployment** - Add FEATHERLESS_API_KEY to production environment

## Support

- Featherless.ai: https://featherless.ai
- API Documentation: http://localhost:8000/docs
- Model Catalog: https://featherless.ai/models
- Implementation: `src/services/featherless_client.py`

## Integration Complete! ✅

The Featherless.ai provider is now fully integrated and ready to use. Once you upgrade your Featherless subscription plan to include API access, you can start making requests to any of their supported models through the Gatewayz API.
