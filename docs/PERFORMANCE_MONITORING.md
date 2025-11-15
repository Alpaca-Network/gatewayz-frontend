# Performance Monitoring Setup

This guide explains how to set up and use the performance monitoring system for tracking backend TTFB, streaming duration, and request stage breakdown.

## Overview

The performance monitoring system provides detailed insights into where time is spent during request processing:

- **Frontend Processing** (< 3ms): Request parsing, auth validation, request preparation
- **Backend API Response** (~1,697ms): Time to first byte (TTFB) from backend API
- **Stream Processing** (~1,300ms): Time spent streaming response to client

## Metrics Exposed

### Backend TTFB Metrics
- `backend_ttfb_seconds` - Histogram of backend API time to first byte
  - Labels: `provider`, `model`, `endpoint`
  - Buckets: 0.1s, 0.5s, 1.0s, 1.5s, 2.0s, 2.5s, 3.0s, 5.0s, 10.0s

### Streaming Duration Metrics
- `streaming_duration_seconds` - Histogram of streaming response duration
  - Labels: `provider`, `model`, `endpoint`
  - Buckets: 0.1s, 0.5s, 1.0s, 1.5s, 2.0s, 2.5s, 3.0s, 5.0s, 10.0s

### Frontend Processing Metrics
- `frontend_processing_seconds` - Histogram of frontend processing time
  - Labels: `endpoint`
  - Buckets: 0.001s, 0.005s, 0.01s, 0.025s, 0.05s, 0.1s, 0.25s, 0.5s

### Stage Breakdown Metrics
- `request_stage_duration_seconds` - Histogram of individual stage durations
  - Labels: `stage`, `endpoint`
  - Stages: `request_parsing`, `auth_validation`, `request_preparation`, `backend_fetch`, `stream_processing`

- `stage_percentage` - Gauge of percentage of total time per stage
  - Labels: `stage`, `endpoint`
  - Stages: `frontend_processing`, `backend_response`, `stream_processing`

## Grafana Dashboard

### Import Dashboard

1. Open Grafana and navigate to **Dashboards** → **Import**
2. Upload `dashboards/performance-monitoring.json`
3. Select your Prometheus datasource
4. Click **Import**

### Dashboard Panels

The dashboard includes:

1. **Backend API TTFB by Provider/Model** - Shows p50, p95, p99 percentiles
2. **Streaming Duration by Provider/Model** - Shows p50, p95, p99 percentiles
3. **Frontend Processing Time (p95)** - Should be minimal (< 3ms)
4. **Request Stage Breakdown (Stacked)** - Visual breakdown of all stages
5. **Time Distribution by Stage (%)** - Percentage breakdown
6. **Top 10 Slowest Backend TTFB** - Identifies bottlenecks
7. **Gauge Panels** - Real-time metrics for quick status checks

## Prometheus Alerts

### Setup Alerting

1. Configure Prometheus to load alert rules:
   ```yaml
   # prometheus.yml
   rule_files:
     - "prometheus-alerts.yml"
   ```

2. Configure Alertmanager to send notifications (email, Slack, PagerDuty, etc.)

### Alert Rules

#### Backend TTFB Alerts
- **HighBackendTTFB**: Warning when p95 TTFB > 2.0s for 5 minutes
- **CriticalBackendTTFB**: Critical when p95 TTFB > 3.0s for 2 minutes

#### Streaming Duration Alerts
- **HighStreamingDuration**: Warning when p95 streaming > 1.5s for 5 minutes
- **CriticalStreamingDuration**: Critical when p95 streaming > 2.5s for 2 minutes

#### Frontend Processing Alerts
- **HighFrontendProcessing**: Warning when p95 frontend > 0.01s (should be minimal)

#### Stage Percentage Alerts
- **BackendResponseDominating**: Info when backend response > 70% of total time
- **StreamingTimeHigh**: Warning when streaming > 50% of total time

#### Provider/Model Alerts
- **SlowProviderTTFB**: Warning for slow providers (> 2.5s p95)
- **SlowModelTTFB**: Warning for slow models (> 3.0s p95)

#### Trend Detection
- **BackendTTFBDegrading**: Warning when TTFB increases > 50% vs 1 hour ago
- **StreamingDurationDegrading**: Warning when streaming increases > 50% vs 1 hour ago

## Code Instrumentation

### Using PerformanceTracker

Add instrumentation to your route handlers:

```python
from src.utils.performance_tracker import PerformanceTracker

@router.post("/v1/chat/completions")
async def chat_completions(req: ProxyRequest, api_key: str = Depends(get_api_key)):
    tracker = PerformanceTracker(endpoint="/v1/chat/completions")
    
    # Track request parsing
    with tracker.stage("request_parsing"):
        # Parse and validate request
        messages = req.messages
        model = req.model
    
    # Track auth validation
    with tracker.stage("auth_validation"):
        user = await validate_api_key(api_key)
    
    # Track request preparation
    with tracker.stage("request_preparation"):
        # Prepare request for backend
        headers = prepare_headers(api_key)
    
    # Track backend request (TTFB)
    with tracker.backend_request(provider="openrouter", model=model):
        response = await make_backend_request(messages, model, headers)
    
    # Track streaming (if applicable)
    if req.stream:
        with tracker.streaming():
            async for chunk in stream_response(response):
                yield chunk
    else:
        return response
    
    # Record percentages
    tracker.record_percentages()
```

### Simplified Usage

For simpler cases, use the context manager:

```python
from src.utils.performance_tracker import track_request_stages

@router.post("/v1/responses")
async def unified_responses(req: ResponseRequest, api_key: str = Depends(get_api_key)):
    with track_request_stages("/v1/responses") as tracker:
        with tracker.stage("request_parsing"):
            # parse request
            pass
        
        with tracker.backend_request(provider="portkey", model=req.model):
            # make backend request
            response = await make_request(...)
        
        # Percentages are automatically recorded when context exits
```

## Querying Metrics

### Prometheus Queries

**Average Backend TTFB (p95):**
```promql
histogram_quantile(0.95, sum(rate(backend_ttfb_seconds_bucket[5m])) by (le))
```

**Average Streaming Duration (p95):**
```promql
histogram_quantile(0.95, sum(rate(streaming_duration_seconds_bucket[5m])) by (le))
```

**Backend TTFB by Provider:**
```promql
histogram_quantile(0.95, sum(rate(backend_ttfb_seconds_bucket[5m])) by (le, provider))
```

**Stage Breakdown:**
```promql
sum(rate(request_stage_duration_seconds_sum[5m])) by (stage) / 
sum(rate(request_stage_duration_seconds_count[5m])) by (stage)
```

**Percentage of Time in Backend:**
```promql
avg(stage_percentage{stage="backend_response"})
```

## Performance Optimization Recommendations

Based on profiling findings:

### Backend Optimization (Main Bottleneck - ~56% of time)
1. **Model Cold Start**: Monitor and optimize cold start times
2. **Backend Infrastructure**: Scale backend infrastructure as needed
3. **Response Caching**: Implement caching for similar requests
4. **Provider Selection**: Route to faster providers when possible

### Network Optimization (~43% of time)
1. **Network Latency**: Check network latency to backend
2. **CDN/Edge Locations**: Consider CDN or edge locations
3. **Chunk Sizes**: Optimize chunk sizes for streaming
4. **Connection Pooling**: Ensure proper connection pooling

### Frontend Optimization (< 0.1% of time)
- Frontend overhead is minimal - no optimization needed

## Monitoring Best Practices

1. **Set Baseline Metrics**: Establish baseline performance metrics during normal operation
2. **Monitor Trends**: Watch for gradual degradation over time
3. **Alert on Anomalies**: Set up alerts for sudden spikes or degradation
4. **Regular Review**: Review performance metrics weekly to identify optimization opportunities
5. **Provider Comparison**: Compare performance across providers to identify best performers
6. **Model Comparison**: Track performance by model to identify slow models

## Troubleshooting

### Metrics Not Appearing

1. **Check Instrumentation**: Ensure routes are instrumented with `PerformanceTracker`
2. **Check Prometheus**: Verify Prometheus is scraping `/metrics` endpoint
3. **Check Labels**: Ensure provider/model labels are set correctly
4. **Check Logs**: Look for errors in application logs

### High TTFB

1. **Check Backend Status**: Verify backend API is healthy
2. **Check Network**: Test network latency to backend
3. **Check Provider**: Some providers may be slower than others
4. **Check Model**: Some models may have longer cold start times

### High Streaming Duration

1. **Check Network**: Test network bandwidth and latency
2. **Check Chunk Size**: Smaller chunks may increase overhead
3. **Check Model**: Some models generate tokens slower
4. **Check Client**: Client-side processing may be slow

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Performance Profiling Guide](./LATENCY_METRICS.md)

