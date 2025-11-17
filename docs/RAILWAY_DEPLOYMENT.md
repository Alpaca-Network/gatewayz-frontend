# Railway Backend Deployment Guide

Complete guide for deploying the Gatewayz Universal Inference API with integrated error monitoring and auto-fix generation to Railway.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Railway Project Setup](#railway-project-setup)
3. [Environment Configuration](#environment-configuration)
4. [Deploy to Railway](#deploy-to-railway)
5. [Verify Deployment](#verify-deployment)
6. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
7. [Using Error Monitoring System](#using-error-monitoring-system)

---

## Prerequisites

### Required Tools

- **Railway CLI**: [Install Railway CLI](https://docs.railway.app/guides/cli)
  ```bash
  npm i -g @railway/cli
  railway login
  ```

- **Git**: For version control
  ```bash
  git --version
  ```

### Required API Keys

1. **Anthropic API Key** (for Claude/auto-fix generation)
   - Get from: https://console.anthropic.com/
   - Format: `sk-ant-...`

2. **GitHub Personal Access Token** (for PR creation)
   - Go to: https://github.com/settings/tokens
   - Create new token (classic)
   - Scopes: `repo`, `workflow`
   - Format: `ghp_...`

3. **Existing API Keys** (from your configuration)
   - Supabase URL and key
   - OpenRouter API key
   - Any other provider keys

---

## Railway Project Setup

### Step 1: Create Railway Project

```bash
# Navigate to your repository
cd /path/to/gatewayz-backend

# Create a new Railway project
railway init

# Follow the prompts to create a new project
# Choose a project name (e.g., "gatewayz-api")
```

### Step 2: Connect GitHub Repository

```bash
# Link your GitHub repository
railway link

# Or add it via the Railway dashboard:
# 1. Go to https://railway.app
# 2. Click "New Project" → "Deploy from GitHub repo"
# 3. Select your repository
```

### Step 3: Verify Configuration

```bash
# Check current project
railway status

# Should show:
# ✓ Project: gatewayz-api
# ✓ Environment: production
# ✓ Service: api
```

---

## Environment Configuration

### Step 1: Set Up Environment Variables via Railway CLI

```bash
# Set individual environment variables
railway variables set ANTHROPIC_API_KEY "sk-ant-..."
railway variables set GITHUB_TOKEN "ghp_..."
railway variables set LOKI_ENABLED "true"
railway variables set ERROR_MONITORING_ENABLED "true"
railway variables set AUTO_FIX_ENABLED "true"

# Existing variables (already set)
railway variables set SUPABASE_URL "https://..."
railway variables set SUPABASE_KEY "..."
railway variables set OPENROUTER_API_KEY "..."
```

### Step 2: Using Railway Dashboard

Alternatively, set via the Railway web dashboard:

1. Go to https://railway.app/dashboard
2. Select your project
3. Click "Variables" tab
4. Add/edit environment variables:

```
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
LOKI_ENABLED=true
LOKI_PUSH_URL=https://your-loki-instance/loki/api/v1/push
ERROR_MONITORING_ENABLED=true
AUTO_FIX_ENABLED=true
ERROR_MONITOR_INTERVAL=300
ERROR_MONITOR_LOOKBACK_HOURS=1
AUTO_FIX_CREATE_PRS=true
AUTO_FIX_REPO=your-org/gatewayz-backend
AUTO_FIX_BASE_BRANCH=main
RAILWAY_SERVICE=api
RAILWAY_POLL_INTERVAL=60
ERROR_FIX_MIN_SEVERITY=high
ERROR_FIX_MIN_COUNT=3
CLAUDE_MODEL=claude-opus-4-1-20250805
CLAUDE_MAX_TOKENS_ANALYSIS=1024
CLAUDE_MAX_TOKENS_FIX=2048
CLAUDE_TEMPERATURE=0.3
LOG_LEVEL=INFO
DRY_RUN=false
```

### Step 3: Verify Variables

```bash
# List all set variables
railway variables

# Check a specific variable
railway variables get ANTHROPIC_API_KEY

# Should show: sk-ant-...
```

---

## Deploy to Railway

### Option 1: Deploy from CLI (Recommended)

```bash
# Deploy from local repository
railway up

# Or deploy from GitHub (automatic on push)
git push origin main
```

### Option 2: Deploy from GitHub (Automatic)

1. Push code to GitHub
   ```bash
   git add .
   git commit -m "Deploy error monitoring system"
   git push origin main
   ```

2. Railway automatically triggers deployment

3. Monitor deployment:
   ```bash
   railway logs --follow
   ```

### Step-by-Step Deployment

```bash
# 1. Ensure you're in the correct project
railway status

# 2. Set any remaining variables
railway variables set KEY VALUE

# 3. Deploy the application
railway up

# 4. Monitor the deployment
railway logs --follow

# Expected output:
# ✓ Building...
# ✓ Starting service...
# INFO: Application started on http://0.0.0.0:8000
```

---

## Verify Deployment

### Step 1: Check Service Status

```bash
# Get your Railway deployment URL
railway domains

# Should output something like:
# https://gatewayz-api-production.railway.app

# Test the health endpoint
curl https://gatewayz-api-production.railway.app/health

# Should return:
# {"status":"ok","environment":"production"}
```

### Step 2: Verify Error Monitoring

```bash
# Check error monitor status
curl https://gatewayz-api-production.railway.app/api/error-monitor/status

# Should return:
# {
#   "enabled": true,
#   "monitoring": true,
#   "errors_detected": 0,
#   "last_scan": "2025-11-17T01:45:00Z"
# }
```

### Step 3: Test the API

```bash
# Create a test API key
curl -X POST https://gatewayz-api-production.railway.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Make a test chat request
curl -X POST https://gatewayz-api-production.railway.app/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## Monitoring & Troubleshooting

### View Logs

```bash
# Real-time logs
railway logs --follow

# Last 100 lines
railway logs --lines 100

# Filter by service
railway logs --follow --service api

# Search for errors
railway logs --follow | grep -i error
```

### Common Issues

#### Issue: "Cannot import name 'LOKI_PUSH_URL'"

**Solution:** Ensure `Config` class is imported, not individual constants:
```python
from src.config.config import Config
# Not: from src.config.config import LOKI_PUSH_URL
```

#### Issue: "datetime.UTC not found"

**Solution:** Use `timezone.utc` for Python 3.10 compatibility:
```python
from datetime import timezone
datetime.now(timezone.utc)  # ✓ Correct
# Not: datetime.now(datetime.UTC)  # ✗ Python 3.13+ only
```

#### Issue: "ModuleNotFoundError: No module named 'src'"

**Solution:** Ensure `PYTHONPATH` includes the project root:
```bash
railway variables set PYTHONPATH "/app"
```

### View Service Logs

```bash
# SSH into the service
railway shell

# Inside the service:
# View application logs
tail -f /var/log/gatewayz-error-monitor.log

# View system logs
journalctl -u api -f

# Exit SSH
exit
```

---

## Using Error Monitoring System

### API Endpoints

#### 1. Check Monitoring Status

```bash
curl https://your-railway-url/api/error-monitor/status
```

Response:
```json
{
  "enabled": true,
  "monitoring": true,
  "errors_detected": 5,
  "last_scan": "2025-11-17T01:45:00Z",
  "auto_fix_enabled": true,
  "fixes_generated": 2,
  "prs_created": 1
}
```

#### 2. Get Detected Errors

```bash
# Get all recent errors
curl https://your-railway-url/api/error-monitor/errors

# Get errors from last hour
curl https://your-railway-url/api/error-monitor/errors?hours=1

# Get specific error type
curl https://your-railway-url/api/error-monitor/errors?category=ImportError
```

Response:
```json
{
  "errors": [
    {
      "id": "err_123",
      "type": "ValueError",
      "message": "Invalid API key format",
      "severity": "high",
      "count": 5,
      "first_seen": "2025-11-17T01:30:00Z",
      "last_seen": "2025-11-17T01:45:00Z",
      "stack_trace": "..."
    }
  ],
  "total": 1
}
```

#### 3. Get Generated Fixes

```bash
# Get all fixes
curl https://your-railway-url/api/error-monitor/fixes

# Get fixes for specific error
curl https://your-railway-url/api/error-monitor/fixes?error_id=err_123
```

Response:
```json
{
  "fixes": [
    {
      "id": "fix_456",
      "error_id": "err_123",
      "status": "pr_created",
      "pr_url": "https://github.com/org/repo/pull/42",
      "explanation": "The error occurs when...",
      "solution": "Change the validation logic to...",
      "created_at": "2025-11-17T01:40:00Z"
    }
  ]
}
```

#### 4. Manually Trigger Scan

```bash
# Trigger error detection scan
curl -X POST https://your-railway-url/api/error-monitor/scan \
  -H "Authorization: Bearer ADMIN_API_KEY"

# Response
{
  "scan_id": "scan_789",
  "status": "running",
  "errors_found": 0,
  "started_at": "2025-11-17T01:50:00Z"
}
```

### Autonomous Monitoring

The system runs in the background and:

1. **Continuously monitors** application logs every 5 minutes (configurable)
2. **Detects patterns** in errors using configurable thresholds
3. **Classifies severity** (Critical > High > Medium > Low > Info)
4. **Generates explanations** using Claude API
5. **Creates GitHub PRs** with proposed fixes
6. **Tracks all activity** in the audit log

### Configuration

Adjust monitoring behavior via environment variables:

```bash
# Scan interval (seconds)
railway variables set ERROR_MONITOR_INTERVAL 300

# How far back to look (hours)
railway variables set ERROR_MONITOR_LOOKBACK_HOURS 1

# Minimum severity to generate fixes
railway variables set ERROR_FIX_MIN_SEVERITY high

# Min occurrences before triggering fix
railway variables set ERROR_FIX_MIN_COUNT 3

# Auto-create PRs
railway variables set AUTO_FIX_CREATE_PRS true

# Dry-run mode (don't create actual PRs)
railway variables set DRY_RUN false
```

---

## Scaling & Performance

### Performance Optimization

```bash
# Increase Python workers
railway variables set WORKERS 4

# Adjust timeouts
railway variables set TIMEOUT 60

# Memory optimization
railway variables set MAX_MEMORY 512MB
```

### Monitoring Performance

```bash
# Check service metrics
railway metrics

# View CPU and memory usage
railway status --verbose

# Check active connections
curl https://your-railway-url/api/system/metrics
```

---

## Best Practices

1. **Always test locally first**
   ```bash
   python -m pytest tests/
   uvicorn src.main:app --reload
   ```

2. **Use environment-specific configurations**
   ```bash
   # Development
   railway variables set APP_ENV development

   # Production
   railway variables set APP_ENV production
   ```

3. **Enable logging for debugging**
   ```bash
   railway variables set LOG_LEVEL DEBUG
   railway variables set VERBOSE true
   ```

4. **Monitor error patterns regularly**
   ```bash
   # Daily review
   curl https://your-railway-url/api/error-monitor/errors?hours=24
   ```

5. **Review generated PRs before merging**
   - Check the GitHub PR created by the system
   - Review Claude's explanation and proposed fix
   - Test the fix locally before merging
   - Merge to `main` to deploy

---

## Next Steps

1. ✅ Set environment variables
2. ✅ Deploy to Railway
3. ✅ Verify deployment
4. ✅ Monitor errors and generated fixes
5. ✅ Review and merge auto-generated PRs
6. ✅ Adjust configuration based on your needs

---

## Support & Resources

- **Railway Docs**: https://docs.railway.app
- **Gatewayz API Docs**: `/docs` endpoint on your deployment
- **Claude API Docs**: https://docs.anthropic.com
- **GitHub API Docs**: https://docs.github.com/rest

---

## Troubleshooting Commands

```bash
# Reset environment
railway reset

# Update deployment
railway up

# View deployment logs
railway logs --follow

# SSH into service
railway shell

# Get service info
railway status --verbose

# List all variables
railway variables

# Remove a variable
railway variables unset VARIABLE_NAME
```

---

**Last Updated**: 2025-11-17
**System Version**: 2.0.3
