# v1/messages API - Anthropic Messages Endpoint

## Overview

The `/v1/messages` endpoint provides an **Anthropic/Claude-compatible API** that allows you to use Claude models and other AI models with the same interface as Anthropic's Messages API.

This endpoint is fully compatible with the official Anthropic Claude API format while leveraging the Gatewayz infrastructure for provider routing, credit management, and rate limiting.

## Key Features

✅ **Claude API Compatible**: Drop-in replacement for Anthropic's Messages API
✅ **Multi-Provider**: Works with OpenRouter, Portkey, and Featherless
✅ **Automatic Transformation**: Converts between Anthropic and OpenAI formats
✅ **Same Infrastructure**: Uses same credit system, rate limiting, and logging
✅ **System Prompts**: Supports separate `system` parameter (Anthropic-style)
✅ **Content Blocks**: Handles multimodal content (text, images)

## API Endpoints

All endpoints covered by `/v1/messages`:
- ✅ `/v1/chat/completions` - OpenAI-style (legacy)
- ✅ `/v1/responses` - Unified API (newer)
- ✅ `/v1/messages` - Anthropic/Claude-style (NEW)

## Request Format

### Basic Request

```json
POST /v1/messages
Content-Type: application/json
Authorization: Bearer mdlz_sk_your_api_key

{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "Hello, Claude! How are you?"
    }
  ]
}
```

### With System Prompt

```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 1024,
  "system": "You are Claude, a helpful AI assistant created by Anthropic.",
  "messages": [
    {
      "role": "user",
      "content": "Who are you?"
    }
  ]
}
```

### With Multimodal Content

```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "What's in this image?"
        },
        {
          "type": "image",
          "source": {
            "type": "base64",
            "media_type": "image/jpeg",
            "data": "/9j/4AAQSkZJRg..."
          }
        }
      ]
    }
  ]
}
```

### With Advanced Parameters

```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 2048,
  "temperature": 0.7,
  "top_p": 0.9,
  "top_k": 40,
  "stop_sequences": ["\n\nHuman:", "\n\nAssistant:"],
  "system": "You are a helpful assistant.",
  "messages": [
    {"role": "user", "content": "Write a poem"}
  ]
}
```

## Response Format

### Successful Response

```json
{
  "id": "msg-123abc",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! I'm doing well, thank you for asking. How can I help you today?"
    }
  ],
  "model": "claude-sonnet-4-5-20250929",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 12,
    "output_tokens": 18
  },
  "gateway_usage": {
    "tokens_charged": 30,
    "request_ms": 1234,
    "cost_usd": 0.000045
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique message identifier |
| `type` | string | Always "message" |
| `role` | string | Always "assistant" |
| `content` | array | Array of content blocks |
| `model` | string | Model used for the response |
| `stop_reason` | string | Why generation stopped: `end_turn`, `max_tokens`, `stop_sequence`, `tool_use` |
| `stop_sequence` | string\|null | The stop sequence that triggered stopping (if any) |
| `usage` | object | Token usage details |
| `gateway_usage` | object | Gatewayz-specific usage and cost info |

## Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | string | ✅ Yes | - | Model identifier (e.g., `claude-sonnet-4-5-20250929`) |
| `messages` | array | ✅ Yes | - | Array of message objects |
| `max_tokens` | integer | ✅ Yes | - | Maximum tokens to generate (REQUIRED in Anthropic API) |
| `system` | string | ❌ No | null | System prompt (separate from messages) |
| `temperature` | float | ❌ No | 1.0 | Sampling temperature (0.0 - 2.0) |
| `top_p` | float | ❌ No | null | Nucleus sampling |
| `top_k` | integer | ❌ No | null | Top-k sampling (Anthropic-specific) |
| `stop_sequences` | array | ❌ No | null | Sequences that stop generation |
| `metadata` | object | ❌ No | null | User-provided metadata |

### Gateway-Specific Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `provider` | string | ❌ No | `openrouter` | Provider: `openrouter`, `portkey`, or `featherless` |
| `portkey_provider` | string | ❌ No | `anthropic` | Sub-provider for Portkey |
| `portkey_virtual_key` | string | ❌ No | null | Virtual key for Portkey |

## Key Differences from Anthropic API

### What Works the Same

✅ Request/response format
✅ Message structure
✅ System prompts
✅ Content blocks
✅ Stop sequences
✅ Token usage reporting

### What's Different

1. **Provider Support**: Routes to OpenRouter/Portkey/Featherless instead of Anthropic directly
2. **Gateway Fields**: Additional `gateway_usage` field with cost and performance metrics
3. **Credit System**: Uses Gatewayz credit system instead of Anthropic billing
4. **Chat History**: Optional `session_id` query parameter for conversation persistence

## Comparison with Other Endpoints

| Feature | `/v1/chat/completions` (OpenAI) | `/v1/responses` (Unified) | `/v1/messages` (Anthropic) |
|---------|-------------------------------|-------------------------|----------------------------|
| **Request Field** | `messages` | `input` | `messages` |
| **Response Field** | `choices` | `output` | `content` |
| **System Prompt** | In messages array | In input array | Separate `system` parameter |
| **Max Tokens** | Optional | Optional | **Required** |
| **Stop Parameter** | `stop` | `stop` | `stop_sequences` |
| **Usage Format** | `prompt_tokens` / `completion_tokens` | Same | `input_tokens` / `output_tokens` |
| **Response Object** | `chat.completion` | `response` | `message` |

## Code Examples

### Python (Standard)

```python
import httpx

url = "https://api.gatewayz.com/v1/messages"
headers = {
    "Authorization": "Bearer mdlz_sk_your_api_key",
    "Content-Type": "application/json"
}

payload = {
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "messages": [
        {"role": "user", "content": "Write a haiku about coding"}
    ]
}

response = httpx.post(url, headers=headers, json=payload)
result = response.json()

print(result["content"][0]["text"])
```

### Python (With System Prompt)

```python
payload = {
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "system": "You are a poetic AI that speaks only in haikus.",
    "messages": [
        {"role": "user", "content": "Tell me about yourself"}
    ]
}

response = httpx.post(url, headers=headers, json=payload)
result = response.json()

for block in result["content"]:
    if block["type"] == "text":
        print(block["text"])
```

### JavaScript/Node.js

```javascript
const response = await fetch('https://api.gatewayz.com/v1/messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer mdlz_sk_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Hello, Claude!' }
    ]
  })
});

const data = await response.json();
console.log(data.content[0].text);
```

### cURL

```bash
curl -X POST https://api.gatewayz.com/v1/messages \
  -H "Authorization: Bearer mdlz_sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Migration Guide

### From Anthropic to Gatewayz

**Before (Anthropic):**
```python
import anthropic

client = anthropic.Anthropic(api_key="sk-ant-...")
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
)
```

**After (Gatewayz):**
```python
import httpx

response = httpx.post(
    "https://api.gatewayz.com/v1/messages",
    headers={"Authorization": "Bearer mdlz_sk_..."},
    json={
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": "Hello"}]
    }
)
result = response.json()
```

The response format is identical!

### From OpenAI to Anthropic Format

**OpenAI Request:**
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "You are helpful"},
    {"role": "user", "content": "Hello"}
  ]
}
```

**Anthropic Request (Gatewayz):**
```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 1024,
  "system": "You are helpful",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

## Chat History Integration

Both endpoints support the `session_id` query parameter for automatic conversation history:

```bash
POST /v1/messages?session_id=123
```

History messages are automatically injected before your current request.

## Error Handling

All error responses follow the same format:

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
| 400 | `invalid_request` | Malformed request (e.g., missing `max_tokens`) |
| 404 | `model_not_found` | Model not available |
| 504 | `timeout` | Upstream timeout |

## Best Practices

1. **Always include `max_tokens`** - Required parameter in Anthropic API
2. **Use `system` parameter** - Cleaner than including system message in array
3. **Handle content blocks** - Response content is always an array
4. **Check `stop_reason`** - Understand why generation stopped
5. **Monitor `gateway_usage`** - Track costs and performance
6. **Use `session_id`** - Simplify conversation management

## Performance Notes

- Average latency: Same as underlying provider (typically 500-2000ms)
- Transformation overhead: < 10ms
- Supports all Gatewayz features: credits, rate limits, analytics

## Limitations

- Streaming not yet implemented (coming soon)
- Some Claude-specific features may not work with all providers
- `top_k` parameter is logged but not passed to non-Anthropic providers

## Support

- 📚 [Full API Documentation](https://docs.gatewayz.com)
- 💬 [Discord Community](https://discord.gg/gatewayz)
- 📧 Email: support@gatewayz.com

## Related Documentation

- [Chat Completions API](/v1/chat/completions) - OpenAI-style endpoint
- [Responses API](/v1/responses) - Unified API endpoint
- [RESPONSES_API.md](./RESPONSES_API.md) - Unified API documentation

---

**Ready to use?** Start making requests to `/v1/messages` with your Gatewayz API key!
