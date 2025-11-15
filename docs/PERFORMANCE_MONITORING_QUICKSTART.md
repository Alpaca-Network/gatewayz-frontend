# Performance Monitoring Quick Start

Quick setup guide for performance monitoring dashboard and alerts.

## 1. Import Grafana Dashboard

```bash
# In Grafana UI:
# 1. Go to Dashboards → Import
# 2. Upload dashboards/performance-monitoring.json
# 3. Select your Prometheus datasource
# 4. Click Import
```

## 2. Configure Prometheus Alerts

Add to your `prometheus.yml`:

```yaml
rule_files:
  - "prometheus-alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

## 3. Add Instrumentation to Routes

Example integration in `src/routes/chat.py`:

```python
from src.utils.performance_tracker import PerformanceTracker

@router.post("/v1/chat/completions")
async def chat_completions(req: ProxyRequest, api_key: str = Depends(get_api_key)):
    tracker = PerformanceTracker(endpoint="/v1/chat/completions")
    
    try:
        # Track request parsing
        with tracker.stage("request_parsing"):
            messages = req.messages
            model = req.model
        
        # Track auth validation
        with tracker.stage("auth_validation"):
            user = await get_user_from_api_key(api_key)
        
        # Track request preparation
        with tracker.stage("request_preparation"):
            headers = prepare_headers(api_key)
            provider = determine_provider(model)
        
        # Track backend request
        with tracker.backend_request(provider=provider, model=model):
            response = await make_backend_request(messages, model, headers)
        
        # Track streaming if applicable
        if req.stream:
            with tracker.streaming():
                async for chunk in stream_response(response):
                    yield chunk
        else:
            return response
    
    finally:
        # Record percentages
        tracker.record_percentages()
```

## 4. Verify Metrics

Check that metrics are being exposed:

```bash
curl http://localhost:8000/metrics | grep -E "(backend_ttfb|streaming_duration|frontend_processing)"
```

## 5. View Dashboard

1. Open Grafana
2. Navigate to "Performance Monitoring - Stage Breakdown" dashboard
3. Verify metrics are appearing

## 6. Test Alerts

Alerts will trigger when:
- Backend TTFB p95 > 2.0s for 5 minutes (warning)
- Backend TTFB p95 > 3.0s for 2 minutes (critical)
- Streaming duration p95 > 1.5s for 5 minutes (warning)

## Key Metrics to Monitor

- **Backend TTFB p95**: Should be < 2.0s (target: ~1.7s based on profiling)
- **Streaming Duration p95**: Should be < 1.5s (target: ~1.3s based on profiling)
- **Frontend Processing p95**: Should be < 0.01s (target: < 3ms based on profiling)

## Next Steps

1. Review [Full Documentation](./PERFORMANCE_MONITORING.md) for detailed setup
2. Customize alert thresholds based on your SLA requirements
3. Set up Alertmanager notifications (email, Slack, PagerDuty)
4. Integrate instrumentation into all chat/inference routes

