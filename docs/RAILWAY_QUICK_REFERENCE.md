# Railway Deployment Quick Reference

Quick commands and workflows for Railway deployment.

## Setup (First Time Only)

### Automated Setup
```bash
cd /root/repo
bash scripts/setup-railway-deployment.sh
```

### Manual Setup
1. Get Railway token: https://railway.app → Account Settings → API Tokens
2. Add to GitHub: Repository → Settings → Secrets → `RAILWAY_TOKEN`
3. (Optional) Add URLs: `PRODUCTION_URL` and `STAGING_URL` secrets

## Common Workflows

### Deploy to Staging

```bash
# Make changes
git add .
git commit -m "feat: add new feature"

# Push to staging
git push origin staging
```

**Result:** Workflow runs automatically, tests execute, app deploys to staging

**Monitor:**
- GitHub Actions: https://github.com/[repo]/actions
- Railway Dashboard: https://railway.app

### Deploy to Production

```bash
# Ensure staging works first
git push origin staging
# ... wait for deployment to complete ...

# Merge to main
git checkout main
git pull origin main
git merge staging
git push origin main
```

**Result:** Workflow runs, app deploys to production

### Manual Deployment

When you need to deploy without waiting for CI:

1. Go to: https://github.com/[repo]/actions
2. Select: **Deploy to Railway (CLI-based)**
3. Click: **Run workflow**
4. Select environment: `staging` or `production`
5. Click: **Run workflow**

**Time:** ~5-10 minutes for full deployment cycle

## Verify Deployment Status

### GitHub Actions
```bash
# List recent workflow runs
gh run list --workflow=deploy-railway-cli.yml

# Watch specific run
gh run watch [run-id]

# View logs
gh run view [run-id] --log
```

### Railway Dashboard
1. Go to: https://railway.app
2. Click your project
3. Click your service (gatewayz)
4. Check **Deployments** tab
5. View logs for latest deployment

### Health Check
```bash
# Test staging health
curl https://[staging-url].railway.app/health

# Test production health
curl https://[production-url].railway.app/health

# Expected response
{"status":"ok"}
```

## Testing Before Deployment

### Run Tests Locally
```bash
# Install dev dependencies
pip install -r requirements-dev.txt

# Run all tests
pytest tests/ -v

# Run tests excluding smoke tests (same as CI)
pytest tests/ -v -m "not smoke"

# Run with coverage
pytest tests/ --cov=src --cov-report=html

# Run specific test file
pytest tests/integration/test_endpoints.py -v
```

### Check Syntax
```bash
# Verify Python imports
python -c "from src.main import app; print('✅ OK')"

# Compile Python files
python -m py_compile src/main.py
```

### Verify Files
```bash
# Check required files exist
ls -la railway.json railway.toml requirements.txt start.sh src/main.py
```

## Troubleshooting

### Deployment Failed

**Check workflow logs:**
```bash
# Open recent workflow run
gh run list --workflow=deploy-railway-cli.yml | head -1

# View logs
gh run view [run-id] --log
```

**Common issues:**
- Tests failed → Fix locally, commit, push again
- Missing `RAILWAY_TOKEN` → Add secret to GitHub
- Missing files → Add railway.json, railway.toml, etc.

### Health Check Failed

**Check application logs:**
1. Go to https://railway.app
2. Select project → service
3. Click **View** logs
4. Look for startup errors

**Common issues:**
- Missing environment variables → Add in Railway dashboard
- `/health` endpoint missing → Check src/main.py
- Port mismatch → Verify Railway config

### View All Secrets
```bash
# List secret names
gh secret list

# Update a secret
gh secret set RAILWAY_TOKEN --body "new-token-here"

# Delete a secret
gh secret delete RAILWAY_TOKEN
```

## Configuration Files

### .github/workflows/deploy-railway-cli.yml

Main deployment workflow with:
- ✅ Code checkout
- ✅ Python 3.12 setup
- ✅ Dependency installation
- ✅ Test execution
- ✅ Build verification
- ✅ Railway CLI deployment
- ✅ Health checks
- ✅ Deployment summary

### railway.json

Specifies builder (Nixpacks) and deployment settings:

```json
{
  "builder": "NIXPACKS"
}
```

### railway.toml

Service configuration:

```toml
[build]
builder = "NIXPACKS"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
startCommand = "./start.sh"
```

### requirements.txt

Python dependencies installed in Railway.

### start.sh

Application startup script executed by Railway.

## Environment Variables

### In Railway Dashboard

Set project variables:
1. Go to https://railway.app
2. Project → Variables
3. Add each required variable

**Common variables:**
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
OPENAI_API_KEY=...
SECRET_KEY=...
DEBUG=false
```

### In GitHub Actions

Referenced in workflow:
```yaml
env:
  PYTHON_VERSION: "3.12"
  NODE_VERSION: "20"
```

Secrets from GitHub:
```yaml
RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## Useful Links

- 📊 [Railway Dashboard](https://railway.app)
- 📖 [Railway Docs](https://docs.railway.app)
- ⚙️ [Railway CLI Ref](https://docs.railway.app/reference/cli-api)
- 🔐 [GitHub Secrets](https://github.com/[repo]/settings/secrets/actions)
- ▶️ [GitHub Actions](https://github.com/[repo]/actions)
- 📋 [Full Deployment Guide](./RAILWAY_DEPLOYMENT.md)
- ✅ [Setup Checklist](./RAILWAY_SETUP_CHECKLIST.md)

## Workflow Diagram

```
Push to main/staging
        ↓
GitHub Actions CI
(lint, test, build)
        ↓
   CI Passed?
      ↙    ↖
    No     Yes
     ↓      ↓
  Fail   deploy-railway-cli.yml
           ↓
    Install Railway CLI
    Link to service
    Execute: railway up
           ↓
    Wait 90 seconds
           ↓
    Health Check
        ↓
   200 OK?
    ↙    ↖
  No     Yes
   ↓      ↓
 Warn   Success!
        ↓
   Deployment Summary
```

## Statistics

- **Test Execution Time:** ~2-3 minutes
- **Build Verification Time:** ~1 minute
- **Railway Deployment Time:** ~2-3 minutes
- **Health Check Time:** ~3-5 minutes (with retries)
- **Total Pipeline Time:** ~8-12 minutes

## Best Practices

✅ **Do:**
- Test locally before pushing
- Use staging branch for testing
- Monitor health checks
- Review deployment logs
- Keep Railway token secure
- Commit deployment files (except token)

❌ **Don't:**
- Commit `.env` files with secrets
- Push untested code to main
- Ignore test failures
- Reuse or share Railway tokens
- Skip health checks
- Force-push to production

## Getting Help

### Check Logs
```bash
# GitHub Actions logs
gh run view [run-id] --log

# Railway logs
railway logs --follow
```

### Common Commands
```bash
# List projects
railway project list

# Switch project
railway project switch

# View variables
railway variables

# Set variable
railway variable add KEY=value

# See deployment status
railway deploy status
```

### Documentation
- [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) - Full guide
- [RAILWAY_SETUP_CHECKLIST.md](./RAILWAY_SETUP_CHECKLIST.md) - Setup steps
- [Railway Docs](https://docs.railway.app) - Official docs

---

**Quick Reference Version:** 1.0
**Last Updated:** 2025-10-31
