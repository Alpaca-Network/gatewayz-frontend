# Railway Deployment - Quick Start Guide

Deploy your Gatewayz backend with error monitoring in minutes.

## ⚡ 5-Minute Setup

### 1. Install Railway CLI

```bash
npm i -g @railway/cli
railway login
```

### 2. Run Setup Script

```bash
bash scripts/setup_railway.sh
```

This script will:
- ✅ Check prerequisites
- ✅ Authenticate with Railway
- ✅ Initialize project
- ✅ Collect API keys
- ✅ Set environment variables
- ✅ Deploy to Railway
- ✅ Verify deployment

### 3. Get Your URL

```bash
railway domains
```

Your API is now live at: `https://your-project.railway.app`

---

## 📋 Manual Setup (If Script Doesn't Work)

### Step 1: Initialize Project

```bash
railway init
# Select or create a project
```

### Step 2: Set Required API Keys

```bash
railway variables set ANTHROPIC_API_KEY "sk-ant-..."
railway variables set GITHUB_TOKEN "ghp_..."
railway variables set SUPABASE_URL "https://..."
railway variables set SUPABASE_KEY "..."
railway variables set OPENROUTER_API_KEY "..."
```

### Step 3: Set Error Monitoring Config

```bash
railway variables set ERROR_MONITORING_ENABLED "true"
railway variables set AUTO_FIX_ENABLED "true"
railway variables set LOKI_ENABLED "false"
railway variables set LOG_LEVEL "INFO"
```

### Step 4: Deploy

```bash
railway up
```

### Step 5: Monitor

```bash
railway logs --follow
```

---

## ✅ Verify Deployment

### Check Service Status

```bash
# Get URL
URL=$(railway domains | head -1)

# Test health
curl $URL/health

# Check error monitoring
curl $URL/api/error-monitor/status
```

### Expected Output

```json
{
  "status": "ok",
  "environment": "production"
}
```

---

## 🔑 Environment Variables Reference

### Required

| Variable | Format | Example |
|----------|--------|---------|
| `ANTHROPIC_API_KEY` | sk-ant-... | sk-ant-abc123... |
| `GITHUB_TOKEN` | ghp_... | ghp_abc123... |
| `SUPABASE_URL` | https://... | https://abc123.supabase.co |
| `SUPABASE_KEY` | ....... | eyJhbGc... |
| `OPENROUTER_API_KEY` | sk-or-... | sk-or-abc123... |

### Error Monitoring

| Variable | Default | Options |
|----------|---------|---------|
| `ERROR_MONITORING_ENABLED` | true | true/false |
| `AUTO_FIX_ENABLED` | true | true/false |
| `ERROR_MONITOR_INTERVAL` | 300 | Seconds |
| `ERROR_FIX_MIN_SEVERITY` | high | critical/high/medium/low |
| `AUTO_FIX_CREATE_PRS` | true | true/false |

### Optional

| Variable | Purpose |
|----------|---------|
| `LOKI_PUSH_URL` | Log aggregation |
| `SLACK_WEBHOOK_URL` | Slack notifications |
| `LOG_LEVEL` | DEBUG/INFO/WARNING/ERROR |

---

## 📊 Using the System

### Check Errors

```bash
URL=$(railway domains | head -1)
curl $URL/api/error-monitor/errors
```

### View Generated Fixes

```bash
curl $URL/api/error-monitor/fixes
```

### Trigger Manual Scan

```bash
curl -X POST $URL/api/error-monitor/scan \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

---

## 📈 Monitoring & Logs

### Real-Time Logs

```bash
railway logs --follow
```

### Search Logs

```bash
railway logs --follow | grep -i error
```

### Last N Lines

```bash
railway logs --lines 50
```

---

## 🐛 Troubleshooting

### Issue: Deployment Hangs

```bash
# Cancel and retry
Ctrl+C
railway up
```

### Issue: Variables Not Set

```bash
# List variables
railway variables

# Verify specific variable
railway variables get ANTHROPIC_API_KEY

# Update
railway variables set ANTHROPIC_API_KEY "new-value"
```

### Issue: Service Won't Start

```bash
# Check logs
railway logs --follow

# Restart
railway up
```

---

## 🚀 Next Steps

1. ✅ Deploy to Railway (complete)
2. ⏭️ Monitor errors (docs/ERROR_MONITORING.md)
3. ⏭️ Review auto-generated PRs
4. ⏭️ Adjust settings based on needs
5. ⏭️ Scale as needed

---

## 📚 Full Documentation

- **Complete Guide**: [docs/RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md)
- **Error Monitoring**: [docs/ERROR_MONITORING.md](ERROR_MONITORING.md)
- **API Reference**: Visit `/docs` on your deployment

---

## ⚙️ Useful Commands

```bash
# View project info
railway status

# Update code
git push origin main

# View logs
railway logs --follow

# SSH into service
railway shell

# View metrics
railway metrics

# Reset (WARNING: deletes deployment)
railway reset
```

---

## 💡 Tips

1. **Always test locally first**
   ```bash
   python -m pytest tests/
   uvicorn src.main:app --reload
   ```

2. **Keep credentials in Railway, not git**
   - Never commit `.env` with real keys
   - Use Railway dashboard for secrets

3. **Monitor errors daily**
   ```bash
   URL=$(railway domains | head -1)
   curl $URL/api/error-monitor/errors?hours=24
   ```

4. **Review generated PRs carefully**
   - Check GitHub for new PRs
   - Review Claude's explanation
   - Test before merging

---

**Ready to deploy?** Run: `bash scripts/setup_railway.sh`

**Questions?** See: [docs/RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md)
