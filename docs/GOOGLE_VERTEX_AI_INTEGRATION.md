# Google Vertex AI Integration Guide

This guide covers the integration of Google Vertex AI generative models into the AI Gateway.

## Overview

The gateway now supports Google Vertex AI models, particularly the Gemini family of models, through direct integration with the Google Cloud AI Platform. This allows users to access advanced generative AI capabilities through a unified OpenAI-compatible API.

## Supported Models

The following Google Vertex AI models are supported:

- **Gemini 2.0 Flash**: Fast, efficient model optimized for real-time applications
  - Model ID: `gemini-2.0-flash`
  - Input tokens: 1,000,000
  - Output tokens: 100,000

- **Gemini 2.0 Flash Thinking**: Extended thinking variant for complex reasoning
  - Model ID: `gemini-2.0-flash-thinking`
  - Input tokens: 1,000,000
  - Output tokens: 100,000

- **Gemini 2.0 Pro**: Advanced reasoning model for complex tasks
  - Model ID: `gemini-2.0-pro`
  - Input tokens: 1,000,000
  - Output tokens: 4,096

- **Gemini 1.5 Pro**: Advanced reasoning with multimodal support
  - Model ID: `gemini-1.5-pro`
  - Input tokens: 1,000,000
  - Output tokens: 8,192

- **Gemini 1.5 Flash**: Fast model for speed-focused applications
  - Model ID: `gemini-1.5-flash`
  - Input tokens: 1,000,000
  - Output tokens: 8,192

- **Gemini 1.0 Pro**: Previous generation pro model
  - Model ID: `gemini-1.0-pro`
  - Input tokens: 32,000
  - Output tokens: 8,192

## Setup and Configuration

### Prerequisites

1. **Google Cloud Project**: You need an active Google Cloud project
2. **Vertex AI API**: Enable the Vertex AI API in your Google Cloud project
3. **Service Account**: Create a service account with appropriate permissions
4. **Python SDK**: Ensure `google-cloud-aiplatform` is installed

### Environment Variables

Configure the following environment variables:

```bash
# Google Cloud Project Configuration
GOOGLE_PROJECT_ID=your-gcp-project-id
GOOGLE_VERTEX_LOCATION=us-central1  # Region where Vertex AI is available
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Installation

The Google Cloud AI Platform SDK is required. Install it using:

```bash
pip install google-cloud-aiplatform
```

If not already installed as part of the project dependencies.

## API Usage

### Using the Unified Gateway API

Make requests to the chat completions endpoint using Google Vertex models:

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d {
    "model": "gemini-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": "Explain quantum computing in simple terms."
      }
    ],
    "max_tokens": 1000,
    "temperature": 0.7
  }
```

### Model ID Formats

The gateway supports multiple model ID formats:

1. **Simple format** (recommended):
   ```
   gemini-2.0-flash
   gemini-1.5-pro
   gemini-1.0-pro
   ```

2. **With organization prefix**:
   ```
   google/gemini-2.0-flash
   google/gemini-1.5-pro
   ```

3. **Full resource name** (advanced):
   ```
   projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/gemini-2.0-flash
   ```

### OpenAI-Compatible Parameters

The Google Vertex integration supports the following OpenAI-compatible parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Model identifier (required) |
| `messages` | array | Conversation messages (required) |
| `max_tokens` | integer | Maximum output tokens |
| `temperature` | float | Sampling temperature (0-2) |
| `top_p` | float | Nucleus sampling parameter |
| `stream` | boolean | Enable streaming responses |

### Example Requests

#### Basic Chat Completion

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="http://localhost:8000/v1"
)

response = client.chat.completions.create(
    model="gemini-2.0-flash",
    messages=[
        {
            "role": "user",
            "content": "What is machine learning?"
        }
    ]
)

print(response.choices[0].message.content)
```

#### Streaming Response

```python
response = client.chat.completions.create(
    model="gemini-1.5-pro",
    messages=[
        {
            "role": "user",
            "content": "Write a short poem about AI"
        }
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

#### With Custom Parameters

```python
response = client.chat.completions.create(
    model="gemini-2.0-flash-thinking",
    messages=[
        {
            "role": "user",
            "content": "Solve this complex problem: ..."
        }
    ],
    max_tokens=2000,
    temperature=0.5,
    top_p=0.9
)
```

## Implementation Details

### Client Architecture

The Google Vertex integration is built with the following components:

1. **google_vertex_client.py**: Main client module
   - `get_google_vertex_credentials()`: Handles authentication
   - `get_google_vertex_client()`: Creates prediction service client
   - `make_google_vertex_request_openai()`: Makes non-streaming requests
   - `make_google_vertex_request_openai_stream()`: Makes streaming requests
   - `transform_google_vertex_model_id()`: Transforms model IDs to resource names

2. **Model Transformation** (model_transformations.py)
   - Detects Google Vertex models by pattern matching
   - Maps user-friendly model IDs to Vertex AI format
   - Supports multiple input formats

3. **Model Registry** (portkey_providers.py)
   - `fetch_models_from_google_vertex()`: Fetches available models
   - Caches model metadata with configurable TTL
   - Enriches models with pricing information

4. **Router Integration** (routes/chat.py)
   - Routes requests to Google Vertex based on model detection
   - Supports both streaming and non-streaming modes
   - Integrates with rate limiting, authentication, and analytics

### Request Flow

```
User Request
    ↓
Detect Provider (google-vertex)
    ↓
Transform Model ID
    ↓
Build Vertex Content Format
    ↓
Create Prediction Request
    ↓
Execute via Google Vertex API
    ↓
Process Response to OpenAI Format
    ↓
Return to User
```

### Response Normalization

Google Vertex responses are automatically converted to OpenAI-compatible format:

```python
{
    "id": "vertex-1234567890",
    "object": "text_completion",
    "created": 1234567890,
    "model": "gemini-2.0-flash",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "Response text..."
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 42,
        "completion_tokens": 137,
        "total_tokens": 179
    }
}
```

## Authentication

The Google Vertex integration uses Google Cloud's authentication mechanisms:

### Service Account Authentication

The recommended approach for production:

1. Create a service account in Google Cloud Console
2. Download the service account key JSON file
3. Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of the JSON file

The client will automatically use the service account credentials.

### Application Default Credentials

If `GOOGLE_APPLICATION_CREDENTIALS` is not set, the client will attempt to use Application Default Credentials (ADC) in the following order:

1. Environment variable `GOOGLE_APPLICATION_CREDENTIALS`
2. User credentials via `gcloud auth application-default login`
3. Metadata server (if running on Google Cloud)

## Error Handling

The integration includes comprehensive error handling:

| Error Type | HTTP Status | Description |
|------------|------------|-------------|
| Authentication Error | 401 | Invalid or missing credentials |
| Permission Error | 403 | Service account lacks permissions |
| Model Not Found | 404 | Requested model doesn't exist |
| Invalid Request | 400 | Malformed request parameters |
| Service Error | 500 | Google Cloud service error |
| Timeout | 504 | Request exceeded timeout |

## Multimodal Support

Google Vertex AI models support multimodal input. The gateway automatically handles:

1. **Text Content**:
   ```json
   {
     "type": "text",
     "text": "Describe this image"
   }
   ```

2. **Image URLs**:
   ```json
   {
     "type": "image_url",
     "image_url": {"url": "https://example.com/image.jpg"}
   }
   ```

3. **Base64 Images**:
   ```json
   {
     "type": "image_url",
     "image_url": {"url": "data:image/jpeg;base64,/9j/4AAQSkZ..."}
   }
   ```

## Caching and Performance

The gateway implements intelligent caching for Google Vertex:

- **Model List Cache**: 1 hour TTL with 2-hour stale-while-revalidate window
- **Response Caching**: Integrated with the gateway's caching layer
- **Rate Limiting**: Applied per API key with configurable limits

## Troubleshooting

### Common Issues

**Issue**: "Authentication failed"
- **Solution**: Verify `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account key file
- **Solution**: Ensure the service account has "Vertex AI Service Agent" role

**Issue**: "Model not found"
- **Solution**: Check that the model ID matches the supported models list
- **Solution**: Verify the model is available in the specified region (`GOOGLE_VERTEX_LOCATION`)

**Issue**: "Request timeout"
- **Solution**: Check network connectivity to Google Cloud
- **Solution**: Increase the timeout limit for complex reasoning tasks

**Issue**: "Permission denied"
- **Solution**: Ensure service account has "Vertex AI Prediction Service Agent" role
- **Solution**: Verify the service account has access to the Google Cloud project

### Debug Logging

Enable debug logging to troubleshoot issues:

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("src.services.google_vertex_client")
logger.setLevel(logging.DEBUG)
```

## Performance Characteristics

Typical performance metrics for Google Vertex models:

| Model | Input Latency | Token Rate | Quality |
|-------|--------------|-----------|---------|
| Gemini 2.0 Flash | ~200ms | 50-100 tokens/sec | High |
| Gemini 1.5 Pro | ~300ms | 30-50 tokens/sec | Very High |
| Gemini 1.5 Flash | ~250ms | 40-80 tokens/sec | High |

*Note: Actual performance depends on request complexity, token count, and system load.*

## Cost Considerations

Google Vertex AI pricing varies by model and region. Refer to [Google Cloud Pricing](https://cloud.google.com/vertex-ai/pricing) for current rates.

The gateway tracks token usage and can integrate with billing systems through the standard `usage` field in responses.

## Examples

### Python Integration

```python
from openai import OpenAI

# Initialize client pointing to the gateway
client = OpenAI(
    base_url="http://gateway.example.com/v1",
    api_key="sk-your-api-key"
)

# Make a request to Google Vertex
response = client.chat.completions.create(
    model="gemini-2.0-flash",
    messages=[
        {"role": "user", "content": "What's the weather like?"}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)
print(f"Tokens used: {response.usage.total_tokens}")
```

### JavaScript/Node.js Integration

```javascript
const OpenAI = require('openai');

const client = new OpenAI({
    baseURL: "http://gateway.example.com/v1",
    apiKey: "sk-your-api-key"
});

async function chat() {
    const response = await client.chat.completions.create({
        model: "gemini-1.5-pro",
        messages: [
            { role: "user", content: "Explain recursion" }
        ],
        max_tokens: 500
    });

    console.log(response.choices[0].message.content);
}

chat();
```

### cURL Example

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant."
      },
      {
        "role": "user",
        "content": "Tell me about quantum computing"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 1000,
    "stream": false
  }'
```

## Advanced Configuration

### Custom Endpoint

For development or testing, you can specify a custom Vertex AI endpoint:

```bash
GOOGLE_VERTEX_ENDPOINT_ID=your-custom-endpoint-id
```

### Region Configuration

Change the Vertex AI region:

```bash
GOOGLE_VERTEX_LOCATION=europe-west1
```

Available regions include:
- `us-central1` (recommended)
- `us-west1`
- `europe-west1`
- `asia-southeast1`

## Testing

Run the test suite for Google Vertex integration:

```bash
pytest tests/services/test_google_vertex_client.py -v
```

For integration tests with actual Google Cloud credentials:

```bash
pytest tests/services/test_google_vertex_client.py -v -k "integration"
```

## Support and Resources

- [Google Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Gemini API Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/gemini/overview)
- [AI Gateway Documentation](../README.md)

## Contributing

To contribute improvements to the Google Vertex integration:

1. Create a feature branch
2. Make your changes and add tests
3. Run `pytest` to ensure all tests pass
4. Submit a pull request with a description of your changes
