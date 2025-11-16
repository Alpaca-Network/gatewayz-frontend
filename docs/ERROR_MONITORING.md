# Error Monitoring & Automated Bug Fixes

Complete guide to the automatic error detection and bug fix generation system.

## Overview

The error monitoring system provides:

1. **Automatic Error Detection** - Monitors Railway logs and Loki for errors
2. **Error Classification** - Categorizes errors by type and severity
3. **Intelligent Analysis** - Uses Claude API to analyze root causes
4. **Automated Fixes** - Generates code fixes and creates GitHub PRs
5. **Dashboard** - Web UI to view errors, fixes, and status

## Architecture

```
┌─────────────────────────────────┐
│     Railway Logs / Loki         │
│   (Error Event Stream)          │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   ErrorMonitor Service          │
│  • Parse & Extract Errors       │
│  • Classify by Type/Severity    │
│  • Group Similar Errors         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  BugFixGenerator Service        │
│  • Analyze with Claude API      │
│  • Generate Fixes               │
│  • Create Git Branch/Commit     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│    GitHub Integration           │
│  • Create Pull Requests         │
│  • Link to Issues               │
│  • Track Status                 │
└─────────────────────────────────┘
```

## Setup & Configuration

### 1. Environment Variables

Add to your `.env` or Railway environment:

```bash
# Required for Claude analysis
ANTHROPIC_API_KEY=sk-ant-...

# For GitHub PR creation (optional)
GITHUB_TOKEN=ghp_...

# Loki integration (optional, for log aggregation)
LOKI_ENABLED=true
LOKI_PUSH_URL=https://your-loki-instance/loki/api/v1/push

# Feature flags
ERROR_MONITORING_ENABLED=true
AUTO_FIX_ENABLED=true
```

### 2. Railway Setup

#### Install Railway CLI

```bash
# macOS
brew install railway

# Linux
curl -L https://railway.app/install.sh | bash

# Windows
iwr https://railway.app/install.ps1 -useb | iex

# Verify installation
railway --version
```

#### Connect to Your Project

```bash
railway login
railway link  # Select your project
```

### 3. Start the Error Monitor

The error monitor is automatically integrated into the FastAPI app. To verify it's running:

```bash
curl http://localhost:8000/error-monitor/health
```

## API Endpoints

### Health & Status

```bash
# Check if monitoring is enabled
curl http://localhost:8000/error-monitor/health
```

Response:
```json
{
  "status": "healthy",
  "monitoring_enabled": true,
  "error_patterns_tracked": 5
}
```

### View Errors

```bash
# Recent errors (last hour)
curl http://localhost:8000/error-monitor/errors/recent?hours=1

# Critical errors only
curl http://localhost:8000/error-monitor/errors/critical?hours=1

# Errors that can be auto-fixed
curl http://localhost:8000/error-monitor/errors/fixable?hours=1

# All tracked error patterns
curl http://localhost:8000/error-monitor/errors/patterns
```

### Error Dashboard

```bash
# Comprehensive dashboard data
curl http://localhost:8000/error-monitor/dashboard
```

Response:
```json
{
  "timestamp": "2024-11-16T10:30:00Z",
  "summary": {
    "total_patterns": 12,
    "critical_errors": 2,
    "fixable_errors": 8,
    "generated_fixes": 3,
    "patterns_by_category": {
      "timeout_error": 5,
      "rate_limit_error": 3,
      "provider_error": 2
    }
  },
  "recent_critical": [...],
  "recent_fixable": [...],
  "recent_fixes": [...]
}
```

### Generate Fixes

```bash
# Generate fix for a specific error
curl -X POST "http://localhost:8000/error-monitor/fixes/generate-for-error?error_id=timeout_error&create_pr=true"

# Generate fixes for multiple errors
curl -X POST "http://localhost:8000/error-monitor/fixes/generate-batch?error_ids=timeout_error,rate_limit_error&create_prs=true"

# View generated fixes
curl http://localhost:8000/error-monitor/fixes/generated

# Get details of a specific fix
curl http://localhost:8000/error-monitor/fixes/{fix_id}
```

### Monitoring Control

```bash
# Start continuous monitoring
curl -X POST "http://localhost:8000/error-monitor/monitor/start?interval=300"

# Trigger manual scan
curl -X POST "http://localhost:8000/error-monitor/monitor/scan?hours=1&auto_fix=true"
```

## Railway CLI Error Watch

### Basic Usage

```bash
# Monitor all services
python scripts/railway_error_watch.py

# Monitor specific service
python scripts/railway_error_watch.py --service api

# Enable auto-fix generation
python scripts/railway_error_watch.py --auto-fix

# Custom check interval
python scripts/railway_error_watch.py --interval 120

# Debug mode
python scripts/railway_error_watch.py --log-level DEBUG
```

### Full Command Reference

```bash
python scripts/railway_error_watch.py [OPTIONS]

Options:
  --service SERVICE         Specific service to monitor
  --auto-fix               Automatically generate fixes for errors
  --interval SECONDS       Check interval (default: 60)
  --log-level LEVEL        Log level: DEBUG, INFO, WARNING, ERROR
  --help                   Show help
```

### Running as Background Service

#### Linux/macOS with systemd

Create `/etc/systemd/system/railway-error-watch.service`:

```ini
[Unit]
Description=Railway Error Monitor
After=network.target

[Service]
Type=simple
User=nobody
WorkingDirectory=/root/repo
Environment="PATH=/root/.local/bin:/usr/local/bin:/usr/bin"
ExecStart=/usr/bin/python3 /root/repo/scripts/railway_error_watch.py --auto-fix
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable railway-error-watch
sudo systemctl start railway-error-watch
sudo systemctl status railway-error-watch
```

#### Using Docker

```dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

# Install Railway CLI
RUN npm install -g @railway/cli

CMD ["python", "scripts/railway_error_watch.py", "--auto-fix"]
```

## Error Categories

The system automatically classifies errors:

| Category | Examples | Fixable |
|----------|----------|---------|
| `provider_error` | OpenRouter, Portkey API failures | ✓ Retry logic |
| `database_error` | Supabase connection issues | ✓ Connection pooling |
| `rate_limit_error` | 429 responses | ✓ Backoff & queuing |
| `timeout_error` | Request timeouts | ✓ Timeout tuning |
| `auth_error` | Invalid API keys | ✓ Key rotation |
| `validation_error` | Input validation failures | - |
| `cache_error` | Redis/cache failures | ✓ Fallback mechanism |
| `external_service_error` | Stripe, Resend issues | ✓ Retry with fallback |
| `internal_error` | Application logic errors | - |

## Error Severity Levels

- **CRITICAL** - Immediate action needed, service degradation
- **HIGH** - Significant impact, requires attention
- **MEDIUM** - Notable issue, should be addressed
- **LOW** - Minor issue, informational
- **INFO** - Informational only

## Auto-Fix Workflow

When an error is detected and is marked as fixable:

1. **Error Detection** - Found in logs/Loki
2. **Classification** - Categorized and analyzed
3. **Root Cause Analysis** - Claude analyzes the error
4. **Fix Generation** - Claude generates a fix with code changes
5. **Git Operations** - Creates branch `auto-fix/{category}/{id}`
6. **Code Application** - Applies changes to affected files
7. **Commit** - Creates detailed commit with analysis
8. **PR Creation** - Opens GitHub PR for review
9. **Status Tracking** - Monitors PR until merge

## Monitoring Examples

### Example 1: Rate Limit Error Response

```json
{
  "timestamp": "2024-11-16T10:25:00Z",
  "error_type": "HTTPException",
  "message": "Rate limit exceeded: 429 Too Many Requests",
  "category": "rate_limit_error",
  "severity": "medium",
  "file": "src/services/openrouter_client.py",
  "line": 245,
  "function": "call_openrouter",
  "count": 15,
  "fixable": true,
  "suggested_fix": "Implement exponential backoff and request queuing"
}
```

### Example 2: Database Connection Error

```json
{
  "timestamp": "2024-11-16T10:20:00Z",
  "error_type": "ConnectionPoolError",
  "message": "Connection pool exhausted for Supabase",
  "category": "database_error",
  "severity": "critical",
  "file": "src/config/supabase_config.py",
  "line": 89,
  "function": "get_connection",
  "count": 8,
  "fixable": true,
  "suggested_fix": "Increase connection pool size or add connection pooling fallback"
}
```

## Dashboard Integration

The error monitor provides real-time status via:

1. **API Endpoints** - JSON data for integration with monitoring tools
2. **Structured Logs** - All events logged with trace IDs for Grafana Loki
3. **Prometheus Metrics** - Track error rates and fix success rates
4. **GitHub Status** - PR links and fix deployment status

## Troubleshooting

### Railway CLI not found

```bash
# Install globally
npm install -g @railway/cli

# Or use with npx
npx @railway/cli logs
```

### No errors detected

1. Check Railway logs are actually flowing:
   ```bash
   railway logs --tail 100
   ```

2. Verify Loki is enabled:
   ```bash
   curl http://localhost:8000/error-monitor/health
   ```

3. Check error filter patterns in `ErrorMonitor.classify_error()`

### Claude API errors

```bash
# Verify API key
echo $ANTHROPIC_API_KEY

# Check API key validity
curl https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY"
```

### GitHub PR creation fails

1. Verify GitHub token has repo access:
   ```bash
   gh auth login  # and authorize if needed
   ```

2. Check token permissions (must include `repo` scope)

3. Verify git is configured:
   ```bash
   git config --global user.email "you@example.com"
   git config --global user.name "Your Name"
   ```

## Best Practices

1. **Review Auto-Generated PRs** - Always review before merging
2. **Monitor Success Rates** - Track which error types have successful fixes
3. **Tune Detection Rules** - Adjust error classification as needed
4. **Keep Dependencies Updated** - Especially Claude API client
5. **Set Appropriate Intervals** - Balance timely detection with resource usage
6. **Test in Staging** - Run with auto-fix disabled initially
7. **Monitor Rate Limits** - Claude API has rate limits; add monitoring
8. **Archive Old Errors** - Clean up old patterns periodically

## Performance Considerations

- **Loki Queries**: Optimized for last 1-24 hours of logs
- **Error Grouping**: Similar errors grouped to reduce noise
- **Async Processing**: All API calls are non-blocking
- **Batch Operations**: Multiple fixes processed in parallel
- **Cache**: Error patterns cached to avoid reprocessing

## Security

1. **API Keys** - Keep `ANTHROPIC_API_KEY` and `GITHUB_TOKEN` secret
2. **Log Data** - Ensure logs don't contain sensitive information
3. **PR Reviews** - Always review auto-generated fixes before merging
4. **Rate Limiting** - Implement rate limiting on error monitoring endpoints
5. **Audit Trail** - All fixes tracked with timestamps and IDs

## Future Enhancements

- [ ] Machine learning-based error prediction
- [ ] Slack/Discord notifications for critical errors
- [ ] Error trend analysis and forecasting
- [ ] Integration with incident management (PagerDuty, Opsgenie)
- [ ] Custom error classification rules
- [ ] A/B testing fix effectiveness
- [ ] Multi-model fix comparison
- [ ] Automatic rollback on fix failures

## Support & Debugging

For issues or debugging:

1. Check logs:
   ```bash
   tail -f /var/log/railway-error-watch.log
   ```

2. Enable debug mode:
   ```bash
   python scripts/railway_error_watch.py --log-level DEBUG
   ```

3. Check API health:
   ```bash
   curl http://localhost:8000/error-monitor/health
   ```

4. View recent errors:
   ```bash
   curl http://localhost:8000/error-monitor/dashboard | jq .
   ```

---

**Last Updated**: 2024-11-16
**Version**: 1.0.0
