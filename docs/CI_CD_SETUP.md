# CI/CD Pipeline Setup Guide

Complete guide for the Continuous Integration and Deployment pipeline.

## Overview

Your CI/CD pipeline consists of:
1. **Pre-commit hooks** - Run locally before each commit
2. **GitHub Actions** - Run on every push/PR to GitHub
3. **Railway deployment** - Auto-deploy after CI passes

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Developer Workflow                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Pre-commit Hooks (Local)                                │
│     ├─ Code formatting (Black)                              │
│     ├─ Import sorting (isort)                               │
│     ├─ Linting (Ruff)                                       │
│     ├─ Security scan (Bandit)                               │
│     └─ File checks (trailing spaces, large files, etc)      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ git push
┌─────────────────────────────────────────────────────────────┐
│  2. GitHub Actions CI (Automated)                           │
│     ├─ Code Quality (Ruff, Black, isort)                    │
│     ├─ Security Scan (Bandit, Safety)                       │
│     ├─ Tests (pytest)                                       │
│     ├─ Build Verification                                   │
│     └─ Deployment Check                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ CI Passes ✅
┌─────────────────────────────────────────────────────────────┐
│  3. Railway Auto-Deploy                                     │
│     ├─ Staging (staging branch)                             │
│     └─ Production (main branch)                             │
└─────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### Step 1: Install Development Dependencies

```bash
cd /Users/arminrad/Desktop/Alpaca-Network/Gatewayz/gatewayz-backend

# Install all development tools
pip install -r requirements-dev.txt
```

### Step 2: Set Up Pre-commit Hooks

Pre-commit hooks run automatically before each commit to catch issues early.

```bash
# Install pre-commit hooks
pre-commit install

# Test it works (run on all files)
pre-commit run --all-files

# Hooks will now run automatically on 'git commit'
```

**What pre-commit checks:**
- ✅ Code formatting (Black)
- ✅ Import sorting (isort)
- ✅ Linting (Ruff)
- ✅ Security issues (Bandit)
- ✅ File issues (large files, secrets, trailing spaces)
- ✅ Dependency vulnerabilities (Safety)

### Step 3: Configure GitHub Branch Protection

**For Production (main branch):**

1. Go to GitHub → Your Repo → Settings → Branches
2. Click "Add branch protection rule"
3. Branch name pattern: `main`
4. Configure:
   - ☑️ Require a pull request before merging
   - ☑️ Require approvals: 1
   - ☑️ Require status checks to pass before merging
   - ☑️ Require branches to be up to date before merging
   - Select required checks:
     - `Code Quality Checks`
     - `Security Scan`
     - `Run Tests`
     - `Build Verification`
   - ☑️ Do not allow bypassing the above settings
5. Click "Create"

**For Staging (staging branch):**

1. Add another branch protection rule
2. Branch name pattern: `staging`
3. Same settings as main, but can be less strict:
   - Require 0 approvals (for solo dev)
   - Still require CI checks to pass

### Step 4: Add GitHub Secrets (Optional)

For running tests with real API keys in CI:

1. GitHub → Your Repo → Settings → Secrets and variables → Actions
2. Add secrets:
   - `SUPABASE_URL_TEST` - Staging Supabase URL
   - `SUPABASE_KEY_TEST` - Staging Supabase key
   - `OPENROUTER_API_KEY_TEST` - Test API key
   - `PORTKEY_API_KEY_TEST` - Test API key

**Note:** Tests will run with mock values if secrets aren't set.

### Step 5: Verify CI is Working

```bash
# Create a test branch
git checkout -b test/ci-pipeline

# Make a small change
echo "# Testing CI" >> README.md

# Commit (pre-commit hooks will run)
git add README.md
git commit -m "Test CI pipeline"

# Push to GitHub
git push origin test/ci-pipeline

# Check GitHub Actions:
# 1. Go to GitHub → Your Repo → Actions
# 2. You should see the CI workflow running
# 3. All jobs should pass ✅
```

## Using the CI/CD Pipeline

### Daily Development Workflow

```bash
# 1. Create feature branch
git checkout staging
git pull origin staging
git checkout -b feature/awesome-feature

# 2. Write code...
# ... code code code ...

# 3. Run tests locally
pytest tests/

# 4. Commit (pre-commit hooks run automatically)
git add .
git commit -m "Add awesome feature"

# 5. Push to GitHub
git push origin feature/awesome-feature

# 6. Create Pull Request
# GitHub → Compare & pull request
# Base: staging ← Compare: feature/awesome-feature

# 7. Wait for CI to pass ✅
# GitHub Actions will run automatically
# You'll see checks on your PR

# 8. Merge when CI passes
# Click "Merge pull request" (only enabled if CI passes)

# 9. Railway auto-deploys to staging
# Wait a few minutes, test on staging

# 10. If staging looks good, merge to production
git checkout main
git pull origin main
git merge staging
git push origin main

# 11. Railway auto-deploys to production
```

### Running Checks Manually

```bash
# Run pre-commit hooks on all files
pre-commit run --all-files

# Run specific checks
ruff check src/
black --check src/
isort --check-only src/
bandit -r src/

# Run tests
pytest tests/ -v

# Run tests with coverage
pytest tests/ --cov=src --cov-report=html

# Security check
safety check

# Format code (auto-fix)
black src/
isort src/
ruff check src/ --fix
```

## CI/CD Jobs Explained

### 1. Code Quality Checks (`lint` job)
- **Runs:** Ruff, Black, isort
- **Purpose:** Ensure code follows style guidelines
- **Can fail:** Yes (but with continue-on-error for some)
- **Time:** ~30 seconds

### 2. Security Scan (`security` job)
- **Runs:** Bandit, Safety
- **Purpose:** Find security vulnerabilities
- **Can fail:** Yes
- **Time:** ~45 seconds

### 3. Run Tests (`test` job)
- **Runs:** pytest on all tests
- **Purpose:** Verify functionality
- **Can fail:** Yes - MUST pass!
- **Time:** 1-3 minutes

### 4. Build Verification (`build` job)
- **Runs:** Import checks, config verification
- **Purpose:** Ensure app can start
- **Can fail:** Yes
- **Time:** ~30 seconds

### 5. Deployment Check (`deployment-check` job)
- **Runs:** Final verification
- **Purpose:** Confirm all checks passed
- **Can fail:** Only if previous jobs failed
- **Time:** ~10 seconds

## Troubleshooting

### Pre-commit hooks failing?

```bash
# Skip hooks temporarily (not recommended!)
git commit --no-verify -m "Message"

# Fix issues and retry
pre-commit run --all-files

# Update hooks
pre-commit autoupdate
```

### CI failing on GitHub but passing locally?

1. **Check Python version:**
   - CI uses Python 3.12
   - Match locally: `python --version`

2. **Check dependencies:**
   - CI installs from `requirements.txt`
   - Ensure it's up to date

3. **Check environment variables:**
   - CI uses mock values unless secrets are set
   - Add secrets in GitHub settings if needed

### Tests pass locally but fail in CI?

```bash
# Clean environment test
python -m venv test-venv
source test-venv/bin/activate  # or `test-venv\Scripts\activate` on Windows
pip install -r requirements.txt
pytest tests/
deactivate
rm -rf test-venv
```

### CI is too slow?

Current optimizations:
- ✅ Parallel jobs
- ✅ Dependency caching
- ✅ Matrix strategy for tests

Additional optimizations:
- Reduce test coverage
- Use `pytest -x` to fail fast
- Skip slow tests in PR checks

## Branch Protection Summary

| Branch | Require PR | Approvals | CI Required | Allow Force Push |
|--------|-----------|-----------|-------------|------------------|
| `main` | ✅ Yes | 1 | ✅ Yes | ❌ No |
| `staging` | ✅ Yes | 0-1 | ✅ Yes | ❌ No |
| `feature/*` | ❌ No | - | ⚠️ Recommended | ✅ Yes |

## What Happens on Each Push?

### Push to Feature Branch
1. ✅ Pre-commit hooks run locally
2. ✅ GitHub Actions CI runs
3. ⏸️ No deployment (feature branches don't auto-deploy)
4. ✅ Create PR to merge into staging

### Push to Staging Branch
1. ✅ Pre-commit hooks run locally
2. ✅ GitHub Actions CI runs
3. ✅ If CI passes → Railway deploys to staging
4. ✅ Test on staging environment

### Push to Main Branch
1. ✅ Pre-commit hooks run locally
2. ✅ GitHub Actions CI runs
3. ✅ If CI passes → Railway deploys to production
4. ✅ Monitor production

## Best Practices

### DO ✅
- Run tests locally before pushing
- Keep commits small and focused
- Write meaningful commit messages
- Wait for CI to pass before merging
- Review CI logs when builds fail
- Update dependencies regularly

### DON'T ❌
- Skip pre-commit hooks (--no-verify)
- Push directly to main/staging
- Merge PRs with failing CI
- Ignore security warnings
- Commit secrets or API keys
- Force push to protected branches

## Performance Tips

### Speed up local development:
```bash
# Run only affected tests
pytest tests/integration/test_auth.py

# Run with specific markers
pytest -m unit  # Fast unit tests only
pytest -m "not slow"  # Skip slow tests

# Parallel test execution
pytest -n auto  # Requires pytest-xdist
```

### Speed up CI:
- Use matrix strategy for parallel tests
- Cache dependencies (already configured)
- Skip non-critical checks for draft PRs
- Use GitHub Actions concurrency groups

## Monitoring CI/CD

### GitHub Actions Dashboard
- **URL:** `https://github.com/YOUR_ORG/gatewayz-backend/actions`
- **View:** All workflow runs, logs, artifacts
- **Notifications:** Email on failure (configure in GitHub settings)

### Railway Deployments
- **URL:** `https://railway.app/project/YOUR_PROJECT`
- **View:** Deployment logs, build times, errors
- **Rollback:** Click on previous successful deployment

## Summary

You now have a complete CI/CD pipeline:

✅ **Local:** Pre-commit hooks catch issues before commit
✅ **GitHub:** Actions verify code quality, security, and tests
✅ **Railway:** Auto-deploys after CI passes
✅ **Protected:** Branch rules prevent bad code from reaching production

Your code is now automatically tested and validated before it reaches users! 🚀
