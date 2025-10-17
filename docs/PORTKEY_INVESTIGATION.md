# Portkey Model Count Investigation

## Summary

**Finding**: Portkey API returns 500 models total, but you mentioned ~895 available.
**Root Cause**: Portkey's API doesn't expose per-provider model queries; it returns a fixed 500-model aggregate.
**Status**: Cannot directly query individual providers through Portkey API.

## Investigation Results

### 1. Portkey API Endpoints

**Working Endpoints**:
- `GET /v1/models` - Returns 500 models (total)
- `GET /v1/providers` - Returns 8 configured providers
- `GET /v1/integrations` - Returns 8 integrations

**Provider IDs Available**:
- `google` (de099012-29e4-4e20-bb1f-2e5c5ec3007f)
- `openrouter` (f4b061a9-f3c8-4676-9699-f3ba52458fb0)
- `novita` (7f203f72-b7b3-4cf9-9553-cd074df64a00)
- `nebius` (1420a71b-426c-41e6-9305-27e5f29ac6d5)
- `xai` (43f22141-ed43-4434-b67a-06e7d705814b)
- `cerebras` (0315da47-3134-4404-a1e8-c16cf3f32807)
- `hug` (a72c7009-34d0-46fe-8c46-25cc852de841)
- `deepinfra` (12e09c33-d73c-4756-81f6-f234ae85f040)

### 2. Per-Provider Query Attempts

All attempts to query models by individual provider failed:

| Attempt | Endpoint | Result | Status |
|---------|----------|--------|--------|
| `?provider={provider_id}` | `/v1/models?provider=...` | 0 models | 200 OK |
| `?provider={provider_name}` | `/v1/models?provider=openrouter` | 0 models | 200 OK |
| `x-portkey-provider` header | `/v1/models` with header | Various errors | 401/400/404 |
| `x-portkey-config` header | `/v1/models` with config | Various errors | 401/400/404 |
| Nested endpoint | `/v1/{provider}/models` | Invalid | 400 |
| Limit/Offset | `?limit=1000&offset=500` | 0 models | 200 OK |

### 3. Current 500 Models Distribution

The 500 models returned are distributed across 7 providers:

| Provider | Count |
|----------|-------|
| openrouter | 299 |
| deepinfra | 95 |
| google | 46 |
| nebius | 35 |
| xai | 15 |
| cerebras | 9 |
| novita | 1 |
| **Total** | **500** |

### 4. Direct Provider API Access

We successfully queried some providers directly:

| Provider | API Available | Count | Notes |
|----------|---------------|-------|-------|
| OpenRouter | Yes | 339 | Direct API works, accessible via `/v1/models` |
| DeepInfra | API Key Error | - | Configured with Portkey temp key, not standalone |
| Google | No key | - | GOOGLE_API_KEY not configured |
| Cerebras | No key | - | CEREBRAS_API_KEY not configured |
| Nebius | No key | - | NEBIUS_API_KEY not configured |
| Xai | No key | - | XAI_API_KEY not configured |
| Hug | No key | - | HUG_API_KEY not configured |
| Novita | No key | - | NOVITA_API_KEY not configured |

## Possible Explanations for ~895 Count

1. **Portkey Account Limit**: Your Portkey account/plan may have a default 500-model limit
2. **Active vs Total Models**: The 895 might include:
   - Inactive models
   - Archived models
   - Private/experimental models
   - Models from additional provider integrations not shown in our account
3. **API Rate Limiting**: Portkey might be limiting the response
4. **Account Status**: Different tiers might expose different model counts
5. **Time-based**: Model counts might have changed

## Recommendations

### Option 1: Query Portkey Support
Contact Portkey to ask:
- Why only 500 models are returned
- If there's a way to access more models
- If pagination or filtering is supported
- If there are rate limits or API limitations

### Option 2: Direct Provider APIs
Obtain API keys for other providers and query them directly:
- Google Models API
- Cerebras API
- Nebius API
- Xai API
- Novita API

### Option 3: Enhanced Export
Create a script that:
- Queries all available provider APIs directly (where keys are configured)
- Augments Portkey data with provider-specific models
- Exports comprehensive model list with provider source tracking

## Current Status

**CSV Export**: Contains 500 Portkey models (latest: models_export_2025-10-16_202520.csv)

**What Works**:
- Fetching 500 models from Portkey unified API
- Identifying 8 configured providers in Portkey
- Distributing models by provider origin

**What Doesn't Work**:
- Per-provider queries through Portkey API
- Pagination through limit/offset
- Provider-specific filtering via headers
- Accessing additional models beyond 500

## Code References

- Portkey fetching: `src/services/models.py:146-186` (`fetch_models_from_portkey()`)
- Model normalization: `src/services/models.py:235-321` (`normalize_portkey_model()`)
- CSV export: `export_models_to_csv.py`

## Next Steps

To resolve the ~895 vs 500 discrepancy:
1. Contact Portkey support for clarification
2. Check your Portkey account dashboard for model count
3. Review Portkey API documentation for pagination parameters
4. Consider querying individual provider APIs directly if additional keys are available
