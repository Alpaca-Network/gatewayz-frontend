# GPT-5.1 Implementation & Pricing Guide

## Overview

This guide documents how GPT-5.1 pricing is implemented, verified, and made available through the Gatewayz API. GPT-5.1 is available through OpenRouter and uses dynamic pricing fetched directly from their API.

## Quick Start

### For Users

To use GPT-5.1 through the API:

```bash
curl -X POST http://localhost:8000/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-5.1",
    "messages": [
      {"role": "user", "content": "Hello, how can you help?"}
    ]
  }'
```

### For Developers

To verify GPT-5.1 pricing is working:

```bash
python3 scripts/verify_gpt5_pricing.py
```

To run tests:

```bash
pytest tests/routes/test_gpt5_pricing.py -v
```

## How It Works

### 1. Dynamic Pricing Fetch

On application startup and periodically:

1. **OpenRouter API Call** → `/v1/models` endpoint
2. **Model Extraction** → Filter for `openai/gpt-5.1` and variants
3. **Pricing Extraction** → Extract pricing data from response
4. **Cache Storage** → Store in memory with TTL
5. **Registration** → Register in canonical model registry

**Code Path**: `src/services/models.py:776-804` (`fetch_models_from_openrouter`)

### 2. Pricing Data Structure

From OpenRouter API:

```json
{
  "id": "openai/gpt-5.1",
  "name": "GPT-5.1",
  "pricing": {
    "prompt": "1.25",       // $1.25 per 1M input tokens
    "completion": "10.00"   // $10.00 per 1M output tokens
  },
  "context_length": 400000,
  "max_tokens": 128000,
  "source_gateway": "openrouter"
}
```

### 3. Pricing Sanitization

Handles edge cases:

- **Dynamic Pricing** (`-1`): Converted to `"0"` to prevent calculation errors
- **Null Pricing**: Treated as `0`
- **Type Conversion**: All prices converted to strings for consistency

**Code Path**: `src/services/models.py:212-240` (`sanitize_pricing`)

### 4. Cost Calculation

When a request is made:

```python
cost = (prompt_tokens × prompt_price) + (completion_tokens × completion_price)
```

**Code Path**: `src/services/pricing.py:91-123` (`calculate_cost`)

### 5. Cache Management

- **Cache Location**: In-memory dictionary (`_models_cache` in `src/cache.py`)
- **TTL Strategy**: Configurable expiration with background revalidation
- **Refresh Endpoints**:
  - Automatic on startup
  - Manual via `/api/v1/system/cache/refresh`
  - Background revalidation when stale

**Code Path**: `src/services/models.py:528-764` (`get_cached_models`)

## API Endpoints

### 1. Get All Models

```bash
GET /v1/models
```

Returns all models including GPT-5.1 with pricing:

```json
{
  "data": [
    {
      "id": "openai/gpt-5.1",
      "pricing": {
        "prompt": "1.25",
        "completion": "10.00"
      }
    }
  ]
}
```

### 2. Get OpenRouter Models

```bash
GET /models?gateway=openrouter
```

### 3. Get Specific Provider

```bash
GET /v1/provider?gateway=openrouter
```

### 4. Refresh Cache

```bash
POST /api/v1/system/cache/refresh
```

## Cost Examples

### Example 1: Short Response

Input: 100 tokens
Output: 50 tokens

```
Prompt Cost:     100 × $1.25 / 1,000,000 = $0.000125
Completion Cost: 50 × $10.00 / 1,000,000  = $0.0005
Total:          $0.000625
```

### Example 2: Medium Response

Input: 1,000 tokens
Output: 500 tokens

```
Prompt Cost:     1,000 × $1.25 / 1,000,000 = $0.00125
Completion Cost: 500 × $10.00 / 1,000,000   = $0.005
Total:           $0.00625
```

### Example 3: Large Response

Input: 10,000 tokens
Output: 5,000 tokens

```
Prompt Cost:     10,000 × $1.25 / 1,000,000 = $0.0125
Completion Cost: 5,000 × $10.00 / 1,000,000  = $0.05
Total:           $0.0625
```

## Implementation Details

### Key Files

| File | Purpose |
|------|---------|
| `src/services/models.py:776` | `fetch_models_from_openrouter()` - Fetches models from API |
| `src/services/models.py:212` | `sanitize_pricing()` - Handles pricing edge cases |
| `src/services/pricing.py:12` | `get_model_pricing()` - Looks up pricing for model |
| `src/services/pricing.py:91` | `calculate_cost()` - Calculates request cost |
| `src/cache.py` | Cache management and TTL |
| `docs/GPT5_PRICING_REFERENCE.md` | User-facing documentation |

### Test Suite

| Test File | Coverage |
|-----------|----------|
| `tests/routes/test_gpt5_pricing.py:20` | Model availability |
| `tests/routes/test_gpt5_pricing.py:38` | Pricing structure |
| `tests/routes/test_gpt5_pricing.py:78` | Cost calculations |
| `tests/routes/test_gpt5_pricing.py:110` | API endpoints |
| `tests/routes/test_gpt5_pricing.py:144` | Dynamic pricing fetch |

### Verification Script

`scripts/verify_gpt5_pricing.py` checks:

- ✓ Pricing data structure validity
- ✓ Dynamic pricing handling (-1 → 0)
- ✓ GPT-5.1 data format correctness
- ✓ Cost calculation accuracy
- ✓ Model ID format validation
- ✓ Cache management availability
- ✓ OpenRouter integration
- ✓ Pricing lookup service

## Available Models

### Primary Models

| Model ID | Name | Context | Max Output | Status |
|----------|------|---------|------------|--------|
| `openai/gpt-5.1` | GPT-5.1 | 400k tokens | 128k tokens | Latest |
| `openai/gpt-5.1-turbo` | GPT-5.1 Turbo | 400k tokens | 128k tokens | High-speed |
| `openai/gpt-5` | GPT-5 | 128k tokens | TBD | Standard |

**Note:** Model availability is determined by OpenRouter. Check `/v1/models` endpoint for current availability.

## Configuration

### Environment Variables Required

```bash
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_SITE_URL=https://your-site.com
OPENROUTER_SITE_NAME=Your Site Name
```

### Optional Cache Configuration

Modify in `src/cache.py`:

```python
# Cache TTL settings (in seconds)
CACHE_TTL = 3600  # 1 hour

# Background revalidation
REVALIDATION_INTERVAL = 1800  # 30 minutes
```

## Troubleshooting

### Issue: GPT-5.1 Not Appearing in Models

**Check:**
1. OpenRouter API key is configured: `echo $OPENROUTER_API_KEY`
2. Cache is fresh: Call `/api/v1/system/cache/refresh`
3. Logs for fetch errors: `grep "fetch_models_from_openrouter" logs/app.log`

**Solution:**
```bash
# Manually refresh cache
curl -X POST http://localhost:8000/api/v1/system/cache/refresh \
  -H "Authorization: Bearer ADMIN_KEY"

# Check models are fetched
curl http://localhost:8000/v1/models -H "Authorization: Bearer YOUR_KEY" | grep gpt-5
```

### Issue: Pricing Shows as 0 or Null

**Possible Causes:**
- Dynamic pricing (`-1`) being converted to `0` (expected behavior)
- OpenRouter API temporarily unavailable
- Stale cache with missing data

**Solution:**
```bash
# Verify pricing from OpenRouter directly
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models | jq '.data[] | select(.id | contains("gpt-5"))'
```

### Issue: High or Unexpected Costs

**Check:**
1. Token counts in response headers
2. Pricing matches OpenRouter's current rates
3. Review credit transaction logs in database

**Query database:**
```sql
SELECT * FROM credit_transactions
WHERE model_id LIKE '%gpt-5%'
ORDER BY created_at DESC LIMIT 10;
```

## Monitoring & Observability

### Log Entries to Watch

```
✓ "Successfully fetched GPT-5.1 from OpenRouter"
✓ "Found pricing for openai/gpt-5.1"
✗ "Failed to fetch models from OpenRouter"
✗ "Model not found in catalog"
```

### Metrics to Track

- Models fetched from OpenRouter (count, time)
- Cache hit/miss ratio
- Cost calculation accuracy
- API response times

### Health Check

```bash
curl http://localhost:8000/health
```

Includes model availability and cache status.

## Performance Considerations

### Caching Strategy

- **First Request**: Fetches from OpenRouter (~500ms-1s)
- **Cached Requests**: Memory lookup (~1-5ms)
- **Background Revalidation**: Non-blocking refresh

### Token Efficiency

GPT-5.1 capabilities:
- **Context Window**: **400,000 tokens** (4x larger than GPT-4)
- **Max Output**: **128,000 tokens**
- Can process entire books or long documents efficiently
- Excellent for multi-turn conversations
- Higher cost but for extremely long-form reasoning tasks

## Security Considerations

### API Key Protection

- Keys stored encrypted in database
- Never logged in plain text
- Sanitized in error messages

### Pricing Data

- Pricing is public information from OpenRouter
- No sensitive data in pricing structures
- Cache contents not logged

## Related Documentation

- **API Reference**: See `docs/api.md`
- **Pricing System**: See `docs/IMPLEMENTATION_SUMMARY.md`
- **Credit Management**: See `docs/ACTIVITY_LOGGING.md`
- **Provider Integration**: See `docs/integration/`

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.3 | 2025-11-15 | Initial GPT-5.1 support added |

## Support

For issues or questions:

1. Check `docs/GPT5_PRICING_REFERENCE.md` for user guide
2. Run `scripts/verify_gpt5_pricing.py` for system health
3. Review test file `tests/routes/test_gpt5_pricing.py` for examples
4. Check application logs for detailed error messages

---

**Last Updated**: 2025-11-15

**Branch**: `terragon/add-gpt5-pricing-reference-mvaks2`

**Related Commits**:
- `bde552d` - docs: add comprehensive GPT-5 pricing reference guide
- `611e0b8` - test: add comprehensive GPT-5.1 pricing verification
