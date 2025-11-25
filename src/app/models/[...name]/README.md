# Model Detail Pages - Hybrid Static + Dynamic Generation

This directory implements a hybrid approach to model detail page generation using Next.js 15+ features for optimal performance and automatic provider model discovery.

## Overview

Model detail pages can now be:
1. **Pre-generated at build time** for popular/important models (fastest)
2. **Generated on first request** for new models from providers (on-demand)
3. **Automatically revalidated hourly** to keep pricing and info current
4. **Instantly regenerated** via webhook when providers add/update models

## Architecture

### Files

- **`page.tsx`** - Client component rendering the model detail page
  - Fetches model data from API
  - Displays model info, pricing, providers, etc.
  - No server-side logic (pure client rendering)

- **`layout.tsx`** - Server component handling ISR configuration
  - `generateStaticParams()` - Pre-generates ~50 popular models at build time
  - `revalidate = 3600` - Revalidates all pages every 1 hour
  - `dynamicParams = true` - Enables dynamic routes for models not pre-generated

- **`utils.ts`** - Utility functions for model data and route generation
  - `getPopularModels()` - Fetches top models for static generation
  - `modelToRouteParams()` - Converts model data to route parameters
  - `generateStaticParamsForModels()` - Main entry point for static generation
  - Cache tag helpers for ISR

## How It Works

### 1. Build Time (Static Generation)

At build/deployment time:

```
NextJS Build Process
  ↓
layout.tsx: generateStaticParams()
  ↓
- Loads all static models from models-data.ts
- Fetches top models from OpenRouter gateway
- Takes up to 50 most important models
  ↓
For each model:
  - Convert name to URL format: "Claude Opus 4.5" → "claude-opus-4-5"
  - Generate route params: {name: ['anthropic', 'claude-opus-4-5']}
  - Pre-render and cache HTML
  ↓
Result: ~50 model pages pre-generated at build time
Benefit: Instant page loads, better SEO, fast TTFB
```

### 2. ISR Revalidation (Time-Based)

Every page is automatically revalidated on a schedule:

```
User visits /models/anthropic/claude-opus-4-5
  ↓
Is cached page fresh? (< 1 hour old)
  ├─ YES → Serve cached page instantly
  └─ NO → Serve stale page + regenerate in background
           (user doesn't wait)
  ↓
Background regeneration:
- Fetch updated model data from API
- Re-render page with new pricing, availability, etc.
- Cache new version
- Next visitor gets fresh page
  ↓
Result: Maximum 1 hour before page data updates
Benefit: Low latency, always reasonably current data
```

### 3. Dynamic Routes (First-Request Rendering)

For models not pre-generated (e.g., newly added models):

```
Provider adds new model: "xai/grok-3"
  ↓
User visits /models/xai/grok-3
  ↓
Model not in pre-generated list?
  ├─ YES → Static page served immediately
  └─ NO → Dynamic rendering on first request
         (page generates then caches)
  ↓
First visitor experiences:
- Slight delay (page generating)
- But less than completely dynamic rendering
- Subsequent visitors get cached version
  ↓
Result: New models discoverable without redeploy
Benefit: Automatic discovery of provider models
```

### 4. On-Demand Invalidation (Webhook-Triggered)

When providers add/update models, webhook triggers instant refresh:

```
Backend detects new model from provider
  ↓
Sends webhook to /api/webhooks/models-updated
  ↓
Webhook processing:
- Verifies signature (HMAC-SHA256)
- Extracts model info
- Calls revalidatePath() for:
  - Individual model detail pages
  - /models listing
  - /rankings page
- Calls revalidateTag() for:
  - model:{modelId}
  - models:detail
  - models:search
  ↓
Next-Gen CDN invalidates cache
Next request triggers regeneration
  ↓
Result: New models visible within seconds
Benefit: Real-time model availability updates
```

## Configuration

### Static Generation

Edit `src/app/models/[...name]/utils.ts`:

```typescript
export async function getPopularModels(limit: number = 50) {
  // Adjust limit to change how many models are pre-generated
  // Higher = longer build time, faster page loads
  // Lower = faster build time, more dynamic rendering
}
```

Current default: **50 models** pre-generated at build time

### ISR Revalidation Time

Edit `src/app/models/[...name]/layout.tsx`:

```typescript
export const revalidate = 3600; // in seconds
// 3600 = 1 hour
// Adjust based on how often model data changes
```

Current default: **3600 seconds (1 hour)**

### Dynamic Params

```typescript
export const dynamicParams = true;
// true = enable dynamic routes (recommended)
// false = only serve pre-generated params, 404 otherwise
```

Current default: **true** (allows discovery of new models)

## Cache Tags

The system uses cache tags for granular invalidation:

```typescript
MODEL_CACHE_TAGS = {
  ALL: 'models:all',           // All model pages
  POPULAR: 'models:popular',   // Popular models (pre-generated)
  DETAIL: 'models:detail',     // Individual model pages
  SEARCH: 'models:search',     // Search results
}
```

Tags are invalidated via:

1. **Time-based**: Every `revalidate` seconds
2. **Webhook**: `/api/webhooks/models-updated`
3. **Manual**: API endpoint for testing

## Performance Impact

### Build Time

- Additional: ~5-10 seconds
- Pre-generates 50 popular model pages
- Can be tuned by adjusting `getPopularModels(limit)`

### Page Load Time

**Pre-generated models** (50 most popular):
- First visit: < 100ms (static HTML)
- Cached visits: < 50ms

**Newly discovered models** (first request):
- First visit: 1-2 seconds (dynamic rendering)
- Cached visits: < 100ms

**All subsequent visits**: < 100ms (served from cache)

### Storage

- ~50 static pages at build time
- Each page: ~150-200KB
- Total disk: ~10MB additional storage

## Webhook Integration

Backend should send webhook to:

```
POST https://beta.gatewayz.ai/api/webhooks/models-updated

Headers:
  Content-Type: application/json
  x-webhook-signature: <HMAC-SHA256 signature>

Body:
{
  "gateway": "openrouter",
  "event_type": "models.added",
  "models": [
    {
      "id": "anthropic/claude-opus-4-5",
      "name": "Claude Opus 4.5",
      "provider_slug": "anthropic",
      ...
    }
  ],
  "timestamp": 1700000000000
}
```

**Supported events:**
- `models.added` - New model added
- `models.updated` - Model updated (pricing, availability)
- `models.removed` - Model removed
- `gateway.status_changed` - Gateway availability changed

**Signature verification:**
```
signature = HMAC_SHA256(body, MODEL_WEBHOOK_SECRET)
header = hex(signature)
```

Environment variable: `MODEL_WEBHOOK_SECRET`

## Testing

### Test Static Generation

```bash
# Build the project (runs generateStaticParams)
npm run build

# Check output to see pre-generated routes
# Look for: "prerendered" in build output for model pages
```

### Test ISR Revalidation

```bash
# Run dev server
npm run dev

# Visit a model page (will be dynamically rendered)
# Note the load time

# Wait, then visit again
# Should be much faster (cached version)

# After 1 hour or manual invalidation, page regenerates
```

### Test Webhook Invalidation

```bash
# Call webhook with test data
curl -X POST http://localhost:3000/api/webhooks/models-updated \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: <valid-sig>" \
  -d '{
    "gateway": "openrouter",
    "event_type": "models.added",
    "models": [{
      "id": "anthropic/test-model",
      "name": "Test Model"
    }]
  }'
```

## Future Improvements

1. **Selective static generation** - Prioritize models by popularity/revenue
2. **Parallel webhook processing** - Handle high-volume model updates
3. **Analytics-driven param selection** - Generate pages for most-visited models
4. **Edge-side rendering** - Use Vercel Edge Functions for ultra-fast responses
5. **Stale-while-revalidate headers** - Better cache control
6. **Real-time updates** - WebSocket for instant model data

## Troubleshooting

### Pages not generating at build time

- Check `getPopularModels()` function logs
- Verify `generateStaticParams` is being called
- Check build output for pre-rendering status

### Webhook not updating pages

- Verify `MODEL_WEBHOOK_SECRET` environment variable is set
- Check signature verification (HMAC-SHA256)
- Look at server logs at `/api/webhooks/models-updated`

### Old data showing on pages

- Check ISR revalidation time (`revalidate` constant)
- Manually invalidate via webhook
- Check Next.js cache storage

## Related Files

- Model data: `src/lib/models-data.ts`
- Model fetching: `src/lib/models-service.ts`
- Webhook handler: `src/app/api/webhooks/models-updated/route.ts`
- Cache invalidation: `src/app/api/cache/invalidate/route.ts`
