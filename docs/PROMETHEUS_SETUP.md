# Prometheus Setup for Gatewayz API Gateway

This guide explains how to set up Prometheus monitoring for the Gatewayz API Gateway, including integration with the Railway Grafana stack template.

## Overview

Prometheus is a time-series metrics database that collects metrics from your application at regular intervals. The Gatewayz API now exposes comprehensive metrics at the `/metrics` endpoint in Prometheus text format.

### Metrics Collected

The application exports metrics across multiple categories:

#### 1. HTTP Request Metrics
- **`http_requests_total`** - Total HTTP requests by method, endpoint, and status code
- **`http_request_duration_seconds`** - HTTP request duration in seconds

#### 2. Model Inference Metrics
- **`model_inference_requests_total`** - Total inference requests by provider, model, and status
- **`model_inference_duration_seconds`** - Inference duration by provider and model
- **`tokens_used_total`** - Tokens consumed (input/output) by provider and model
- **`credits_used_total`** - Credits consumed by provider, model, and user

#### 3. Database Metrics
- **`database_queries_total`** - Total database queries by table and operation
- **`database_query_duration_seconds`** - Query duration by table

#### 4. Cache Metrics
- **`cache_hits_total`** - Cache hits by cache name
- **`cache_misses_total`** - Cache misses by cache name
- **`cache_size_bytes`** - Cache size in bytes

#### 5. Rate Limiting Metrics
- **`rate_limited_requests_total`** - Blocked requests by API key and limit type
- **`current_rate_limit`** - Current rate limit remaining

#### 6. Provider Health Metrics
- **`provider_availability`** - Provider health status (1=available, 0=unavailable)
- **`provider_error_rate`** - Provider error rate (0-1)
- **`provider_response_time_seconds`** - Provider response time

#### 7. API Key Metrics
- **`api_key_usage_total`** - API key usage by key and status
- **`active_api_keys`** - Number of active/inactive API keys

#### 8. Business Metrics
- **`user_credit_balance`** - User credit balance by user and plan type
- **`trial_active`** - Number of active trials by status
- **`subscription_count`** - Active subscriptions by plan and billing cycle

#### 9. System Metrics
- **`active_connections`** - Active connections by type (db/redis/provider)
- **`queue_size`** - Request queue size by queue name

---

## Setup Instructions

### 1. Local Development Setup

#### Prerequisites
- Docker and Docker Compose installed
- Gatewayz API environment variables configured

#### Step 1: Start the Stack

```bash
# Navigate to the repository root
cd /root/repo

# Start Gatewayz, Prometheus, and Grafana
docker-compose -f docker-compose.prometheus.yml up -d
```

#### Step 2: Verify Prometheus is Collecting Metrics

1. Open Prometheus UI: http://localhost:9090
2. Go to Status → Targets
3. Verify that the `gatewayz-api` target is "UP"
4. Go to Status → Service Discovery to see active targets

#### Step 3: Query Metrics in Prometheus

1. Navigate to Graph tab: http://localhost:9090/graph
2. Try these queries:
   - `http_requests_total` - View total HTTP requests
   - `model_inference_requests_total` - View model inference requests
   - `tokens_used_total` - View token usage
   - `cache_hits_total` - View cache hit rate

#### Step 4: Set Up Grafana

1. Open Grafana: http://localhost:3000
2. Login with default credentials (admin/admin)
3. Add Prometheus as a data source:
   - Navigate to Configuration → Data Sources
   - Click "Add data source"
   - Select "Prometheus"
   - URL: `http://prometheus:9090`
   - Click "Save & Test"

4. Import or create dashboards:
   - Click "+" → Import Dashboard
   - Use our pre-built dashboards (see section below)

---

### 2. Railway Deployment with Grafana Stack

The Railway Grafana stack template (https://railway.com/deploy/8TLSQD) provides pre-configured Prometheus, Grafana, Loki, and Tempo.

#### Step 1: Deploy Grafana Stack

1. Click the Railway template link: https://railway.com/deploy/8TLSQD
2. Follow Railway's deployment instructions
3. Note the internal URLs for Prometheus and Grafana

#### Step 2: Deploy Gatewayz API

1. Deploy your Gatewayz API to Railway
2. Verify the application is running and accessible

#### Step 3: Configure Prometheus to Scrape Gatewayz API

The Railway Grafana stack's Prometheus needs to be configured to scrape your Gatewayz API.

**Option A: Update Prometheus Configuration (Recommended)**

1. In your Railway project, access the Prometheus service configuration
2. Update the `prometheus.yml` to include your Gatewayz API:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'gatewayz-api'
    scrape_interval: 10s
    scrape_timeout: 5s
    static_configs:
      - targets: ['gatewayz-api:8000']  # Internal Railway URL
        labels:
          service: 'gatewayz-api'
          environment: 'production'
    metrics_path: '/metrics'
```

**Option B: Environment Variables**

Set these environment variables in Prometheus service:
- `SCRAPE_TARGETS`: Your Gatewayz API URL (e.g., `http://gatewayz-api.railway.internal:8000`)

#### Step 4: Verify Metrics Collection

1. Access Prometheus in Railway
2. Navigate to Status → Targets
3. Verify `gatewayz-api` target is "UP"
4. Check Health → Targets for any errors

#### Step 5: Create Grafana Dashboards

See the section on "Grafana Dashboards" below for pre-built dashboard definitions.

---

## Grafana Dashboards

### Pre-built Dashboard: Gatewayz API Overview

The following JSON can be imported into Grafana to create a comprehensive overview dashboard:

**Dashboard: API Performance & Usage**

Panels to include:
1. Request Rate (requests/sec)
2. Error Rate (%)
3. Response Time (percentiles)
4. Tokens Used (daily)
5. Credits Used (daily)
6. Cache Hit Rate (%)
7. Provider Availability (status gauge)
8. Top Models by Usage
9. Top Users by Requests
10. Rate Limited Requests

### Creating Custom Dashboards

#### Step 1: Access Grafana Dashboard Editor

1. In Grafana, click "+" → Create → Dashboard
2. Click "Add Panel"

#### Step 2: Add Prometheus Queries

Example queries:

**Request Rate**
```promql
rate(http_requests_total[5m])
```

**Error Rate**
```promql
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])
```

**Average Response Time (by endpoint)**
```promql
histogram_quantile(0.95, http_request_duration_seconds_bucket)
```

**Tokens Used Today**
```promql
increase(tokens_used_total[24h])
```

**Credits Used (by user)**
```promql
topk(10, increase(credits_used_total[24h]) by (user_id))
```

**Cache Hit Rate**
```promql
cache_hits_total / (cache_hits_total + cache_misses_total)
```

**Provider Status**
```promql
provider_availability
```

---

## Integration with Existing Monitoring

### OpenTelemetry Integration

The Gatewayz API already has OpenTelemetry dependencies. Prometheus metrics complement OTel by providing:
- Simpler deployment (single endpoint vs distributed tracing)
- Better aggregation (time-series vs event logging)
- Built-in Grafana support

Both systems can coexist and be used together.

### Adding Instrumentation to Existing Code

To add Prometheus metrics to your code:

```python
from src.services.prometheus_metrics import (
    track_model_inference,
    record_tokens_used,
    record_credits_used,
    track_http_request,
)

# Track model inference
with track_model_inference("openrouter", "gpt-4"):
    response = await openrouter_client.create_completion(...)

# Record token usage
record_tokens_used(
    provider="openrouter",
    model="gpt-4",
    input_tokens=100,
    output_tokens=50
)

# Record credit usage
record_credits_used(
    provider="openrouter",
    model="gpt-4",
    user_id="user123",
    credits=1.5
)
```

---

## Troubleshooting

### Prometheus can't scrape the application

**Symptom**: Target shows as "DOWN" in Prometheus UI

**Solution**:
1. Verify the application is running
2. Check the URL is correct (e.g., `localhost:8000` for local, `gatewayz-api:8000` for Docker)
3. Ensure the `/metrics` endpoint is accessible:
   ```bash
   curl http://localhost:8000/metrics
   ```
4. Check for network connectivity issues between Prometheus and the app

### No metrics appearing in Grafana

**Symptom**: Dashboard shows "No data"

**Solution**:
1. Verify Prometheus has collected metrics (check Prometheus graph)
2. Check dashboard queries (may have wrong metric names)
3. Ensure data source is correctly configured
4. Wait 1-2 minutes for data collection (default scrape interval is 15s)

### High memory usage in Prometheus

**Symptom**: Prometheus consuming excessive memory

**Solution**:
1. Reduce data retention: Update `--storage.tsdb.retention.time=7d` (shorter period)
2. Increase scrape interval in prometheus.yml
3. Use recording rules to pre-aggregate metrics

### Metrics endpoint is slow

**Symptom**: `/metrics` endpoint takes >5 seconds

**Solution**:
1. Check Prometheus metric cardinality (number of unique metric series)
2. Remove high-cardinality labels (e.g., user_id in some metrics)
3. Use metric relabeling to drop unnecessary metrics
4. Consider using Prometheus remote storage

---

## Performance Considerations

### Metric Cardinality

High cardinality can cause performance issues. Be careful with these metrics:
- `credits_used_total` - Uses user_id as label
- `api_key_usage_total` - Uses api_key_id as label

**Recommendation**: Use these metrics cautiously in production, or aggregate by higher-level labels.

### Scrape Interval

Default is 15 seconds. Adjust based on:
- **Real-time monitoring needed?** Use 5-10s intervals
- **Long-term trend analysis?** Use 30-60s intervals
- **Memory constrained?** Use 30s+ intervals

### Storage Configuration

Prometheus default retention is 15 days. For longer retention:

```yaml
# In prometheus.yml
command:
  - '--storage.tsdb.retention.time=90d'  # 90 days
```

---

## Production Deployment Checklist

- [ ] Configure persistent storage for Prometheus data
- [ ] Set up alerting rules for critical metrics
- [ ] Configure Prometheus remote storage backup
- [ ] Set up Grafana user authentication
- [ ] Create monitoring dashboards
- [ ] Test scraping and metric collection
- [ ] Configure log aggregation (Loki) if needed
- [ ] Set up alerting notifications (email, Slack, PagerDuty)
- [ ] Document custom dashboards
- [ ] Set up metric retention policy

---

## Useful Links

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Prometheus Query Language (PromQL)](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard Documentation](https://grafana.com/docs/grafana/latest/dashboards/)
- [Railway Documentation](https://docs.railway.app/)
- [prometheus-client Python Library](https://github.com/prometheus/client_python)

---

## Example: Complete Monitoring Setup

Here's a complete example of instrumenting a chat completion endpoint:

```python
from src.services.prometheus_metrics import (
    track_http_request,
    track_model_inference,
    record_tokens_used,
    record_credits_used,
    record_api_key_usage,
)
from src.services.pricing import calculate_credits

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest, api_key: str = Depends(get_api_key)):
    with track_http_request("POST", "/v1/chat/completions"):
        # Track API key usage
        record_api_key_usage(api_key, status="attempt")

        # Get pricing info
        pricing = get_pricing(request.model)

        # Track model inference
        with track_model_inference(request.model.split("/")[0], request.model):
            response = await openrouter_client.create_completion(request)

        # Record token usage
        record_tokens_used(
            provider=request.model.split("/")[0],
            model=request.model,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
        )

        # Record credit usage
        credits = calculate_credits(
            pricing,
            response.usage.prompt_tokens,
            response.usage.completion_tokens,
        )
        record_credits_used(
            provider=request.model.split("/")[0],
            model=request.model,
            user_id=api_key,  # Use API key as identifier
            credits=credits,
        )

        # Update user balance (deduct credits)
        await update_user_credits(api_key, -credits)

        record_api_key_usage(api_key, status="success")
        return response
```

---

## Questions?

For issues or questions about Prometheus setup:
1. Check [Prometheus troubleshooting guide](https://prometheus.io/docs/prometheus/latest/guides/troubleshooting/)
2. Review `/metrics` endpoint output: `curl http://localhost:8000/metrics`
3. Check application logs for errors during metric collection
4. Consult [GitHub Issues](https://github.com/anthropics/claude-code/issues)
