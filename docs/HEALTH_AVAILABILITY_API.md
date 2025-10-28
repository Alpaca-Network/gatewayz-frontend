# Health & Availability API Documentation

## Overview

The Health & Availability API provides comprehensive monitoring of model availability, performance, and health status across all providers and gateways. This system includes:

- **Health Monitoring**: Real-time health checks and metrics
- **Availability Management**: Circuit breakers and fallback mechanisms
- **Uptime Tracking**: Status page integration and monitoring
- **Performance Metrics**: Response times and success rates

## Base URL

```
https://api.gatewayz.ai
```

## Authentication

All endpoints require API key authentication:

```bash
Authorization: Bearer YOUR_API_KEY
```

## Health Monitoring Endpoints

### System Health

#### `GET /health/system`

Get overall system health metrics.

**Response:**
```json
{
  "overall_status": "healthy",
  "total_providers": 8,
  "healthy_providers": 7,
  "degraded_providers": 1,
  "unhealthy_providers": 0,
  "total_models": 1250,
  "healthy_models": 1180,
  "degraded_models": 60,
  "unhealthy_models": 10,
  "system_uptime": 94.4,
  "last_updated": "2024-01-15T10:30:00Z"
}
```

#### `GET /health/providers`

Get health metrics for all providers.

**Query Parameters:**
- `gateway` (optional): Filter by specific gateway

**Response:**
```json
[
  {
    "provider": "openai",
    "gateway": "openrouter",
    "status": "online",
    "total_models": 45,
    "healthy_models": 42,
    "degraded_models": 2,
    "unhealthy_models": 1,
    "avg_response_time_ms": 2500.5,
    "overall_uptime": 93.3,
    "last_checked": "2024-01-15T10:30:00Z"
  }
]
```

#### `GET /health/models`

Get health metrics for all models.

**Query Parameters:**
- `gateway` (optional): Filter by specific gateway
- `provider` (optional): Filter by specific provider
- `status` (optional): Filter by health status

**Response:**
```json
[
  {
    "model_id": "gpt-4",
    "provider": "openai",
    "gateway": "openrouter",
    "status": "healthy",
    "response_time_ms": 2100.5,
    "success_rate": 98.5,
    "last_checked": "2024-01-15T10:30:00Z",
    "last_success": "2024-01-15T10:29:45Z",
    "last_failure": "2024-01-15T09:15:30Z",
    "error_count": 15,
    "total_requests": 1000,
    "avg_response_time_ms": 2050.2,
    "uptime_percentage": 98.5,
    "error_message": null
  }
]
```

#### `GET /health/model/{model_id}`

Get health metrics for a specific model.

**Query Parameters:**
- `gateway` (optional): Specific gateway to check

**Response:**
```json
{
  "model_id": "gpt-4",
  "provider": "openai",
  "gateway": "openrouter",
  "status": "healthy",
  "response_time_ms": 2100.5,
  "success_rate": 98.5,
  "last_checked": "2024-01-15T10:30:00Z",
  "last_success": "2024-01-15T10:29:45Z",
  "last_failure": "2024-01-15T09:15:30Z",
  "error_count": 15,
  "total_requests": 1000,
  "avg_response_time_ms": 2050.2,
  "uptime_percentage": 98.5,
  "error_message": null
}
```

#### `GET /health/summary`

Get comprehensive health summary.

**Response:**
```json
{
  "system": {
    "overall_status": "healthy",
    "total_providers": 8,
    "healthy_providers": 7,
    "degraded_providers": 1,
    "unhealthy_providers": 0,
    "total_models": 1250,
    "healthy_models": 1180,
    "degraded_models": 60,
    "unhealthy_models": 10,
    "system_uptime": 94.4,
    "last_updated": "2024-01-15T10:30:00Z"
  },
  "providers": [...],
  "models": [...],
  "monitoring_active": true,
  "last_check": "2024-01-15T10:30:00Z"
}
```

#### `GET /health/uptime`

Get uptime metrics for frontend integration.

**Response:**
```json
{
  "status": "operational",
  "uptime_percentage": 99.9,
  "response_time_avg": 2500.5,
  "last_incident": null,
  "total_requests": 50000,
  "successful_requests": 49950,
  "failed_requests": 50,
  "error_rate": 0.1,
  "last_updated": "2024-01-15T10:30:00Z"
}
```

#### `GET /health/dashboard`

Get complete health dashboard data for frontend.

**Response:**
```json
{
  "system_status": {
    "overall_status": "healthy",
    "total_providers": 8,
    "healthy_providers": 7,
    "degraded_providers": 1,
    "unhealthy_providers": 0,
    "total_models": 1250,
    "healthy_models": 1180,
    "degraded_models": 60,
    "unhealthy_models": 10,
    "system_uptime": 94.4,
    "last_updated": "2024-01-15T10:30:00Z"
  },
  "providers": [
    {
      "provider": "openai",
      "gateway": "openrouter",
      "status": "Online",
      "status_color": "green",
      "models_count": 45,
      "healthy_count": 42,
      "uptime": "93.3%",
      "avg_response_time": "2.5s"
    }
  ],
  "models": [
    {
      "model_id": "gpt-4",
      "name": "gpt-4",
      "provider": "openai",
      "status": "Healthy",
      "status_color": "green",
      "response_time": "2.1s",
      "uptime": "98.5%",
      "last_checked": "10:30:00"
    }
  ],
  "uptime_metrics": {
    "status": "operational",
    "uptime_percentage": 99.9,
    "response_time_avg": 2500.5,
    "last_incident": null,
    "total_requests": 50000,
    "successful_requests": 49950,
    "failed_requests": 50,
    "error_rate": 0.1,
    "last_updated": "2024-01-15T10:30:00Z"
  },
  "last_updated": "2024-01-15T10:30:00Z",
  "monitoring_active": true
}
```

### Gateway Health Monitoring

#### `GET /health/gateways`

Get health metrics for all gateways.

**Response:**
```json
[
  {
    "gateway": "openrouter",
    "status": "online",
    "total_models": 500,
    "healthy_models": 480,
    "degraded_models": 15,
    "unhealthy_models": 5,
    "avg_response_time_ms": 2500.5,
    "overall_uptime": 96.0,
    "last_checked": "2024-01-15T10:30:00Z",
    "endpoint_url": "https://openrouter.ai/api/v1",
    "api_key_configured": true,
    "rate_limit_remaining": 1000,
    "rate_limit_reset": "2024-01-15T11:00:00Z"
  },
  {
    "gateway": "portkey",
    "status": "degraded",
    "total_models": 300,
    "healthy_models": 280,
    "degraded_models": 15,
    "unhealthy_models": 5,
    "avg_response_time_ms": 3500.2,
    "overall_uptime": 93.3,
    "last_checked": "2024-01-15T10:30:00Z",
    "endpoint_url": "https://api.portkey.ai/v1",
    "api_key_configured": true,
    "rate_limit_remaining": 500,
    "rate_limit_reset": "2024-01-15T10:45:00Z"
  }
]
```

#### `GET /health/gateway/{gateway}`

Get health metrics for a specific gateway.

**Path Parameters:**
- `gateway`: Gateway name (e.g., openrouter, portkey, featherless, deepinfra, huggingface, groq, fireworks, together, xai, novita, chutes, aimo, near)

**Response:**
```json
{
  "gateway": "openrouter",
  "status": "online",
  "total_models": 500,
  "healthy_models": 480,
  "degraded_models": 15,
  "unhealthy_models": 5,
  "avg_response_time_ms": 2500.5,
  "overall_uptime": 96.0,
  "last_checked": "2024-01-15T10:30:00Z",
  "endpoint_url": "https://openrouter.ai/api/v1",
  "api_key_configured": true,
  "rate_limit_remaining": 1000,
  "rate_limit_reset": "2024-01-15T11:00:00Z",
  "providers": [
    {
      "provider": "openai",
      "models_count": 45,
      "healthy_count": 42,
      "avg_response_time_ms": 2100.5,
      "uptime": 93.3
    },
    {
      "provider": "anthropic",
      "models_count": 25,
      "healthy_count": 24,
      "avg_response_time_ms": 2800.2,
      "uptime": 96.0
    }
  ],
  "recent_errors": [
    {
      "timestamp": "2024-01-15T10:25:00Z",
      "error": "Rate limit exceeded",
      "model_id": "gpt-4",
      "status_code": 429
    }
  ],
  "performance_trends": {
    "response_time_1h": 2500.5,
    "response_time_24h": 2400.2,
    "uptime_1h": 96.0,
    "uptime_24h": 95.8
  }
}
```

#### `GET /health/gateway/{gateway}/models`

Get health metrics for all models in a specific gateway.

**Path Parameters:**
- `gateway`: Gateway name

**Query Parameters:**
- `provider` (optional): Filter by specific provider
- `status` (optional): Filter by health status
- `limit` (optional): Limit number of results (default: 100)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
{
  "gateway": "openrouter",
  "total_models": 500,
  "models": [
    {
      "model_id": "gpt-4",
      "provider": "openai",
      "status": "healthy",
      "response_time_ms": 2100.5,
      "success_rate": 98.5,
      "last_checked": "2024-01-15T10:30:00Z",
      "uptime_percentage": 98.5,
      "error_count": 15,
      "total_requests": 1000
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 500,
    "has_more": true
  }
}
```

#### `GET /health/gateway/{gateway}/status`

Get simple status check for a specific gateway.

**Path Parameters:**
- `gateway`: Gateway name

**Response:**
```json
{
  "gateway": "openrouter",
  "status": "online",
  "uptime": 96.0,
  "response_time_avg": 2500.5,
  "models_healthy": 480,
  "models_total": 500,
  "last_checked": "2024-01-15T10:30:00Z",
  "api_key_configured": true,
  "rate_limit_ok": true
}
```

#### `POST /health/gateway/{gateway}/test`

Test connectivity to a specific gateway.

**Path Parameters:**
- `gateway`: Gateway name

**Response:**
```json
{
  "gateway": "openrouter",
  "test_result": "success",
  "response_time_ms": 1200.5,
  "status_code": 200,
  "timestamp": "2024-01-15T10:30:00Z",
  "error_message": null,
  "api_key_valid": true,
  "rate_limit_ok": true
}
```

#### `GET /health/gateways/summary`

Get summary of all gateway health metrics.

**Response:**
```json
{
  "total_gateways": 13,
  "online_gateways": 11,
  "degraded_gateways": 2,
  "offline_gateways": 0,
  "overall_uptime": 95.2,
  "avg_response_time": 2800.5,
  "gateways": [
    {
      "gateway": "openrouter",
      "status": "online",
      "uptime": 96.0,
      "models_count": 500,
      "healthy_models": 480
    },
    {
      "gateway": "portkey",
      "status": "degraded",
      "uptime": 93.3,
      "models_count": 300,
      "healthy_models": 280
    }
  ],
  "last_updated": "2024-01-15T10:30:00Z"
}
```

## Availability Endpoints

### Model Availability

#### `GET /availability/models`

Get available models with enhanced reliability features.

**Query Parameters:**
- `gateway` (optional): Filter by specific gateway
- `provider` (optional): Filter by specific provider
- `status` (optional): Filter by availability status

**Response:**
```json
[
  {
    "model_id": "gpt-4",
    "provider": "openai",
    "gateway": "openrouter",
    "status": "available",
    "last_checked": "2024-01-15T10:30:00Z",
    "success_rate": 98.5,
    "response_time_ms": 2100.5,
    "error_count": 15,
    "circuit_breaker_state": "closed",
    "fallback_models": ["gpt-4-turbo", "gpt-3.5-turbo", "claude-3-opus"],
    "maintenance_until": null,
    "error_message": null
  }
]
```

#### `GET /availability/model/{model_id}`

Get availability status for a specific model.

**Query Parameters:**
- `gateway` (optional): Specific gateway to check

**Response:**
```json
{
  "model_id": "gpt-4",
  "provider": "openai",
  "gateway": "openrouter",
  "status": "available",
  "last_checked": "2024-01-15T10:30:00Z",
  "success_rate": 98.5,
  "response_time_ms": 2100.5,
  "error_count": 15,
  "circuit_breaker_state": "closed",
  "fallback_models": ["gpt-4-turbo", "gpt-3.5-turbo", "claude-3-opus"],
  "maintenance_until": null,
  "error_message": null
}
```

#### `GET /availability/check/{model_id}`

Quick availability check for a model.

**Query Parameters:**
- `gateway` (optional): Specific gateway to check

**Response:**
```json
{
  "model_id": "gpt-4",
  "available": true,
  "status": "available",
  "circuit_breaker_state": "closed",
  "success_rate": 98.5,
  "response_time_ms": 2100.5,
  "last_checked": "2024-01-15T10:30:00Z",
  "fallback_models": ["gpt-4-turbo", "gpt-3.5-turbo", "claude-3-opus"],
  "maintenance_until": null
}
```

#### `GET /availability/fallback/{model_id}`

Get fallback models for a given model.

**Query Parameters:**
- `gateway` (optional): Specific gateway to check

**Response:**
```json
{
  "primary_model": "gpt-4",
  "fallback_models": [
    {
      "model_id": "gpt-4-turbo",
      "available": true,
      "status": "available"
    },
    {
      "model_id": "gpt-3.5-turbo",
      "available": true,
      "status": "available"
    },
    {
      "model_id": "claude-3-opus",
      "available": false,
      "status": "unavailable"
    }
  ],
  "best_available": "gpt-4-turbo"
}
```

#### `GET /availability/best/{model_id}`

Get the best available model with fallbacks.

**Query Parameters:**
- `gateway` (optional): Specific gateway to check

**Response:**
```json
{
  "primary_model": "gpt-4",
  "best_available": "gpt-4",
  "is_primary": true,
  "availability": "available",
  "success_rate": 98.5,
  "response_time_ms": 2100.5
}
```

#### `GET /availability/summary`

Get availability summary across all models.

**Response:**
```json
{
  "total_models": 1250,
  "available_models": 1180,
  "degraded_models": 60,
  "unavailable_models": 10,
  "availability_percentage": 94.4,
  "gateway_stats": {
    "openrouter": {
      "total": 500,
      "available": 480,
      "degraded": 15,
      "unavailable": 5
    },
    "portkey": {
      "total": 300,
      "available": 285,
      "degraded": 10,
      "unavailable": 5
    }
  },
  "monitoring_active": true,
  "last_updated": "2024-01-15T10:30:00Z"
}
```

## Admin Endpoints

### Health Monitoring Control

#### `POST /health/monitoring/start`

Start health monitoring service.

**Response:**
```json
{
  "message": "Health monitoring started",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `POST /health/monitoring/stop`

Stop health monitoring service.

**Response:**
```json
{
  "message": "Health monitoring stopped",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Availability Management

#### `POST /availability/maintenance/{model_id}`

Set maintenance mode for a model.

**Request Body:**
```json
{
  "gateway": "openrouter",
  "until": "2024-01-15T12:00:00Z"
}
```

**Response:**
```json
{
  "message": "Model gpt-4 set to maintenance mode until 2024-01-15T12:00:00Z",
  "model_id": "gpt-4",
  "gateway": "openrouter",
  "maintenance_until": "2024-01-15T12:00:00Z"
}
```

#### `DELETE /availability/maintenance/{model_id}`

Clear maintenance mode for a model.

**Query Parameters:**
- `gateway`: Gateway name

**Response:**
```json
{
  "message": "Maintenance mode cleared for model gpt-4",
  "model_id": "gpt-4",
  "gateway": "openrouter"
}
```

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 404 | Model/Provider not found |
| 500 | Internal server error |
| 503 | Service unavailable |

## Error Responses

```json
{
  "detail": "Model gpt-4 not found or no health data available"
}
```

## Frontend Integration

### Status Page Integration

Use the `/health/uptime` endpoint for status page integration:

```javascript
// Fetch uptime metrics
const response = await fetch('/health/uptime', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const data = await response.json();

// Display status
document.getElementById('status').textContent = data.status;
document.getElementById('uptime').textContent = `${data.uptime_percentage}%`;
```

### Dashboard Integration

Use the `/health/dashboard` endpoint for comprehensive dashboard data:

```javascript
// Fetch dashboard data
const response = await fetch('/health/dashboard', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const data = await response.json();

// Render providers
data.providers.forEach(provider => {
  const element = document.createElement('div');
  element.className = `provider ${provider.status_color}`;
  element.innerHTML = `
    <h3>${provider.provider}</h3>
    <span class="status">${provider.status}</span>
    <span class="uptime">${provider.uptime}</span>
  `;
  document.getElementById('providers').appendChild(element);
});
```

### Gateway Health Monitoring

Use gateway-specific endpoints for detailed gateway monitoring:

```javascript
// Fetch all gateway health
const response = await fetch('/health/gateways', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const gateways = await response.json();

// Render gateway status
gateways.forEach(gateway => {
  const element = document.createElement('div');
  element.className = `gateway ${gateway.status}`;
  element.innerHTML = `
    <h3>${gateway.gateway}</h3>
    <span class="status">${gateway.status}</span>
    <span class="uptime">${gateway.overall_uptime}%</span>
    <span class="models">${gateway.healthy_models}/${gateway.total_models} models</span>
  `;
  document.getElementById('gateways').appendChild(element);
});
```

### Gateway-Specific Model Monitoring

Monitor models within a specific gateway:

```javascript
// Fetch models for a specific gateway
const response = await fetch('/health/gateway/openrouter/models?limit=50', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const data = await response.json();

// Render models
data.models.forEach(model => {
  const element = document.createElement('div');
  element.className = `model ${model.status}`;
  element.innerHTML = `
    <h4>${model.model_id}</h4>
    <span class="provider">${model.provider}</span>
    <span class="status">${model.status}</span>
    <span class="response-time">${model.response_time_ms}ms</span>
    <span class="uptime">${model.uptime_percentage}%</span>
  `;
  document.getElementById('models').appendChild(element);
});
```

### Gateway Connectivity Testing

Test gateway connectivity in real-time:

```javascript
// Test gateway connectivity
async function testGateway(gatewayName) {
  const response = await fetch(`/health/gateway/${gatewayName}/test`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  });
  const result = await response.json();
  
  if (result.test_result === 'success') {
    console.log(`${gatewayName} is healthy: ${result.response_time_ms}ms`);
  } else {
    console.error(`${gatewayName} test failed: ${result.error_message}`);
  }
}

// Test multiple gateways
['openrouter', 'portkey', 'featherless'].forEach(testGateway);
```

### Model Selection with Fallbacks

Use the availability endpoints for intelligent model selection:

```javascript
// Get best available model
const response = await fetch('/availability/best/gpt-4', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const data = await response.json();

// Use the best available model
const modelToUse = data.best_available;
```

## Monitoring and Alerts

### Health Check Endpoints

- `/health/status` - Simple health check
- `/health/gateways/summary` - Gateway health summary
- `/health/gateway/{gateway}/status` - Specific gateway status
- `/availability/status` - Simple availability check

### Metrics to Monitor

- System uptime percentage
- Model availability rates
- Response time averages
- Error rates by provider
- Circuit breaker states
- Gateway-specific metrics
- API key validity
- Rate limit status

### Recommended Alerting

- System uptime < 95%
- Model availability < 90%
- Response time > 10 seconds
- Error rate > 5%
- Circuit breaker open for > 5 minutes
- Gateway uptime < 90%
- API key invalid or expired
- Rate limit exceeded
- Gateway connectivity failures

## Best Practices

1. **Use Fallbacks**: Always check for fallback models when primary is unavailable
2. **Monitor Circuit Breakers**: Track circuit breaker states for early warning
3. **Cache Results**: Cache availability data to reduce API calls
4. **Handle Maintenance**: Check maintenance status before using models
5. **Monitor Trends**: Track availability trends over time
6. **Set Alerts**: Configure alerts for critical thresholds
7. **Test Fallbacks**: Regularly test fallback model functionality
8. **Monitor Gateways**: Track gateway health and connectivity separately
9. **API Key Management**: Monitor API key validity and rate limits
10. **Gateway Failover**: Implement automatic gateway switching on failures
11. **Performance Tracking**: Monitor response times per gateway
12. **Error Analysis**: Track and analyze gateway-specific errors
