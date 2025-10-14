# Portkey Integration Testing Guide

Portkey sits in front of the upstream model providers and now relies on **virtual keys**
for all traffic. This guide shows how to wire up the required environment variables,
exercise the Gateway API, and use the official Portkey Node.js SDK for local smoke tests.

## 1. Required Environment Variables

Export the following before running tests, scripts, or the API locally:

```bash
export PORTKEY_API_KEY=pk_live_xxx
export PORTKEY_VIRTUAL_KEY_OPENAI=vk_live_xxx     # or PORTKEY_VIRTUAL_KEY
# Optional: provider-specific overrides
# export PORTKEY_VIRTUAL_KEY_ANTHROPIC=vk_live_yyy
# export PORTKEY_VIRTUAL_KEY_DEEPINFRA=vk_live_zzz
```

- `PORTKEY_API_KEY` identifies your Portkey workspace.
- `PORTKEY_VIRTUAL_KEY_*` selects which credential from the Portkey vault is used for
  each provider. If only `PORTKEY_VIRTUAL_KEY` is present it is treated as the default
  for every provider.

The Gateway will return `400` (“Portkey virtual key not provided”) if these values are
missing or misconfigured.

## 2. Install the Portkey Node.js SDK

The repository contains a lightweight Node helper you can clone or adapt. Install the
SDK with your favourite package manager:

```bash
npm install portkey-ai
# or
yarn add portkey-ai
# or
pnpm add portkey-ai
```

Then execute the sample script (it reads the same environment variables listed above):

```bash
node examples/portkey-node-client.mjs
```

The script prints the raw Portkey response, making it useful for debugging virtual key
scope, quotas, or upstream availability without going through the Gateway.

## 3. Testing via the Gateway API

### OpenAI through Portkey

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-3.5-turbo",
    "provider": "portkey",
    "portkey_provider": "openai",
    "portkey_virtual_key": "vk_live_xxx",
    "messages": [
      {"role": "user", "content": "Say hello in 5 words."}
    ],
    "max_tokens": 50
  }'
```

### Anthropic (Claude) via Portkey

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "provider": "portkey",
    "portkey_provider": "anthropic",
    "portkey_virtual_key": "vk_live_anthropic",
    "messages": [
      {"role": "user", "content": "What is 2 + 2?"}
    ],
    "max_tokens": 100
  }'
```

### DeepInfra via Portkey

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "jondurbin/airoboros-l2-70b-gpt4-1.4.1",
    "provider": "portkey",
    "portkey_provider": "deepinfra",
    "portkey_virtual_key": "vk_live_deepinfra",
    "messages": [
      {"role": "user", "content": "Introduce yourself in one sentence."}
    ],
    "max_tokens": 120
  }'
```

### Streaming Example

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-3.5-turbo",
    "provider": "portkey",
    "portkey_provider": "openai",
    "portkey_virtual_key": "vk_live_xxx",
    "messages": [
      {"role": "user", "content": "Stream a haiku about debugging."}
    ],
    "stream": true
  }'
```

The response arrives as Server-Sent Events (`data: ...`). Termination is signalled by
`data: [DONE]`.

## 4. JavaScript/TypeScript Snippet for Gateway Calls

```typescript
async function chatViaPortkey(apiKey: string, body: Record<string, unknown>) {
  const response = await fetch('https://api.gatewayz.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gateway request failed: ${response.status} ${error}`);
  }

  return response.json();
}

await chatViaPortkey(process.env.GATEWAYZ_API_KEY!, {
  model: 'gpt-3.5-turbo',
  provider: 'portkey',
  portkey_provider: 'openai',
  portkey_virtual_key: process.env.PORTKEY_VIRTUAL_KEY_OPENAI,
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## 5. Troubleshooting Checklist

- **400 – Portkey virtual key not provided**: Ensure the appropriate
  `PORTKEY_VIRTUAL_KEY_*` environment variable is set or sent in the payload.
- **403 – Not authenticated**: Verify the Gateway API key in the `Authorization` header.
- **502 – error code: 502**: Usually indicates that Portkey rejected the upstream call.
  Confirm the virtual key has access to the requested provider/model and that the
  provider has available quota.
- **Still stuck?** Use `node examples/portkey-node-client.mjs` with increased log output
  to isolate whether the failure occurs inside Portkey or at the Gateway layer.

With these steps you can validate Portkey end-to-end, whether you are scripting directly
against Portkey, sending traffic through the Gateway, or running regression tests.**
