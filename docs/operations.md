# Operations

## Health Monitoring

### Health Check Endpoint
**GET** `/health`
- **Purpose**: System health and dependency status
- **Response**: Database connectivity, OpenRouter status, user count, timestamp
- **Use Cases**: Uptime monitoring, load balancer health checks, alerting

Example response:
```json
{
  "status": "healthy",
  "database": "connected",
  "openrouter": "connected",
  "user_count": 42,
  "timestamp": "2025-09-01T12:00:00.000000"
}
```

### Monitoring Integration
- **Uptime Monitoring**: Use for external monitoring services
- **Load Balancer**: Health check endpoint for load balancers
- **Alerting**: Set up alerts for unhealthy status
- **Dashboard**: Display system status in monitoring dashboards

## Logging and Monitoring

### Application Logs
The application provides comprehensive logging at multiple levels:

#### Log Levels
- **ERROR**: Critical errors and exceptions
- **WARNING**: Non-critical issues and warnings
- **INFO**: General information and status updates
- **DEBUG**: Detailed debugging information

#### Log Sources
- **Application Logs**: FastAPI application logs
- **Database Logs**: Supabase connection and query logs
- **External API Logs**: OpenRouter API call logs
- **Security Logs**: Authentication and authorization events

### Platform-Specific Logging

#### Vercel
- **Dashboard**: Access logs via Vercel dashboard
- **CLI**: `vercel logs` command for real-time logs
- **Alerts**: Configure alerts for error rates and response times
- **Metrics**: Built-in performance and usage metrics

#### Railway
- **CLI**: `railway logs` for real-time log streaming
- **Dashboard**: Web-based log viewer
- **Alerts**: Configure alerts for deployment failures
- **Metrics**: Resource usage and performance metrics

#### Heroku
- **CLI**: `heroku logs --tail` for real-time logs
- **Dashboard**: Web-based log viewer
- **Add-ons**: Log management add-ons available
- **Metrics**: Dyno performance and usage metrics

#### DigitalOcean App Platform
- **Dashboard**: Built-in log viewer
- **CLI**: DigitalOcean CLI for log access
- **Alerts**: Configure alerts for app health
- **Metrics**: Resource usage and performance metrics

## Usage and Rate Limiting

### User Monitoring
**GET** `/user/monitor`
- **Purpose**: User-specific usage metrics and rate limits
- **Authentication**: Requires valid API key
- **Response**: Credits, usage statistics, rate limit information
- **Use Cases**: User dashboards, usage tracking, billing

**GET** `/user/balance`
- **Purpose**: Current user balance and account status
- **Authentication**: Requires valid API key
- **Response**: Masked API key, credits, user ID, status
- **Use Cases**: Balance checks, account status verification

### Admin Monitoring
**GET** `/admin/monitor`
- **Purpose**: System-wide monitoring dashboard
- **Authentication**: Admin access required
- **Response**: Comprehensive system metrics and analytics
- **Use Cases**: System administration, capacity planning, performance monitoring

### Rate Limit Management
**POST** `/admin/limit`
- **Purpose**: Configure rate limits for specific users
- **Request Body**: `SetRateLimitRequest` with rate limit configuration
- **Response**: Updated rate limit configuration
- **Use Cases**: User management, abuse prevention, capacity control

#### Rate Limit Types
- **Per-Minute Limits**: Requests and tokens per minute
- **Per-Hour Limits**: Requests and tokens per hour
- **Per-Day Limits**: Requests and tokens per day
- **Plan-Based Limits**: Subscription plan enforcement

## Model Cache Management

### Cache Operations
**POST** `/admin/refresh-models`
- **Purpose**: Force refresh of OpenRouter model cache
- **Authentication**: Admin access required
- **Response**: Cache refresh status and model count
- **Use Cases**: Model updates, cache invalidation, troubleshooting

**GET** `/admin/cache-status`
- **Purpose**: Get model cache status and statistics
- **Authentication**: Admin access required
- **Response**: Cache health, age, TTL, model count
- **Use Cases**: Cache monitoring, performance optimization

### Cache Configuration
- **TTL**: 5 minutes for OpenRouter models
- **Storage**: In-memory cache with automatic refresh
- **Fallback**: Graceful degradation when cache is unavailable
- **Monitoring**: Cache hit rates and performance metrics

## Performance Monitoring

### Key Metrics
- **Response Time**: API endpoint response times
- **Throughput**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Resource Usage**: CPU, memory, and database usage

### Monitoring Tools
- **Application Metrics**: Built-in FastAPI metrics
- **Database Metrics**: Supabase performance metrics
- **External API Metrics**: OpenRouter API performance
- **Custom Metrics**: Business-specific metrics

### Alerting
- **Error Rate Alerts**: High error rate notifications
- **Response Time Alerts**: Slow response time warnings
- **Resource Alerts**: High resource usage notifications
- **Health Check Alerts**: System health status changes

## Security Monitoring

### Audit Logging
**GET** `/user/api-keys/audit-logs`
- **Purpose**: Security event monitoring and audit trails
- **Authentication**: User access to own audit logs
- **Query Parameters**: Filter by key, action, date range, limit
- **Use Cases**: Security monitoring, compliance, incident response

### Security Events
- **API Key Creation**: New key generation events
- **API Key Rotation**: Key rotation and updates
- **Authentication Failures**: Failed login attempts
- **Rate Limit Violations**: Rate limit exceeded events
- **Suspicious Activity**: Unusual usage patterns

### Security Monitoring
- **Real-time Alerts**: Immediate notification of security events
- **Pattern Analysis**: Detection of unusual usage patterns
- **Access Monitoring**: Track API key usage and access patterns
- **Compliance Reporting**: Generate compliance reports

## Maintenance Operations

### Database Maintenance
- **Connection Pooling**: Monitor database connection health
- **Query Optimization**: Monitor slow queries and optimize
- **Index Maintenance**: Ensure proper database indexing
- **Backup Verification**: Verify database backups

### Cache Maintenance
- **Cache Warming**: Pre-populate cache with frequently used data
- **Cache Cleanup**: Remove expired or unused cache entries
- **Cache Optimization**: Optimize cache hit rates
- **Cache Monitoring**: Monitor cache performance and health

### Application Maintenance
- **Dependency Updates**: Keep dependencies current and secure
- **Security Patches**: Apply security updates promptly
- **Performance Optimization**: Optimize application performance
- **Code Deployment**: Deploy updates safely and efficiently

## Troubleshooting

### Common Issues
- **High Error Rates**: Check logs for error patterns
- **Slow Response Times**: Monitor database and external API performance
- **Cache Issues**: Verify cache configuration and refresh
- **Rate Limit Issues**: Check rate limit configuration and usage

### Diagnostic Tools
- **Health Checks**: Use health endpoint for system status
- **Log Analysis**: Analyze logs for error patterns
- **Performance Metrics**: Monitor key performance indicators
- **External Service Status**: Check OpenRouter and Supabase status

### Recovery Procedures
- **Service Restart**: Restart application services
- **Cache Refresh**: Force refresh model cache
- **Database Connection**: Reset database connections
- **External Service**: Check external service availability
