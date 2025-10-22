# Complete CI/CD Pipeline Documentation

## Overview

Your backend now has a **complete Continuous Integration and Continuous Deployment (CI/CD) pipeline** with three GitHub Actions workflows:

### Workflows:

1. **`ci.yml`** - Continuous Integration (CI)
   - Runs on every push and PR
   - Tests, lints, and validates code
   - **MUST pass** before deployment

2. **`deploy.yml`** - Continuous Deployment (CD)
   - Runs after CI passes
   - Auto-deploys to Railway
   - Health checks after deployment

3. **`deploy-manual.yml`** - Manual Deployment
   - Triggered manually via GitHub UI
   - Allows selective deployment
   - Useful for hotfixes or rollbacks

---

## Complete Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Developer commits code                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Pre-commit Hooks (Local)                                   │
│  ✅ Code formatting                                          │
│  ✅ Linting                                                  │
│  ✅ Security scan                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ git push
┌─────────────────────────────────────────────────────────────┐
│  CI Workflow (ci.yml)                                       │
│  ├─ Code Quality Checks                                     │
│  ├─ Security Scan                                           │
│  ├─ Run All Tests ⚠️ MUST PASS                             │
│  ├─ Build Verification                                      │
│  └─ Deployment Ready Check                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ CI Passes ✅
┌─────────────────────────────────────────────────────────────┐
│  CD Workflow (deploy.yml)                                   │
│  ├─ Pre-deployment checks                                   │
│  ├─ Railway auto-deploy                                     │
│  └─ Post-deployment health check                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Deployed! 🚀                                               │
│  ├─ staging branch → Staging environment                    │
│  └─ main branch → Production environment                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Workflow Details

### 1. CI Workflow (`ci.yml`)

**Triggers:**
- Push to `main`, `staging`, or `develop`
- Pull requests to these branches

**Jobs:**

| Job | Description | Can Fail? | Time |
|-----|-------------|-----------|------|
| **Code Quality** | Ruff, Black, isort | ⚠️ Warning | ~30s |
| **Security Scan** | Bandit, Safety | ⚠️ Warning | ~45s |
| **Run Tests** | pytest all tests | ✅ **YES - Blocks deploy** | 1-3min |
| **Build Verification** | Import & config checks | ✅ YES | ~30s |
| **Deployment Check** | Final validation | ✅ YES | ~10s |

**Key Feature:** Tests **MUST pass** before deployment is allowed.

### 2. CD Workflow (`deploy.yml`)

**Triggers:**
- After CI workflow completes successfully
- Push to `main` or `staging` branches

**Jobs:**

| Job | Description | What It Does |
|-----|-------------|--------------|
| **Check CI Status** | Verify CI passed | Determines if deployment should proceed |
| **Pre-deployment** | Validate configs | Checks railway.json, requirements.txt, etc. |
| **Deploy to Railway** | Trigger deployment | Railway auto-deploys via GitHub integration |
| **Post-deployment** | Health checks | Verifies deployment succeeded |
| **Notify** | Status notification | Reports success/failure |

**Environment Mapping:**
- `main` branch → Production environment
- `staging` branch → Staging environment

### 3. Manual Deployment (`deploy-manual.yml`)

**Triggers:**
- Manual trigger from GitHub Actions UI

**Options:**
- Choose environment (staging or production)
- Skip tests (not recommended for production)

**Use Cases:**
- Hotfixes
- Rollbacks
- Off-hours deployments
- Controlled production deploys

---

## Railway Integration

### How Railway Deploys:

Railway has **automatic GitHub integration**:

1. **You push to GitHub** → Railway detects the push
2. **CI runs and passes** → Railway sees the green checkmark
3. **Railway builds** → Using `nixpacks.toml` and `railway.json`
4. **Railway deploys** → Using config from `railway.toml`

### Railway Configuration Files:

**`railway.json`** - Deployment config:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn src.main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**`railway.toml`** - Service config:
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn src.main:app --host 0.0.0.0 --port $PORT"
```

**`nixpacks.toml`** - Build system config
**`start.sh`** - Startup script

---

## Setup Instructions

### 1. Initial Setup (One-time)

```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Set up pre-commit hooks
pre-commit install

# Test pre-commit works
pre-commit run --all-files
```

### 2. Configure GitHub Secrets (Optional but recommended)

Go to: **GitHub → Repo → Settings → Secrets and variables → Actions**

Add these secrets:

**For Health Checks:**
```
PRODUCTION_URL=https://api.gatewayz.ai
STAGING_URL=https://staging-api.gatewayz.ai
```

**For Tests (optional):**
```
SUPABASE_URL_TEST=https://your-test-project.supabase.co
SUPABASE_KEY_TEST=your-test-key
OPENROUTER_API_KEY_TEST=sk-or-test-...
PORTKEY_API_KEY_TEST=test-key
```

**For Railway CLI (if using explicit deploy):**
```
RAILWAY_TOKEN=your-railway-token
```

### 3. Configure Branch Protection

**GitHub → Repo → Settings → Branches → Add rule**

**For `main` branch:**
- Branch name pattern: `main`
- ☑️ Require pull request before merging
- ☑️ Require approvals: 1
- ☑️ Require status checks to pass:
  - `Code Quality Checks`
  - `Run Tests`
  - `Build Verification`
  - `Deployment Ready`
- ☑️ Require branches to be up to date
- ☑️ Do not allow bypassing

**For `staging` branch:**
- Same as above, but can have 0 approvals for solo dev

### 4. Configure Railway Projects

**Staging:**
- Project: `gatewayz-backend-staging`
- Branch: `staging`
- Environment variables: `APP_ENV=staging`, staging API keys

**Production:**
- Project: `gatewayz-backend-production`
- Branch: `main`
- Environment variables: `APP_ENV=production`, production API keys

---

## Usage Guide

### Standard Development Workflow

```bash
# 1. Create feature branch from staging
git checkout staging
git pull origin staging
git checkout -b feature/awesome-feature

# 2. Make changes
# ... code code code ...

# 3. Commit (pre-commit hooks run automatically)
git add .
git commit -m "Add awesome feature"
# ✅ Pre-commit: formatting, linting, security

# 4. Push to GitHub
git push origin feature/awesome-feature

# 5. Create PR on GitHub
# Base: staging ← Compare: feature/awesome-feature

# 6. CI runs automatically
# ✅ GitHub Actions runs all checks
# ✅ Can't merge until all checks pass

# 7. Merge PR when CI passes ✅
# Click "Merge pull request"

# 8. CD deploys to staging automatically
# ✅ Railway deploys to staging environment
# ✅ Health check runs
# 🎉 Live on staging!

# 9. Test on staging
# Verify everything works

# 10. Deploy to production
git checkout main
git pull origin main
git merge staging
git push origin main

# 11. CI + CD run for production
# ✅ All checks pass
# ✅ Railway deploys to production
# 🚀 Live!
```

### Manual Deployment (When Needed)

**Via GitHub UI:**

1. Go to **GitHub → Actions → Manual Deploy to Railway**
2. Click **"Run workflow"**
3. Choose:
   - **Environment:** staging or production
   - **Skip tests:** false (recommended)
4. Click **"Run workflow"**
5. Monitor the deployment

**Use cases for manual deploy:**
- Hotfix that can't wait for PR process
- Rollback to previous version
- Deploy at specific time (e.g., off-hours)
- Emergency production fix

### Monitoring Deployments

**GitHub Actions:**
```
https://github.com/YOUR_ORG/gatewayz-backend/actions
```

**Railway Dashboard:**
```
https://railway.app/project/YOUR_PROJECT
```

**View Logs:**
- GitHub Actions: Click on workflow run → Job → Step
- Railway: Dashboard → Deployments → View Logs

---

## Health Checks

The CD workflow performs automatic health checks after deployment.

### How Health Checks Work:

1. **Wait 2 minutes** for Railway deployment
2. **HTTP GET** to `/health` endpoint
3. **Retry 5 times** with 30s intervals
4. **Expect HTTP 200**
5. **Report success or failure**

### Health Check URLs:

Set these as GitHub secrets:
- `PRODUCTION_URL` = `https://api.gatewayz.ai`
- `STAGING_URL` = `https://staging-api.gatewayz.ai`

### If Health Check Fails:

1. Check Railway deployment logs
2. Check application logs
3. Verify environment variables
4. Test health endpoint manually:
   ```bash
   curl https://api.gatewayz.ai/health
   ```
5. Rollback if necessary

---

## Rollback Procedures

### Method 1: Via Railway Dashboard

1. Go to Railway Dashboard
2. Navigate to **Deployments**
3. Find last working deployment
4. Click **"Redeploy"**
5. Wait for redeployment (~2 minutes)

### Method 2: Git Revert

```bash
# Revert last commit
git revert HEAD
git push

# Or revert specific commit
git revert <commit-sha>
git push

# CI + CD will run and deploy the reverted code
```

### Method 3: Manual Deployment

1. GitHub Actions → **Manual Deploy to Railway**
2. Select environment
3. The workflow will deploy current HEAD
4. Or: checkout previous commit and deploy

---

## Troubleshooting

### CI Fails on GitHub

**Check logs:**
1. GitHub → Actions → Failed workflow
2. Click on the red ❌ job
3. Expand failed steps
4. Read error messages

**Common issues:**
- **Tests fail:** Fix test locally, commit, push
- **Linting fails:** Run `black src/` and `ruff check src/ --fix`
- **Import fails:** Check `requirements.txt` has all dependencies
- **Python version:** Ensure using Python 3.12

### Deployment Fails

**Check Railway logs:**
1. Railway Dashboard → Deployments → Failed deployment
2. Click **"View Logs"**
3. Look for errors

**Common issues:**
- **Build fails:** Check `requirements.txt`, `railway.json`
- **Start fails:** Check `start.sh`, environment variables
- **Crash loop:** Check application logs, database connection

### Health Check Fails

**Debug steps:**
1. Test endpoint manually:
   ```bash
   curl https://your-deployment.railway.app/health
   ```
2. Check if app is running in Railway
3. Verify environment variables
4. Check application logs
5. May need to increase wait time in workflow

---

## Performance Optimization

### Speed up CI:

**Current optimizations:**
- ✅ Parallel jobs
- ✅ Dependency caching
- ✅ Fail-fast on tests

**Additional optimizations:**
```yaml
# Run tests in parallel (requires pytest-xdist)
pytest tests/ -n auto

# Run only affected tests
pytest tests/unit/  # Fast tests first
```

### Speed up deployment:

- Use Railway's build cache (automatic)
- Minimize dependencies in `requirements.txt`
- Use smaller base image (nixpacks handles this)

---

## Best Practices

### ✅ DO:

- Always wait for CI to pass before merging
- Test in staging before production
- Use meaningful commit messages
- Keep PRs small and focused
- Review CI logs when builds fail
- Use branch protection rules
- Run pre-commit hooks locally
- Monitor deployment health checks

### ❌ DON'T:

- Skip CI checks (--no-verify)
- Merge failing PRs
- Deploy directly to production without staging
- Ignore security warnings
- Commit secrets or API keys
- Force push to protected branches
- Skip tests for "small changes"
- Deploy without monitoring

---

## Summary

You now have a **complete, production-grade CI/CD pipeline**:

✅ **CI (Continuous Integration)**
- Automated testing
- Code quality checks
- Security scanning
- Build verification

✅ **CD (Continuous Deployment)**
- Automatic deployment to Railway
- Environment-based routing
- Health checks
- Deployment notifications

✅ **Safety**
- Branch protection rules
- Tests must pass before deploy
- Rollback procedures
- Manual deployment option

✅ **Visibility**
- GitHub Actions logs
- Railway deployment logs
- Health check reports
- PR status checks

Your code is now automatically tested, validated, and deployed safely! 🚀
