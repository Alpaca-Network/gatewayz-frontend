# Observability Quick Start Guide

Get your Gatewayz API fully observable in 5 minutes!

## TL;DR

Add these environment variables and restart your API:

```bash
# Enable observability
TEMPO_ENABLED=true
LOKI_ENABLED=true
PROMETHEUS_ENABLED=true

# Configure endpoints (Railway internal networking)
TEMPO_OTLP_HTTP_ENDPOINT=http://tempo.railway.internal:4318
LOKI_PUSH_URL=http://loki.railway.internal:3100/loki/api/v1/push

# Service name
OTEL_SERVICE_NAME=gatewayz-api
```

That's it! Your API now sends metrics, logs, and traces to your observability stack.

## Quick Setup

### 1. Configure Environment Variables

**For Railway deployment** (API on same Railway project):
```bash
TEMPO_ENABLED=true
LOKI_ENABLED=true
TEMPO_OTLP_HTTP_ENDPOINT=http://tempo.railway.internal:4318
LOKI_PUSH_URL=http://loki.railway.internal:3100/loki/api/v1/push
```

**For external deployment** (API outside Railway):
1. Expose Loki and Tempo in Railway (Settings → Networking → Generate Domain)
2. Use public URLs:
```bash
TEMPO_ENABLED=true
LOKI_ENABLED=true
TEMPO_OTLP_HTTP_ENDPOINT=https://tempo-production-xxxx.up.railway.app:4318
LOKI_PUSH_URL=https://loki-production-xxxx.up.railway.app/loki/api/v1/push
```

### 2. Verify Configuration

Check your API logs on startup:
```
🔭 Initializing OpenTelemetry tracing...
   Tempo endpoint: http://tempo.railway.internal:4318
   HTTP client instrumentation enabled
✅ OpenTelemetry tracing initialized successfully
✅ FastAPI application instrumented with OpenTelemetry

📝 Console logging configured
✅ Loki logging enabled: http://loki.railway.internal:3100/loki/api/v1/push
```

### 3. Generate Some Traffic

```bash
# Health check
curl https://api.gatewayz.ai/health

# Chat completion
curl -X POST https://api.gatewayz.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 4. View in Grafana

Open Grafana at `http://grafana.railway.internal:3000` (or your public URL)

#### View Metrics
1. Go to **Explore** → **Prometheus**
2. Query: `fastapi_requests_total`
3. You should see your requests!

#### View Logs
1. Go to **Explore** → **Loki**
2. Query: `{app="gatewayz-api"}`
3. You should see structured logs with trace IDs!

#### View Traces
1. Go to **Explore** → **Tempo**
2. Click **Search** → Service Name: `gatewayz-api`
3. You should see your request traces!

#### Log-to-Trace Correlation
1. In **Loki** logs, find a log entry with a `trace_id`
2. **Click the trace_id** link
3. You'll jump directly to the full trace in Tempo!

## What You Get

### ✅ Automatic Metrics
- Request rate, duration, error rate
- Model inference metrics
- Database query metrics
- Cache hit/miss rates
- Credit consumption

### ✅ Structured Logs
- JSON-formatted logs
- Trace correlation (trace_id, span_id)
- Request context (path, method, status)
- Automatic push to Loki

### ✅ Distributed Traces
- Full request timeline
- HTTP client calls (to OpenRouter, Portkey, etc.)
- Custom spans for important operations
- Exception tracking

### ✅ Log-to-Trace Correlation
- Click from logs to traces
- See logs for specific traces
- Debug with full context

## Common Queries

### Metrics (Prometheus)

```promql
# Request rate (req/sec)
rate(fastapi_requests_total[5m])

# P99 latency
histogram_quantile(0.99, rate(fastapi_requests_duration_seconds_bucket[5m]))

# Error rate
rate(fastapi_requests_total{status_code=~"5.."}[5m])

# Model inference rate
rate(model_inference_requests_total[5m])
```

### Logs (Loki)

```logql
# All logs
{app="gatewayz-api"}

# Errors only
{app="gatewayz-api"} |= "ERROR"

# Specific endpoint
{app="gatewayz-api", path="/v1/chat/completions"}

# Logs with traces
{app="gatewayz-api"} | json | trace_id != ""
```

### Traces (Tempo)

- Go to **Explore** → **Tempo** → **Search**
- Filter by:
  - Service: `gatewayz-api`
  - Min duration: `1s` (find slow requests)
  - Status: `error` (find failed requests)

## Dashboards

### Import FastAPI Dashboard

1. Go to **Dashboards** → **Import**
2. Enter dashboard ID: **16110**
3. Select Prometheus data source
4. Click **Import**

You'll get:
- Request rate and error rate graphs
- Latency percentiles (P50, P95, P99)
- Top endpoints by traffic
- Request/response sizes

## Troubleshooting

### No traces appearing?

```bash
# Check Tempo is enabled
echo $TEMPO_ENABLED  # Should be "true"

# Check endpoint
echo $TEMPO_OTLP_HTTP_ENDPOINT

# Check Tempo is reachable
curl http://tempo.railway.internal:4318/v1/traces

# Check API logs
grep "OpenTelemetry" <your-api-logs>
```

### No logs appearing?

```bash
# Check Loki is enabled
echo $LOKI_ENABLED  # Should be "true"

# Check endpoint
echo $LOKI_PUSH_URL

# Check Loki is reachable
curl http://loki.railway.internal:3100/ready

# Check API logs
grep "Loki" <your-api-logs>
```

### Metrics working but traces/logs not?

That's normal! Prometheus scrapes the `/metrics` endpoint (pull model), while traces and logs are pushed. Check:

1. **Environment variables** are set correctly
2. **Tempo and Loki services** are running
3. **Network connectivity** between services

## Next Steps

- Read the full [OpenTelemetry Setup Guide](./OPENTELEMETRY_SETUP.md)
- Learn about [custom spans](./OPENTELEMETRY_SETUP.md#3-custom-spans)
- Configure [trace sampling](./OPENTELEMETRY_SETUP.md#trace-sampling) for high traffic
- Set up [alerting](./ALERTING.md) based on metrics

## Help

If you encounter issues:
1. Check the [Troubleshooting section](./OPENTELEMETRY_SETUP.md#troubleshooting)
2. Review Railway service logs
3. Verify network connectivity between services
4. Check Grafana data source configuration

Happy observing! 🔭
