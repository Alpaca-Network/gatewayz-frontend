# Railway Deployment Guide

This guide explains how to set up and use the GitHub Actions workflow for deploying to Railway using the Railway CLI.

## Overview

The project includes two deployment workflows:

1. **`deploy.yml`** - Uses Railway's automatic GitHub integration (simpler, less control)
2. **`deploy-railway-cli.yml`** - Uses Railway CLI for explicit control with custom build/test steps (recommended)

## Quick Setup

### 1. Get Your Railway Token

1. Go to [Railway Dashboard](https://railway.app)
2. Click your profile icon → **Account Settings**
3. Navigate to **API Tokens**
4. Create a new API token
5. Copy the token (you'll only see it once)

### 2. Add GitHub Secret

1. Go to your GitHub repository
2. Settings → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `RAILWAY_TOKEN`
5. Value: Paste your Railway API token
6. Click **Add secret**

### 3. Optional: Add Health Check URLs

For post-deployment health checks, add these secrets (optional):

1. `PRODUCTION_URL` - e.g., `https://your-production-app.railway.app`
2. `STAGING_URL` - e.g., `https://your-staging-app.railway.app`

## Workflow: `deploy-railway-cli.yml`

### Features

✅ **Automated Testing**
- Runs full test suite before deployment
- Generates coverage reports
- Fails fast on test failures

✅ **Build Verification**
- Validates Python syntax
- Checks all required deployment files
- Verifies Railway configuration

✅ **Railway CLI Deployment**
- Uses explicit `railway up` command
- Leverages stored RAILWAY_TOKEN
- Supports multiple environments (staging/production)

✅ **Health Checks**
- Automatic post-deployment health verification
- Retry logic with configurable delays
- Detailed health check reporting

✅ **Manual Trigger Option**
- Manually trigger deployment via GitHub UI
- Select staging or production environment
- Useful for emergency deploys

### Trigger Events

The workflow runs automatically on:

```yaml
push:
  branches: [main, staging]  # Auto-deploy to production on main, staging on staging
workflow_dispatch:           # Manual trigger with environment selection
```

### Job Breakdown

#### 1. **setup** - Determine Environment
- Detects which environment to deploy to
- Handles manual trigger with environment selection
- Outputs: environment, should_deploy, app_name

#### 2. **checkout-and-setup** - Code Preparation
- Checks out repository code
- Sets up Python 3.12 environment
- Caches pip dependencies

#### 3. **install-dependencies** - Dependency Installation
- Upgrades pip, setuptools, wheel
- Installs production dependencies from `requirements.txt`
- Installs dev dependencies from `requirements-dev.txt`
- Verifies FastAPI app imports correctly

#### 4. **test** - Run Test Suite
- Executes pytest with verbose output
- Skips smoke tests (`-m "not smoke"`)
- Generates code coverage reports
- Uploads coverage to Codecov (optional)

```bash
pytest tests/ -v --tb=short -m "not smoke"
pytest tests/ --cov=src --cov-report=term-summary
```

#### 5. **build** - Build Verification
- Validates all required deployment files:
  - `railway.json`
  - `railway.toml`
  - `requirements.txt`
  - `start.sh`
  - `src/main.py`
- Checks Python syntax compilation
- Validates Railway configuration JSON

#### 6. **deploy** - Railway CLI Deployment
- Installs Railway CLI globally
- Links to Railway service via token
- Executes `railway up` with deployment options
- Detaches process to allow workflow continuation

```bash
railway link --environment="$ENV"
railway up --service=gatewayz --detach --skip-database=true
```

#### 7. **health-check** - Post-Deployment Verification
- Waits 90 seconds for Railway to process
- Makes HTTP GET request to `/health` endpoint
- Retries up to 6 times with 30-second delays
- Fails if health check doesn't return HTTP 200

#### 8. **summary** - Deployment Report
- Generates final deployment summary
- Shows environment, branch, commit, author
- Provides next steps or troubleshooting guidance

## Deployment Scenarios

### Scenario 1: Push to Main Branch
```bash
git commit -m "Fix: important bug"
git push origin feature-branch
# Create PR and merge to main
```

**Result:**
- CI workflow runs (lint, test, build)
- If CI passes → `deploy-railway-cli.yml` triggers
- Deploys to **production** environment
- Health check verifies deployment

### Scenario 2: Push to Staging Branch
```bash
git push origin staging
```

**Result:**
- CI workflow runs
- If CI passes → `deploy-railway-cli.yml` triggers
- Deploys to **staging** environment
- Health check verifies deployment

### Scenario 3: Manual Deployment
1. Go to repository → **Actions** tab
2. Select **Deploy to Railway (CLI-based)**
3. Click **Run workflow**
4. Select environment: `staging` or `production`
5. Click **Run workflow**

**Result:**
- Skips CI checks (for emergency deploys)
- Deploys to selected environment immediately

## Environment Variables in Railway

The Railway app automatically gets access to environment variables defined in:

1. **Railway Dashboard** - Project Settings → Variables
2. **`.env` file** - Local development (not committed)
3. **GitHub Secrets** - Referenced in workflow

For this project, ensure Railway has:

```bash
DATABASE_URL=           # Supabase connection
REDIS_URL=              # Redis cache
OPENAI_API_KEY=         # OpenAI access
# ... other provider keys
```

Configure these in Railway Dashboard → Project Variables.

## Troubleshooting

### Issue: RAILWAY_TOKEN secret not configured

**Error:** `❌ RAILWAY_TOKEN secret not configured`

**Solution:**
1. Generate token in Railway Dashboard
2. Add to GitHub Secrets (see Quick Setup section)
3. Verify secret name is exactly `RAILWAY_TOKEN`

### Issue: Health check fails

**Error:** `❌ Health check failed after 6 attempts`

**Solution:**
1. Check Railway deployment logs in Dashboard
2. Verify app is starting correctly
3. Check `/health` endpoint is available
4. Add `PRODUCTION_URL` or `STAGING_URL` secrets for proper URLs
5. Verify environment variables are set in Railway

### Issue: Tests fail before deployment

**Error:** `❌ All tests passed` → exit code failure

**Solution:**
1. Tests must pass before deployment
2. Check test logs in GitHub Actions
3. Fix failing tests locally
4. Commit and push again

### Issue: Missing deployment files

**Error:** `❌ Missing required file: railway.json`

**Solution:**
Ensure these files exist in repository root:
- `railway.json`
- `railway.toml`
- `requirements.txt`
- `start.sh`
- `src/main.py`

## Customization

### Modify Test Exclusions

Edit the test command in `deploy-railway-cli.yml`:

```yaml
# Current: Skip smoke tests
pytest tests/ -v -m "not smoke"

# Alternative: Run specific test file
pytest tests/integration/test_endpoints.py -v

# Alternative: Run critical tests only
pytest tests/ -v -m "critical"
```

### Adjust Health Check Timing

Edit the health check delays:

```yaml
steps:
  - name: Wait for deployment
    run: sleep 90    # Change 90 to desired seconds

  - name: Run health check
    run: |
      RETRY_DELAY=30   # Change 30 to desired seconds between retries
      MAX_RETRIES=6    # Change 6 to desired max attempts
```

### Add Additional Build Steps

Add custom build commands before deployment:

```yaml
build:
  steps:
    # ... existing steps ...
    - name: Custom build step
      run: |
        echo "🔨 Running custom build..."
        python scripts/build.py
        echo "✅ Build complete"
```

### Add Slack/Discord Notifications

Uncomment and configure notification in the summary job:

```yaml
- name: Notify Slack
  if: always()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "🚀 Deployed to ${{ env.ENVIRONMENT }}: ${{ github.ref_name }}"
      }
```

Then add `SLACK_WEBHOOK_URL` to GitHub Secrets.

## Railway CLI Commands Reference

Common commands used in workflow:

```bash
# Link to a Railway service
railway link --environment="production"

# Deploy the app
railway up --detach --skip-database=true

# Check deployment status
railway logs --follow

# View environment variables
railway variables

# Set environment variable
railway variable add KEY=value
```

See [Railway CLI Documentation](https://docs.railway.app/reference/cli-api) for more.

## Monitoring Deployments

### GitHub Actions
- Go to **Actions** tab in repository
- Click the workflow run
- View logs for each job
- See deployment status and health check results

### Railway Dashboard
- Go to [Railway Dashboard](https://railway.app)
- Click your project
- Click your service (gatewayz)
- View deployment history
- Check logs and metrics

## Best Practices

1. **Always test locally first**
   ```bash
   pytest tests/ -v
   ```

2. **Use staging branch for testing**
   - Push to `staging` branch first
   - Verify deployment works
   - Then merge to `main` for production

3. **Monitor health checks**
   - Add `PRODUCTION_URL` and `STAGING_URL` secrets
   - Enables automatic post-deployment verification

4. **Keep Railway token secure**
   - Use GitHub Secrets (never commit token)
   - Rotate tokens periodically
   - Review token access in Railway Dashboard

5. **Review workflow logs**
   - Check each deployment's logs
   - Monitor test results
   - Track deployment history

## Related Documentation

- [Railway Platform Documentation](https://docs.railway.app)
- [Railway CLI Reference](https://docs.railway.app/reference/cli-api)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)

## Support

For issues with:

- **Railway**: [Railway Support](https://railway.app/support)
- **GitHub Actions**: [GitHub Discussions](https://github.com/discussions)
- **This Project**: Check existing issues or create new one

---

**Last Updated:** 2025-10-31
**Workflow File:** `.github/workflows/deploy-railway-cli.yml`
