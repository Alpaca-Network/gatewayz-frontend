# Model Update Synchronization System

This system ensures that model pages are automatically updated as new models are added to providers.

## Overview

The model synchronization system provides multiple layers of automation to keep model data current:

1. **Automated Background Sync** - Regular polling of all gateways
2. **Webhook-based Updates** - Real-time notifications from providers
3. **Cache Invalidation** - Smart cache management
4. **Manual Sync Tools** - Admin tools for on-demand updates

## Components

### 1. Model Sync Service (`src/lib/model-sync-service.ts`)

The core service that handles automated synchronization:

- **Frequency-based Updates**: Different sync intervals for different gateways
  - High-frequency (15 min): openrouter, groq, together, fireworks
  - Medium-frequency (1 hour): google, cerebras, nebius, xai
  - Low-frequency (4 hours): huggingface, aimo, near, fal, vercel-ai-gateway
- **Change Detection**: Compares snapshots to identify new/updated/removed models
- **Cache Invalidation**: Automatically invalidates caches when changes are detected
- **Error Handling**: Robust error handling with Sentry integration

### 2. Webhook Handler (`src/app/api/webhooks/models-updated/route.ts`)

Receives real-time notifications from providers:

- **Signature Verification**: Secure webhook processing
- **Event Types**: Handles models.added, models.updated, models.removed, gateway.status_changed
- **Targeted Invalidation**: Precise cache invalidation based on event type
- **Batch Processing**: Efficient handling of multiple model updates

### 3. Cache Management (`src/app/api/cache/invalidate/route.ts`)

Manages cache invalidation:

- **Tag-based Invalidation**: Uses Next.js cache tags for precise control
- **Multi-level Caching**: Gateway-specific, model-specific, and global caches
- **Path Invalidation**: Invalidates relevant pages when data changes

### 4. Background Initialization (`src/components/model-sync-initializer.tsx`)

Starts the sync service when the app boots:

- **Singleton Pattern**: Prevents multiple initialization
- **Non-blocking**: Doesn't delay app startup
- **Error Recovery**: Graceful handling of initialization failures

## Usage

### Manual Sync

```bash
# Sync all gateways
npm run sync-models

# Sync specific gateway
npm run sync-models openrouter
```

### Check Status

```bash
# Check all gateway status
npm run model-sync-status
```

### API Endpoints

```bash
# Trigger manual sync
POST /api/sync/models
{
  "gateway": "all" | "openrouter" | "google" | ...
}

# Get sync status
GET /api/sync/status?gateway=openrouter

# Invalidate cache
POST /api/cache/invalidate
{
  "type": "models",
  "gateway": "openrouter"
}
```

## Configuration

### Environment Variables

```env
# Webhook security
MODEL_WEBHOOK_SECRET=your-secure-secret

# API endpoints
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai

# Provider API keys (if needed for webhooks)
OPENROUTER_API_KEY=...
GOOGLE_API_KEY=...
```

### Sync Frequency Adjustment

Edit `src/lib/model-sync-service.ts`:

```typescript
private readonly SYNC_INTERVALS = {
  high_frequency: ['gateway1', 'gateway2'], // 15 minutes
  medium_frequency: ['gateway3', 'gateway4'], // 1 hour  
  low_frequency: ['gateway5', 'gateway6'], // 4 hours
};
```

## Monitoring

### Sentry Integration

All sync operations are tracked in Sentry:

- Sync failures and errors
- Performance metrics
- Gateway-specific issues

### Analytics Integration

Sync events are logged to analytics:

- Model addition/removal counts
- Gateway availability changes
- Sync performance metrics

## Webhook Setup

### Provider Configuration

Configure providers to send webhooks to:

```
https://beta.gatewayz.ai/api/webhooks/models-updated
```

### Payload Format

```json
{
  "gateway": "openrouter",
  "event_type": "models.added",
  "models": [
    {
      "id": "openai/gpt-5",
      "name": "GPT-5",
      "provider_slug": "openai"
    }
  ],
  "timestamp": 1704067200000
}
```

### Security

- Include `X-Webhook-Signature` header with HMAC-SHA256 signature
- Set `MODEL_WEBHOOK_SECRET` environment variable
- Webhooks are rejected if signature verification fails

## Cache Strategy

### Cache Tags

- `models:all` - All model data
- `models:gateway:{gateway}` - Gateway-specific models
- `model:{modelId}` - Individual model pages
- `models:search` - Search results cache
- `rankings` - Analytics rankings data

### Invalidation Triggers

- **Model Changes**: Gateway and model-specific tags
- **New Models**: Global model cache and search
- **Gateway Status**: All model-related caches
- **Rankings Updates**: Rankings-specific cache

## Troubleshooting

### Common Issues

1. **Sync Not Running**: Check if ModelSyncInitializer is properly imported
2. **Cache Not Updating**: Verify webhook signature and cache tags
3. **High Memory Usage**: Check for memory leaks in long-running sync
4. **API Rate Limits**: Adjust sync frequencies for rate-limited gateways

### Debug Mode

Enable detailed logging:

```typescript
// In model-sync-service.ts
console.log(`[ModelSync] Detailed info:`, { ... });
```

### Health Checks

Monitor sync health:

```bash
# Check last sync times
curl https://beta.gatewayz.ai/api/sync/status

# Test webhook endpoint
curl https://beta.gatewayz.ai/api/webhooks/models-updated
```

## Performance Considerations

### Database Impact

- Sync operations are read-only
- No database writes required
- Minimal performance impact

### Memory Usage

- Snapshots stored in memory
- Automatic cleanup of old data
- Configurable retention policies

### Network Usage

- Efficient parallel fetching
- Request timeouts and retries
- Compression support

## Future Enhancements

1. **Real-time Subscriptions**: WebSocket-based model updates
2. **Smart Caching**: ML-based cache prediction
3. **Multi-region Sync**: Geo-distributed model data
4. **Provider Health Monitoring**: Advanced gateway health tracking
5. **Automated Testing**: Continuous sync validation