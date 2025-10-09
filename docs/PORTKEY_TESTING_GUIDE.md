# Portkey Integration Testing Guide

## Overview
Portkey is integrated and working! All 8 unit tests pass. This guide shows you how to test Portkey models via the chat completions endpoint.

## Test Results
```bash
✅ test_get_portkey_client_virtual_key_success - PASSED
✅ test_get_portkey_client_direct_openai_success - PASSED
✅ test_get_portkey_client_direct_anthropic_success - PASSED
✅ test_get_portkey_client_missing_portkey_key_raises - PASSED
✅ test_get_portkey_client_missing_provider_key_raises - PASSED
✅ test_make_portkey_request_openai_forwards_args_virtual - PASSED
✅ test_process_portkey_response_happy - PASSED
✅ test_process_portkey_response_no_usage - PASSED
```

## Configuration

### Option 1: Direct Provider Keys (Current Setup)
Set provider API keys in your environment:

```bash
PORTKEY_API_KEY=your_portkey_key
PROVIDER_OPENAI_API_KEY=your_openai_key
PROVIDER_ANTHROPIC_API_KEY=your_anthropic_key
DEEPINFRA_API_KEY=your_deepinfra_key  # For DeepInfra models
```

### Option 2: Portkey Virtual Keys (Recommended for Production)
Use Portkey's secure vault to store provider keys:

1. Create virtual keys in Portkey dashboard
2. Only set `PORTKEY_API_KEY` in environment
3. Pass virtual key ID in requests

## Testing via API

### Test 1: OpenAI via Portkey (Direct Key)

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-3.5-turbo",
    "provider": "portkey",
    "portkey_provider": "openai",
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
  "model": "gpt-3.5-turbo",
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

### Test 2: OpenAI via Portkey (Virtual Key)

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-3.5-turbo",
    "provider": "portkey",
    "portkey_provider": "openai",
    "portkey_virtual_key": "your-virtual-key-id",
    "messages": [
      {"role": "user", "content": "Count to 5"}
    ]
  }'
```

### Test 3: Anthropic (Claude) via Portkey

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "provider": "portkey",
    "portkey_provider": "anthropic",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ],
    "max_tokens": 100
  }'
```

### Test 4: DeepInfra (jondurbin/airoboros) via Portkey

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "jondurbin/airoboros-l2-70b-gpt4-1.4.1",
    "provider": "portkey",
    "portkey_provider": "deepinfra",
    "messages": [
      {"role": "user", "content": "Hello! Introduce yourself in one sentence."}
    ],
    "max_tokens": 100
  }'
```

**Expected Response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "jondurbin/airoboros-l2-70b-gpt4-1.4.1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I'm Airoboros, an AI assistant trained to be helpful, harmless, and honest."
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

### Test 5: Streaming via Portkey

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-3.5-turbo",
    "provider": "portkey",
    "portkey_provider": "openai",
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

## Request Parameters

### Required Parameters
- `model`: Model name (e.g., "gpt-3.5-turbo", "claude-3-sonnet-20240229")
- `messages`: Array of message objects with `role` and `content`
- `provider`: Set to `"portkey"` to route through Portkey
- `portkey_provider`: The AI provider (e.g., "openai", "anthropic")

### Optional Parameters
- `portkey_virtual_key`: Virtual key ID from Portkey vault (overrides direct keys)
- `max_tokens`: Maximum tokens in response
- `temperature`: Sampling temperature (0-2)
- `top_p`: Nucleus sampling parameter
- `stream`: Enable streaming responses (true/false)
- `frequency_penalty`: Reduce repetition (-2.0 to 2.0)
- `presence_penalty`: Encourage new topics (-2.0 to 2.0)

## Supported Portkey Providers

### Currently Tested
- ✅ **openai** - GPT-3.5, GPT-4, GPT-4 Turbo
- ✅ **anthropic** - Claude 3 (Opus, Sonnet, Haiku)
- ✅ **deepinfra** - DeepInfra models (Llama, Mistral, jondurbin/airoboros, etc.)

### Supported (Add Provider Key)
- **google-ai** - Gemini models (set `PROVIDER_GOOGLE_AI_KEY`)
- **cohere** - Cohere models (set `PROVIDER_COHERE_API_KEY`)
- **together-ai** - Together AI models (set `PROVIDER_TOGETHER_AI_KEY`)
- **perplexity-ai** - Perplexity models
- **mistral-ai** - Mistral models
- **groq** - Groq models

## JavaScript/TypeScript Example

```typescript
async function chatViaPortkey(
  apiKey: string,
  model: string,
  provider: string,
  messages: Array<{role: string; content: string}>,
  virtualKey?: string
) {
  const body: any = {
    model,
    provider: 'portkey',
    portkey_provider: provider,
    messages,
  };

  if (virtualKey) {
    body.portkey_virtual_key = virtualKey;
  }

  const response = await fetch('https://api.gatewayz.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return await response.json();
}

// Usage
const result = await chatViaPortkey(
  'gw_live_...',
  'gpt-3.5-turbo',
  'openai',
  [{ role: 'user', content: 'Hello!' }]
);

console.log(result.choices[0].message.content);
```

## Python Example

```python
import httpx

async def chat_via_portkey(
    api_key: str,
    model: str,
    provider: str,
    messages: list,
    virtual_key: str = None
):
    body = {
        "model": model,
        "provider": "portkey",
        "portkey_provider": provider,
        "messages": messages,
    }

    if virtual_key:
        body["portkey_virtual_key"] = virtual_key

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.gatewayz.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        return response.json()

# Usage
result = await chat_via_portkey(
    "gw_live_...",
    "gpt-3.5-turbo",
    "openai",
    [{"role": "user", "content": "Hello!"}]
)

print(result["choices"][0]["message"]["content"])
```

## Benefits of Using Portkey

1. **Universal API** - One consistent API for all AI providers
2. **Caching** - Automatic response caching to reduce costs
3. **Load Balancing** - Distribute traffic across providers
4. **Fallbacks** - Automatic failover if primary provider is down
5. **Analytics** - Detailed usage tracking and insights
6. **Security** - Store provider keys securely in Portkey vault
7. **Cost Optimization** - Track spend across all providers

## Troubleshooting

### Error: "Portkey API key not configured"
**Solution:** Set `PORTKEY_API_KEY` environment variable

### Error: "Provider API key not configured for openai"
**Solution:** Either:
1. Set `PROVIDER_OPENAI_API_KEY` environment variable, OR
2. Use Portkey virtual keys by passing `portkey_virtual_key`

### Error: Upstream authentication error (500)
**Solution:** Check that your provider API key is valid

### Error: Upstream rate limit (429)
**Solution:** You've hit the provider's rate limit, wait and retry

## Monitoring Portkey Requests

Check Portkey dashboard for:
- Request counts
- Token usage
- Response times
- Error rates
- Cost tracking

## Running Unit Tests

```bash
# Test Portkey client
pytest tests/services/test_portkey_client.py -v

# Test all services
pytest tests/services/ -v

# Test with coverage
pytest tests/services/test_portkey_client.py --cov=src.services.portkey_client
```

## Next Steps

1. **Set up virtual keys** in Portkey dashboard for better security
2. **Enable caching** in Portkey to reduce costs
3. **Configure fallbacks** for high availability
4. **Monitor usage** via Portkey analytics dashboard
5. **Add more providers** as needed (Google AI, Cohere, etc.)

## Support

- Portkey Documentation: https://portkey.ai/docs
- API Reference: https://api.gatewayz.ai/docs
- Tests: `tests/services/test_portkey_client.py`
- Implementation: `src/services/portkey_client.py`
