# v1/responses API - Unified Response Endpoint

## Overview

The `/v1/responses` endpoint is the **newer, unified API** introduced by OpenAI in 2024 as a successor to `/v1/chat/completions`. It provides a more flexible and future-proof interface for AI model interactions.

## Key Features

✅ **Unified Interface**: Single endpoint for chat, completions, and more
✅ **Structured Output**: Native support for `response_format` with JSON schemas
✅ **Multimodal Ready**: Built to handle text, images, audio, and more
✅ **Consistent Design**: Cleaner request/response structure
✅ **Future-Proof**: Designed for upcoming AI capabilities

## API Comparison

### Legacy `/v1/chat/completions` vs New `/v1/responses`

| Feature | `/v1/chat/completions` | `/v1/responses` |
|---------|------------------------|-----------------|
| **Status** | 🕰️ Legacy (still supported) | ✅ **Recommended** |
| **Input Field** | `messages` | `input` |
| **Output Field** | `choices` | `output` |
| **Response Object** | `chat.completion` | `response` |
| **Structured JSON** | ⚠️ Limited | ✅ Full support |
| **Multimodal** | ❌ No | ✅ Yes |
| **Streaming** | ✅ SSE style | ✅ Simpler events |

## Request Format

### Basic Request

```json
POST /v1/responses
Content-Type: application/json
Authorization: Bearer mdlz_sk_your_api_key

{
  "model": "deepseek/deepseek-r1-0528",
  "input": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Write a haiku about the ocean."
    }
  ],
  "max_tokens": 100,
  "temperature": 0.7
}
```

### With JSON Response Format

```json
{
  "model": "gpt-4",
  "input": [
    {
      "role": "system",
      "content": "You are a helpful assistant that responds in JSON."
    },
    {
      "role": "user",
      "content": "Generate a person profile with name, age, and city."
    }
  ],
  "response_format": {
    "type": "json_object"
  }
}
```

### With JSON Schema (Structured Output)

```json
{
  "model": "gpt-4",
  "input": [
    {
      "role": "user",
      "content": "Generate a person profile"
    }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "age": { "type": "integer" },
        "city": { "type": "string" }
      },
      "required": ["name", "age", "city"]
    }
  }
}
```

### Streaming Request

```json
{
  "model": "deepseek/deepseek-r1-0528",
  "input": [
    {
      "role": "user",
      "content": "Count from 1 to 5."
    }
  ],
  "stream": true
}
```

## Response Format

### Non-Streaming Response

```json
{
  "id": "chatcmpl-123",
  "object": "response",
  "created": 1677652288,
  "model": "deepseek/deepseek-r1-0528",
  "output": [
    {
      "index": 0,
      "role": "assistant",
      "content": "Waves crash endlessly\nWhispering to the pale moon\nSecrets of the deep",
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 15,
    "total_tokens": 35
  },
  "gateway_usage": {
    "tokens_charged": 35,
    "request_ms": 1234,
    "cost_usd": 0.000035
  }
}
```

### Streaming Response

Server-Sent Events (SSE) format with transformed output:

```
data: {"id":"chatcmpl-123","object":"response.chunk","created":1677652288,"model":"deepseek/deepseek-r1-0528","output":[{"index":0,"role":"assistant","content":"W"}]}

data: {"id":"chatcmpl-123","object":"response.chunk","created":1677652288,"model":"deepseek/deepseek-r1-0528","output":[{"index":0,"content":"aves"}]}

data: {"id":"chatcmpl-123","object":"response.chunk","created":1677652288,"model":"deepseek/deepseek-r1-0528","output":[{"index":0,"content":" crash"}]}

...

data: [DONE]
```

## Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | string | ✅ Yes | - | Model identifier (e.g., `deepseek/deepseek-r1-0528`) |
| `input` | array | ✅ Yes | - | Array of input messages with `role` and `content` |
| `max_tokens` | integer | ❌ No | 950 | Maximum tokens to generate |
| `temperature` | float | ❌ No | 1.0 | Sampling temperature (0.0 - 2.0) |
| `top_p` | float | ❌ No | 1.0 | Nucleus sampling parameter |
| `frequency_penalty` | float | ❌ No | 0.0 | Frequency penalty (-2.0 - 2.0) |
| `presence_penalty` | float | ❌ No | 0.0 | Presence penalty (-2.0 - 2.0) |
| `stream` | boolean | ❌ No | false | Enable streaming responses |
| `response_format` | object | ❌ No | null | Output format specification |
| `provider` | string | ❌ No | `openrouter` | Provider: `openrouter`, `portkey`, or `featherless` |

### Response Format Options

| Type | Description |
|------|-------------|
| `text` | Standard text response (default) |
| `json_object` | Returns valid JSON object |
| `json_schema` | Returns JSON matching provided schema |

## Code Examples

### Python

```python
import httpx

url = "https://api.gatewayz.com/v1/responses"
headers = {
    "Authorization": "Bearer mdlz_sk_your_api_key",
    "Content-Type": "application/json"
}

# Non-streaming request
payload = {
    "model": "deepseek/deepseek-r1-0528",
    "input": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Write a haiku about the ocean."}
    ],
    "max_tokens": 100
}

response = httpx.post(url, headers=headers, json=payload)
result = response.json()

print(result["output"][0]["content"])
```

### JavaScript/Node.js

```javascript
const response = await fetch('https://api.gatewayz.com/v1/responses', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer mdlz_sk_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'deepseek/deepseek-r1-0528',
    input: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Write a haiku about the ocean.' }
    ],
    max_tokens: 100
  })
});

const data = await response.json();
console.log(data.output[0].content);
```

### cURL

```bash
curl -X POST https://api.gatewayz.com/v1/responses \
  -H "Authorization: Bearer mdlz_sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-r1-0528",
    "input": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Write a haiku about the ocean."}
    ],
    "max_tokens": 100
  }'
```

### Streaming Example (Python)

```python
import httpx

url = "https://api.gatewayz.com/v1/responses"
headers = {
    "Authorization": "Bearer mdlz_sk_your_api_key",
    "Content-Type": "application/json"
}

payload = {
    "model": "deepseek/deepseek-r1-0528",
    "input": [
        {"role": "user", "content": "Count from 1 to 5."}
    ],
    "stream": True
}

with httpx.stream("POST", url, headers=headers, json=payload) as response:
    for line in response.iter_lines():
        if line.startswith("data: "):
            data = line[6:]
            if data.strip() == "[DONE]":
                break

            import json
            chunk = json.loads(data)
            if "output" in chunk:
                content = chunk["output"][0].get("content", "")
                print(content, end="", flush=True)
```

## Migration Guide

### From `/v1/chat/completions` to `/v1/responses`

**Before (Legacy):**
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

**After (Unified):**
```json
{
  "model": "gpt-4",
  "input": [
    {"role": "user", "content": "Hello"}
  ]
}
```

**Response Transformation:**

| Legacy | Unified |
|--------|---------|
| `response.choices[0].message.content` | `response.output[0].content` |
| `response.object == "chat.completion"` | `response.object == "response"` |

## Error Handling

All error responses follow the same format as `/v1/chat/completions`:

```json
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_exceeded"
  }
}
```

### Common Error Codes

| Status | Error Type | Description |
|--------|-----------|-------------|
| 401 | `invalid_api_key` | Invalid or missing API key |
| 402 | `insufficient_credits` | Not enough credits |
| 429 | `rate_limit_exceeded` | Rate limit hit |
| 429 | `plan_limit_exceeded` | Plan quota exceeded |
| 400 | `invalid_request` | Malformed request |
| 504 | `timeout` | Upstream timeout |

## Features

### Chat History Integration

Both endpoints support the `session_id` query parameter for automatic conversation history:

```bash
POST /v1/responses?session_id=123
```

History messages are automatically injected before your current request.

### Provider Selection

The gateway automatically detects the best provider, or you can specify:

```json
{
  "model": "gpt-4",
  "provider": "portkey",
  "input": [...]
}
```

Supported providers:
- `openrouter` (default)
- `portkey`
- `featherless`

### Credit Deduction

Credits are deducted based on actual token usage:

```
cost = (prompt_tokens × prompt_price) + (completion_tokens × completion_price)
```

Usage details are returned in `gateway_usage`:

```json
{
  "gateway_usage": {
    "tokens_charged": 35,
    "request_ms": 1234,
    "cost_usd": 0.000035
  }
}
```

## Best Practices

1. **Use `/v1/responses` for new projects** - It's the future-proof choice
2. **Leverage `response_format`** - Get structured JSON output reliably
3. **Enable streaming** - Better UX for long responses
4. **Monitor `gateway_usage`** - Track costs and latency
5. **Use `session_id`** - Simplify conversation management

## Limitations

- Maximum `max_tokens`: Model-dependent (typically 4096-8192)
- Rate limits apply per API key
- Credit balance must be positive for non-trial users
- Some older models may not support `response_format`

## Support

- 📚 [Full API Documentation](https://docs.gatewayz.com)
- 💬 [Discord Community](https://discord.gg/gatewayz)
- 📧 Email: support@gatewayz.com

## Changelog

**v1.0.0** (2025-01-09)
- Initial release of `/v1/responses` endpoint
- Full compatibility with OpenAI unified API spec
- Support for `response_format` with JSON schemas
- Streaming support with transformed output
- Automatic provider detection
- Chat history integration via `session_id`
