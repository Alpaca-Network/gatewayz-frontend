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

**Description:** Returns all available inference providers with detailed metric data, including logos and additional metadata.

**Query Parameters:**
- `moderated_only` (boolean, optional): Filter for moderated providers only (default: false)
- `limit` (integer, optional): Limit number of results
- `offset` (integer, optional): Offset for pagination (default: 0)

**Response Format:**
```json
{
  "data": [
    {
      "name": "Provider Name",
      "slug": "provider-slug",
      "privacy_policy_url": "https://provider.com/privacy",
      "terms_of_service_url": "https://provider.com/terms",
      "status_page_url": "https://status.provider.com/",
      "may_log_prompts": true,
      "may_train_on_data": false,
      "moderated_by_openrouter": false,
      "needs_moderated": false,
      "logo_url": "https://logo-url.com/logo.svg",
      "site_url": "https://provider.com"
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
      "supported_parameters": ["temperature", "max_tokens", "top_p"]
    }
  ],
  "total": 100,
  "returned": 10,
  "offset": 0,
  "limit": 10,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Example Usage:**
```bash
# Get all models
curl -X GET "https://your-api.com/models"

# Filter by provider with pagination
curl -X GET "https://your-api.com/models?provider=openai&limit=5&offset=0"
```

### 3. Get Specific Model

**Endpoint:** `GET /{provider_name}/{model_name}`

**Description:** Returns detailed information for a specific model from a given provider, including all available endpoints and their configurations.

**Path Parameters:**
- `provider_name` (string): The provider slug (e.g., "openai", "anthropic")
- `model_name` (string): The model name (e.g., "gpt-4", "claude-3")

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
# Get specific model information
curl -X GET "https://your-api.com/openai/gpt-4"
curl -X GET "https://your-api.com/anthropic/claude-3"
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

## Caching

- **Provider data**: Cached for 1 hour (3600 seconds)
- **Model data**: Cached for 30 minutes (1800 seconds)
- **Specific model data**: Not cached, fetched on-demand

## Rate Limiting

These endpoints are not rate-limited and can be called frequently. However, they do utilize caching to reduce load on the OpenRouter API.

## Authentication

These endpoints do not require authentication and are publicly accessible.

## Data Sources

All data is sourced from the OpenRouter API:
- Providers: `https://openrouter.ai/api/v1/providers`
- Models: `https://openrouter.ai/api/v1/models`
- Specific Model: `https://openrouter.ai/api/v1/models/{provider}/{model}/endpoints`

## Implementation Details

The implementation includes:
- Automatic caching with TTL
- Error handling and logging
- Pagination support
- Filtering capabilities
- Enhanced provider data with logos and site URLs
- Comprehensive model metadata
