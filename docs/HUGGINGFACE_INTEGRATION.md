# Hugging Face Inference API Integration

This guide explains how to use the Hugging Face Inference API with your gateway.

## Overview

The gateway now supports the **Hugging Face Inference API Router**, which provides access to a wide variety of models via OpenAI-compatible endpoints.

**Key Features:**
- OpenAI-compatible chat completions API
- Access to 1000+ models on Hugging Face Hub
- Streaming and non-streaming responses
- Full integration with gateway's rate limiting, credits, and usage tracking

## Setup

### 1. Get Your Hugging Face Token

1. Go to [huggingface.co](https://huggingface.co)
2. Create an account or log in
3. Navigate to **Settings → Access Tokens**
4. Create a new **Read** access token
5. Copy the token (starts with `hf_`)

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
HUG_API_KEY=hf_your_token_here
```

The config automatically reads this as `Config.HUG_API_KEY`.

## Usage Examples

### Basic Chat Request

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-2-7b-chat-hf",
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "provider": "huggingface"
  }'
```

### Streaming Response

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-2-7b-chat-hf",
    "messages": [
      {"role": "user", "content": "Write a poem about Python"}
    ],
    "stream": true,
    "provider": "huggingface"
  }'
```

### Using with OpenAI Python Client

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="YOUR_API_KEY"
)

completion = client.chat.completions.create(
    model="meta-llama/Llama-2-7b-chat-hf",
    messages=[
        {
            "role": "user",
            "content": "What is the capital of France?"
        }
    ],
    provider="huggingface"
)

print(completion.choices[0].message.content)
```

### Streaming with OpenAI Python Client

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="YOUR_API_KEY"
)

stream = client.chat.completions.create(
    model="meta-llama/Llama-2-7b-chat-hf",
    messages=[
        {
            "role": "user",
            "content": "Write a haiku about AI"
        }
    ],
    stream=True,
    provider="huggingface"
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

## Supported Models

The Hugging Face Inference API supports 1000+ models. Here are popular options:

### Large Language Models

**Meta (Llama Family):**
- `meta-llama/Llama-2-7b-chat-hf`
- `meta-llama/Llama-2-13b-chat-hf`
- `meta-llama/Llama-2-70b-chat-hf`

**Mistral:**
- `mistralai/Mistral-7B-Instruct-v0.1`
- `mistralai/Mistral-7B-Instruct-v0.2`

**Other Popular Models:**
- `google/flan-t5-xxl`
- `EleutherAI/gpt-neox-20b`
- `tiiuae/falcon-7b-instruct`

### Router Models

Special router models that distribute requests across multiple providers:

```python
# Example: Arch Router (combines multiple models)
response = client.chat.completions.create(
    model="katanemo/Arch-Router-1.5B:hf-inference",
    messages=[{"role": "user", "content": "Hello!"}],
    provider="huggingface"
)
```

You can find more models at [huggingface.co/models](https://huggingface.co/models?pipeline_tag=text-generation&sort=trending)

## Parameters

The Hugging Face integration supports all standard OpenAI parameters:

```python
response = client.chat.completions.create(
    model="meta-llama/Llama-2-7b-chat-hf",
    messages=[...],
    max_tokens=512,           # Maximum completion tokens
    temperature=0.7,          # Randomness (0-2)
    top_p=0.9,               # Nucleus sampling
    frequency_penalty=0,      # Reduce repetition
    presence_penalty=0,       # Encourage new topics
    provider="huggingface"
)
```

## Rate Limiting & Credits

The gateway automatically applies rate limiting and credits to Hugging Face requests:

- **Rate Limits**: Applied per API key and time window
- **Credits**: Deducted based on tokens used (prompt + completion)
- **Trial Limits**: Free tier users get token limits on trial

## Auto-Detection

If you don't specify the provider, the gateway will auto-detect based on the model:

```python
# This will automatically use Hugging Face
response = client.chat.completions.create(
    model="meta-llama/Llama-2-7b-chat-hf",
    messages=[{"role": "user", "content": "Hello"}]
    # No provider specified, but HF is auto-detected
)
```

## Troubleshooting

### "Hugging Face API key (HUG_API_KEY) not configured"

**Fix**: Add your token to `.env` and restart the server:
```bash
HUG_API_KEY=hf_your_token_here
```

### "Model not found"

**Solutions**:
1. Check the model name on [huggingface.co/models](https://huggingface.co/models)
2. Model names are case-sensitive
3. Ensure the model is publicly available
4. Some models may be restricted or removed

### Rate Limiting (HTTP 429)

The request exceeded rate limits. Wait according to the `Retry-After` header:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

### High Token Usage

If costs are higher than expected:
1. Check token counts in responses
2. Use `max_tokens` to limit completion length
3. Shorter prompts use fewer tokens
4. Consider using smaller models

## Implementation Details

### Files Modified

1. **`src/services/huggingface_client.py`** - Client implementation
   - `get_huggingface_client()` - Initialize OpenAI client
   - `make_huggingface_request_openai()` - Non-streaming requests
   - `make_huggingface_request_openai_stream()` - Streaming requests
   - `process_huggingface_response()` - Response processing

2. **`src/routes/chat.py`** - Route integration
   - Added HF support to `/v1/chat/completions`
   - Added HF support to `/v1/responses`
   - Auto-detection includes Hugging Face

3. **`src/config.py`** - Configuration
   - `HUG_API_KEY` environment variable

### Response Format

Responses follow OpenAI format:

```json
{
  "id": "chatcmpl-123...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "meta-llama/Llama-2-7b-chat-hf",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 8,
    "total_tokens": 20
  },
  "gateway_usage": {
    "tokens_charged": 20,
    "cost_usd": 0.001,
    "request_ms": 450
  }
}
```

## Performance Notes

- **Cold Starts**: First request to a model may take 30-60 seconds as models are loaded
- **Batch Requests**: Router models (like Arch-Router) distribute load across providers
- **Timeout**: Default timeout is 30 seconds per request
- **Streaming**: Enables progressive output for better UX

## Cost Considerations

Hugging Face Inference API pricing depends on:
1. Model size and compute requirements
2. Token usage (input + output)
3. Concurrent requests

Check [huggingface.co/pricing](https://huggingface.co/pricing) for current rates.

## Advanced Usage

### Using with LangChain

```python
from langchain.llms import OpenAI

llm = OpenAI(
    model_name="meta-llama/Llama-2-7b-chat-hf",
    openai_api_key="YOUR_API_KEY",
    openai_api_base="http://localhost:8000/v1",
    temperature=0.7,
    model_kwargs={"provider": "huggingface"}
)

response = llm("What is machine learning?")
print(response)
```

### Using with LiteLLM

```python
import litellm

response = litellm.completion(
    model="openai/meta-llama/Llama-2-7b-chat-hf",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="http://localhost:8000/v1",
    api_key="YOUR_API_KEY",
)

print(response.choices[0].message.content)
```

## Support

For issues:
1. Check [Hugging Face documentation](https://huggingface.co/docs/inference-providers/providers/hf-inference)
2. Review gateway logs for detailed error messages
3. Verify model availability on [huggingface.co/models](https://huggingface.co/models)
