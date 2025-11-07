# Railway + Grafana Stack: Prometheus Setup Guide

This guide walks you through setting up Prometheus monitoring for Gatewayz API on Railway using the pre-configured Grafana stack template.

## Quick Start

1. **Deploy Grafana Stack**: https://railway.com/deploy/8TLSQD
2. **Deploy Gatewayz API**: Push your code to Railway
3. **Configure Prometheus**: Update prometheus.yml in the Prometheus service
4. **Create Dashboards**: Import pre-built dashboards or create custom ones

---

## Step-by-Step Setup

### Step 1: Deploy the Grafana Stack

1. Click: https://railway.com/deploy/8TLSQD
2. Select your Railway project or create a new one
3. Railway will deploy:
   - **Prometheus** - Metrics collection (port 9090)
   - **Grafana** - Visualization (port 3000)
   - **Loki** - Log aggregation (port 3100)
   - **Tempo** - Distributed tracing (port 3200)

4. Wait for all services to be "UP" in Railway dashboard

### Step 2: Deploy Gatewayz API

Ensure your Gatewayz API is deployed to Railway with the Prometheus metrics endpoint.

**Note the following from your Railway deployment:**
- **Service name**: gatewayz-api (or whatever you named it)
- **Internal URL**: You'll need this for Prometheus scraping
- **API should be running** and `/metrics` endpoint accessible

### Step 3: Find Prometheus Service URL

In Railway dashboard:

1. Go to your project
2. Click on "Prometheus" service
3. Copy the **Internal URL** (e.g., `prometheus.railway.internal:9090`)
4. Note the **Public URL** (e.g., `https://prometheus-prod-xxx.railway.app`)

### Step 4: Configure Prometheus to Scrape Gatewayz API

**Option A: Edit prometheus.yml Configuration**

1. In Railway, go to Prometheus service
2. Click "Settings" → "Variables"
3. Add or edit the `prometheus.yml` configuration

Replace or add this scrape config:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'gatewayz-api'
    environment: 'production'

scrape_configs:
  # Gatewayz API Gateway
  - job_name: 'gatewayz-api'
    scrape_interval: 10s
    scrape_timeout: 5s
    static_configs:
      - targets: ['gatewayz-api.railway.internal:8000']
        labels:
          service: 'gatewayz-api'
          environment: 'production'

    metrics_path: '/metrics'
    scheme: 'http'

  # Prometheus itself (optional)
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

4. Click "Save" or "Deploy"
5. Prometheus will reload and start scraping

**Option B: Using Environment Variable**

If Prometheus is configured to read from environment variables:

```bash
# Set in Prometheus service environment
GATEWAYZ_API_TARGET=gatewayz-api.railway.internal:8000
```

### Step 5: Verify Prometheus is Scraping

1. Open Prometheus public URL in browser
2. Navigate to **Status** → **Targets**
3. Look for `gatewayz-api` job
4. Status should be **UP** (green) within 1-2 minutes

If status is **DOWN** (red):
- Check the error message
- Verify gatewayz-api service is running
- Test endpoint manually: `curl http://gatewayz-api.railway.internal:8000/metrics`

### Step 6: Query Metrics in Prometheus

1. Go to **Graph** tab in Prometheus
2. Try these queries:

```promql
# Request count
http_requests_total

# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])

# Model inferences
model_inference_requests_total

# Tokens used
increase(tokens_used_total[24h])

# Provider health
provider_availability
```

### Step 7: Access Grafana

**From Railway:**
1. Click on Grafana service in Railway
2. Click "Public URL" to open Grafana
3. Default login: **admin / admin** (change password immediately!)

**Alternative:**
- Use the Grafana public URL from Railway service page

### Step 8: Connect Grafana to Prometheus

1. In Grafana, go to **Configuration** (gear icon) → **Data Sources**
2. Click **Add data source**
3. Select **Prometheus**
4. Configure:
   - **Name**: Gatewayz Prometheus
   - **URL**: `http://prometheus.railway.internal:9090`
   - **Access**: Server (default)
   - **Scrape interval**: 10s
5. Click **Save & Test**
   - Should see "Datasource is working"

### Step 9: Create Your First Dashboard

#### Option A: Import Pre-built Dashboard

1. In Grafana, click **+** (plus icon) → **Import**
2. Use dashboard ID or JSON
3. Click **Load**
4. Select data source: "Gatewayz Prometheus"
5. Click **Import**

#### Option B: Create Dashboard from Scratch

1. Click **+** → **Dashboard**
2. Click **Add panel**
3. Query examples:

**Panel 1: Request Rate**
```promql
rate(http_requests_total[5m])
```
- Visualization: Graph or Stat
- Unit: requests/sec

**Panel 2: Error Rate**
```promql
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])
```
- Visualization: Gauge
- Unit: percentunit

**Panel 3: Tokens Used**
```promql
increase(tokens_used_total[24h])
```
- Visualization: Stat
- Unit: short

**Panel 4: Provider Health**
```promql
provider_availability
```
- Visualization: Stat or Table
- Thresholds: 0 (red) / 1 (green)

---

## Example Dashboards

### Dashboard: Gatewayz API Overview

This dashboard provides a comprehensive view of API performance and usage.

**Panels to create:**

1. **Request Rate (requests/sec)**
   - Query: `rate(http_requests_total[5m])`
   - Type: Graph
   - Unit: ops/s

2. **Error Rate (%)**
   - Query: `rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100`
   - Type: Gauge
   - Thresholds: 0 (green), 1 (yellow), 5 (red)

3. **P95 Response Time**
   - Query: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
   - Type: Stat
   - Unit: s

4. **Tokens Used (Last 24h)**
   - Query: `increase(tokens_used_total[24h])`
   - Type: Stat
   - Unit: short

5. **Credits Used (Last 24h)**
   - Query: `increase(credits_used_total[24h])`
   - Type: Stat
   - Unit: short

6. **Cache Hit Rate (%)**
   - Query: `cache_hits_total / (cache_hits_total + cache_misses_total) * 100`
   - Type: Gauge
   - Thresholds: 0 (red), 50 (yellow), 80 (green)

7. **Top Models by Requests**
   - Query: `topk(10, increase(model_inference_requests_total[24h]) by (model))`
   - Type: Table

8. **Provider Health Status**
   - Query: `provider_availability`
   - Type: Table

9. **Active Connections**
   - Query: `active_connections`
   - Type: Stat

10. **Rate Limited Requests**
    - Query: `increase(rate_limited_requests_total[5m])`
    - Type: Stat

---

## Troubleshooting

### Prometheus target shows "DOWN"

**Symptoms:**
- Prometheus Status → Targets shows gatewayz-api as DOWN
- Error: "connection refused" or "no such host"

**Solutions:**

1. **Verify service is running**
   ```bash
   curl http://gatewayz-api.railway.internal:8000/health
   ```

2. **Check service name**
   - In Railway, get the exact internal URL
   - Should be: `SERVICE_NAME.railway.internal:PORT`

3. **Verify metrics endpoint**
   ```bash
   curl http://gatewayz-api.railway.internal:8000/metrics
   ```

4. **Check network connectivity**
   - Prometheus and Gatewayz should be in same Railway project
   - Or explicitly allow traffic between projects

### No data in Grafana

**Symptoms:**
- Grafana dashboard shows "No data" or empty graphs
- Prometheus has data, but Grafana doesn't show it

**Solutions:**

1. **Verify data source**
   - Configuration → Data Sources
   - Click "Test" - should show success

2. **Check metric names**
   - In Prometheus, verify query returns data
   - Copy exact metric name to Grafana

3. **Wait for data**
   - Metrics need ~1-2 scrape intervals to appear
   - Default interval is 15s, so wait 30s+

4. **Check time range**
   - Ensure Grafana time range includes data
   - Try "Last 6 hours" or "Last 24 hours"

### High Prometheus disk usage

**Problem:** Prometheus storing too much data

**Solutions:**

1. **Reduce retention time**
   - Edit prometheus.yml:
   ```yaml
   command:
     - '--storage.tsdb.retention.time=7d'  # Reduce from 15d
   ```

2. **Increase scrape interval**
   - Change in prometheus.yml:
   ```yaml
   global:
     scrape_interval: 30s  # Increase from 15s
   ```

3. **Drop unnecessary metrics**
   - Use relabeling to skip some metrics

### Prometheus memory usage high

**Solutions:**

1. **Reduce metric cardinality**
   - Avoid high-cardinality labels (many unique values)
   - E.g., don't use individual user_id as label

2. **Reduce scrape frequency**
   - Increase `scrape_interval` to 30s or 1m

3. **Enable compression**
   - Prometheus should compress TSDB data

---

## Monitoring Gatewayz from External Services

### Slack Notifications

Set up Prometheus alerts to send Slack notifications:

1. **Create AlertManager service in Railway** (optional)
2. **Add alert rules to prometheus.yml**

```yaml
rule_files:
  - 'alert_rules.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager.railway.internal:9093']
```

### PagerDuty Integration

Configure Prometheus to send critical alerts to PagerDuty:

1. Set up AlertManager with PagerDuty webhook
2. Define alert rules for critical metrics

Example alert rule:
```yaml
groups:
  - name: gatewayz_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High error rate detected"
```

---

## Performance Tips

### Optimize Metric Collection

1. **Use recording rules** to pre-aggregate metrics:
```yaml
groups:
  - name: gatewayz_recording
    interval: 15s
    rules:
      - record: job:http_requests:rate5m
        expr: rate(http_requests_total[5m])
      - record: job:errors:rate5m
        expr: rate(http_requests_total{status_code=~"5.."}[5m])
```

2. **Drop unwanted metrics** using relabeling:
```yaml
scrape_configs:
  - job_name: 'gatewayz-api'
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'credits_used_total'
        action: drop  # Don't scrape high-cardinality metric
```

3. **Increase scrape interval** for less critical metrics:
```yaml
scrape_configs:
  - job_name: 'gatewayz-api'
    scrape_interval: 30s  # Lower frequency
```

---

## Next Steps

1. ✅ Deploy Grafana Stack
2. ✅ Deploy Gatewayz API
3. ✅ Configure Prometheus scraping
4. ✅ Create Grafana dashboards
5. 📊 Set up alerts for critical metrics
6. 📈 Use metrics for capacity planning
7. 🔍 Investigate issues using historical data
8. 🎯 Implement SLOs based on metrics

---

## Useful Commands

### Test metrics endpoint
```bash
curl http://gatewayz-api.railway.internal:8000/metrics
```

### Query Prometheus API
```bash
curl http://prometheus.railway.internal:9090/api/v1/query?query=http_requests_total
```

### Check Prometheus targets
```bash
curl http://prometheus.railway.internal:9090/api/v1/targets
```

---

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/grafana/)
- [Railway Documentation](https://docs.railway.app/)
- [PromQL Query Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard Variables](https://grafana.com/docs/grafana/latest/dashboards/manage-dashboards/#variables)

---

## Support

For issues:
1. Check Prometheus `/metrics` endpoint directly
2. Review Prometheus logs in Railway
3. Verify data source connection in Grafana
4. Check metric names are correct
5. Consult [Prometheus Troubleshooting](https://prometheus.io/docs/prometheus/latest/guides/troubleshooting/)
