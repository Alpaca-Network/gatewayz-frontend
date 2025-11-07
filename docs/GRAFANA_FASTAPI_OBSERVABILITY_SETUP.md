# Grafana FastAPI Observability Dashboard Setup

This guide explains how to set up and use the Grafana FastAPI Observability Dashboard with the Gatewayz API.

## Overview

The dashboard provides comprehensive monitoring of your FastAPI application with the following observability pillars:

- **Metrics**: Real-time performance metrics via Prometheus
- **Traces**: Distributed tracing via OpenTelemetry and Tempo (optional)
- **Logs**: Structured logging correlation (optional)

## What Metrics Are Exposed

The Gatewayz API automatically exposes the following metrics at `/metrics`:

### HTTP Request Metrics
- `http_requests_total` - Total requests by method, endpoint, and status code
- `http_request_duration_seconds` - Request latency histogram (p50, p95, p99)
- `fastapi_requests_in_progress` - Current in-flight requests by method and endpoint
- `fastapi_request_size_bytes` - Request body size histogram
- `fastapi_response_size_bytes` - Response body size histogram

### Model Inference Metrics
- `model_inference_requests_total` - Total inference requests by provider and model
- `model_inference_duration_seconds` - Inference latency by provider and model
- `tokens_used_total` - Total tokens consumed (input/output)
- `credits_used_total` - Total credits consumed

### Database Metrics
- `database_queries_total` - Total queries by table and operation
- `database_query_duration_seconds` - Query latency by table

### Cache Metrics
- `cache_hits_total` - Cache hit count by cache name
- `cache_misses_total` - Cache miss count by cache name
- `cache_size_bytes` - Cache size in bytes

### Rate Limiting Metrics
- `rate_limited_requests_total` - Blocked requests by limit type
- `current_rate_limit` - Current rate limit status

### Provider Health Metrics
- `provider_availability` - Provider availability status (1=available, 0=unavailable)
- `provider_error_rate` - Error rate per provider (0-1)
- `provider_response_time_seconds` - Provider response time

### Business Metrics
- `user_credit_balance` - Total user credit balance by plan type
- `trial_active` - Active trials count
- `subscription_count` - Active subscriptions by plan type
- `api_key_usage_total` - API key usage count
- `active_api_keys` - Number of active API keys

## Prerequisites

1. **Prometheus** instance (v2.0+)
   - For local development: Use Docker Compose
   - For Railway: Use Railway Grafana Stack template

2. **Grafana** instance (v8.0+)
   - For local development: Use Docker Compose
   - For Railway: Provided by template

3. **Gatewayz API** running with metrics enabled
   - The `/metrics` endpoint must be accessible
   - Metrics are exposed by default in Prometheus format

## Quick Start (Local Development)

### Step 1: Configure Environment Variables

Ensure these environment variables are set in your `.env`:

```bash
# Prometheus Configuration
PROMETHEUS_ENABLED=true
PROMETHEUS_REMOTE_WRITE_URL=http://prometheus:9090/api/v1/write
PROMETHEUS_SCRAPE_ENABLED=true

# Optional: OpenTelemetry for distributed tracing
TEMPO_ENABLED=false
TEMPO_OTLP_HTTP_ENDPOINT=http://tempo:4318

# Optional: Structured logging
LOKI_ENABLED=false
LOKI_PUSH_URL=http://loki:3100/loki/api/v1/push
```

### Step 2: Start Prometheus and Grafana (Docker Compose)

If you have a `docker-compose.prometheus.yml` file:

```bash
docker-compose -f docker-compose.prometheus.yml up -d
```

This will start:
- **Prometheus** on `http://localhost:9090`
- **Grafana** on `http://localhost:3000`

### Step 3: Start the Gatewayz API

```bash
python src/main.py
# or
uvicorn src.main:app --reload
```

The metrics endpoint will be available at `http://localhost:8000/metrics`

### Step 4: Configure Prometheus Scrape Job

In Prometheus configuration (`prometheus.yml`), add this scrape job:

```yaml
scrape_configs:
  - job_name: 'gatewayz-api'
    scrape_interval: 15s
    scrape_timeout: 10s
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
```

### Step 5: Import the Grafana Dashboard

1. Open Grafana at `http://localhost:3000`
   - Default credentials: admin/admin

2. Go to **Dashboards** → **Import**

3. **Option A**: Upload JSON file
   - Click "Upload JSON file"
   - Select `/dashboards/fastapi-observability.json`
   - Choose your Prometheus data source
   - Click "Import"

4. **Option B**: Paste JSON content
   - Click "Paste JSON"
   - Copy contents from `/dashboards/fastapi-observability.json`
   - Click "Load"
   - Choose your Prometheus data source
   - Click "Import"

5. Select **Prometheus** as the data source and click "Import"

### Step 6: Verify the Dashboard

Once imported, you should see panels showing:
- Request rate by method
- Error rate (5xx responses)
- Request latency percentiles (p50, p95, p99)
- Requests by status code
- Active requests by method
- Request/response sizes
- Top endpoints by request count
- Top slowest endpoints
- And more...

## Advanced Setup (Railway with Grafana Stack)

### Step 1: Deploy Railway Grafana Stack

1. Go to [Railway Dashboard](https://railway.app)
2. Create a new project
3. Add Grafana Stack template
   - This includes Prometheus, Grafana, Loki, and Tempo

### Step 2: Configure Gatewayz API

In your Railway variables, set:

```
PROMETHEUS_ENABLED=true
PROMETHEUS_REMOTE_WRITE_URL=http://prometheus:9090/api/v1/write
TEMPO_ENABLED=true
TEMPO_OTLP_HTTP_ENDPOINT=http://tempo:4318
LOKI_ENABLED=true
LOKI_PUSH_URL=http://loki:3100/loki/api/v1/push
```

### Step 3: Wait for Prometheus to Scrape Metrics

Prometheus scrapes metrics at intervals (default: 15 seconds). Wait a few minutes before checking the dashboard.

### Step 4: Import Dashboard

Follow Step 5-6 from the Quick Start section, but use the Railway Grafana URL instead of localhost.

## Understanding Dashboard Panels

### Request Rate by Method
Shows the number of HTTP requests per second by method (GET, POST, PUT, DELETE, etc.)

**What it indicates**: Traffic volume and distribution by HTTP method

### Error Rate (5xx)
Percentage of requests returning 5xx status codes

**What it indicates**: Application errors and stability issues
- Green (< 5%): Healthy
- Yellow (5-10%): Watch
- Red (> 10%): Critical

### Request Latency Percentiles
Shows p50, p95, and p99 latency percentiles

**What it indicates**: User experience and performance
- p50: Median response time (50% of requests faster than this)
- p95: 95% of requests are faster than this time
- p99: 99% of requests are faster than this time

### Requests by Status Code
Stacked bar chart of requests by HTTP status code (2xx, 3xx, 4xx, 5xx)

**What it indicates**: Request success/failure distribution

### Active Requests by Method
Current number of in-flight requests by method

**What it indicates**: Current load and concurrency

### Request/Response Size
Histogram of request and response body sizes (p95)

**What it indicates**: Payload size and bandwidth usage

### Top Endpoints by Request Count
Bar chart of endpoints with most traffic

**What it indicates**: Which endpoints are most used

### Top Slowest Endpoints
Bar chart of endpoints with highest latency (p95)

**What it indicates**: Performance bottlenecks and slowest parts of the API

### Model Inference Metrics
- **Top Models by Requests**: Which AI models are most used
- **Requests by Provider**: Traffic distribution across providers

**What it indicates**: Model usage patterns and provider load balancing

### Cache Metrics
- **Cache Hit/Miss Rate**: How often cache is effective
- **Overall Cache Hit Rate**: Total cache effectiveness

**What it indicates**: Cache performance and optimization opportunities

### Database Metrics
- **Queries by Operation Type**: SELECT, INSERT, UPDATE, DELETE distribution
- **Query Latency by Table**: Which tables are slowest

**What it indicates**: Database performance and potential query optimizations

### Rate Limiting
Shows how many requests were blocked by rate limits

**What it indicates**: Rate limiting effectiveness and potential legitimate users being blocked

### Provider Health
- **Availability Status**: Whether each provider is online (1) or offline (0)
- **Error Rate**: Failure rate per provider

**What it indicates**: Provider reliability and failover effectiveness

## Common Queries for Custom Dashboards

### Request Rate (QPS)
```promql
sum(rate(http_requests_total[5m]))
```

### Error Rate Percentage
```promql
sum(rate(http_requests_total{status_code=~"5.."}[5m])) /
sum(rate(http_requests_total[5m])) * 100
```

### P95 Latency
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Cache Hit Rate
```promql
sum(rate(cache_hits_total[5m])) /
(sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m]))) * 100
```

### Inference Requests per Provider
```promql
sum(rate(model_inference_requests_total[5m])) by (provider)
```

### Average Database Query Latency
```promql
sum(rate(database_query_duration_seconds_sum[5m])) by (table) /
sum(rate(database_query_duration_seconds_count[5m])) by (table)
```

## Troubleshooting

### Metrics Not Showing

1. **Check Prometheus scrape job**
   - Go to Prometheus UI (`http://localhost:9090`)
   - Click "Status" → "Targets"
   - Verify the gatewayz-api target is UP

2. **Check metrics endpoint**
   - Try accessing `http://localhost:8000/metrics` directly
   - Should return text-format Prometheus metrics

3. **Check Prometheus data source in Grafana**
   - Go to Grafana Settings → Data Sources
   - Verify Prometheus URL is correct
   - Click "Test Connection"

### High Cardinality Issues

The middleware normalizes paths to prevent unbounded cardinality:
- Dynamic IDs (`/users/123`) → `/users/{id}`
- UUIDs are automatically grouped
- Path segments are limited to first 5

If you see many unique endpoints in metrics, the normalization may need adjustment in `src/middleware/observability_middleware.py`.

### Dashboard Not Updating

1. Refresh Grafana page (Cmd/Ctrl + R)
2. Check query time range (usually "Last 1 hour")
3. Verify Prometheus has recent data points
4. Check browser console for query errors

### Memory Issues

If Prometheus uses too much memory:
1. Reduce `PROMETHEUS_REMOTE_WRITE_URL` push interval
2. Implement metric relabeling to drop low-priority metrics
3. Use smaller retention period in Prometheus

## Performance Considerations

### Metric Cardinality

The dashboard is designed to have reasonable cardinality:
- Request metrics: ~100-500 unique label combinations (depends on endpoint count)
- Inference metrics: ~50-200 unique label combinations
- Provider metrics: ~15 providers
- Cache metrics: ~5-10 caches

This is safe for most deployments.

### Data Retention

Default Prometheus retention: 15 days

For longer retention:
- Store metrics in remote storage (Railway Prometheus handles this)
- Or configure Prometheus locally with larger disk space

### Scrape Interval

Default: 15 seconds (granular data)

For high-throughput APIs:
- Keep at 15s for good time resolution
- Increase retention in Prometheus
- Consider Prometheus Operator for advanced features

## Next Steps

1. **Set up alerting**: Create alert rules based on metrics
   - Alert on error rate > 5%
   - Alert on latency p95 > 1s
   - Alert on provider unavailability

2. **Enable distributed tracing**: Configure OpenTelemetry
   - Set `TEMPO_ENABLED=true`
   - View traces in Grafana Tempo datasource
   - Correlate metrics with traces

3. **Add structured logging**: Enable JSON logging
   - Set `LOKI_ENABLED=true`
   - Inject trace IDs into logs
   - View logs in Grafana Loki

4. **Create custom dashboards**: Build specialized dashboards
   - Business metrics (credits, users)
   - Security metrics (rate limiting, auth failures)
   - Operational metrics (uptime, provider health)

5. **Set up notifications**: Configure alert notifications
   - Send to Slack, PagerDuty, OpsGenie, etc.
   - Create runbooks for common issues

## Related Documentation

- [Prometheus Setup Guide](./PROMETHEUS_SETUP.md)
- [Railway Grafana Integration](./RAILWAY_GRAFANA_INTEGRATION.md)
- [OpenTelemetry Setup](./OPENTELEMETRY_SETUP.md) (if available)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Prometheus/Grafana logs
3. Check Gatewayz API logs for metric collection errors
4. Open an issue in the repository

---

**Last Updated**: 2025-11-07
**Dashboard Version**: 1.0
**Tested with**: Prometheus 2.39+, Grafana 8.0+, FastAPI 0.104+
