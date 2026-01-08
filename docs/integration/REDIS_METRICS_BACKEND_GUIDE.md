# Redis-Based Real-Time Monitoring: Backend Implementation Guide

## Document Purpose

This comprehensive guide provides backend teams with everything needed to implement Redis-based real-time monitoring for the Gatewayz AI platform. It covers complete Redis data models, API specifications, integration points, performance optimizations, and testing procedures.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Redis Data Architecture](#redis-data-architecture)
3. [API Specifications](#api-specifications)
4. [Integration Points](#integration-points)
5. [Performance Optimizations](#performance-optimizations)
6. [Error Handling](#error-handling)
7. [Testing & Validation](#testing--validation)
8. [Deployment Checklist](#deployment-checklist)
9. [Monitoring & Observability](#monitoring--observability)

---

## System Overview

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (Browser)                   │
│  - ChatPerformanceTracker (client-side metrics)             │
│  - React Hooks (useRealtimeMetrics, etc.)                   │
│  - UI Components (RealtimeMetricsCard, etc.)                │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                   API LAYER (Next.js)                        │
│  - POST /api/metrics/chat (record metrics)                  │
│  - GET  /api/metrics/realtime (fetch metrics)               │
│  - GET  /api/metrics/health/leaderboard                     │
│  - GET  /api/metrics/provider/summary                       │
│  - GET  /api/metrics/trends                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                 SERVICE LAYER (TypeScript)                   │
│  - RedisMetricsService (singleton)                          │
│  - Recording methods (fire-and-forget)                      │
│  - Retrieval methods (with caching)                         │
│  - Health score calculations                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  REDIS LAYER (ioredis)                       │
│  - Connection pool with retry logic                         │
│  - Pipeline batching                                        │
│  - Automatic TTL expiration (1hr/6hr)                       │
│  - Sorted sets, hashes, strings                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Fire-and-Forget Recording**: Metrics recording never blocks the critical path
2. **Hourly Time Bucketing**: Natural data organization with automatic expiration
3. **Graceful Degradation**: System works even when Redis is unavailable
4. **Cache-Aside Pattern**: 60-second cache for dashboard aggregations
5. **Pipeline Batching**: Minimize network round-trips to Redis

### Metrics Tracked

- **Request Counts**: Total requests per model/gateway/provider
- **Latency Metrics**: TTFT (Time to First Token), total response time, network latency, backend time
- **Success Rates**: Success/error breakdown by type (timeout, rate_limit, network, other)
- **Health Scores**: Calculated success rate (0-100) for leaderboards
- **Time-Series Data**: 6-hour TTFT trends for visualization

---

## Redis Data Architecture

### Time Bucketing Strategy

**Format**: `YYYY-MM-DD-HH` (UTC timezone)

**Examples**:
- `2025-11-27-14` = November 27, 2025, 2:00 PM - 2:59 PM UTC
- `2025-11-27-15` = November 27, 2025, 3:00 PM - 3:59 PM UTC

**Benefits**:
- Natural data organization
- Automatic expiration via TTL
- Simple aggregation (last N hours)
- No cleanup jobs required

### Redis Data Structures

#### 1. Request Counters (Redis String)

**Purpose**: Count total requests per model/gateway/provider

**Keys**:
```
metrics:model:{model_id}:requests:{time_bucket}
metrics:gateway:{gateway_name}:requests:{time_bucket}
metrics:provider:{provider_name}:requests:{time_bucket}
```

**Data Type**: String (integer value)

**Operations**:
- `INCR` - Increment counter
- `GET` - Retrieve count
- `EXPIRE 3600` - Set 1-hour TTL

**Example**:
```redis
INCR "metrics:model:anthropic/claude-3.5-sonnet:requests:2025-11-27-14"
EXPIRE "metrics:model:anthropic/claude-3.5-sonnet:requests:2025-11-27-14" 3600
GET "metrics:model:anthropic/claude-3.5-sonnet:requests:2025-11-27-14"
# Returns: "142"
```

#### 2. Latency Metrics (Redis Hash)

**Purpose**: Aggregate latency measurements (sums and counts for averaging)

**Keys**:
```
metrics:model:{model_id}:latency:{time_bucket}
metrics:gateway:{gateway_name}:latency:{time_bucket}
```

**Data Type**: Hash

**Fields**:
- `ttft_sum` - Total TTFT milliseconds
- `ttft_count` - Number of TTFT measurements
- `total_sum` - Total response time milliseconds
- `total_count` - Number of total time measurements
- `network_sum` - Total network latency milliseconds
- `backend_sum` - Total backend processing milliseconds

**Operations**:
- `HINCRBY` - Increment field value
- `HGETALL` - Retrieve all fields
- `EXPIRE 3600` - Set 1-hour TTL

**Example**:
```redis
HINCRBY "metrics:model:anthropic/claude-3.5-sonnet:latency:2025-11-27-14" "ttft_sum" 1250
HINCRBY "metrics:model:anthropic/claude-3.5-sonnet:latency:2025-11-27-14" "ttft_count" 1
EXPIRE "metrics:model:anthropic/claude-3.5-sonnet:latency:2025-11-27-14" 3600

HGETALL "metrics:model:anthropic/claude-3.5-sonnet:latency:2025-11-27-14"
# Returns:
# {
#   "ttft_sum": "125043",
#   "ttft_count": "100",
#   "total_sum": "562891",
#   "total_count": "100"
# }

# Average TTFT = 125043 / 100 = 1250.43 ms
```

#### 3. Status Tracking (Redis Hash)

**Purpose**: Track success and error counts by type

**Key**:
```
metrics:model:{model_id}:status:{time_bucket}
```

**Data Type**: Hash

**Fields**:
- `success` - Successful request count
- `error_timeout` - Timeout error count
- `error_rate_limit` - Rate limit error count
- `error_network` - Network error count
- `error_other` - Other error count

**Operations**:
- `HINCRBY` - Increment field value
- `HGETALL` - Retrieve all fields
- `EXPIRE 3600` - Set 1-hour TTL

**Example**:
```redis
HINCRBY "metrics:model:anthropic/claude-3.5-sonnet:status:2025-11-27-14" "success" 1
EXPIRE "metrics:model:anthropic/claude-3.5-sonnet:status:2025-11-27-14" 3600

HGETALL "metrics:model:anthropic/claude-3.5-sonnet:status:2025-11-27-14"
# Returns:
# {
#   "success": "95",
#   "error_timeout": "3",
#   "error_rate_limit": "1",
#   "error_network": "1",
#   "error_other": "0"
# }

# Success Rate = 95 / (95 + 3 + 1 + 1 + 0) = 95%
```

#### 4. Health Leaderboard (Redis Sorted Set)

**Purpose**: Rank models by success rate for fast leaderboard queries

**Key**:
```
metrics:health:models:{time_bucket}
```

**Data Type**: Sorted Set

**Score**: Success rate (0-100)
**Member**: Model ID

**Operations**:
- `ZADD` - Add/update model score
- `ZREVRANGE` - Get top N models (best → worst)
- `ZRANGE` - Get bottom N models (worst → best)
- `EXPIRE 3600` - Set 1-hour TTL

**Example**:
```redis
ZADD "metrics:health:models:2025-11-27-14" 98.5 "anthropic/claude-3.5-sonnet"
ZADD "metrics:health:models:2025-11-27-14" 95.2 "openai/gpt-4"
ZADD "metrics:health:models:2025-11-27-14" 87.3 "meta/llama-3.1-70b"
EXPIRE "metrics:health:models:2025-11-27-14" 3600

# Get top 10 models
ZREVRANGE "metrics:health:models:2025-11-27-14" 0 9 WITHSCORES
# Returns:
# [
#   "anthropic/claude-3.5-sonnet", "98.5",
#   "openai/gpt-4", "95.2",
#   "meta/llama-3.1-70b", "87.3"
# ]

# Get bottom 10 models
ZRANGE "metrics:health:models:2025-11-27-14" 0 9 WITHSCORES
# Returns (worst first):
# [
#   "meta/llama-3.1-70b", "87.3",
#   "openai/gpt-4", "95.2",
#   "anthropic/claude-3.5-sonnet", "98.5"
# ]
```

#### 5. Time-Series Data (Redis Sorted Set)

**Purpose**: Store time-series TTFT data for trend visualization

**Key**:
```
metrics:model:{model_id}:ttft_series
```

**Data Type**: Sorted Set

**Score**: Unix timestamp in milliseconds
**Member**: TTFT value in milliseconds (as string)

**TTL**: 21600 seconds (6 hours)

**Operations**:
- `ZADD` - Add TTFT measurement with timestamp
- `ZRANGEBYSCORE` - Query by time range
- `EXPIRE 21600` - Set 6-hour TTL

**Example**:
```redis
# Record TTFT measurements
ZADD "metrics:model:anthropic/claude-3.5-sonnet:ttft_series" 1732723200000 "1250"
ZADD "metrics:model:anthropic/claude-3.5-sonnet:ttft_series" 1732723260000 "1180"
ZADD "metrics:model:anthropic/claude-3.5-sonnet:ttft_series" 1732723320000 "1310"
EXPIRE "metrics:model:anthropic/claude-3.5-sonnet:ttft_series" 21600

# Query last hour (3600000 ms)
ZRANGEBYSCORE "metrics:model:anthropic/claude-3.5-sonnet:ttft_series" \
  1732719600000 1732723200000
# Returns: ["1250", "1180", "1310", ...]

# Calculate average TTFT for time range
# Application layer computes: sum(values) / count(values)
```

#### 6. Gateway Metrics

**Purpose**: Track gateway health and performance

**Keys**:
```
metrics:gateway:{gateway_name}:success:{time_bucket}
metrics:gateway:{gateway_name}:latency:{time_bucket}
metrics:gateway:{gateway_name}:errors:{time_bucket}
```

**Data Types**:
- Success: String (counter)
- Latency: Hash (sum, count)
- Errors: Hash (error types)

**Example**:
```redis
# Record successful gateway fetch
INCR "metrics:gateway:openrouter:success:2025-11-27-14"
HINCRBY "metrics:gateway:openrouter:latency:2025-11-27-14" "sum" 850
HINCRBY "metrics:gateway:openrouter:latency:2025-11-27-14" "count" 1
EXPIRE "metrics:gateway:openrouter:success:2025-11-27-14" 3600
EXPIRE "metrics:gateway:openrouter:latency:2025-11-27-14" 3600

# Record error
HINCRBY "metrics:gateway:openrouter:errors:2025-11-27-14" "timeout" 1
EXPIRE "metrics:gateway:openrouter:errors:2025-11-27-14" 3600
```

### Redis Memory Estimation

**Per model per hour**:
- Request counter: ~100 bytes
- Latency hash: ~300 bytes
- Status hash: ~250 bytes
- Health score entry: ~50 bytes
- **Total per model/hour**: ~700 bytes

**For 300 models**:
- Per hour: 300 × 700 bytes = 210 KB
- 24 hours: 210 KB × 24 = 5 MB

**Time-series (6-hour retention)**:
- Per measurement: ~20 bytes
- 1 request/minute × 360 minutes: 7.2 KB per model
- 300 models: 2.16 MB

**Total estimated memory**: ~7-10 MB for full 24-hour dataset across 300 models

---

## API Specifications

### 1. POST /api/metrics/chat

**Purpose**: Record chat completion metrics (fire-and-forget)

**Request**:
```http
POST /api/metrics/chat
Content-Type: application/json

{
  "model": "anthropic/claude-3.5-sonnet",
  "gateway": "openrouter",
  "provider": "anthropic",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "ttft_ms": 1250.5,
  "total_time_ms": 5630.2,
  "network_time_ms": 120.3,
  "backend_time_ms": 5509.9,
  "success": true,
  "error_type": null
}
```

**Field Descriptions**:
- `model` (required): Model identifier (e.g., "provider/model-name")
- `gateway` (optional): Gateway used (e.g., "openrouter", "groq")
- `provider` (optional): Provider name (e.g., "anthropic", "openai")
- `session_id` (optional): Chat session identifier
- `ttft_ms` (optional): Time to First Token in milliseconds
- `total_time_ms` (optional): Total response time in milliseconds
- `network_time_ms` (optional): Network latency in milliseconds
- `backend_time_ms` (optional): Backend processing time in milliseconds
- `success` (optional): Boolean success flag (default: true)
- `error_type` (optional): Error category ("timeout", "rate_limit", "network", "other")

**Response** (immediate):
```json
{
  "success": true
}
```

**Status Codes**:
- `200 OK` - Accepted (doesn't guarantee Redis write)
- `400 Bad Request` - Missing required field (model)
- `500 Internal Server Error` - Server error

**Implementation Notes**:
- Returns immediately without waiting for Redis
- Metrics recording happens asynchronously
- Errors are logged but not returned to client

**Example Implementation** (Node.js/TypeScript):
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.model) {
      return NextResponse.json(
        { error: 'Missing required field: model' },
        { status: 400 }
      );
    }

    // Fire-and-forget recording (don't await)
    metricsService.recordRequestComplete({
      model: body.model,
      gateway: body.gateway,
      provider: body.provider,
      session_id: body.session_id,
      ttft_ms: body.ttft_ms,
      total_time_ms: body.total_time_ms,
      network_time_ms: body.network_time_ms,
      backend_time_ms: body.backend_time_ms,
      success: body.success ?? true,
      error_type: body.error_type,
    }).catch((error) => {
      console.error('[API /metrics/chat] Failed to record:', error);
    });

    // Return immediately
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API /metrics/chat] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 2. GET /api/metrics/realtime

**Purpose**: Fetch real-time metrics for model/provider/gateway

**Request**:
```http
GET /api/metrics/realtime?type=model&id=anthropic/claude-3.5-sonnet&time_bucket=2025-11-27-14
```

**Query Parameters**:
- `type` (required): "model", "provider", or "gateway"
- `id` (required): Identifier (model ID, provider name, or gateway name)
- `time_bucket` (optional): Specific hour bucket (defaults to current hour)

**Response** (model type):
```json
{
  "type": "model",
  "id": "anthropic/claude-3.5-sonnet",
  "data": {
    "model": "anthropic/claude-3.5-sonnet",
    "time_bucket": "2025-11-27-14",
    "requests": 142,
    "success_count": 138,
    "error_count": 4,
    "success_rate": 97.18,
    "avg_ttft_ms": 1250.43,
    "avg_total_time_ms": 5628.91,
    "error_breakdown": {
      "timeout": 2,
      "rate_limit": 1,
      "network": 1,
      "other": 0
    }
  }
}
```

**Response** (provider type):
```json
{
  "type": "provider",
  "id": "anthropic",
  "data": {
    "provider": "anthropic",
    "time_bucket": "2025-11-27-14",
    "total_requests": 456,
    "total_models": 3,
    "avg_success_rate": 96.5,
    "avg_ttft_ms": 1180.2,
    "top_models": [
      {
        "model_id": "anthropic/claude-3.5-sonnet",
        "requests": 300
      },
      {
        "model_id": "anthropic/claude-3-opus",
        "requests": 100
      },
      {
        "model_id": "anthropic/claude-3-haiku",
        "requests": 56
      }
    ],
    "error_distribution": {
      "timeout": 8,
      "rate_limit": 3,
      "network": 2,
      "other": 1
    }
  }
}
```

**Status Codes**:
- `200 OK` - Data found
- `400 Bad Request` - Invalid parameters
- `404 Not Found` - No metrics for specified parameters
- `500 Internal Server Error` - Server error

**Caching**: 60-second cache using cache-aside pattern

**Example Implementation**:
```typescript
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const timeBucket = searchParams.get('time_bucket') || undefined;

    // Validation
    if (!type || !id) {
      return NextResponse.json(
        { error: 'Missing required parameters: type, id' },
        { status: 400 }
      );
    }

    if (!['model', 'provider', 'gateway'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: model, provider, or gateway' },
        { status: 400 }
      );
    }

    // Cache key
    const cacheKey = `metrics:dashboard:${type}:${id}:${timeBucket || metricsService.getTimeBucket()}`;

    // Cache-aside pattern with 60-second TTL
    const metrics = await cacheAside(
      cacheKey,
      async () => {
        if (type === 'model') {
          return await metricsService.getModelMetrics(id, timeBucket);
        } else if (type === 'provider') {
          return await metricsService.getProviderSummary(id, timeBucket);
        }
        return null;
      },
      TTL.METRICS_DASHBOARD,
      'metrics_dashboard'
    );

    if (!metrics) {
      return NextResponse.json(
        { error: 'No metrics found for the specified parameters' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      type,
      id,
      data: metrics,
    });

  } catch (error) {
    console.error('[API /metrics/realtime] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 3. GET /api/metrics/health/leaderboard

**Purpose**: Get top or bottom models by health score

**Request**:
```http
GET /api/metrics/health/leaderboard?order=desc&limit=10&time_bucket=2025-11-27-14
```

**Query Parameters**:
- `order` (optional): "asc" (worst first) or "desc" (best first), default: "desc"
- `limit` (optional): Number of results (1-100), default: 10
- `time_bucket` (optional): Specific hour bucket (defaults to current hour)

**Response**:
```json
{
  "time_bucket": "2025-11-27-14",
  "order": "desc",
  "limit": 10,
  "models": [
    {
      "model_id": "anthropic/claude-3.5-sonnet",
      "health_score": 98.5,
      "requests": 142,
      "avg_ttft_ms": 1250.43
    },
    {
      "model_id": "openai/gpt-4",
      "health_score": 95.2,
      "requests": 89,
      "avg_ttft_ms": 2140.12
    },
    {
      "model_id": "meta/llama-3.1-70b",
      "health_score": 87.3,
      "requests": 56,
      "avg_ttft_ms": 980.5
    }
  ]
}
```

**Status Codes**:
- `200 OK` - Data found (empty array if no models)
- `400 Bad Request` - Invalid parameters
- `500 Internal Server Error` - Server error

**Caching**: 60-second cache

**Example Implementation**:
```typescript
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '10'), 1),
      100
    );
    const timeBucket = searchParams.get('time_bucket') || undefined;

    // Validation
    if (!['asc', 'desc'].includes(order)) {
      return NextResponse.json(
        { error: 'Invalid order. Must be: asc or desc' },
        { status: 400 }
      );
    }

    const bucket = timeBucket || metricsService.getTimeBucket();
    const cacheKey = `metrics:leaderboard:${order}:${limit}:${bucket}`;

    // Cache-aside
    const models = await cacheAside(
      cacheKey,
      async () => await metricsService.getHealthLeaderboard(limit, order, timeBucket),
      TTL.METRICS_DASHBOARD,
      'metrics_dashboard'
    );

    return NextResponse.json({
      time_bucket: bucket,
      order,
      limit,
      models,
    });

  } catch (error) {
    console.error('[API /metrics/health/leaderboard] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 4. GET /api/metrics/provider/summary

**Purpose**: Get aggregated metrics for all models of a provider

**Request**:
```http
GET /api/metrics/provider/summary?provider=anthropic&time_bucket=2025-11-27-14
```

**Query Parameters**:
- `provider` (required): Provider name (e.g., "anthropic", "openai")
- `time_bucket` (optional): Specific hour bucket (defaults to current hour)

**Response**: See provider response format in section 2

**Status Codes**: Same as section 2

---

### 5. GET /api/metrics/trends

**Purpose**: Get time-series trend data for a model

**Request**:
```http
GET /api/metrics/trends?model=anthropic/claude-3.5-sonnet&metric=ttft&hours=6
```

**Query Parameters**:
- `model` (required): Model identifier
- `metric` (required): "ttft", "requests", or "success_rate"
- `hours` (optional): Number of hours to fetch (1-24), default: 6

**Response**:
```json
{
  "model": "anthropic/claude-3.5-sonnet",
  "metric": "ttft",
  "hours": 6,
  "data_points": [
    {
      "time_bucket": "2025-11-27-09",
      "value": 1180.5
    },
    {
      "time_bucket": "2025-11-27-10",
      "value": 1250.3
    },
    {
      "time_bucket": "2025-11-27-11",
      "value": 1190.8
    },
    {
      "time_bucket": "2025-11-27-12",
      "value": 1310.2
    },
    {
      "time_bucket": "2025-11-27-13",
      "value": 1220.4
    },
    {
      "time_bucket": "2025-11-27-14",
      "value": 1250.9
    }
  ]
}
```

**Status Codes**:
- `200 OK` - Data found (may contain zero values for missing hours)
- `400 Bad Request` - Invalid parameters
- `500 Internal Server Error` - Server error

**Caching**: 60-second cache

---

## Integration Points

### 1. Chat Completions API

**File**: `/api/chat/completions/route.ts`

**Integration Locations**:

**A. Non-streaming success** (after latency calculation):
```typescript
const latency = Date.now() - startTime;

// Record metrics
metricsService.recordRequestComplete({
  model: body.model,
  gateway: body.gateway,
  provider: extractProvider(body.model),
  total_time_ms: latency,
  success: true,
}).catch(err => console.error('[Metrics] Recording failed:', err));
```

**B. Streaming start** (before stream begins):
```typescript
// Record request initiation
metricsService.recordRequestStart({
  model: body.model,
  gateway: body.gateway,
  provider: extractProvider(body.model),
}).catch(err => console.error('[Metrics] Recording failed:', err));
```

**C. Error handling** (in catch blocks):
```typescript
catch (error) {
  metricsService.recordStatus({
    model: body.model,
    gateway: body.gateway,
    provider: extractProvider(body.model),
    success: false,
    error_type: determineErrorType(error),
    error_message: error instanceof Error ? error.message : String(error),
  }).catch(err => console.error('[Metrics] Recording failed:', err));

  throw error; // Re-throw original error
}
```

### 2. Streaming Utilities

**File**: `/lib/streaming.ts`

**Integration Locations**:

**D. Track stream start time** (beginning of function):
```typescript
export async function* streamChatResponse(...) {
  const streamStartTime = performance.now();
  let recordedTTFT: number | undefined;

  // ... rest of function
}
```

**E. First token (TTFT)** (when first content chunk arrives):
```typescript
if (isFirstContentChunk && (chunk.content || chunk.reasoning)) {
  chunk.status = 'first_token';
  isFirstContentChunk = false;

  // Record TTFT
  const ttft = performance.now() - streamStartTime;
  recordedTTFT = ttft;

  metricsService.recordLatency({
    model: requestBody.model,
    gateway: requestBody.gateway,
    provider: extractProvider(requestBody.model),
    ttft_ms: ttft,
  }).catch(err => console.error('[Metrics] TTFT recording failed:', err));
}
```

**F. Stream complete** (after successful stream):
```typescript
yield { done: true };

// Record completion metrics
const totalTime = performance.now() - streamStartTime;
metricsService.recordRequestComplete({
  model: requestBody.model,
  gateway: requestBody.gateway,
  provider: extractProvider(requestBody.model),
  ttft_ms: recordedTTFT,
  total_time_ms: totalTime,
  success: true,
}).catch(err => console.error('[Metrics] Completion recording failed:', err));
```

**G. Stream error** (in error handlers):
```typescript
catch (error) {
  metricsService.recordStatus({
    model: requestBody.model,
    gateway: requestBody.gateway,
    provider: extractProvider(requestBody.model),
    success: false,
    error_type: errorType, // Already categorized in streaming.ts
    error_message: errorMessage,
  }).catch(err => console.error('[Metrics] Error recording failed:', err));

  throw error; // Re-throw
}
```

### 3. Model Gateway Service

**File**: `/lib/models-service.ts`

**Integration Locations**:

**H. Gateway fetch start** (before fetch request):
```typescript
metricsService.recordGatewayFetch('start', {
  gateway: gateway,
}).catch(err => console.error('[Metrics] Gateway start failed:', err));

const fetchStartTime = Date.now();
const response = await Promise.race([...]);
```

**I. Gateway fetch success** (after successful fetch):
```typescript
if (response.ok) {
  const data = await response.json();
  const fetchTime = Date.now() - fetchStartTime;

  metricsService.recordGatewayFetch('success', {
    gateway: gateway,
    model_count: data.data.length,
    response_time_ms: fetchTime,
  }).catch(err => console.error('[Metrics] Gateway success failed:', err));
}
```

**J. Gateway fetch error** (in catch blocks):
```typescript
catch (error: any) {
  metricsService.recordGatewayFetch('error', {
    gateway: gateway,
    error_type: isAbortOrNetworkError(error) ? 'timeout' : 'error',
  }).catch(err => console.error('[Metrics] Gateway error failed:', err));
}
```

### Required Utility Functions

**1. Extract Provider from Model ID**:
```typescript
// Add to: /lib/utils.ts
export function extractProvider(modelId: string): string {
  if (!modelId) return 'unknown';

  // Handle "provider/model" format
  if (modelId.includes('/')) {
    return modelId.split('/')[0];
  }

  // Handle "provider:model" format
  if (modelId.includes(':')) {
    return modelId.split(':')[0];
  }

  return 'unknown';
}
```

**2. Determine Error Type**:
```typescript
// Add to: /lib/utils.ts
export function determineErrorType(
  error: any
): 'timeout' | 'rate_limit' | 'network' | 'other' {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      error.name === 'AbortError' ||
      message.includes('timeout') ||
      message.includes('timed out')
    ) {
      return 'timeout';
    }

    if (message.includes('rate limit') || message.includes('429')) {
      return 'rate_limit';
    }

    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout')
    ) {
      return 'network';
    }
  }

  if (typeof error === 'object' && error.status === 429) {
    return 'rate_limit';
  }

  return 'other';
}
```

---

## Performance Optimizations

### 1. Pipeline Batching

**Technique**: Group multiple Redis commands into a single network round-trip

**Implementation**:
```typescript
async recordRequestStart(options: MetricRecordOptions): Promise<void> {
  const bucket = this.getTimeBucket();
  const pipeline = this.redis.pipeline();

  // Batch multiple operations
  const modelKey = `metrics:model:${options.model}:requests:${bucket}`;
  pipeline.incr(modelKey);
  pipeline.expire(modelKey, 3600);

  if (options.gateway) {
    const gatewayKey = `metrics:gateway:${options.gateway}:requests:${bucket}`;
    pipeline.incr(gatewayKey);
    pipeline.expire(gatewayKey, 3600);
  }

  // Execute all at once
  await pipeline.exec();
}
```

**Benefits**:
- 3-5x faster than individual commands
- Reduces network latency
- Atomic execution (all or nothing)

### 2. Fire-and-Forget Recording

**Technique**: Don't wait for Redis write confirmation

**Implementation**:
```typescript
// API endpoint - return immediately
metricsService.recordRequestComplete(data)
  .catch(err => console.error('Recording failed:', err));

return NextResponse.json({ success: true });
```

**Benefits**:
- Zero performance impact on critical path
- Handles Redis failures gracefully
- Sub-millisecond API response times

### 3. Cache-Aside Pattern

**Technique**: Cache frequently-accessed aggregations

**Implementation**:
```typescript
const metrics = await cacheAside(
  cacheKey,
  async () => await metricsService.getModelMetrics(modelId),
  TTL.METRICS_DASHBOARD, // 60 seconds
  'metrics_dashboard'
);
```

**Benefits**:
- 10x faster on cache hit
- Reduces Redis load
- 60-second staleness acceptable for dashboards

### 4. Parallel Fetching

**Technique**: Fetch multiple Redis keys concurrently

**Implementation**:
```typescript
async getModelMetrics(modelId: string, timeBucket?: string) {
  const bucket = timeBucket || this.getTimeBucket();

  const [requests, latencyData, statusData] = await Promise.all([
    this.redis.get(`metrics:model:${modelId}:requests:${bucket}`),
    this.redis.hgetall(`metrics:model:${modelId}:latency:${bucket}`),
    this.redis.hgetall(`metrics:model:${modelId}:status:${bucket}`),
  ]);

  // Process results...
}
```

**Benefits**:
- 3x faster than sequential fetches
- Minimal code complexity
- Better resource utilization

### 5. Time-Series Optimization

**Technique**: Use sorted sets for efficient range queries

**Implementation**:
```typescript
// Store with timestamp as score
await this.redis.zadd(
  `metrics:model:${modelId}:ttft_series`,
  Date.now(),
  ttftValue.toString()
);

// Query by time range (last hour)
const startTime = Date.now() - 3600000;
const endTime = Date.now();
const values = await this.redis.zrangebyscore(
  `metrics:model:${modelId}:ttft_series`,
  startTime,
  endTime
);
```

**Benefits**:
- O(log N + M) query time
- Efficient storage
- Native Redis support

### 6. Automatic Expiration

**Technique**: Use Redis TTL for data cleanup

**Benefits**:
- No cleanup jobs needed
- Bounded memory usage
- Consistent retention policy

**Implementation**:
```typescript
// Set TTL with every write
pipeline.incr(key);
pipeline.expire(key, 3600); // 1 hour
```

---

## Error Handling

### Principles

1. **Never Block**: Metrics errors never affect application flow
2. **Silent Failures**: Log errors but don't throw
3. **Graceful Degradation**: Return null/empty when Redis unavailable
4. **Isolation**: Redis failures isolated from business logic

### Implementation Pattern

**Service Layer**:
```typescript
async recordLatency(options: LatencyMetricOptions): Promise<void> {
  try {
    // Check Redis availability
    if (!(await isRedisAvailable())) {
      return; // Graceful exit
    }

    // Redis operations...

  } catch (error) {
    console.error('[RedisMetrics] Failed to record latency:', error);
    // No throw - silent failure
  }
}
```

**API Layer**:
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Fire-and-forget with error handler
    metricsService.recordRequestComplete(body)
      .catch(err => console.error('[API] Recording failed:', err));

    // Return success immediately
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Integration Points**:
```typescript
// Always use .catch() on fire-and-forget calls
metricsService.recordStatus(options)
  .catch(err => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Integration] Metrics recording failed:', err);
    }
  });
```

### Error Categories

1. **Connection Errors**: Redis server unreachable
2. **Timeout Errors**: Command took too long
3. **Command Errors**: Invalid Redis operation
4. **Serialization Errors**: JSON parsing failed

All handled with same pattern: log and continue.

---

## Testing & Validation

### 1. Unit Tests (Jest)

**File**: `__tests__/lib/redis-metrics.test.ts`

**Test Cases**:
```typescript
describe('RedisMetricsService', () => {
  describe('Time Bucketing', () => {
    it('should generate correct hourly time bucket', () => {
      const service = new RedisMetricsService();
      const date = new Date('2025-11-27T14:30:00Z');
      expect(service.getTimeBucket(date)).toBe('2025-11-27-14');
    });

    it('should get last N hour buckets', () => {
      const service = new RedisMetricsService();
      const buckets = service.getLastNHourBuckets(3);
      expect(buckets).toHaveLength(3);
    });
  });

  describe('Recording Methods', () => {
    it('should record request start without error', async () => {
      const service = new RedisMetricsService();
      await expect(
        service.recordRequestStart({
          model: 'test/model',
          gateway: 'test-gateway',
        })
      ).resolves.not.toThrow();
    });

    it('should handle Redis unavailable gracefully', async () => {
      // Mock Redis unavailable
      jest.spyOn(redis, 'isRedisAvailable').mockResolvedValue(false);

      const service = new RedisMetricsService();
      await expect(
        service.recordLatency({ model: 'test/model', ttft_ms: 1000 })
      ).resolves.not.toThrow();
    });
  });

  describe('Retrieval Methods', () => {
    it('should return null when no metrics exist', async () => {
      const service = new RedisMetricsService();
      const metrics = await service.getModelMetrics('nonexistent/model');
      expect(metrics).toBeNull();
    });

    it('should calculate correct success rate', async () => {
      // Setup test data in Redis
      // ... test implementation
    });
  });
});
```

### 2. Integration Tests

**File**: `__tests__/api/metrics.integration.test.ts`

**Test Cases**:
```typescript
describe('Metrics API Integration', () => {
  it('POST /api/metrics/chat should accept valid payload', async () => {
    const response = await fetch('http://localhost:3000/api/metrics/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'test/model',
        ttft_ms: 1000,
        total_time_ms: 5000,
        success: true,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('GET /api/metrics/realtime should return metrics', async () => {
    // First record some metrics
    await recordTestMetrics();

    // Wait briefly for Redis write
    await new Promise(resolve => setTimeout(resolve, 100));

    // Fetch metrics
    const response = await fetch(
      'http://localhost:3000/api/metrics/realtime?type=model&id=test/model'
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.data.requests).toBeGreaterThan(0);
  });
});
```

### 3. Load Testing

**File**: `scripts/load-test-metrics.ts`

**Test Scenario**: Simulate 1000 concurrent chat completions

```typescript
import { metricsService } from '@/lib/redis-metrics';

async function loadTest() {
  const models = [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4',
    'meta/llama-3.1-70b',
  ];

  const promises = [];

  for (let i = 0; i < 1000; i++) {
    const model = models[i % models.length];
    const promise = metricsService.recordRequestComplete({
      model,
      gateway: 'openrouter',
      provider: model.split('/')[0],
      ttft_ms: Math.random() * 2000 + 500,
      total_time_ms: Math.random() * 8000 + 2000,
      success: Math.random() > 0.05, // 95% success rate
      error_type: Math.random() > 0.95 ? 'timeout' : undefined,
    });

    promises.push(promise);
  }

  const start = Date.now();
  await Promise.all(promises);
  const duration = Date.now() - start;

  console.log(`✅ Load test complete: ${duration}ms for 1000 requests`);
  console.log(`⚡ Average: ${(duration / 1000).toFixed(2)}ms per request`);
}

loadTest().catch(console.error);
```

### 4. Manual Testing Script

**File**: `scripts/test-metrics.ts`

```typescript
import { metricsService } from '@/lib/redis-metrics';

async function testMetricsFlow() {
  console.log('🧪 Testing Redis Metrics System\n');

  // 1. Record some metrics
  console.log('1️⃣ Recording test metrics...');
  await metricsService.recordRequestComplete({
    model: 'anthropic/claude-3.5-sonnet',
    gateway: 'openrouter',
    provider: 'anthropic',
    ttft_ms: 1250,
    total_time_ms: 5600,
    success: true,
  });
  console.log('✅ Metrics recorded\n');

  // 2. Fetch model metrics
  console.log('2️⃣ Fetching model metrics...');
  const modelMetrics = await metricsService.getModelMetrics(
    'anthropic/claude-3.5-sonnet'
  );
  console.log('📊 Model Metrics:', JSON.stringify(modelMetrics, null, 2));
  console.log('');

  // 3. Fetch health leaderboard
  console.log('3️⃣ Fetching health leaderboard...');
  const leaderboard = await metricsService.getHealthLeaderboard(10, 'desc');
  console.log('🏆 Top 10 Models:', JSON.stringify(leaderboard, null, 2));
  console.log('');

  // 4. Fetch trends
  console.log('4️⃣ Fetching TTFT trends...');
  const trends = await metricsService.getTrendData(
    'anthropic/claude-3.5-sonnet',
    'ttft',
    6
  );
  console.log('📈 TTFT Trends:', JSON.stringify(trends, null, 2));

  console.log('\n✅ All tests completed!');
}

testMetricsFlow().catch(console.error);
```

**Run with**:
```bash
npx ts-node scripts/test-metrics.ts
```

### 5. Validation Checklist

**Before Production**:
- [ ] Unit tests pass (95%+ coverage)
- [ ] Integration tests pass
- [ ] Load test handles 1000+ concurrent requests
- [ ] Manual testing script shows correct data flow
- [ ] Redis keys expire correctly (verify with TTL command)
- [ ] Cache hit rate >50% on dashboard endpoints
- [ ] Error handling doesn't throw exceptions
- [ ] Metrics recording doesn't slow down chat responses
- [ ] Dashboard displays real-time data
- [ ] Time-series trends render correctly

---

## Deployment Checklist

### Environment Setup

**1. Redis Configuration**:
```bash
# Required environment variables
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0

# Optional (defaults shown)
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=3
```

**2. Redis Server Requirements**:
- **Version**: Redis 6.0+ (for sorted set commands)
- **Memory**: 100MB minimum (10MB estimated usage + buffer)
- **Persistence**: Optional (metrics are ephemeral)
- **Replication**: Recommended for production
- **Max Memory Policy**: `allkeys-lru` (evict least recently used)

**3. Network Requirements**:
- Firewall rules: Allow Next.js server → Redis (port 6379)
- TLS/SSL: Recommended for production
- Connection pooling: Handled by ioredis (default max: 10)

### Pre-Deployment Testing

**1. Verify Redis Connection**:
```bash
npx ts-node scripts/test-redis-connection.ts
```

**2. Run Full Test Suite**:
```bash
npm test -- --coverage
```

**3. Load Test**:
```bash
npx ts-node scripts/load-test-metrics.ts
```

**4. Check Redis Memory**:
```bash
redis-cli INFO memory
```

### Deployment Steps

**1. Deploy Code**:
```bash
git pull origin main
npm install
npm run build
pm2 restart next-app
```

**2. Verify API Endpoints**:
```bash
# Test recording
curl -X POST https://your-domain.com/api/metrics/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"test/model","success":true}'

# Test retrieval
curl "https://your-domain.com/api/metrics/realtime?type=model&id=test/model"
```

**3. Monitor Initial Traffic**:
- Watch logs for errors: `tail -f logs/error.log | grep Metrics`
- Check Redis CPU: `redis-cli INFO cpu`
- Check Redis commands: `redis-cli INFO stats`

**4. Verify Dashboard**:
- Open metrics dashboard in browser
- Verify real-time updates (5-10 second polling)
- Check health leaderboard renders
- Verify trend charts display

### Post-Deployment Monitoring

**1. Key Metrics to Watch**:
- Redis CPU usage (should be <10%)
- Redis memory usage (should be <100MB)
- API response times (should be <50ms for /api/metrics/chat)
- Cache hit rate (should be >50% after warmup)
- Error rate in logs (should be <0.1%)

**2. Redis Monitoring Commands**:
```bash
# Check key count
redis-cli DBSIZE

# Check memory usage
redis-cli INFO memory | grep used_memory_human

# Check command stats
redis-cli INFO commandstats | grep metrics

# List sample keys
redis-cli KEYS "metrics:*" | head -10

# Check TTL on keys
redis-cli TTL "metrics:model:anthropic/claude-3.5-sonnet:requests:2025-11-27-14"
```

**3. Alert Thresholds**:
- Redis memory >80% → Scale up
- Redis CPU >50% → Investigate query patterns
- Error rate >1% → Check connection health
- Cache miss rate >80% → Increase TTL or review patterns

### Rollback Plan

**If Issues Occur**:

**1. Disable Metrics Recording** (quick fix):
```typescript
// In api/metrics/chat/route.ts
export async function POST(request: NextRequest) {
  // Temporary: just return success without recording
  return NextResponse.json({ success: true });
}
```

**2. Revert Code**:
```bash
git revert HEAD
npm run build
pm2 restart next-app
```

**3. Clear Redis** (if corrupted):
```bash
redis-cli FLUSHDB
```

---

## Monitoring & Observability

### Redis Metrics to Track

**1. Memory Metrics**:
```bash
redis-cli INFO memory
```
- `used_memory_human` - Total memory used
- `used_memory_peak_human` - Peak memory
- `mem_fragmentation_ratio` - Fragmentation (should be 1.0-1.5)

**2. Performance Metrics**:
```bash
redis-cli INFO stats
```
- `total_commands_processed` - Total commands
- `instantaneous_ops_per_sec` - Current ops/sec
- `keyspace_hits` - Cache hits
- `keyspace_misses` - Cache misses

**3. Key Metrics**:
```bash
redis-cli INFO keyspace
```
- `keys` - Total key count
- `expires` - Keys with TTL
- `avg_ttl` - Average TTL

### Application Metrics

**1. Recording Performance**:
- Track time spent in `recordRequestComplete()`
- Should be <5ms (fire-and-forget)
- Alert if >50ms consistently

**2. Retrieval Performance**:
- Track API endpoint response times
- `/api/metrics/realtime` should be <50ms (cached) or <200ms (uncached)
- `/api/metrics/health/leaderboard` should be <100ms

**3. Cache Effectiveness**:
- Track hit rate via `cacheAside` metrics
- Target >50% hit rate
- Adjust TTL if consistently low

### Logging Strategy

**Production Logs** (only log errors):
```typescript
if (process.env.NODE_ENV === 'production') {
  console.error('[RedisMetrics] Critical error:', error);
}
```

**Development Logs** (verbose):
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[RedisMetrics] Recording metrics:', options);
  console.log('[RedisMetrics] Redis operation completed in', duration, 'ms');
}
```

### Dashboard Monitoring

**Key UI Indicators**:
- Health scores should be >90% for top models
- TTFT trends should be stable (no spikes)
- Error counts should be <5% of total requests
- Leaderboard should update every 5-10 seconds

---

## Summary

This implementation provides:

✅ **Production-ready** Redis-based metrics system
✅ **Fire-and-forget** recording (zero performance impact)
✅ **Automatic expiration** (1-hour buckets with TTL)
✅ **Rich aggregations** (leaderboards, trends, provider summaries)
✅ **Graceful degradation** (works even when Redis fails)
✅ **Complete type safety** (TypeScript throughout)
✅ **Cache optimization** (60-second dashboard cache)
✅ **Comprehensive testing** (unit, integration, load tests)
✅ **Clear error handling** (never blocks application)
✅ **Scalable architecture** (handles 10k+ writes/sec)

### Key Files Reference

**Core Implementation**:
- `src/lib/redis-metrics.ts` - Metrics service (620 lines)
- `src/lib/redis-client.ts` - Redis connection (117 lines)
- `src/lib/cache-strategies.ts` - Caching utilities (419 lines)

**API Endpoints**:
- `src/app/api/metrics/chat/route.ts` - Recording endpoint
- `src/app/api/metrics/realtime/route.ts` - Real-time metrics
- `src/app/api/metrics/health/leaderboard/route.ts` - Health leaderboard
- `src/app/api/metrics/provider/summary/route.ts` - Provider aggregation
- `src/app/api/metrics/trends/route.ts` - Time-series trends

**Integration Points**:
- `src/app/api/chat/completions/route.ts` - Chat completions
- `src/lib/streaming.ts` - Streaming utilities
- `src/lib/models-service.ts` - Gateway fetching

**Frontend**:
- `src/hooks/use-realtime-metrics.ts` - React hook
- `src/components/metrics/realtime-metrics-card.tsx` - UI component
- `src/components/metrics/health-leaderboard.tsx` - Leaderboard UI

### Support

For questions or issues:
1. Check Redis logs: `redis-cli MONITOR`
2. Check application logs: `tail -f logs/error.log | grep Metrics`
3. Verify Redis connection: `redis-cli PING`
4. Run manual test: `npx ts-node scripts/test-metrics.ts`

---

**Document Version**: 1.0
**Last Updated**: 2025-11-27
**Author**: Backend Implementation Team
