# Railway Deployment Setup Checklist

Complete this checklist to enable Railway CLI-based deployment with GitHub Actions.

## Prerequisites

- [ ] Railway account created at https://railway.app
- [ ] GitHub repository access with admin permissions
- [ ] Git installed locally
- [ ] GitHub CLI (gh) installed and authenticated

## 1. Railway Configuration

### 1.1 Create Railway Project

- [ ] Go to [Railway Dashboard](https://railway.app)
- [ ] Click "Create New Project"
- [ ] Select "Deploy from GitHub repo" or "Empty Project"
- [ ] Connect your GitHub account if needed
- [ ] Create the project

### 1.2 Get Your Railway Token

- [ ] Go to [Railway Dashboard](https://railway.app)
- [ ] Click profile icon → **Account Settings**
- [ ] Navigate to **API Tokens** section
- [ ] Click **Create New Token**
- [ ] Copy the token (appears only once)
- [ ] Save it securely (you'll need it in next section)

### 1.3 Link Railway to GitHub

Option A: Automatic (Recommended)
- [ ] In Railway: Project Settings → GitHub Repository
- [ ] Connect your GitHub account
- [ ] Select the repository
- [ ] Enable automatic deploys (optional)

Option B: Manual
- [ ] Repository settings noted for later configuration

## 2. GitHub Configuration

### 2.1 Add Repository Secrets

Using **Method A (Recommended: Automated Setup Script)**

```bash
cd /root/repo
bash scripts/setup-railway-deployment.sh
```

This script will:
- [ ] Prompt for your Railway API token
- [ ] Create `RAILWAY_TOKEN` secret
- [ ] Optionally add `PRODUCTION_URL` secret
- [ ] Optionally add `STAGING_URL` secret

**OR**

Using **Method B (Manual Setup)**

Go to: https://github.com/[YOUR_REPO]/settings/secrets/actions

#### Required Secrets

**`RAILWAY_TOKEN`**
- [ ] Click "New repository secret"
- [ ] Name: `RAILWAY_TOKEN`
- [ ] Value: [Paste your Railway API token]
- [ ] Click "Add secret"

#### Optional Secrets (for Health Checks)

**`PRODUCTION_URL`**
- [ ] Click "New repository secret"
- [ ] Name: `PRODUCTION_URL`
- [ ] Value: Your production app URL (e.g., `https://app.railway.app`)
- [ ] Click "Add secret"

**`STAGING_URL`**
- [ ] Click "New repository secret"
- [ ] Name: `STAGING_URL`
- [ ] Value: Your staging app URL (e.g., `https://app-staging.railway.app`)
- [ ] Click "Add secret"

### 2.2 Verify Secrets

```bash
# View secret names (not values)
gh secret list --repo [YOUR_REPO]
```

Expected output:
```
RAILWAY_TOKEN        Updated 2025-10-31
PRODUCTION_URL       Updated 2025-10-31
STAGING_URL          Updated 2025-10-31
```

- [ ] `RAILWAY_TOKEN` exists
- [ ] (Optional) `PRODUCTION_URL` exists
- [ ] (Optional) `STAGING_URL` exists

## 3. Workflow Files

### 3.1 Verify Workflow Files Exist

- [ ] `.github/workflows/deploy-railway-cli.yml` exists
  - Check: `ls -la .github/workflows/deploy-railway-cli.yml`
- [ ] `.github/workflows/deploy.yml` exists (original)
- [ ] `.github/workflows/ci.yml` exists (CI pipeline)

### 3.2 Review Workflow Configuration

- [ ] Open `.github/workflows/deploy-railway-cli.yml`
- [ ] Verify Python version: `PYTHON_VERSION: "3.12"`
- [ ] Verify Node version: `NODE_VERSION: "20"`
- [ ] Check trigger branches: `[main, staging]`
- [ ] Confirm workflow can be manually triggered

## 4. Local Testing

### 4.1 Verify Local Setup

```bash
# Test that application imports correctly
python -c "from src.main import app; print('✅ FastAPI app imports successfully')"
```

- [ ] FastAPI app imports without errors
- [ ] No missing dependencies

### 4.2 Run Tests Locally

```bash
# Install dependencies
pip install -r requirements-dev.txt

# Run tests
pytest tests/ -v -m "not smoke"
```

- [ ] All tests pass locally
- [ ] No failures or errors

### 4.3 Verify Railway Files

Check these files exist in repository root:

- [ ] `railway.json` - Railway builder configuration
- [ ] `railway.toml` - Railway service configuration
- [ ] `requirements.txt` - Python dependencies
- [ ] `start.sh` - Application startup script
- [ ] `src/main.py` - FastAPI application entry point

## 5. Initial Deployment

### 5.1 Test on Staging Branch

```bash
# Create or update staging branch
git checkout -b staging
git push origin staging
```

- [ ] Push committed to staging branch
- [ ] GitHub Actions workflow starts automatically
- [ ] Monitor at: https://github.com/[YOUR_REPO]/actions

### 5.2 Monitor Deployment

**In GitHub Actions:**
- [ ] `setup` job completes
- [ ] `checkout-and-setup` job completes
- [ ] `install-dependencies` job completes
- [ ] `test` job runs and passes
- [ ] `build` job verifies files
- [ ] `deploy` job runs Railway CLI
- [ ] `health-check` job verifies deployment
- [ ] `summary` job shows success

**In Railway Dashboard:**
- [ ] Go to https://railway.app
- [ ] Select your project
- [ ] Check "Deployments" tab
- [ ] See new deployment in progress or completed
- [ ] Check logs for any errors

### 5.3 Verify Health Check

- [ ] Wait for health check to complete (5-10 minutes total)
- [ ] If health check fails:
  - Check application logs in Railway
  - Verify `/health` endpoint exists
  - Check environment variables in Railway
  - Review error messages in GitHub Actions

### 5.4 Test Application

```bash
# If STAGING_URL is configured
curl https://[staging-app].railway.app/health

# Expected response
# {"status":"ok"}
```

- [ ] Health endpoint returns 200 OK
- [ ] Application is accessible
- [ ] No errors in logs

## 6. Production Deployment

### 6.1 Prepare Production Deployment

- [ ] Code is tested and reviewed
- [ ] All tests pass locally
- [ ] Staging deployment is working
- [ ] Ready for production release

### 6.2 Deploy to Production

```bash
# Merge to main branch
git checkout main
git merge staging
git push origin main
```

- [ ] Code pushed to main branch
- [ ] GitHub Actions workflow starts
- [ ] All jobs complete successfully
- [ ] Deployment visible in Railway dashboard

### 6.3 Verify Production

- [ ] Health check passes for production
- [ ] Production application is accessible
- [ ] No errors in logs
- [ ] All services operational

## 7. Ongoing Maintenance

### 7.1 Regular Updates

- [ ] Review deployment logs monthly
- [ ] Update dependencies regularly (`pip list --outdated`)
- [ ] Check GitHub security alerts
- [ ] Monitor Railway resource usage

### 7.2 Secret Management

- [ ] Rotate `RAILWAY_TOKEN` every 6 months
- [ ] Keep `PRODUCTION_URL` and `STAGING_URL` current
- [ ] Never commit secrets to git
- [ ] Use `.gitignore` for local `.env` files

### 7.3 Monitoring

- [ ] Set up Railway alerts for deployment failures
- [ ] Monitor application logs regularly
- [ ] Track deployment frequency
- [ ] Document any issues encountered

## 8. Troubleshooting

If you encounter issues, check:

### Deployment Won't Start

- [ ] Is `RAILWAY_TOKEN` secret configured?
  ```bash
  gh secret list
  ```
- [ ] Is the token still valid in Railway dashboard?
- [ ] Are tests passing in CI?

### Health Check Fails

- [ ] Is `/health` endpoint available?
- [ ] Are environment variables configured in Railway?
- [ ] Check application logs in Railway dashboard
- [ ] Add `PRODUCTION_URL` and `STAGING_URL` secrets for better diagnosis

### Tests Fail

- [ ] Run tests locally: `pytest tests/ -v`
- [ ] Check error messages in GitHub Actions logs
- [ ] Fix issues locally before pushing
- [ ] Ensure all dependencies are installed

### Missing Deployment Files

- [ ] Verify all required files exist:
  ```bash
  ls -la railway.json railway.toml requirements.txt start.sh src/main.py
  ```
- [ ] Add missing files to repository
- [ ] Commit and push again

## 9. Reference Links

- [ ] [Railway Documentation](https://docs.railway.app)
- [ ] [Railway CLI Reference](https://docs.railway.app/reference/cli-api)
- [ ] [GitHub Actions Docs](https://docs.github.com/en/actions)
- [ ] [Project Deployment Guide](./RAILWAY_DEPLOYMENT.md)

## 10. Completion Verification

- [ ] All steps completed
- [ ] Secrets configured in GitHub
- [ ] Workflow files in place
- [ ] Local tests passing
- [ ] Staging deployment successful
- [ ] Production deployment successful
- [ ] Health checks passing
- [ ] Documentation reviewed

## Summary

Once all items are checked:

✅ **Railway CLI-based GitHub Actions deployment is ready!**

Your project can now:
- Automatically test on every push
- Automatically deploy to staging/production via Railway CLI
- Run health checks after deployment
- Support manual deployment triggers
- Integrate with GitHub Actions for visibility

For questions or issues, see [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

---

**Created:** 2025-10-31
**Last Updated:** 2025-10-31
