# Provider and Models API Endpoints

This document describes the three new API endpoints for retrieving provider and model information from the OpenRouter API.

## Overview

The API provides three main endpoints for accessing inference provider and model data:

1. **`GET /provider`** - Returns all available providers with detailed information
2. **`GET /models`** - Returns all available models with metric data
3. **`GET /{provider_name}/{model_name}`** - Returns specific model data for a given provider

## Endpoints

### 1. Get All Providers

**Endpoint:** `GET /provider`

**Description:** Returns all available inference providers with detailed metric data, including logos, model counts, and additional metadata.

**Query Parameters:**
- `moderated_only` (boolean, optional): Filter for moderated providers only (default: false)
- `limit` (integer, optional): Limit number of results
- `offset` (integer, optional): Offset for pagination (default: 0)

**Response Format:**
```json
{
  "data": [
    {
      "name": "OpenAI",
      "slug": "openai",
      "privacy_policy_url": "https://openai.com/privacy",
      "terms_of_service_url": "https://openai.com/terms",
      "status_page_url": "https://status.openai.com/",
      "may_log_prompts": true,
      "may_train_on_data": false,
      "moderated_by_openrouter": true,
      "needs_moderated": false,
      "logo_url": "https://www.google.com/s2/favicons?domain=openai.com&sz=128",
      "site_url": "https://openai.com",
      "model_count": 15,
      "token_generated": "21.1B",
      "weekly_growth": "+25.4%"
    }
  ],
  "total": 50,
  "returned": 10,
  "offset": 0,
  "limit": 10,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Example Usage:**
```bash
# Get all providers
curl -X GET "https://your-api.com/provider"

# Get only moderated providers with pagination
curl -X GET "https://your-api.com/provider?moderated_only=true&limit=5&offset=0"
```

### 2. Get All Models

**Endpoint:** `GET /models`

**Description:** Returns all available models with comprehensive metric data including pricing, architecture, and capabilities.

**Query Parameters:**
- `provider` (string, optional): Filter models by provider name
- `limit` (integer, optional): Limit number of results
- `offset` (integer, optional): Offset for pagination (default: 0)
- `include_huggingface` (boolean, optional): Include Hugging Face metrics for models with hugging_face_id (default: true)

**Response Format:**
```json
{
  "data": [
    {
      "id": "openai/gpt-4",
      "name": "GPT-4",
      "created": 1741818122,
      "description": "Most capable GPT-4 model",
      "architecture": {
        "input_modalities": ["text", "image"],
        "output_modalities": ["text"],
        "tokenizer": "GPT",
        "instruct_type": "string"
      },
      "top_provider": {
        "is_moderated": true,
        "context_length": 128000,
        "max_completion_tokens": 16384
      },
      "pricing": {
        "prompt": "0.0000007",
        "completion": "0.0000007",
        "image": "0",
        "request": "0",
        "web_search": "0",
        "internal_reasoning": "0",
        "input_cache_read": "0",
        "input_cache_write": "0"
      },
      "canonical_slug": "gpt-4",
      "context_length": 128000,
      "hugging_face_id": "openai/gpt-4",
      "per_request_limits": {},
      "supported_parameters": ["temperature", "max_tokens", "top_p"],
      "provider_slug": "openai",
      "provider_site_url": "https://openai.com",
      "model_logo_url": "https://www.google.com/s2/favicons?domain=openai.com&sz=128",
      "huggingface_metrics": {
        "downloads": 42076,
        "likes": 675,
        "pipeline_tag": "image-text-to-text",
        "num_parameters": 257517120,
        "gated": false,
        "private": false,
        "last_modified": "2025-09-23T08:52:16.000Z",
        "author": "ibm-granite",
        "author_data": {
          "name": "ibm-granite",
          "fullname": "IBM Granite",
          "avatar_url": "https://cdn-avatars.huggingface.co/v1/production/uploads/639bcaa2445b133a4e942436/CEW-OjXkRkDNmTxSu8Egh.png",
          "follower_count": 2630
        },
        "available_inference_providers": [],
        "widget_output_urls": [],
        "is_liked_by_user": false,
        "performance_metrics": {
          "avg_latency_ms": 1250,
          "p95_latency_ms": 2100,
          "throughput_tokens_per_sec": 45.2,
          "uptime_percentage": 99.8,
          "inference_speed_score": 8.5,
          "hardware_efficiency": 7.2,
          "last_updated": "2025-09-23T08:52:16.000Z",
          "data_source": "huggingface"
        }
      },
      "performance_metrics": {
        "avg_latency_ms": 1200,
        "p95_latency_ms": 2000,
        "throughput_tokens_per_sec": 50.0,
        "uptime_percentage": 99.5,
        "inference_speed_score": 8.0,
        "hardware_efficiency": 7.5,
        "last_updated": "2024-01-15T10:30:00Z",
        "data_source": "openrouter_estimated"
      }
    }
  ],
  "total": 100,
  "returned": 10,
  "offset": 0,
  "limit": 10,
  "include_huggingface": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Example Usage:**
```bash
# Get all models with Hugging Face data (default)
curl -X GET "https://your-api.com/models"

# Get models without Hugging Face data
curl -X GET "https://your-api.com/models?include_huggingface=false"

# Filter by provider with pagination and Hugging Face data
curl -X GET "https://your-api.com/models?provider=openai&limit=5&offset=0&include_huggingface=true"
```

### 3. Get Specific Model

**Endpoint:** `GET /{provider_name}/{model_name}`

**Description:** Returns detailed information for a specific model from a given provider, including all available endpoints and their configurations.

**Path Parameters:**
- `provider_name` (string): The provider slug (e.g., "openai", "anthropic")
- `model_name` (string): The model name (e.g., "gpt-4", "claude-3")

**Query Parameters:**
- `include_huggingface` (boolean, optional): Include Hugging Face metrics if available (default: true)

**Response Format:**
```json
{
  "data": {
    "id": "openai/gpt-4",
    "name": "GPT-4",
    "created": 1741818122,
    "description": "Most capable GPT-4 model",
    "architecture": {
      "input_modalities": ["text", "image"],
      "output_modalities": ["text"],
      "tokenizer": "GPT",
      "instruct_type": "string"
    },
    "endpoints": [
      {
        "name": "GPT-4",
        "context_length": 128000,
        "pricing": {
          "request": "0.0",
          "image": "0.0",
          "prompt": "0.00003",
          "completion": "0.00006"
        },
        "provider_name": "openai",
        "supported_parameters": ["temperature", "max_tokens", "top_p"],
        "quantization": "none",
        "max_completion_tokens": 16384,
        "max_prompt_tokens": 128000,
        "status": "active",
        "uptime_last_30m": 99.9
      }
    ]
  },
  "provider": "openai",
  "model": "gpt-4",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Example Usage:**
```bash
# Get specific model information with Hugging Face data (default)
curl -X GET "https://your-api.com/openai/gpt-4"
curl -X GET "https://your-api.com/anthropic/claude-3"

# Get specific model without Hugging Face data
curl -X GET "https://your-api.com/openai/gpt-4?include_huggingface=false"
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- **200 OK**: Successful request
- **404 Not Found**: Model or provider not found (for specific model endpoint)
- **503 Service Unavailable**: Provider or model data unavailable
- **500 Internal Server Error**: Server error

Error responses follow this format:
```json
{
  "detail": "Error message describing what went wrong"
}
```

## Hugging Face Integration

The API now includes optional integration with Hugging Face to provide additional model metrics for models that have a `hugging_face_id` in their OpenRouter response.

### Features

- **Automatic Enhancement**: Models with `hugging_face_id` are automatically enhanced with Hugging Face data
- **Optional Integration**: Use `include_huggingface=false` to get original OpenRouter data only
- **Caching**: Hugging Face data is cached for 1 hour to reduce API calls
- **Error Handling**: Graceful fallback to original data if Hugging Face API is unavailable

### Provider Analytics Properties

All providers now include analytics and usage information:

- `logo_url`: Generated logo URL using Google's favicon service with 128px size (same format as `model_logo_url`)
- `site_url`: Provider's website URL extracted from various sources
- `model_count`: Number of available models provided by this provider
- `token_generated`: Daily token processing volume (e.g., "21.1B")
- `weekly_growth`: Weekly growth rate of token processing (e.g., "+25.4%")

**Note:** The `token_generated` and `weekly_growth` fields currently contain mock data as OpenRouter's API doesn't provide these specific analytics metrics. These values are based on estimated provider popularity and growth trends.

### Model Logo Properties

All models now include provider logo information:

- `provider_slug`: Provider identifier extracted from model ID (e.g., "openai" from "openai/gpt-4")
- `provider_site_url`: Provider's website URL from the providers endpoint
- `model_logo_url`: Generated logo URL using Google's favicon service with 128px size

### Hugging Face Metrics Included

When `include_huggingface=true` (default), models with `hugging_face_id` will include:

- `downloads`: Number of model downloads
- `likes`: Number of likes on Hugging Face
- `pipeline_tag`: Model pipeline type (e.g., "text-generation", "image-classification")
- `num_parameters`: Number of model parameters
- `gated`: Whether the model requires authentication
- `private`: Whether the model is private
- `last_modified`: Last modification date
- `author`: Model author/organization
- `author_data`: Detailed author information including avatar URL and follower count

### Performance Metrics Included

All models now include performance metrics for latency and throughput:

#### For Models with Hugging Face Data:
- `avg_latency_ms`: Average response latency in milliseconds
- `p95_latency_ms`: 95th percentile latency in milliseconds
- `throughput_tokens_per_sec`: Tokens processed per second
- `uptime_percentage`: Model availability percentage
- `inference_speed_score`: Community-based speed rating (1-10)
- `hardware_efficiency`: Hardware efficiency score (1-10)
- `last_updated`: Last performance data update
- `data_source`: "huggingface"

#### For Models without Hugging Face Data:
- `avg_latency_ms`: Estimated latency based on context length and pricing
- `p95_latency_ms`: Estimated 95th percentile latency
- `throughput_tokens_per_sec`: Estimated throughput based on pricing
- `uptime_percentage`: Estimated uptime based on provider reliability
- `inference_speed_score`: Calculated score based on context and pricing
- `hardware_efficiency`: Calculated efficiency based on model characteristics
- `last_updated`: Model creation or last modification date
- `data_source`: "openrouter_estimated"

**Note:** Performance metrics are calculated using real data from API responses:
- **Hugging Face models**: Based on real community data (downloads, likes, parameters, pipeline type) and model characteristics
- **OpenRouter-only models**: Calculated from real OpenRouter data (context length, pricing, model names, provider reliability)

### Real Data Sources Used:

#### Hugging Face Data:
- `downloads`: Actual download count from Hugging Face
- `likes`: Real community likes count
- `numParameters`: Actual model parameter count
- `pipeline_tag`: Real model pipeline type (text-generation, classification, etc.)
- `lastModified`: Actual last modification timestamp
- `tags`: Real model tags and categories

#### OpenRouter Data:
- `context_length`: Real context window size
- `pricing`: Actual prompt and completion prices
- `model_name`: Real model names (GPT-4, Claude, etc.)
- `provider_slug`: Actual provider identifiers
- `created`: Real model creation timestamp

### Admin Endpoints

- `GET /admin/huggingface-cache-status`: View Hugging Face cache status and statistics
- `POST /admin/refresh-huggingface-cache`: Clear Hugging Face cache to force refresh

## Caching

- **Provider data**: Cached for 1 hour (3600 seconds)
- **Model data**: Cached for 30 minutes (1800 seconds)
- **Hugging Face data**: Cached for 1 hour (3600 seconds)
- **Specific model data**: Not cached, fetched on-demand

## Rate Limiting

These endpoints are not rate-limited and can be called frequently. However, they do utilize caching to reduce load on the OpenRouter API.

## Authentication

These endpoints do not require authentication and are publicly accessible.

## Data Sources

The API combines data from multiple sources:

### OpenRouter API
- **Providers**: `https://openrouter.ai/api/v1/providers`
- **Models**: `https://openrouter.ai/api/v1/models`
- **Specific Model**: `https://openrouter.ai/api/v1/models/{provider}/{model}/endpoints`

### Hugging Face API (Optional Enhancement)
- **Model Details**: `https://huggingface.co/api/models/{hugging_face_id}`
- Only used when `include_huggingface=true` and model has `hugging_face_id`

## Implementation Details

The implementation includes:
- Automatic caching with TTL for all data sources
- Error handling and logging with graceful fallbacks
- Pagination support for all list endpoints
- Filtering capabilities (provider, moderation status)
- Enhanced provider data with logos and site URLs
- Comprehensive model metadata from OpenRouter
- Optional Hugging Face integration for additional metrics
- Admin endpoints for cache management
- Timeout handling for external API calls
