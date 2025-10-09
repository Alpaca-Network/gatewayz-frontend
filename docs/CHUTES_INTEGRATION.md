# Chutes.ai Integration Guide

## Overview

This document describes the integration of Chutes.ai as a model provider in the Gatewayz backend. Chutes.ai provides access to 104+ AI models including LLMs, image generation, text-to-speech, embeddings, and more.

## Features

- **104 Models** across multiple categories:
  - 69 LLM models (DeepSeek, Qwen, NousResearch, etc.)
  - 19 Image Generation models (FLUX, Stable Diffusion, etc.)
  - 5 Content Moderation models
  - 4 Embeddings models
  - 2 Text-to-Speech models
  - 1 Speech-to-Text model
  - 1 Video model
  - 1 Music Generation model
  - 2 Other specialized models

- **Hourly Pricing Model** - Models are billed per hour of compute time
- **Hot/Popular Tags** - Some models are tagged for discoverability
- **Multi-modal Support** - Text, image, audio, video, and embeddings

## Architecture

### Files Modified/Created

1. **src/cache.py** - Added `_chutes_models_cache`
2. **src/config.py** - Added `CHUTES_API_KEY` configuration
3. **src/services/models.py** - Added Chutes fetching and normalization functions:
   - `fetch_models_from_chutes()` - Loads from static catalog or API
   - `fetch_models_from_chutes_api()` - Placeholder for future API integration
   - `normalize_chutes_model()` - Normalizes Chutes models to standard schema
   - Updated `get_cached_models()` to support "chutes" gateway

4. **src/routes/catalog.py** - Updated endpoints to support Chutes:
   - `/catalog/models?gateway=chutes` - Get Chutes models only
   - `/catalog/models?gateway=all` - Includes Chutes in combined results
   - `/catalog/provider?gateway=chutes` - Get Chutes providers

5. **src/data/chutes_catalog.json** - Static catalog with 104 models

### Data Flow

```
API Request (gateway=chutes)
    ↓
get_cached_models("chutes")
    ↓
Check _chutes_models_cache
    ↓
If expired or empty:
    fetch_models_from_chutes()
        ↓
    Load from static catalog (chutes_catalog.json)
        ↓
    Normalize each model with normalize_chutes_model()
        ↓
    Cache results
    ↓
Return normalized models
```

## Configuration

### Environment Variables

Add to your `.env` file (optional for static catalog):

```bash
CHUTES_API_KEY=your_chutes_api_key_here
```

**Note:** The static catalog works without an API key. The API key is only needed for future dynamic API integration.

## Model Schema

Chutes models are normalized to match the OpenRouter schema:

```json
{
  "id": "deepseek-ai/DeepSeek-R1",
  "slug": "deepseek-ai/DeepSeek-R1",
  "canonical_slug": "deepseek-ai/DeepSeek-R1",
  "name": "DeepSeek-R1",
  "description": "Chutes.ai hosted LLM model: deepseek-ai/DeepSeek-R1. Pricing: $22.0/hr.",
  "provider_slug": "deepseek-ai",
  "source_gateway": "chutes",
  "model_type": "LLM",
  "tags": ["hot", "popular"],
  "pricing": {
    "prompt": "0.000022",
    "completion": "0.000022",
    "hourly_rate": "22.0"
  },
  "architecture": {
    "modality": "text->text",
    "input_modalities": ["text"],
    "output_modalities": ["text"]
  }
}
```

### Special Fields

- **model_type** - Category: "LLM", "Image Generation", "Text to Speech", etc.
- **tags** - Array of tags like "hot", "popular"
- **pricing.hourly_rate** - Chutes uses hourly pricing instead of per-token

## API Endpoints

### Get Chutes Models

```bash
GET /catalog/models?gateway=chutes&limit=10
```

Response:
```json
{
  "data": [...],
  "total": 104,
  "returned": 10,
  "gateway": "chutes",
  "note": "Chutes.ai catalog",
  "timestamp": "2025-10-08T..."
}
```

### Get All Models (Including Chutes)

```bash
GET /catalog/models?gateway=all&limit=100
```

Combines models from OpenRouter, Portkey, Featherless, and Chutes.

### Filter by Provider

```bash
GET /catalog/models?gateway=chutes&provider=deepseek-ai
```

### Get Chutes Providers

```bash
GET /catalog/provider?gateway=chutes
```

## Testing

### Unit Tests

```bash
# Test Chutes model loading
python3 test_chutes_integration.py
```

Expected output:
```
✓ Successfully loaded 104 Chutes models

Model types breakdown:
  LLM: 69
  Image Generation: 19
  Content Moderation: 5
  Embeddings: 4
  ...
```

### API Tests

```bash
# Start the server
uvicorn src.main:app --reload

# In another terminal, test the API
python3 test_chutes_api.py
```

### Manual Testing

```bash
# Get Chutes models
curl "http://localhost:8000/catalog/models?gateway=chutes&limit=5"

# Get all models including Chutes
curl "http://localhost:8000/catalog/models?gateway=all&limit=10"

# Filter by model type (requires custom logic)
curl "http://localhost:8000/catalog/models?gateway=chutes" | jq '.data[] | select(.model_type == "Image Generation")'
```

## Model Categories

### LLM Models (69)
- DeepSeek (R1, V3, V3.1, etc.)
- Qwen (Qwen3, Qwen2.5, etc.)
- NousResearch (Hermes series)
- Microsoft (MAI-DS-R1-FP8)
- OpenAI (gpt-oss variants)

### Image Generation (19)
- FLUX.1-schnell, FLUX.1-dev
- Stable Diffusion XL variants
- JuggernautXL, HassakuXL, Animij
- iLustMix, hidream, nova-anime3d-xl

### Specialized Models
- **Embeddings**: Qwen3-Embedding, sentence-transformers
- **Content Moderation**: BAAI/bge, nsfw-classifier, hate-speech-detector
- **Text-to-Speech**: csm-1b, kokoro
- **Speech-to-Text**: whisper-large-v3
- **Video**: wan2.1-14b
- **Music**: diffrhythm

## Pricing Tiers

Models are available at various hourly rates:

| Tier | Hourly Rate | Example Models |
|------|-------------|----------------|
| Free | $0.00/hr | zai-org/GLM-4.5-Air, gemma-3-4b-it |
| Budget | $0.13-$2.00/hr | Most 8B-14B models |
| Standard | $2.00-$6.00/hr | 30B-70B models |
| Premium | $6.00-$22.00/hr | Large 70B+ models |
| Enterprise | $22.00-$36.30/hr | Flagship models like DeepSeek-V3, GLM-4.5-FP8 |

## Future Enhancements

1. **Dynamic API Integration** - Replace static catalog with live API calls
2. **Model Availability Monitoring** - Track which models are online
3. **Usage Analytics** - Track popular Chutes models
4. **Custom Filtering** - Filter by model_type, pricing, tags
5. **Provider Metadata** - Enhanced provider information with logos
6. **Routing Integration** - Direct inference requests to Chutes models

## Troubleshooting

### Models Not Loading

```bash
# Check if catalog file exists
ls -la src/data/chutes_catalog.json

# Test loading directly
python3 test_chutes_integration.py
```

### API Returns Empty Results

```bash
# Check logs
tail -f uvicorn_test.log

# Verify gateway parameter
curl "http://localhost:8000/catalog/models?gateway=chutes" | jq '.total'
```

### Cache Issues

The cache TTL is 3600 seconds (1 hour). To force refresh:
- Restart the server
- Wait for cache to expire
- Implement cache invalidation endpoint

## Integration Summary

✅ **Completed:**
- Added Chutes.ai as a supported gateway
- Created static catalog with 104 models
- Normalized model schema to match existing providers
- Updated all API endpoints to support Chutes
- Added comprehensive testing

🔄 **Future Work:**
- Live API integration (when Chutes SDK is available)
- Model routing for inference requests
- Enhanced provider metadata
- Custom filtering by model type

## Support

For issues or questions:
1. Check the test scripts: `test_chutes_integration.py`, `test_chutes_api.py`
2. Review logs for error messages
3. Verify catalog file: `src/data/chutes_catalog.json`
4. Check configuration: `src/config.py`

---

**Last Updated:** 2025-10-08
**Version:** 1.0.0
**Models:** 104
