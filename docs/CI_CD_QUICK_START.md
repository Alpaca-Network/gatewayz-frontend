# CI/CD Quick Start

Get your CI/CD pipeline up and running in 5 minutes.

## 1. Install & Setup (One-time)

```bash
# Run the automated setup script
./scripts/utilities/setup-ci.sh

# Or manually:
pip install -r requirements-dev.txt
pre-commit install
```

## 2. Configure GitHub Branch Protection

### For `main` branch:
1. GitHub → Repo → Settings → Branches → Add Rule
2. Branch name: `main`
3. Check:
   - ☑️ Require pull request before merging
   - ☑️ Require status checks: `Code Quality Checks`, `Run Tests`
   - ☑️ Require branches to be up to date
4. Save

### For `staging` branch:
- Same as above, but pattern: `staging`

## 3. Daily Usage

### Your code is now automatically checked! 🎉

**When you commit:**
```bash
git commit -m "Add feature"
# ✅ Pre-commit hooks run automatically
# ✅ Code is formatted
# ✅ Linting checks pass
# ✅ Security scan runs
```

**When you push:**
```bash
git push origin feature/my-feature
# ✅ GitHub Actions CI runs
# ✅ All tests execute
# ✅ Build verification
# ✅ PR gets status checks
```

**When you merge to staging/main:**
```bash
# After PR merge:
# ✅ CI runs again
# ✅ Railway auto-deploys (if CI passes)
# 🚀 Your code is live!
```

## 4. CI/CD Pipeline Overview

```
Local Development
    ↓
Pre-commit Hooks (formatting, linting, security)
    ↓
Git Push
    ↓
GitHub Actions CI
  ├─ Code Quality ✅
  ├─ Security Scan ✅
  ├─ Tests ✅
  └─ Build Check ✅
    ↓
Railway Auto-Deploy
  ├─ staging branch → Staging env
  └─ main branch → Production env
```

## 5. Common Commands

```bash
# Run all pre-commit checks manually
pre-commit run --all-files

# Run tests
pytest tests/

# Run tests with coverage
pytest tests/ --cov=src

# Format code
black src/
isort src/

# Lint code
ruff check src/ --fix

# Security scan
bandit -r src/
```

## 6. What Gets Checked?

### Pre-commit (Local):
- Code formatting (Black)
- Import sorting (isort)
- Linting (Ruff)
- Security issues (Bandit)
- Large files, secrets, etc.

### GitHub Actions (CI):
- All of the above, plus:
- Unit & integration tests
- Type checking
- Dependency vulnerabilities
- Build verification

## 7. Branch Protection Rules

| Branch | Direct Push | PR Required | CI Required | Auto-Deploy |
|--------|------------|-------------|-------------|-------------|
| `main` | ❌ Blocked | ✅ Yes | ✅ Yes | ✅ Production |
| `staging` | ❌ Blocked | ✅ Yes | ✅ Yes | ✅ Staging |
| `feature/*` | ✅ Allowed | ❌ No | ⚠️ Runs | ❌ No |

## 8. Troubleshooting

**Pre-commit fails?**
```bash
# See what failed
pre-commit run --all-files

# Auto-fix most issues
black src/
isort src/
ruff check src/ --fix

# Commit again
git add .
git commit -m "Fix linting issues"
```

**CI fails on GitHub?**
1. Check Actions tab for error logs
2. Fix the issue locally
3. Push again

**Need to skip hooks temporarily?**
```bash
# NOT RECOMMENDED - only for emergencies
git commit --no-verify -m "Hotfix"
```

## 9. Next Steps

✅ You're all set! Your CI/CD pipeline is ready.

**To deploy to staging:**
1. Create feature branch
2. Make changes
3. Push & create PR to `staging`
4. CI runs automatically
5. Merge → Railway deploys to staging

**To deploy to production:**
1. Test on staging
2. Create PR from `staging` to `main`
3. CI runs automatically
4. Merge → Railway deploys to production

## 10. Learn More

- **Full Guide:** `docs/CI_CD_SETUP.md`
- **Deployment Guide:** `docs/RAILWAY_STAGING_SETUP.md`
- **Quick Reference:** `docs/DEPLOYMENT_QUICK_REFERENCE.md`

---

**Questions?** Check the full documentation or GitHub Actions logs for details.
