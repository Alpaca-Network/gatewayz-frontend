# Railway Grafana Stack Integration Guide

Complete guide for integrating Gatewayz API with the Railway Grafana stack template (https://railway.com/deploy/8TLSQD).

## Overview

The Railway Grafana stack template provides a pre-configured observability stack with:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Loki** - Log aggregation
- **Tempo** - Distributed tracing

Your Gatewayz API has been enhanced with:

1. **Prometheus Remote Write** - Pushes metrics directly to Prometheus
2. **OpenTelemetry OTLP** - Exports traces to Tempo
3. **/metrics endpoint** - Exposing metrics in Prometheus format (optional fallback)

---

## Architecture

```
Gatewayz API (on Railway)
├── Prometheus Metrics (in-app collection)
│   └─→ Remote Write → Prometheus service (internal)
│
├── OpenTelemetry Instrumentation
│   └─→ OTLP Export → Tempo service (internal)
│
└── /metrics endpoint (optional, for Prometheus scraping)
    └─→ Can be scraped by Prometheus service (fallback)

Railway Grafana Stack:
├── Prometheus :9090 (receives metrics)
├── Tempo :4317/:4318 (receives traces)
├── Grafana :3000 (visualization)
└── Loki :3100 (optional log aggregation)
```

---

## Setup Instructions

### Step 1: Deploy Railway Grafana Stack

1. Click: https://railway.com/deploy/8TLSQD
2. Select your Railway project or create a new one
3. Wait for all services to deploy (should see 4 services: Prometheus, Grafana, Tempo, Loki)

### Step 2: Deploy Gatewayz API to Railway

1. Push code to your Railway-connected repository
2. Railway will automatically build and deploy
3. Ensure your Gatewayz service is running

### Step 3: Configure Environment Variables

In your Gatewayz API Railway service, add these environment variables:

```bash
# ==================== Monitoring Configuration ====================

# Prometheus Configuration
PROMETHEUS_ENABLED=true
PROMETHEUS_REMOTE_WRITE_URL=http://prometheus.railway.internal:9090/api/v1/write
PROMETHEUS_SCRAPE_ENABLED=true

# Tempo/OpenTelemetry OTLP Configuration
TEMPO_ENABLED=true
TEMPO_OTLP_HTTP_ENDPOINT=http://tempo.railway.internal:4318
TEMPO_OTLP_GRPC_ENDPOINT=tempo.railway.internal:4317

# Loki Configuration (optional)
LOKI_ENABLED=false
LOKI_PUSH_URL=http://loki.railway.internal:3100/loki/api/v1/push
```

**Important Notes:**
- All services use **internal URLs** (`.railway.internal`) for inter-service communication
- `TEMPO_ENABLED=true` enables distributed tracing to Tempo
- `PROMETHEUS_ENABLED=true` enables metrics export (recommended)
- Services communicate over Railway's private network

### Step 4: Verify Metrics Collection

#### Check Prometheus

1. Open Prometheus public URL in Railway dashboard
2. Navigate to **Graph** tab
3. Try query: `http_requests_total`
4. You should see metrics coming from Gatewayz API

If no data appears:
- Check `/metrics` endpoint directly: `curl <gatewayz-url>/metrics`
- Review Prometheus logs in Railway
- Verify environment variables are set correctly

#### Check Tempo Traces

1. Open Grafana public URL in Railway dashboard
2. Navigate to **Explore** → select **Tempo** data source
3. Query recent traces
4. You should see HTTP request traces from Gatewayz API

### Step 5: Create Grafana Dashboards

#### Step 5a: Add Data Sources

1. Login to Grafana (default: admin/admin)
2. Go to **Configuration** → **Data Sources**
3. Verify Prometheus data source is configured
   - Name: Prometheus
   - URL: `http://prometheus.railway.internal:9090`
4. Verify Tempo data source is configured
   - Name: Tempo
   - URL: `http://tempo.railway.internal:4317`

#### Step 5b: Import or Create Dashboards

**Option A: Create a Basic Dashboard**

1. Click **+** → **Dashboard**
2. Click **Add panel**
3. Use Prometheus as data source
4. Add queries:

```promql
# Request Rate
rate(http_requests_total[5m])

# Error Rate
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])

# Model Inferences
model_inference_requests_total

# Token Usage
increase(tokens_used_total[24h])
```

**Option B: Use Pre-built Dashboard Template**

See the example dashboard JSON below.

---

## Metrics Available

### HTTP Metrics
- `http_requests_total[method, endpoint, status_code]` - Request count
- `http_request_duration_seconds[method, endpoint]` - Response time

### Model Inference Metrics
- `model_inference_requests_total[provider, model, status]` - Inference count
- `model_inference_duration_seconds[provider, model]` - Inference latency
- `tokens_used_total[provider, model, token_type]` - Token consumption
- `credits_used_total[provider, model, user_id]` - Credit consumption

### Database Metrics
- `database_queries_total[table, operation]` - Query count
- `database_query_duration_seconds[table]` - Query latency

### Cache Metrics
- `cache_hits_total[cache_name]` - Cache hits
- `cache_misses_total[cache_name]` - Cache misses
- `cache_size_bytes[cache_name]` - Cache size

### Rate Limiting
- `rate_limited_requests_total[api_key, limit_type]` - Blocked requests
- `current_rate_limit[api_key, limit_type]` - Current limits

### Provider Health
- `provider_availability[provider]` - Health status (1=up, 0=down)
- `provider_error_rate[provider]` - Error rate (0-1)
- `provider_response_time_seconds[provider]` - Response time

### Business Metrics
- `user_credit_balance[user_id, plan_type]` - User credits
- `trial_active[status]` - Active trials count
- `subscription_count[plan_type, billing_cycle]` - Active subscriptions

---

## Common PromQL Queries

### Performance Monitoring

**Request Rate (requests per second)**
```promql
rate(http_requests_total[5m])
```

**Error Rate (percentage)**
```promql
rate(http_requests_total{status_code=~"5.."}[5m])
/ rate(http_requests_total[5m]) * 100
```

**Response Time Percentiles (P50, P95, P99)**
```promql
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))  # P50
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))  # P95
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))  # P99
```

### Model Usage

**Inference Rate by Model**
```promql
rate(model_inference_requests_total[5m]) by (model)
```

**Top 10 Models by Daily Usage**
```promql
topk(10, increase(model_inference_requests_total[24h]) by (model))
```

**Tokens Used Today**
```promql
increase(tokens_used_total[24h])
```

**Credits Used by User (Top 10)**
```promql
topk(10, increase(credits_used_total[24h]) by (user_id))
```

### System Health

**Cache Hit Rate**
```promql
cache_hits_total / (cache_hits_total + cache_misses_total) * 100
```

**Provider Availability**
```promql
provider_availability
```

**Database Query Latency**
```promql
rate(database_query_duration_seconds_sum[5m])
/ rate(database_query_duration_seconds_count[5m])
```

---

## Example Grafana Dashboard

Here's a sample dashboard configuration (save as JSON and import into Grafana):

```json
{
  "dashboard": {
    "title": "Gatewayz API - Performance & Usage",
    "panels": [
      {
        "title": "Request Rate (req/sec)",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate (%)",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "P95 Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Model Inferences (24h)",
        "targets": [
          {
            "expr": "topk(10, increase(model_inference_requests_total[24h]) by (model))"
          }
        ],
        "type": "table"
      },
      {
        "title": "Tokens Used (24h)",
        "targets": [
          {
            "expr": "increase(tokens_used_total[24h])"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Cache Hit Rate (%)",
        "targets": [
          {
            "expr": "cache_hits_total / (cache_hits_total + cache_misses_total) * 100"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "Provider Health",
        "targets": [
          {
            "expr": "provider_availability"
          }
        ],
        "type": "table"
      }
    ]
  }
}
```

---

## Troubleshooting

### Prometheus Not Receiving Metrics

**Symptom:** Prometheus has no data from Gatewayz API

**Check 1: Verify environment variables**
```bash
# In Railway, check Gatewayz service logs and environment variables
PROMETHEUS_ENABLED=true
PROMETHEUS_REMOTE_WRITE_URL=http://prometheus.railway.internal:9090/api/v1/write
```

**Check 2: Test metrics endpoint**
```bash
curl https://<your-gatewayz-domain>/metrics | head -20
```

**Check 3: Check Prometheus logs**
In Railway, view Prometheus service logs for connection errors

**Check 4: Verify network connectivity**
Both services should be in the same Railway project to use internal URLs

### Tempo Not Receiving Traces

**Symptom:** Tempo shows no traces from Gatewayz API

**Solution:**
```bash
# Verify environment variable
TEMPO_ENABLED=true
TEMPO_OTLP_HTTP_ENDPOINT=http://tempo.railway.internal:4318
```

**Note:** Tempo tracing requires OpenTelemetry packages. Check logs for missing dependencies.

### Grafana Shows Empty Dashboards

**Check 1:** Data source connectivity
- Go to Configuration → Data Sources
- Click "Test" on Prometheus and Tempo sources

**Check 2:** Time range
- Set Grafana time range to "Last 6 hours" (default might be shorter)
- Wait 1-2 minutes for data collection (default scrape interval is 30s)

**Check 3:** Metric names
- Query in Prometheus directly to verify metrics exist
- Copy exact metric name to Grafana query

### High Memory Usage

**Solution:**
- In Railway Prometheus settings, adjust retention time
- Reduce metric cardinality by excluding high-cardinality metrics
- Increase metrics push interval (currently 30s)

---

## Scaling Considerations

### Metrics Push Interval

Currently set to 30 seconds. Adjust in `prometheus_remote_write.py`:
```python
push_interval=30,  # Change this value
```

**Options:**
- 15s: More real-time (more network traffic)
- 30s: Balanced (default)
- 60s: Less frequent (saves bandwidth)

### Metric Cardinality

Be cautious with high-cardinality metrics:
- `credits_used_total` - Uses user_id label
- `api_key_usage_total` - Uses api_key_id label

In production, consider:
- Aggregating by higher-level labels
- Filtering in prometheus.yml with relabel configs
- Using recording rules for common queries

---

## Next Steps

1. ✅ Deploy Grafana stack
2. ✅ Deploy Gatewayz API
3. ✅ Configure environment variables
4. ✅ Verify metrics in Prometheus
5. ✅ Create Grafana dashboards
6. 📊 Set up alerts for critical metrics
7. 🔍 Investigate issues using historical data
8. 🎯 Use metrics for capacity planning

---

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/grafana/)
- [Tempo Documentation](https://grafana.com/docs/tempo/)
- [Railway Documentation](https://docs.railway.app/)
- [OpenTelemetry Python](https://github.com/open-telemetry/opentelemetry-python)
- [PromQL Query Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)

---

## Support

For issues:
1. Check environment variables are set correctly
2. Verify network connectivity between services (use internal URLs)
3. Review logs in Railway dashboard
4. Test endpoints directly (e.g., `/metrics`)
5. Check Prometheus/Tempo web UIs for data
