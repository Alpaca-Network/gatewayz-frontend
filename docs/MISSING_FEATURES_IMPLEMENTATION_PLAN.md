# Missing Features - Implementation Plan

## Overview
This document outlines missing features for the multi-provider model catalog system and provides an implementation roadmap.

## Phase 1: Critical Features (Week 1-2) 🔴

### 1.1 Provider Statistics & Analytics

**Priority: CRITICAL**
**Addresses Screenshot Issues: Yes - Total Tokens, Top Provider, Top Model**

#### New Endpoints Needed:

```python
# src/routes/catalog.py additions

@router.get("/provider/{provider_name}/stats", tags=["providers"])
async def get_provider_stats(
    provider_name: str,
    gateway: Optional[str] = Query(None),
    time_range: str = Query("24h", description="1h, 24h, 7d, 30d, all")
):
    """
    Get statistics for a specific provider
    
    Returns:
    - Total tokens generated
    - Total requests
    - Top models
    - Average latency
    - Error rate
    - Cost metrics
    """
    pass


@router.get("/gateway/{gateway}/stats", tags=["gateways"])
async def get_gateway_stats(gateway: str):
    """
    Get comprehensive statistics for a gateway
    
    Returns:
    - Total models available
    - Total providers
    - Usage statistics
    - Performance metrics
    - Uptime data
    """
    pass


@router.get("/models/trending", tags=["models"])
async def get_trending_models(
    gateway: Optional[str] = Query("all"),
    time_range: str = Query("24h"),
    limit: int = Query(10)
):
    """
    Get trending models based on usage
    
    Returns list of models sorted by:
    - Request count
    - Token generation
    - User growth
    """
    pass
```

#### Database Schema Additions:

```sql
-- Track gateway-specific usage
CREATE TABLE gateway_usage (
    id BIGSERIAL PRIMARY KEY,
    gateway VARCHAR(50) NOT NULL,
    provider VARCHAR(100),
    model_id VARCHAR(255),
    user_id INTEGER,
    tokens_generated INTEGER DEFAULT 0,
    requests INTEGER DEFAULT 1,
    cost DECIMAL(10, 4) DEFAULT 0,
    latency_ms INTEGER,
    error BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_gateway_usage_gateway ON gateway_usage(gateway);
CREATE INDEX idx_gateway_usage_model ON gateway_usage(model_id);
CREATE INDEX idx_gateway_usage_timestamp ON gateway_usage(timestamp);

-- Track provider performance metrics
CREATE TABLE provider_metrics (
    id BIGSERIAL PRIMARY KEY,
    provider_name VARCHAR(100) NOT NULL,
    gateway VARCHAR(50) NOT NULL,
    total_tokens BIGINT DEFAULT 0,
    total_requests BIGINT DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    avg_latency_ms INTEGER,
    uptime_percentage DECIMAL(5, 2),
    last_updated TIMESTAMP DEFAULT NOW(),
    date DATE DEFAULT CURRENT_DATE,
    UNIQUE(provider_name, gateway, date)
);
```

#### Implementation Files:

1. **`src/db/gateway_analytics.py`** (NEW)
   - Functions to track gateway usage
   - Provider statistics aggregation
   - Model popularity tracking

2. **`src/services/gateway_stats.py`** (NEW)
   - Calculate provider statistics
   - Aggregate usage metrics
   - Performance analysis

### 1.2 Model Comparison

**Priority: HIGH**

```python
@router.get("/model/{provider_name}/{model_name}/compare", tags=["models"])
async def compare_model_across_gateways(
    provider_name: str,
    model_name: str
):
    """
    Compare the same model across all available gateways
    
    Returns:
    {
        "model_id": "openai/gpt-4",
        "comparisons": [
            {
                "gateway": "openrouter",
                "pricing": {...},
                "availability": true,
                "latency_ms": 250,
                "features": [...]
            },
            {
                "gateway": "portkey",
                "pricing": {...},
                "availability": true,
                "latency_ms": 180,
                "features": [...]
            }
        ],
        "recommendation": "portkey",  # Based on price/performance
        "savings_vs_most_expensive": 0.30
    }
    """
    pass


@router.post("/models/batch-compare", tags=["models"])
async def batch_compare_models(
    models: List[str],  # ["openai/gpt-4", "anthropic/claude-3"]
    criteria: str = Query("price")  # price, latency, features
):
    """
    Compare multiple models at once
    """
    pass
```

### 1.3 Real-Time Pricing Data

**Priority: HIGH**

#### Implementation:

1. **`src/services/pricing_sync.py`** (NEW)
```python
async def fetch_deepinfra_pricing():
    """Fetch latest pricing from DeepInfra API"""
    pass

async def fetch_featherless_pricing():
    """Fetch latest pricing from Featherless API"""  
    pass

async def fetch_chutes_pricing():
    """Fetch latest pricing from Chutes API"""
    pass

async def sync_all_pricing():
    """Background task to sync pricing every hour"""
    pass
```

2. **Endpoints:**
```python
@router.get("/pricing/{gateway}/models", tags=["pricing"])
async def get_gateway_pricing(gateway: str):
    """Get all model pricing for a gateway"""
    pass

@router.get("/model/{provider}/{model}/pricing/live", tags=["pricing"])
async def get_live_pricing(provider: str, model: str):
    """Get real-time pricing across all gateways"""
    pass
```

## Phase 2: Enhanced Features (Week 3-4) 🟡

### 2.1 Advanced Model Search

```python
@router.get("/models/search", tags=["models"])
async def search_models(
    q: Optional[str] = Query(None, description="Search query"),
    modality: Optional[str] = Query(None, description="text, image, audio, video"),
    min_context: Optional[int] = Query(None),
    max_context: Optional[int] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    gateway: Optional[str] = Query("all"),
    sort_by: str = Query("price", description="price, context, popularity"),
    order: str = Query("asc", description="asc, desc"),
    limit: int = Query(20),
    offset: int = Query(0)
):
    """
    Advanced model search with multiple filters
    """
    pass
```

### 2.2 Cache Management

```python
@router.get("/cache/status", tags=["cache"])
async def get_cache_status():
    """
    Get cache status for all gateways
    
    Returns:
    {
        "openrouter": {
            "models_cached": 250,
            "last_refresh": "2025-01-15T10:30:00Z",
            "ttl_seconds": 3600,
            "hit_rate": 0.85,
            "size_mb": 2.5
        },
        ...
    }
    """
    pass

@router.post("/cache/refresh/{gateway}", tags=["cache"])
async def refresh_gateway_cache(
    gateway: str,
    force: bool = Query(False)
):
    """Force refresh cache for specific gateway"""
    pass
```

### 2.3 Gateway Health Monitoring

```python
@router.get("/health/gateways", tags=["health"])
async def check_all_gateways():
    """
    Check health of all configured gateways
    
    Returns:
    {
        "openrouter": {
            "status": "healthy",
            "latency_ms": 150,
            "uptime_24h": 99.9,
            "last_check": "2025-01-15T10:30:00Z"
        },
        "deepinfra": {
            "status": "degraded",
            "latency_ms": 500,
            "uptime_24h": 95.2,
            "last_check": "2025-01-15T10:30:00Z"
        }
    }
    """
    pass

@router.get("/health/{gateway}/history", tags=["health"])
async def get_gateway_health_history(
    gateway: str,
    days: int = Query(7, ge=1, le=90)
):
    """Get historical uptime and performance data"""
    pass
```

## Phase 3: Advanced Features (Week 5+) 🟢

### 3.1 Model Recommendations

```python
@router.get("/models/recommend", tags=["recommendations"])
async def recommend_models(
    use_case: str = Query(..., description="chat, code, image, analysis"),
    budget_per_1m_tokens: Optional[float] = Query(None),
    min_context: Optional[int] = Query(None),
    prioritize: str = Query("balanced", description="speed, cost, quality")
):
    """
    Get AI-powered model recommendations based on requirements
    """
    pass
```

### 3.2 Batch Operations

```python
@router.post("/models/batch/fetch", tags=["batch"])
async def batch_fetch_models(
    model_ids: List[str],
    gateway: Optional[str] = Query(None)
):
    """Fetch multiple models in a single request"""
    pass
```

### 3.3 Webhooks

```python
@router.post("/webhooks/subscribe", tags=["webhooks"])
async def subscribe_to_updates(
    url: str,
    events: List[str],  # ["price_change", "new_model", "availability"]
    gateway: Optional[str] = Query(None)
):
    """Subscribe to model catalog updates"""
    pass
```

## Implementation Priority Matrix

| Feature | Priority | Impact | Effort | Should Implement |
|---------|----------|--------|--------|------------------|
| Provider Statistics | 🔴 Critical | High | Medium | ✅ YES (Phase 1) |
| Model Comparison | 🔴 High | High | Medium | ✅ YES (Phase 1) |
| Real-time Pricing | 🔴 High | High | High | ✅ YES (Phase 1) |
| Advanced Search | 🟡 Medium | Medium | Medium | ✅ YES (Phase 2) |
| Cache Management | 🟡 Medium | Medium | Low | ✅ YES (Phase 2) |
| Health Monitoring | 🟡 Medium | Medium | Medium | ✅ YES (Phase 2) |
| Recommendations | 🟢 Low | Medium | High | ⏸️ Later (Phase 3) |
| Batch Operations | 🟢 Low | Low | Low | ⏸️ Later (Phase 3) |
| Webhooks | 🟢 Low | Low | High | ⏸️ Later (Phase 3) |

## Quick Start: Implement Provider Statistics (Most Critical)

Here's what you need RIGHT NOW to fix the screenshot issues:

### Step 1: Track Gateway Usage
Add logging to your chat endpoints to track which gateway/model was used.

### Step 2: Create Statistics Endpoint
```python
@router.get("/provider/{provider_name}/stats")
async def get_provider_stats(provider_name: str):
    # Query activity_log table (already exists!)
    # Filter by provider_name
    # Return aggregated stats
    pass
```

### Step 3: Add to Frontend
Your frontend can now display the missing data:
- Total Tokens: Sum from gateway_usage
- Top Provider: Most used provider
- Top Model: Most requested model
- Latency/Throughput: Avg from metrics

## Recommended Next Actions

1. **Immediate (Today):**
   - Create `src/routes/gateway_stats.py` with provider statistics endpoints
   - Leverage existing `activity_log` table for initial data

2. **This Week:**
   - Implement model comparison endpoint
   - Add real-time pricing for DeepInfra/Featherless
   - Create cache management endpoints

3. **Next Week:**
   - Advanced search functionality
   - Health monitoring system
   - Performance benchmarking

4. **Future:**
   - AI-powered recommendations
   - Webhook system
   - Advanced analytics dashboard

## Questions to Consider

1. **Do you want me to implement Phase 1 features now?**
   - Provider statistics
   - Model comparison  
   - Real-time pricing

2. **Which feature is most critical for your use case?**
   - Showing provider stats in UI?
   - Price comparison?
   - Model search?

3. **Do you have preferences for the implementation approach?**
   - Use existing `activity_log` table?
   - Create new tables?
   - Cache strategies?

Let me know which features you'd like me to implement first!

