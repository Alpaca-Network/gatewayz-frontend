# Error Monitoring Quick Start Guide

Get the automated error detection and bug fixing system running in 5 minutes.

## 🚀 Quick Setup

### 1. Validate Your Setup (1 minute)

```bash
python scripts/setup_error_monitoring.py
```

This checks:
- Python 3.10+
- Dependencies
- Railway CLI
- Git configuration
- Required API keys
- Module imports

### 2. Set Environment Variables (1 minute)

```bash
# Required: Claude API for fix generation
export ANTHROPIC_API_KEY=sk-ant-...

# Required: GitHub token for PR creation
export GITHUB_TOKEN=ghp_...

# Optional: Loki for log aggregation
export LOKI_ENABLED=true
export LOKI_PUSH_URL=https://your-loki/loki/api/v1/push
```

### 3. Start the Application (1 minute)

```bash
cd /root/repo
python src/main.py
```

### 4. Verify It's Working (1 minute)

```bash
# Check health
curl http://localhost:8000/error-monitor/health

# View dashboard
curl http://localhost:8000/error-monitor/dashboard | jq .

# View recent errors
curl http://localhost:8000/error-monitor/errors/recent | jq .
```

### 5. Start Railway Error Monitor (1 minute)

```bash
# First, install Railway CLI if needed
npm install -g @railway/cli

# Login to Railway
railway login

# Start monitoring with auto-fix
python scripts/railway_error_watch.py --auto-fix --interval 60
```

## 📊 Monitor Errors

### Check Dashboard

```bash
# Full dashboard with all metrics
curl http://localhost:8000/error-monitor/dashboard | jq .

# Output:
# {
#   "summary": {
#     "total_patterns": 12,
#     "critical_errors": 2,
#     "fixable_errors": 8,
#     "generated_fixes": 3
#   },
#   "recent_critical": [...],
#   "recent_fixable": [...]
# }
```

### View Specific Errors

```bash
# Critical errors
curl http://localhost:8000/error-monitor/errors/critical?hours=1

# Errors that can be auto-fixed
curl http://localhost:8000/error-monitor/errors/fixable?hours=1

# All patterns
curl http://localhost:8000/error-monitor/errors/patterns
```

## 🔧 Generate Fixes

### Auto-Generate Fix for an Error

```bash
# Generate fix and create PR
curl -X POST "http://localhost:8000/error-monitor/fixes/generate-for-error?error_id=timeout_error&create_pr=true"

# Output:
# {
#   "status": "success",
#   "fix": {
#     "id": "550e8400-e29b-41d4-a716-446655440000",
#     "pr_url": "https://github.com/terragon-labs/gatewayz/pull/123",
#     "status": "testing",
#     ...
#   }
# }
```

### Generate Fixes in Batch

```bash
# Multiple errors at once
curl -X POST "http://localhost:8000/error-monitor/fixes/generate-batch?error_ids=timeout_error,rate_limit_error&create_prs=true"
```

### View Generated Fixes

```bash
# All fixes
curl http://localhost:8000/error-monitor/fixes/generated

# Specific fix
curl http://localhost:8000/error-monitor/fixes/{fix_id}
```

## 📈 Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/error-monitor/health` | GET | Check if monitoring is enabled |
| `/error-monitor/dashboard` | GET | Full dashboard with metrics |
| `/error-monitor/errors/recent` | GET | Recent errors |
| `/error-monitor/errors/critical` | GET | Critical errors only |
| `/error-monitor/errors/fixable` | GET | Errors that can be fixed |
| `/error-monitor/errors/patterns` | GET | All tracked patterns |
| `/error-monitor/fixes/generate-for-error` | POST | Generate fix for one error |
| `/error-monitor/fixes/generate-batch` | POST | Generate fixes for multiple errors |
| `/error-monitor/fixes/generated` | GET | All generated fixes |
| `/error-monitor/fixes/{id}` | GET | Specific fix details |
| `/error-monitor/monitor/start` | POST | Start continuous monitoring |
| `/error-monitor/monitor/scan` | POST | Manual scan for errors |

## 🚨 Understanding Error Severity

- **🔴 CRITICAL** - Immediate attention needed
  - Database connection pool exhausted
  - Service unavailable

- **🟠 HIGH** - Significant impact
  - Provider API failures (OpenRouter, etc.)
  - Authentication failures

- **🟡 MEDIUM** - Notable issue
  - Rate limiting
  - Timeouts
  - Cache failures

- **🟢 LOW** - Minor issue
  - Validation errors
  - Deprecated API calls

## 🤖 Auto-Fix Examples

### Example 1: Rate Limit Error

**Error Detected:**
```
Rate limit exceeded: 429 Too Many Requests from OpenRouter
```

**Auto-Fix Generated:**
```python
# Added exponential backoff and request queuing
import asyncio
from tenacity import retry, wait_exponential

@retry(wait=wait_exponential(multiplier=1, min=1, max=10))
async def call_provider(self, ...):
    # Add request to queue if rate limit hit
    if self.request_queue.qsize() > threshold:
        await asyncio.sleep(1)  # Backoff
    return await self._request()
```

### Example 2: Connection Pool Error

**Error Detected:**
```
Connection pool exhausted for Supabase
```

**Auto-Fix Generated:**
```python
# Increased pool size and added fallback
SUPABASE_POOL_SIZE=20  # Increased from 10
SUPABASE_POOL_TIMEOUT=30  # Increased from 10

# Added fallback mechanism
if connection_pool.available() == 0:
    logger.warning("Using fallback direct connection")
    return await direct_connection.query()
```

## 🔍 Railway CLI Examples

### Monitor Specific Service

```bash
python scripts/railway_error_watch.py --service api
```

### Enable Auto-Fix

```bash
python scripts/railway_error_watch.py --auto-fix
```

### Custom Interval (Check every 2 minutes)

```bash
python scripts/railway_error_watch.py --interval 120
```

### Debug Mode

```bash
python scripts/railway_error_watch.py --log-level DEBUG
```

## 📋 Typical Workflow

1. **Error Occurs** in production
   ```
   2024-11-16 10:25:00 ERROR: Rate limit exceeded (429)
   ```

2. **System Detects** and classifies
   ```json
   {
     "category": "rate_limit_error",
     "severity": "medium",
     "fixable": true
   }
   ```

3. **Claude Analyzes** root cause
   ```
   Root Cause: OpenRouter API rate limit reached due to high request volume
   Suggestion: Implement backoff and queue mechanism
   ```

4. **Fix Generated** and tested
   ```
   Branch: auto-fix/rate_limit_error/a1b2c3d4
   Files: src/services/openrouter_client.py, src/utils/request_queue.py
   ```

5. **PR Created** for review
   ```
   PR: #456 - [AUTO] Fix rate_limit_error: Rate limit exceeded
   ```

6. **Team Reviews** and merges
   ```
   ✅ Merged to main
   ```

7. **Deployment** and verification
   ```
   Rate limit errors reduced by 95%
   ```

## ⚠️ Important Notes

1. **Always Review PRs** - Auto-generated fixes are suggestions, review before merging
2. **Test in Staging** - Test fixes in staging environment first
3. **Monitor Success Rates** - Track which errors are actually fixed
4. **Keep Keys Secure** - Never commit API keys, use environment variables
5. **Rate Limits** - Claude API has rate limits, be aware when auto-fixing many errors

## 🛠️ Troubleshooting

### Error Monitor Not Responding

```bash
# Check if service is running
curl http://localhost:8000/error-monitor/health

# View logs
tail -f /var/log/gatewayz.log | grep error-monitor
```

### Railway CLI Not Found

```bash
# Install or update
npm install -g @railway/cli@latest

# Verify
railway --version
```

### No Errors Detected

```bash
# Check if errors are actually occurring
railway logs --tail 50

# Verify Loki integration
echo $LOKI_PUSH_URL
```

### Claude API Errors

```bash
# Verify API key
curl https://api.anthropic.com/v1/models \
  -H "x-api-key: $ANTHROPIC_API_KEY"

# Check rate limits in response headers
curl -i https://api.anthropic.com/v1/models \
  -H "x-api-key: $ANTHROPIC_API_KEY"
```

## 📚 More Information

- **Full Guide**: See `docs/ERROR_MONITORING.md`
- **Configuration**: See `src/config/config.py`
- **Error Types**: See `src/services/error_monitor.py`
- **Fix Generation**: See `src/services/bug_fix_generator.py`

## 🎯 Next Steps

1. ✅ Run validation script
2. ✅ Set environment variables
3. ✅ Start application and Railway monitor
4. ✅ Monitor errors in dashboard
5. ✅ Review auto-generated PRs
6. ✅ Merge fixes to production
7. ✅ Monitor fix effectiveness

---

**Need help?** Check the troubleshooting section or see `docs/ERROR_MONITORING.md` for detailed documentation.
