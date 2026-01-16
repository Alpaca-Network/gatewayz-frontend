# Redis Metrics System - Quick Start Guide

## Overview

This is a quick reference for the Redis-based real-time monitoring system. For complete details, see [REDIS_METRICS_BACKEND_GUIDE.md](./REDIS_METRICS_BACKEND_GUIDE.md).

## What's Already Implemented ✅

- **Core Service**: `src/lib/redis-metrics.ts` (620 lines)
- **Redis Client**: `src/lib/redis-client.ts` (117 lines)
- **API Endpoints**: 5 complete endpoints in `src/app/api/metrics/`
- **React Hooks**: `src/hooks/use-realtime-metrics.ts`
- **UI Components**: RealtimeMetricsCard, HealthLeaderboard
- **Cache Strategies**: Integrated with existing caching system

## Quick Start

### 1. Environment Setup

```bash
# Add to .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0
```

### 2. Test the System

```bash
# Test Redis connection
npx ts-node scripts/test-metrics.ts

# Run load test
npx ts-node scripts/load-test-metrics.ts
```

### 3. Record Metrics (Client-side)

Already integrated via `ChatPerformanceTracker`:

```typescript
import { chatPerformanceTracker } from '@/lib/chat-performance-tracker';

// Metrics are automatically recorded and sent to Redis
// when chat completions complete
```

### 4. Fetch Metrics (API)

```bash
# Get model metrics
curl "http://localhost:3000/api/metrics/realtime?type=model&id=anthropic/claude-3.5-sonnet"

# Get health leaderboard
curl "http://localhost:3000/api/metrics/health/leaderboard?order=desc&limit=10"

# Get trends
curl "http://localhost:3000/api/metrics/trends?model=anthropic/claude-3.5-sonnet&metric=ttft&hours=6"
```

### 5. Display Metrics (React)

```tsx
import { RealtimeMetricsCard } from '@/components/metrics/realtime-metrics-card';

function Dashboard() {
  return (
    <RealtimeMetricsCard
      type="model"
      id="anthropic/claude-3.5-sonnet"
      pollingInterval={5000}
    />
  );
}
```

## Key Concepts

### Time Bucketing

- **Format**: `YYYY-MM-DD-HH` (e.g., `2025-11-27-14`)
- **Granularity**: Hourly
- **TTL**: 1 hour (automatic expiration)
- **Trends**: 6-hour retention for time-series

### Redis Keys

```
metrics:model:{model_id}:requests:{bucket}     - Request count
metrics:model:{model_id}:latency:{bucket}      - Latency aggregates
metrics:model:{model_id}:status:{bucket}       - Success/error counts
metrics:model:{model_id}:ttft_series           - Time-series data
metrics:health:models:{bucket}                 - Health leaderboard
```

### Metrics Tracked

- **TTFT**: Time to First Token (ms)
- **Total Time**: Complete response time (ms)
- **Success Rate**: Percentage (0-100)
- **Error Types**: timeout, rate_limit, network, other
- **Request Count**: Total requests per hour

## Integration Checklist

### What's Missing (Server-Side Recording)

Server-side metrics recording is **not yet integrated**. Client-side recording via `ChatPerformanceTracker` works, but backend validation and gateway monitoring needs integration:

- [ ] Add metrics recording in `/api/chat/completions/route.ts`
- [ ] Add TTFT tracking in `/lib/streaming.ts`
- [ ] Add gateway metrics in `/lib/models-service.ts`
- [ ] Add utility functions (`extractProvider`, `determineErrorType`)

### Integration Steps

**1. Add Utility Functions** (`src/lib/utils.ts`):

```typescript
export function extractProvider(modelId: string): string {
  if (!modelId) return 'unknown';
  if (modelId.includes('/')) return modelId.split('/')[0];
  if (modelId.includes(':')) return modelId.split(':')[0];
  return 'unknown';
}

export function determineErrorType(error: any): 'timeout' | 'rate_limit' | 'network' | 'other' {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (error.name === 'AbortError' || msg.includes('timeout')) return 'timeout';
    if (msg.includes('rate limit') || msg.includes('429')) return 'rate_limit';
    if (msg.includes('network') || msg.includes('econnrefused')) return 'network';
  }
  return 'other';
}
```

**2. Chat Completions** (`src/app/api/chat/completions/route.ts`):

```typescript
import { metricsService } from '@/lib/redis-metrics';
import { extractProvider, determineErrorType } from '@/lib/utils';

// After non-streaming response
const latency = Date.now() - startTime;
metricsService.recordRequestComplete({
  model: body.model,
  gateway: body.gateway,
  provider: extractProvider(body.model),
  total_time_ms: latency,
  success: true,
}).catch(console.error);

// In error handlers
metricsService.recordStatus({
  model: body.model,
  gateway: body.gateway,
  provider: extractProvider(body.model),
  success: false,
  error_type: determineErrorType(error),
}).catch(console.error);
```

**3. Streaming TTFT** (`src/lib/streaming.ts`):

```typescript
// At start of function
const streamStartTime = performance.now();
let recordedTTFT: number | undefined;

// When first token arrives
if (isFirstContentChunk && (chunk.content || chunk.reasoning)) {
  const ttft = performance.now() - streamStartTime;
  recordedTTFT = ttft;

  metricsService.recordLatency({
    model: requestBody.model,
    gateway: requestBody.gateway,
    provider: extractProvider(requestBody.model),
    ttft_ms: ttft,
  }).catch(console.error);
}

// On stream complete
const totalTime = performance.now() - streamStartTime;
metricsService.recordRequestComplete({
  model: requestBody.model,
  ttft_ms: recordedTTFT,
  total_time_ms: totalTime,
  success: true,
}).catch(console.error);
```

**4. Gateway Metrics** (`src/lib/models-service.ts`):

```typescript
// Before fetch
const fetchStartTime = Date.now();

// On success
const fetchTime = Date.now() - fetchStartTime;
metricsService.recordGatewayFetch('success', {
  gateway: gateway,
  model_count: data.data.length,
  response_time_ms: fetchTime,
}).catch(console.error);

// On error
metricsService.recordGatewayFetch('error', {
  gateway: gateway,
  error_type: isAbortOrNetworkError(error) ? 'timeout' : 'error',
}).catch(console.error);
```

## Testing

### Manual Test

```bash
npx ts-node scripts/test-metrics.ts
```

### Load Test

```bash
npx ts-node scripts/load-test-metrics.ts
```

### Check Redis

```bash
# Check keys
redis-cli KEYS "metrics:*" | head -10

# Check memory
redis-cli INFO memory | grep used_memory_human

# Check a specific metric
redis-cli HGETALL "metrics:model:anthropic/claude-3.5-sonnet:latency:2025-11-27-14"
```

## Performance Characteristics

- **Write**: Fire-and-forget, <5ms, never blocks
- **Read**: <50ms cached, <200ms uncached
- **Memory**: ~7-10 MB for 300 models over 24 hours
- **Throughput**: 10k+ writes/sec, 100k+ reads/sec

## Error Handling

- Metrics failures never block application
- Silent failures with console logging
- Graceful degradation when Redis unavailable
- All recording is fire-and-forget

## Monitoring

### Key Metrics

```bash
# Redis health
redis-cli INFO stats
redis-cli INFO memory

# Application
- API response times: <50ms target
- Cache hit rate: >50% target
- Error rate: <0.1% target
```

### Dashboard Indicators

- Health scores: >90% for top models
- TTFT trends: Stable (no spikes)
- Error counts: <5% of requests
- Updates: Every 5-10 seconds

## Architecture

```
Client → ChatPerformanceTracker → POST /api/metrics/chat
                                        ↓
                                RedisMetricsService
                                        ↓
                                  Redis (TTL)
                                        ↓
Dashboard → useRealtimeMetrics → GET /api/metrics/realtime
                                        ↓
                                  Cache (60s)
                                        ↓
                               RealtimeMetricsCard
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/metrics/chat` | POST | Record metrics (fire-and-forget) |
| `/api/metrics/realtime` | GET | Fetch model/provider/gateway metrics |
| `/api/metrics/health/leaderboard` | GET | Top/bottom models by health |
| `/api/metrics/provider/summary` | GET | Aggregate provider metrics |
| `/api/metrics/trends` | GET | Time-series trend data |

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/redis-metrics.ts` | Core service | 620 |
| `src/lib/redis-client.ts` | Connection | 117 |
| `src/lib/cache-strategies.ts` | Caching | 419 |
| `src/app/api/metrics/chat/route.ts` | Recording API | 75 |
| `src/app/api/metrics/realtime/route.ts` | Fetch API | 76 |
| `src/hooks/use-realtime-metrics.ts` | React hook | 109 |
| `src/components/metrics/realtime-metrics-card.tsx` | UI | 256 |

## Next Steps

1. **Add utility functions** to `src/lib/utils.ts`
2. **Integrate recording** in chat completions and streaming
3. **Add gateway metrics** in models service
4. **Test thoroughly** with manual and load tests
5. **Monitor** Redis and API performance
6. **Create dashboard page** (optional)

## Support

- **Full Guide**: [REDIS_METRICS_BACKEND_GUIDE.md](./REDIS_METRICS_BACKEND_GUIDE.md)
- **Test Issues**: Check `redis-cli PING` and environment variables
- **Performance Issues**: Check Redis CPU/memory with `INFO` commands
- **Integration Help**: See "Integration Points" section in full guide

---

**Quick Start Version**: 1.0
**Last Updated**: 2025-11-27
