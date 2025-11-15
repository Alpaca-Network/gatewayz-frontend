# GPT-5 Pricing Reference

## Overview

OpenRouter provides access to OpenAI's GPT-5 models with dynamic pricing. Pricing is automatically fetched from OpenRouter's API on startup and is cached in memory for performance.

## How Pricing Works

### Dynamic Pricing Fetching

When the Gatewayz API starts, it:

1. **Calls OpenRouter's `/v1/models` API** to fetch all available models including GPT-5
2. **Extracts pricing data** from each model's pricing object
3. **Caches models** in memory with a TTL (time-to-live)
4. **Sanitizes pricing** to handle edge cases like dynamic pricing (-1 values)

### Pricing Data Structure

OpenRouter returns pricing in the following format for each model:

```json
{
  "id": "openai/gpt-5.1",
  "name": "GPT-5.1",
  "pricing": {
    "prompt": "1.25",       // Cost per 1M input tokens in USD
    "completion": "10.00"   // Cost per 1M output tokens in USD
  },
  "context_length": 400000,
  "max_tokens": 128000,
  "source_gateway": "openrouter"
}
```

## Available GPT-5 Models

OpenRouter provides access to the following OpenAI GPT-5 models:

| Model ID | Name | Context | Max Output | Status |
|----------|------|---------|------------|--------|
| `openai/gpt-5.1` | GPT-5.1 | 400,000 tokens | 128,000 tokens | Latest |
| `openai/gpt-5` | GPT-5 | 128,000 tokens | TBD | Available |
| `openai/gpt-5-turbo` | GPT-5 Turbo | 128,000 tokens | TBD | High-speed variant |

**Note:** Model availability and pricing are subject to OpenRouter's catalog. Check the `/api/v1/models` endpoint for the most current list.

## Accessing GPT-5 Pricing

### Via OpenRouter Integration

All requests to GPT-5 models through Gatewayz use OpenRouter's pricing automatically:

```bash
curl -X POST http://localhost:8000/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-5",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Via Catalog Endpoint

Fetch all available models with pricing:

```bash
curl http://localhost:8000/api/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Response includes:
```json
{
  "data": [
    {
      "id": "openai/gpt-5",
      "pricing": {
        "prompt": "0.15",
        "completion": "0.60"
      },
      ...
    }
  ]
}
```

### Via Pricing Service

The pricing service automatically looks up costs for any model:

```python
from src.services.pricing import get_model_pricing, calculate_cost

# Get pricing for GPT-5.1
pricing = get_model_pricing("openai/gpt-5.1")
# Returns: {"prompt": 1.25, "completion": 10.00, "found": True}

# Calculate cost for a request
cost = calculate_cost(
    model_id="openai/gpt-5.1",
    prompt_tokens=1000,
    completion_tokens=500
)
# Returns cost in USD
```

## Cost Calculation

When a request is made to GPT-5.1, the cost is calculated as:

```
Total Cost = (prompt_tokens × prompt_price) + (completion_tokens × completion_price)
```

### Example

For a request with:
- **Model:** `openai/gpt-5.1`
- **Prompt tokens:** 1,000
- **Completion tokens:** 500
- **Pricing:** prompt=$1.25/1M, completion=$10.00/1M

```
Prompt cost:     1,000 × ($1.25 / 1,000,000) = $0.00125
Completion cost: 500 × ($10.00 / 1,000,000) = $0.005
Total cost:      $0.00625
```

## Pricing Cache Management

### Cache Location

Pricing is cached in memory in `src/cache.py`:
- Cache key: `_models_cache`
- Data structure: Dictionary with models list and timestamp

### Cache TTL (Time-To-Live)

The default cache TTL is configurable and checked in `src/services/models.py`:
- Check: `is_cache_fresh()` function
- Revalidation: `should_revalidate_in_background()` function
- Manual refresh: Call `refresh_pricing_cache()` when needed

### Cache Refresh

The cache can be:

1. **Automatically refreshed** on startup
2. **Background revalidated** when stale but still valid
3. **Manually refreshed** via the `/api/v1/system/cache/refresh` endpoint

```bash
curl -X POST http://localhost:8000/api/v1/system/cache/refresh \
  -H "Authorization: Bearer ADMIN_KEY"
```

## Pricing Sanitization

OpenRouter uses `-1` to indicate dynamic pricing for certain models. The system handles this by:

1. **Detecting negative values** in pricing data
2. **Converting to `0`** to prevent calculation errors
3. **Logging the conversion** for debugging

This happens in `src/services/models.py:sanitize_pricing()`.

## Important Considerations

### Rate Limiting

Each OpenRouter request is subject to:
- Per-user rate limits
- Per-API-key rate limits
- OpenRouter's global rate limits

### Credit System

GPT-5 requests consume credits based on token usage and pricing:
1. Request is processed through OpenRouter
2. Usage is extracted from response
3. Cost is calculated using GPT-5 pricing
4. Credits are deducted from user account

### Billing

- Charges are based on **actual tokens used**, not estimated
- Token counts come directly from OpenRouter's response
- Pricing follows OpenRouter's current rates
- Billing records are stored in the `credit_transactions` table

## Troubleshooting

### Model Not Found

If GPT-5 is not appearing in the model catalog:

1. **Check OpenRouter availability:**
   ```bash
   curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
     https://openrouter.ai/api/v1/models | jq '.data[] | select(.id | contains("gpt-5"))'
   ```

2. **Verify API key:** Ensure `OPENROUTER_API_KEY` is set in environment variables

3. **Refresh cache:** Call the cache refresh endpoint to force re-fetch

4. **Check logs:** Look for errors in `fetch_models_from_openrouter()` in application logs

### Pricing Not Showing

If pricing appears as `null` or `0`:

1. **Check OpenRouter's API response** - some models use dynamic pricing
2. **Verify sanitization** isn't converting valid pricing to 0
3. **Check cache freshness** - old cache might have stale data

### High Costs

To understand costs:

1. **Check token counts** in request logs
2. **Verify pricing** matches OpenRouter's current rates
3. **Review credit transactions** in database for detailed breakdown

## Related Files

- `src/services/models.py:776` - OpenRouter model fetching
- `src/services/models.py:212` - Pricing sanitization logic
- `src/services/pricing.py` - Pricing lookup and cost calculation
- `src/cache.py` - Cache management
- `src/config/config.py` - Configuration including API keys
- `src/routes/catalog.py` - Model catalog endpoint

## References

- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [OpenAI GPT-5 Documentation](https://platform.openai.com/docs/models)
- [Gatewayz Pricing System](./IMPLEMENTATION_SUMMARY.md)
- [Credit Management](./ACTIVITY_LOGGING.md)

## Last Updated

2025-11-15

**Note:** Pricing information is fetched dynamically from OpenRouter's API. For the most current rates, check the `/api/v1/models` endpoint or visit [OpenRouter's pricing page](https://openrouter.ai/pricing).
