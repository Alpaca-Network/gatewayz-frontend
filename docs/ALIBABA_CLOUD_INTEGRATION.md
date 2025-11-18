# Alibaba Cloud / Qwen Integration Guide

## Overview

Alibaba Cloud integration enables the Gatewayz gateway to route requests to Alibaba Cloud's DashScope platform and access 100+ Qwen language models. This integration provides:

- **25+ Qwen Models**: Including flagship models (Max, Plus, Flash), specialized models (Coder, Math, VL, Omni), and reasoning models (QwQ)
- **OpenAI-Compatible API**: Direct compatibility with OpenAI Python SDK
- **Multi-Region Support**: Singapore and Beijing endpoints
- **Automatic Failover**: Integrated into the provider failover chain
- **Cost-Effective**: Competitive pricing on quality models

## Configuration

### Environment Variables

Set the following environment variable with your Alibaba Cloud API key:

```bash
export ALIBABA_CLOUD_API_KEY="your-dashscope-api-key-here"
```

For development, add to `.env` file:

```
ALIBABA_CLOUD_API_KEY=your-dashscope-api-key-here
```

### Obtaining an API Key

1. Sign up for Alibaba Cloud: https://www.alibabacloud.com/
2. Navigate to Model Studio: https://dashscope.aliyuncs.com/
3. Create or retrieve your API key from the dashboard
4. Copy the key and set it as the environment variable

## Supported Models

### Commercial Models (Recommended)

- **qwen-plus**: Balanced performance and cost (1M context)
- **qwen-max**: Most powerful commercial model (262K context)
- **qwen-flash**: Fast and cost-effective (1M context)
- **qwen-coder**: Specialized code generation model
- **qwen-long**: Document processing (10M context)

### Reasoning Models

- **qwq-plus**: Advanced reasoning for math and code
- **qwq-32b-preview**: 32B reasoning model

### Specialized Models

- **qwen-omni**: Multimodal (text, image, audio, video)
- **qwen-vl**: Vision and language understanding
- **qwen-math**: Mathematics problem-solving
- **qwen-mt**: Translation (92 languages)

### Series Models

- **Qwen 3 Series**: Latest models with thinking mode
  - qwen-3-30b-a3b-instruct
  - qwen-3-80b-a3b-instruct
  - qwen-3-30b-a3b-thinking (thinking mode)
  - qwen-3-80b-a3b-thinking (thinking mode)

- **Qwen 2.5 Series**: Enhanced instruction following
  - qwen-2.5-72b-instruct
  - qwen-2.5-7b-instruct

- **Qwen 2 Series**: Stable baseline models
  - qwen-2-72b-instruct
  - qwen-2-7b-instruct

- **Qwen 1.5 Series**: Legacy models
  - qwen-1.5-72b-chat
  - qwen-1.5-14b-chat

## Usage Examples

### Direct Model ID

```python
# Using simple model names
response = requests.post(
    "http://localhost:8000/v1/chat/completions",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={
        "model": "qwen-plus",
        "messages": [{"role": "user", "content": "Hello"}]
    }
)
```

### With Organization Prefix

```python
# Using org/model format (automatically detected as alibaba-cloud)
response = requests.post(
    "http://localhost:8000/v1/chat/completions",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={
        "model": "qwen/qwen-max",
        "messages": [{"role": "user", "content": "Hello"}]
    }
)
```

### Using OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_GATEWAYZ_API_KEY",
    base_url="http://localhost:8000/v1"
)

response = client.chat.completions.create(
    model="qwen-plus",
    messages=[
        {"role": "user", "content": "Explain quantum computing"}
    ]
)

print(response.choices[0].message.content)
```

### Streaming Responses

```python
response = client.chat.completions.create(
    model="qwen-plus",
    messages=[{"role": "user", "content": "Write a poem"}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

## Model Selection and Routing

The gateway automatically detects and routes Qwen models to Alibaba Cloud based on:

1. **Pattern Matching**: Models starting with "qwen/" or "alibaba-cloud/"
2. **Model Name Mapping**: Direct model ID lookups in the transformation table
3. **Failover Support**: Falls back to alternative providers if needed

### Automatic Detection Examples

```
User Input                  → Provider      → DashScope Model ID
qwen-plus                  → alibaba-cloud → qwen-plus
qwen/qwen-max              → alibaba-cloud → qwen-max
alibaba-cloud/qwen-coder   → alibaba-cloud → qwen-coder
qwen-3-30b                 → alibaba-cloud → qwen-3-30b-a3b-instruct
```

## Pricing

Pricing is configured per 1M tokens:

| Model | Prompt ($) | Completion ($) | Context |
|-------|-----------|-----------------|---------|
| qwen-flash | 0.001 | 0.003 | 1M |
| qwen-plus | 0.005 | 0.015 | 1M |
| qwen-max | 0.012 | 0.036 | 262K |
| qwen-coder | 0.008 | 0.024 | 262K |
| qwq-plus | 0.020 | 0.060 | 262K |
| qwen-long | 0.001 | 0.003 | 10M |

Pricing is defined in `src/data/manual_pricing.json` and is automatically applied to token usage calculations.

## Failover Behavior

Alibaba Cloud is integrated into the failover chain with priority:

```
Priority Order for Failover:
1. huggingface
2. featherless
3. vercel-ai-gateway
4. aihubmix
5. anannas
6. alibaba-cloud          ← Your configured provider
7. fireworks
8. together
9. google-vertex
10. openrouter
```

If Alibaba Cloud returns a 502, 503, or 504 error, the gateway will automatically attempt these fallback providers.

## Rate Limiting

Alibaba Cloud requests are subject to the same rate limiting as other providers:
- Per-user limits
- Per-API-key limits
- System-wide limits

Rate limits are configurable in the database via the `rate_limits` table.

## Monitoring and Debugging

### Check Provider Status

The provider will automatically be detected and loaded on startup. Check logs for:

```
✓ Loaded alibaba_cloud provider client
```

If there are any import errors, you'll see:

```
⚠ Failed to load alibaba_cloud provider client: ImportError: ...
```

### Verify Model Transformations

Model ID transformations are logged when processing requests:

```
Transformed model ID from 'qwen-plus' to 'qwen-plus' for provider alibaba-cloud
```

### Check API Key Configuration

If the API key is not configured:

```
ValueError: Alibaba Cloud API key not configured
```

Ensure `ALIBABA_CLOUD_API_KEY` is set in your environment.

## Integration Points

### Files Modified/Added

1. **src/services/alibaba_cloud_client.py** (NEW)
   - Core provider integration
   - 4 main functions: get_alibaba_cloud_client(), make_alibaba_cloud_request_openai(), process_alibaba_cloud_response(), make_alibaba_cloud_request_openai_stream()

2. **src/config/config.py** (MODIFIED)
   - Added ALIBABA_CLOUD_API_KEY configuration

3. **src/routes/chat.py** (MODIFIED)
   - Added provider imports and registration
   - Added request routing for streaming and non-streaming

4. **src/services/model_transformations.py** (MODIFIED)
   - Added Alibaba Cloud model ID mappings
   - Added provider detection for Qwen/Alibaba Cloud patterns

5. **src/services/provider_failover.py** (MODIFIED)
   - Added alibaba-cloud to fallback provider priority

6. **src/data/manual_pricing.json** (MODIFIED)
   - Added Qwen model pricing data

## API Endpoints

### Chat Completions

```
POST /v1/chat/completions
```

**Request:**
```json
{
    "model": "qwen-plus",
    "messages": [
        {"role": "system", "content": "You are helpful"},
        {"role": "user", "content": "Hello"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
}
```

**Response:**
```json
{
    "id": "chatcmpl-...",
    "object": "chat.completion",
    "created": 1234567890,
    "model": "qwen-plus",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "Hello! I'm here to help..."
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 20,
        "completion_tokens": 100,
        "total_tokens": 120
    }
}
```

## Troubleshooting

### 401 Unauthorized

**Issue**: "Authorization failed" or "Invalid API key"

**Solution**:
- Verify ALIBABA_CLOUD_API_KEY is set correctly
- Check that the API key has not expired
- Confirm you're using a valid DashScope API key

### 503 Service Unavailable

**Issue**: Provider returns 503 errors

**Behavior**: Gateway automatically falls back to next provider in chain

**Debug**: Check Alibaba Cloud service status at https://www.alibabacloud.com/

### Model Not Found

**Issue**: "Model xyz not found"

**Solution**:
- Verify the model is available in your region (Singapore vs Beijing)
- Check that the model ID is correctly mapped in model_transformations.py
- Try using a different region by modifying the base_url in alibaba_cloud_client.py

### Timeout Issues

**Issue**: Request times out

**Solution**:
- The default timeout is 30 seconds
- For Alibaba Cloud, use: `request_timeout = PROVIDER_TIMEOUTS.get("alibaba-cloud", 30)`
- Increase timeout if needed for longer model contexts

## Advanced Configuration

### Switching Regions

Edit `src/services/alibaba_cloud_client.py` to change the region:

```python
# Singapore (International)
base_url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

# Beijing (Mainland China)
base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
```

### Custom Headers

To add custom headers (if needed for specific use cases):

```python
def get_alibaba_cloud_client():
    return OpenAI(
        base_url=base_url,
        api_key=Config.ALIBABA_CLOUD_API_KEY,
        default_headers={
            "X-DashScope-SSE": "enable",  # Enable streaming
        }
    )
```

## Performance Optimization

### Caching

Model responses are automatically cached by Redis when available, reducing latency for repeated requests.

### Connection Pooling

The OpenAI client maintains connection pools internally. No additional configuration needed.

### Batch Processing

For high-volume requests, consider using the batch API (if available on Alibaba Cloud).

## References

- **Alibaba Cloud Documentation**: https://www.alibabacloud.com/help/en/model-studio/
- **DashScope API**: https://dashscope.aliyuncs.com/compatible-mode/v1
- **Qwen Models**: https://qwenlm.github.io/
- **OpenAI SDK**: https://github.com/openai/openai-python

## Support

For issues or questions:
1. Check the [troubleshooting section](#troubleshooting)
2. Review logs for provider-specific errors
3. Check Alibaba Cloud service status
4. Contact Alibaba Cloud support if API-related issues persist
