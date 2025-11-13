# Chat API Usage Guide

## Quick Reference

### Correct Request Format

```typescript
// Frontend API call
const response = await fetch(`/v1/chat/completions?session_id=${sessionId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'near/meta-llama/Llama-3.3-70B-Instruct',
    gateway: 'near',  // Gateway goes in BODY
    messages: [
      { role: 'user', content: 'Hello, world!' }
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 2000,
  })
});
```

## Important Notes

### ✅ DO
- Put `gateway` parameter in the **request body**
- Put `session_id` parameter in the **URL query string**
- Include authorization header with API key

### ❌ DON'T
- Don't put `gateway` in the URL query string
- Don't put `session_id` in the request body
- Don't forget the authorization header

## Supported Gateways

| Gateway | Model Prefix | Example Model |
|---------|-------------|---------------|
| OpenRouter | Various | `openrouter/openai/gpt-4` |
| NEAR | `near/` | `near/meta-llama/Llama-3.3-70B-Instruct` |
| Cerebras | `cerebras/` | `cerebras/llama-3.3-70b` |
| Groq | `groq/` | `groq/llama-3.1-70b` |
| Together | `together/` | `together/meta-llama/Llama-3.3-70B` |
| Fireworks | `fireworks/` | `fireworks/llama-v3p3-70b-instruct` |
| DeepInfra | `deepinfra/` | `deepinfra/meta-llama/Meta-Llama-3.3-70B-Instruct` |
| Hugging Face | `huggingface/` | `huggingface/meta-llama/Llama-3.3-70B-Instruct` |

## Request Flow

```
Frontend
    ↓ POST /v1/chat/completions?session_id=abc
    ↓ Body: { model, gateway, messages, ... }
    ↓
Next.js API Route (/src/app/v1/chat/completions/route.ts)
    ↓ Forwards to backend
    ↓
Backend API (https://api.gatewayz.ai)
    ↓ POST /v1/chat/completions?session_id=abc
    ↓ Body: { model, gateway, messages, ... }
    ↓
Gateway Provider (NEAR, Cerebras, etc.)
    ↓ Processes request
    ↓
Response (streaming or non-streaming)
```

## Code Examples

### React Component Example

```tsx
const sendMessage = async (message: string) => {
  const apiKey = getApiKey();
  const sessionId = currentSession?.id;

  // Build URL with session_id (if available)
  const url = sessionId
    ? `/v1/chat/completions?session_id=${sessionId}`
    : '/v1/chat/completions';

  // Prepare request body with gateway
  const requestBody = {
    model: selectedModel.id,
    gateway: selectedModel.gateway,  // Important: in BODY
    messages: [
      { role: 'user', content: message }
    ],
    stream: true,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  // Handle streaming response...
};
```

### API Route Example

```typescript
// src/app/v1/chat/completions/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const apiKey = request.headers.get('authorization');

  // Build backend URL
  const targetUrl = new URL(`${API_BASE_URL}/v1/chat/completions`);

  // Forward query parameters (e.g., session_id)
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  // Forward request to backend
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify(body),  // Gateway is in body
  });

  return response;
}
```

## Testing

See tests in:
- `/src/app/v1/chat/completions/__tests__/route.test.ts`
- `/src/app/v1/chat/__tests__/gateway-param-integration.test.ts`

Run tests:
```bash
pnpm test -- src/app/v1/chat
```

## Migration from Old Format

If you have code using the old format, update it:

```diff
- // OLD: Gateway in URL
- const url = `/v1/chat/completions?session_id=${sid}&gateway=${gw}`;
- const body = { model, messages };

+ // NEW: Gateway in body
+ const url = `/v1/chat/completions?session_id=${sid}`;
+ const body = { model, gateway: gw, messages };
```

## Related Documentation

- [CHAT_CHANGES_TEST_SUMMARY.md](../CHAT_CHANGES_TEST_SUMMARY.md) - Test coverage details
- [CLAUDE.md](../CLAUDE.md) - Full codebase documentation
- Backend API docs - Contact backend team for details
