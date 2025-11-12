# OpenTelemetry Setup for Gatewayz API

This guide explains how to configure OpenTelemetry to send metrics, logs, and traces from the Gatewayz API to your Railway observability stack (Prometheus, Loki, and Tempo).

## Overview

The Gatewayz API now includes comprehensive observability through:

- **Metrics (Prometheus)**: HTTP request metrics, model inference metrics, database metrics, etc.
- **Logs (Loki)**: Structured JSON logs with trace correlation
- **Traces (Tempo)**: Distributed tracing for request flows

## Architecture

```
┌─────────────────────┐
│   Gatewayz API      │
│   (FastAPI)         │
└──────┬──────────────┘
       │
       ├─── Metrics ────────► Prometheus (Port 9090)
       │    (/metrics)           │
       │                         ▼
       │                    Grafana (Port 3000)
       │                         ▲
       ├─── Logs ───────────► Loki (Port 3100)
       │    (HTTP Push)          │
       │                         │
       └─── Traces ─────────► Tempo (Port 4318)
            (OTLP HTTP)
```

## Configuration

### Step 1: Environment Variables

Add these environment variables to your `.env` file or Railway service configuration:

```bash
# OpenTelemetry Service Configuration
OTEL_SERVICE_NAME=gatewayz-api

# Tempo Configuration (Tracing)
TEMPO_ENABLED=true
TEMPO_OTLP_HTTP_ENDPOINT=http://tempo:4318

# Loki Configuration (Logging)
LOKI_ENABLED=true
LOKI_PUSH_URL=http://loki:3100/loki/api/v1/push

# Prometheus Configuration (Metrics)
PROMETHEUS_ENABLED=true
PROMETHEUS_SCRAPE_ENABLED=true
```

### Step 2: Railway-Specific Configuration

#### Option A: Internal Railway Networking (Recommended)

If your API is deployed on Railway alongside your observability stack, use internal URLs:

```bash
TEMPO_OTLP_HTTP_ENDPOINT=http://tempo.railway.internal:4318
LOKI_PUSH_URL=http://loki.railway.internal:3100/loki/api/v1/push
```

#### Option B: Public URLs (External API)

If your API is deployed outside Railway (e.g., Vercel), you need to expose Loki and Tempo:

1. **Expose Loki**:
   - Go to Loki service → Settings → Networking
   - Click "Generate Domain"
   - Copy the URL (e.g., `loki-production-xxxx.up.railway.app`)

2. **Expose Tempo**:
   - Go to Tempo service → Settings → Networking
   - Click "Generate Domain"
   - Copy the URL (e.g., `tempo-production-xxxx.up.railway.app`)

3. **Update environment variables**:
   ```bash
   TEMPO_OTLP_HTTP_ENDPOINT=https://tempo-production-xxxx.up.railway.app:4318
   LOKI_PUSH_URL=https://loki-production-xxxx.up.railway.app/loki/api/v1/push
   ```

### Step 3: Verify Prometheus is Scraping Metrics

Your Prometheus configuration should already be scraping the `/metrics` endpoint:

**prometheus.yml**:
```yaml
scrape_configs:
  - job_name: 'gatewayz_api'
    scrape_interval: 15s
    static_configs:
      - targets: ['api.gatewayz.ai:443']
    scheme: https
```

## Features

### 1. Automatic Request Tracing

Every HTTP request is automatically traced with:
- Request method and path
- Response status code
- Request duration
- HTTP headers
- Exception tracking

### 2. Log-to-Trace Correlation

Logs automatically include trace and span IDs, allowing you to:
- Click from a log entry to see the full trace in Grafana
- Follow request flows across services
- Debug issues with complete context

**Example log entry**:
```json
{
  "timestamp": "2025-11-12T10:30:45.123Z",
  "level": "INFO",
  "logger": "src.routes.chat",
  "message": "Processing chat completion request",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "path": "/v1/chat/completions",
  "method": "POST"
}
```

### 3. Custom Spans

Add custom spans to track specific operations:

```python
from src.config.opentelemetry_config import OpenTelemetryConfig

tracer = OpenTelemetryConfig.get_tracer(__name__)

@app.get("/process")
async def process_data():
    with tracer.start_as_current_span("process_data") as span:
        span.set_attribute("user.id", "123")
        span.set_attribute("model", "gpt-4")

        # Your processing logic
        result = await do_something()

        span.set_attribute("result.count", len(result))
        return result
```

### 4. HTTP Client Instrumentation

HTTPX and Requests are automatically instrumented, so outbound HTTP calls (e.g., to OpenRouter, Portkey) are traced automatically:

```python
import httpx

# This request is automatically traced!
async with httpx.AsyncClient() as client:
    response = await client.post(
        "https://openrouter.ai/api/v1/chat/completions",
        json={"model": "gpt-4", "messages": [...]},
    )
```

## Viewing Observability Data in Grafana

### 1. Metrics (Prometheus)

1. Go to Grafana → Explore → Prometheus
2. Try these queries:
   ```promql
   # Total requests
   fastapi_requests_total{job="gatewayz_api"}

   # Request rate (requests per second)
   rate(fastapi_requests_total[5m])

   # P99 latency
   histogram_quantile(0.99,
     rate(fastapi_requests_duration_seconds_bucket[5m])
   )

   # Error rate
   rate(fastapi_requests_total{status_code=~"5.."}[5m])
   ```

### 2. Logs (Loki)

1. Go to Grafana → Explore → Loki
2. Try these queries:
   ```logql
   # All logs from the API
   {app="gatewayz-api"}

   # Error logs only
   {app="gatewayz-api"} |= "ERROR"

   # Logs for a specific endpoint
   {app="gatewayz-api", path="/v1/chat/completions"}

   # Logs with trace correlation
   {app="gatewayz-api"} | json | trace_id != ""
   ```

3. **Click on a trace_id** in a log entry to jump to the full trace!

### 3. Traces (Tempo)

1. Go to Grafana → Explore → Tempo
2. Click "Search"
3. Filter by:
   - **Service Name**: `gatewayz-api`
   - **Operation**: (e.g., `POST /v1/chat/completions`)
   - **Duration**: (e.g., `> 1s` to find slow requests)
4. Click on a trace to see:
   - Full request timeline
   - All spans (API → OpenRouter → etc.)
   - Tags and attributes
   - Correlated logs

## Dashboards

### FastAPI Observability Dashboard

Import the pre-built dashboard:

1. Go to Grafana → Dashboards → Import
2. Use dashboard ID: **16110** (FastAPI Observability)
3. Or import from file: `/root/repo/docs/grafana-fastapi-dashboard.json`

This dashboard shows:
- Request rate and error rate
- Request duration percentiles (P50, P95, P99)
- Requests in progress
- Request/response sizes
- Top endpoints by volume and latency

### Custom Dashboard

Create a custom dashboard with panels for:

1. **HTTP Metrics**:
   - Request rate: `rate(fastapi_requests_total[5m])`
   - Error rate: `rate(fastapi_requests_total{status_code=~"5.."}[5m])`
   - P99 latency: `histogram_quantile(0.99, rate(fastapi_requests_duration_seconds_bucket[5m]))`

2. **Model Metrics**:
   - Inference requests: `rate(model_inference_requests_total[5m])`
   - Token consumption: `rate(model_tokens_total[5m])`
   - Credits used: `rate(credits_deducted_total[5m])`

3. **Logs Panel** (Loki):
   - Query: `{app="gatewayz-api"} |= "ERROR"`
   - Shows recent errors

4. **Traces Panel** (Tempo):
   - Linked from logs via trace_id

## Troubleshooting

### Traces not appearing in Tempo

1. **Check Tempo is reachable**:
   ```bash
   curl http://tempo:4318/v1/traces
   ```

2. **Check environment variable**:
   ```bash
   echo $TEMPO_ENABLED  # Should be "true"
   echo $TEMPO_OTLP_HTTP_ENDPOINT  # Should be correct URL
   ```

3. **Check application logs**:
   ```
   grep "OpenTelemetry" /var/log/app.log
   ```

4. **Verify in Grafana**:
   - Go to Tempo → Search
   - Check if service name appears in dropdown

### Logs not appearing in Loki

1. **Check Loki is reachable**:
   ```bash
   curl http://loki:3100/ready
   ```

2. **Check environment variable**:
   ```bash
   echo $LOKI_ENABLED  # Should be "true"
   echo $LOKI_PUSH_URL  # Should be correct URL
   ```

3. **Check application logs**:
   ```
   grep "Loki" /var/log/app.log
   ```

4. **Test Loki query**:
   - Go to Grafana → Explore → Loki
   - Query: `{app="gatewayz-api"}`
   - Check "Last 15 minutes"

### Prometheus not scraping metrics

1. **Check /metrics endpoint**:
   ```bash
   curl https://api.gatewayz.ai/metrics
   ```
   Should return metrics in Prometheus format

2. **Check Prometheus targets**:
   - Go to Prometheus UI → Status → Targets
   - Check if `gatewayz_api` target is "UP"

3. **Check Prometheus logs**:
   ```bash
   docker logs prometheus
   ```

### High cardinality warnings

If you see warnings about high cardinality metrics:

1. **Check path normalization** in `src/middleware/observability_middleware.py`
2. Ensure dynamic path segments (IDs, UUIDs) are replaced with `{id}`
3. Limit the number of unique label values

## Performance Considerations

### Trace Sampling

By default, all requests are traced (100% sampling). For high-traffic production:

```python
# In src/config/opentelemetry_config.py
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased

# Sample 10% of traces
sampler = TraceIdRatioBased(0.1)
tracer_provider = TracerProvider(resource=resource, sampler=sampler)
```

### Log Volume

To reduce log volume in production:

```python
# In src/config/logging_config.py
if Config.IS_PRODUCTION:
    root_logger.setLevel(logging.WARNING)  # Only warnings and errors
```

### Batch Processing

OpenTelemetry uses batch processing by default:
- Spans are batched and sent every 5 seconds
- Max batch size: 512 spans
- This minimizes overhead on the main application

## Security

### Authentication

If Loki/Tempo are exposed publicly, add authentication:

```python
# In src/config/opentelemetry_config.py
otlp_exporter = OTLPSpanExporter(
    endpoint=f"{tempo_endpoint}/v1/traces",
    headers={"Authorization": f"Bearer {os.getenv('TEMPO_AUTH_TOKEN')}"}
)

# In src/config/logging_config.py
import base64
auth = base64.b64encode(f"{username}:{password}".encode()).decode()
loki_handler = LokiLogHandler(
    loki_url=Config.LOKI_PUSH_URL,
    tags={...},
    headers={"Authorization": f"Basic {auth}"}
)
```

### Railway Private Networking

Use Railway's internal networking for better security:

```bash
# No public URLs needed!
TEMPO_OTLP_HTTP_ENDPOINT=http://tempo.railway.internal:4318
LOKI_PUSH_URL=http://loki.railway.internal:3100/loki/api/v1/push
```

## Summary

Your FastAPI application now sends:

- ✅ **Metrics** → Prometheus → Grafana (via `/metrics` endpoint)
- ✅ **Logs** → Loki → Grafana (via HTTP push API)
- ✅ **Traces** → Tempo → Grafana (via OTLP HTTP)

All three are correlated via trace IDs, enabling powerful debugging and observability workflows!

## References

- [OpenTelemetry Python Docs](https://opentelemetry.io/docs/instrumentation/python/)
- [Grafana Tempo Docs](https://grafana.com/docs/tempo/latest/)
- [Grafana Loki Docs](https://grafana.com/docs/loki/latest/)
- [FastAPI Observability Dashboard](https://grafana.com/grafana/dashboards/16110)
