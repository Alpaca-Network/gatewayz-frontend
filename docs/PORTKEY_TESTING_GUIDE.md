# Portkey Integration Testing Guide

Portkey sits in front of upstream model providers and routes requests using the `@provider/model`
syntax. This guide shows how to configure Portkey, test the integration, and use it in production.

## 1. Required Environment Variables

Only the Portkey API key is required. Models are specified using the `@provider/model` format:

```bash
export PORTKEY_API_KEY=your_portkey_api_key
```

- `PORTKEY_API_KEY` identifies your Portkey workspace and provides access to all configured providers

**Note:** Virtual keys are managed in the Portkey dashboard and automatically used when you
reference models with the `@provider/model` syntax. You do NOT need to set virtual key
environment variables.

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

### OpenRouter via Portkey

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "@openrouter/openai/gpt-3.5-turbo",
    "provider": "portkey",
    "messages": [
      {"role": "user", "content": "Say hello in 5 words."}
    ],
    "max_tokens": 50
  }'
```

### DeepInfra via Portkey

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "@deepinfra/meta-llama/Meta-Llama-3.1-8B-Instruct",
    "provider": "portkey",
    "messages": [
      {"role": "user", "content": "Introduce yourself in one sentence."}
    ],
    "max_tokens": 120
  }'
```

### X.AI (Grok) via Portkey

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "@xai/grok-beta",
    "provider": "portkey",
    "messages": [
      {"role": "user", "content": "What is 2 + 2?"}
    ],
    "max_tokens": 100
  }'
```

### Streaming Example

```bash
curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_GATEWAYZ_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "@deepinfra/zai-org/GLM-4.5-Air",
    "provider": "portkey",
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
  model: '@openrouter/openai/gpt-3.5-turbo',
  provider: 'portkey',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## 5. Supported Provider Slugs

Portkey supports the following provider slugs (use with `@provider/model` format):

- `openrouter` - OpenRouter aggregated models
- `deepinfra` - DeepInfra models
- `xai` - X.AI (Grok) models
- `cerebras` - Cerebras models
- `hug` - HuggingFace models
- `novita` - Novita AI models
- `nebius` - Nebius AI models

**Example models:**
- `@openrouter/openai/gpt-3.5-turbo`
- `@deepinfra/meta-llama/Meta-Llama-3.1-8B-Instruct`
- `@deepinfra/zai-org/GLM-4.5-Air`
- `@xai/grok-beta`

## 6. Troubleshooting Checklist

- **400 – Invalid model format**: Ensure you're using the `@provider/model` format
- **400 – Following keys are not valid**: The provider slug may be incorrect or the
  virtual key for that provider is not configured in your Portkey dashboard
- **403 – Not authenticated**: Verify the Gateway API key in the `Authorization` header
- **502 – Upstream error**: The provider may be experiencing issues or your Portkey
  account may not have access to the requested model
- **Still stuck?** Use `node examples/portkey-node-client.mjs` or run
  `pytest tests/test_portkey.py -v` to test the integration

With these steps you can validate Portkey end-to-end, whether you are scripting directly
against Portkey, sending traffic through the Gateway, or running regression tests.
