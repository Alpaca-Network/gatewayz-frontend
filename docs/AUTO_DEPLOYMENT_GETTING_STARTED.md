# Automatic Container Deployment - Getting Started

## The Big Picture

You now have **automatic deployment** set up. When you merge a PR to `main` or `staging`:

```
Merge PR → All tests pass? → Deploy to Railway → Health check → Done ✅
```

No manual commands needed. It's all automatic.

## 5-Minute Setup

### 1. Get Railway Token

Visit: https://railway.app → Account Settings → Tokens

Create a new token and copy it (starts with `rwy_`).

### 2. Run Setup Script

```bash
bash scripts/setup-auto-deploy.sh
```

The script will ask for:
- Railway token (paste the one you just copied)
- Railway Project ID (from your project dashboard)
- Railway domain (where your app runs, like `api.railway.app`)

### 3. Done!

That's it. Your deployment is now configured.

## Test It Out

1. Create a small test PR
2. Make a minor code change
3. Merge to `staging` branch
4. Watch it deploy automatically:
   - Go to **Actions** tab
   - Click **"Auto Deploy to Railway"**
   - Watch the workflow run
   - In ~10 minutes, your code is live

## What Happens Automatically

### When You Merge

```
1. CI checks run (3-5 min)
   ✓ Code quality checks (Ruff, Black)
   ✓ Security scans (Bandit)
   ✓ Tests (parallel, 4 shards)
   ✓ Build verification

2. If all pass → Deploy starts
   ✓ Builds container
   ✓ Starts service
   ✓ Runs health check

3. If healthy → Done!
   ✓ PR gets comment with status
   ✓ Deployment lives at your domain

Total time: ~7-10 minutes from merge to live
```

### Continuous Monitoring

After deployment, the system automatically:
- Checks health every 15 minutes
- Creates GitHub issues if something breaks
- You get notified if there are problems

## Daily Workflow

### Normal Development

```bash
# Work on feature
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "Add my feature"
git push origin feature/my-feature

# Open PR on GitHub
# Get code review ✓
# Merge PR to main/staging

# Deployment happens automatically!
# Check: Actions tab → Auto Deploy to Railway
```

### If Something Breaks

```bash
# Option 1: Via Railway Dashboard (fastest, 2 min)
1. Go to https://railway.app
2. Click your project → Deployments
3. Select previous version → Redeploy

# Option 2: Via Git (safer, 10 min)
git revert HEAD
git push origin main
# Auto-deployment triggers again with previous version
```

## Files You Got

### Workflows

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | Auto-deploys when PR merges |
| `.github/workflows/monitor-deployment.yml` | Checks health every 15 min |

### Setup & Docs

| File | Purpose |
|------|---------|
| `scripts/setup-auto-deploy.sh` | Interactive setup script |
| `docs/AUTO_DEPLOY_QUICKSTART.md` | 5-min quick reference |
| `docs/AUTO_DEPLOYMENT_SETUP.md` | Complete setup guide |
| `docs/AUTO_DEPLOYMENT_ARCHITECTURE.md` | Technical deep-dive |
| `docs/AUTO_DEPLOYMENT_SUMMARY.md` | This summary |

## Common Questions

### Q: How long does deployment take?
**A:** ~7-10 minutes total:
- CI checks: 3-5 min
- Build: 1-2 min
- Startup: 1-2 min

### Q: What if tests fail?
**A:** Deployment stops and doesn't proceed. Fix the code and merge again.

### Q: Can I deploy without merging?
**A:** Yes! Go to Actions → Auto Deploy to Railway → Run workflow. Select environment and click "Run".

### Q: What if I need to rollback?
**A:** Via Railway dashboard: Deployments → select previous → Redeploy (~2 min).

### Q: Where do I check status?
**A:**
- **GitHub**: Actions tab → Auto Deploy to Railway → latest run
- **Railway**: https://railway.app → Your project → Deployments
- **Health**: Actions tab → Monitor Deployment Health

### Q: How do I know if it failed?
**A:**
- You'll see red X in Actions tab
- A comment on the PR if merged
- GitHub issues created with `deployment-alert` label

### Q: Can I disable it?
**A:** Yes, disable the workflow in the Actions tab (not recommended).

## Manual Deployment

To deploy without merging a PR:

1. Go to GitHub → **Actions** tab
2. Click **"Auto Deploy to Railway"**
3. Click **"Run workflow"** button (top right)
4. Select environment: `production` or `staging`
5. Click **"Run workflow"**

Done! Deployment starts immediately.

## Environment Variables

Your Railway environment needs these configured (set in Railway dashboard):

```
ENVIRONMENT=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-key
OPENROUTER_API_KEY=your-key
PORTKEY_API_KEY=your-key
# ... other provider keys from config.py
```

Add these in Railway:
1. Project → Environment (Production or Staging)
2. Variables tab
3. Add each variable

## Monitoring Your Deployments

### View Deployment Logs

**GitHub Actions**:
```bash
# List recent deployments
gh run list --workflow=deploy.yml --limit 5

# View full logs
gh run view $(gh run list --workflow=deploy.yml --limit 1 -q | head -1) --log
```

**Railway**:
- https://railway.app → Project → Service → Logs

### Check Health Status

```bash
# Direct health check
curl https://your-domain.railway.app/health

# Should respond with:
# {"status": "healthy"}
```

### View Issue Reports

Health check issues appear in GitHub Issues with `deployment-alert` label:
- Repository → Issues → Filter by label: `deployment-alert`

## Deployment Environments

### Production (main branch)
- Auto-deploys when PR merges to `main`
- Health checked every 15 minutes
- Issues created on failures
- Use production secrets/database

### Staging (staging branch)
- Auto-deploys when PR merges to `staging`
- Great for testing before production
- Use staging/test secrets/database

## Security

### Secrets Configuration

Three secrets needed in GitHub (set by setup script):

```
RAILWAY_TOKEN      → Do NOT commit, rotate every 90 days
RAILWAY_PROJECT_ID → Safe to commit (just a UUID)
RAILWAY_DOMAIN     → Safe to commit (domain name)
```

### Branch Protection (Recommended)

Set up branch protection to prevent mistakes:

1. Settings → Branches → Add rule
2. Pattern: `main`
3. ✓ Require status checks to pass
4. ✓ Require code reviews: 1

This ensures:
- Only tested code gets deployed
- Someone reviews before deploying
- Can't accidentally push bad code

## Troubleshooting

### Nothing's deploying?

1. Check if workflow exists:
   ```bash
   ls .github/workflows/deploy.yml
   ```

2. Check if secrets are configured:
   ```bash
   gh secret list
   ```

3. Check if you're pushing to main/staging:
   ```bash
   git branch -v
   ```

### Deployment fails?

1. **View logs**:
   - Actions → Auto Deploy to Railway → Latest run → Logs

2. **Check Railway**:
   - https://railway.app → Service → Logs
   - Look for startup errors

3. **Check env vars**:
   - Railway dashboard → Environment tab
   - Verify all required variables are set

### Health check fails?

1. Test the endpoint:
   ```bash
   curl -v https://your-domain.railway.app/health
   ```

2. Check app is listening on $PORT:
   - App must use environment variable, not hardcoded port
   - Check your `start.sh` or `Dockerfile`

3. Check logs for errors:
   - Railway dashboard → Service → Logs

## Next Steps

1. ✅ Run setup script: `bash scripts/setup-auto-deploy.sh`
2. ✅ Verify secrets: `gh secret list`
3. ✅ Create test PR and merge to staging
4. ✅ Watch it deploy in Actions tab
5. ✅ Check domain is live
6. ✅ (Optional) Set branch protection rules

## Quick Links

- **Railway Dashboard**: https://railway.app
- **GitHub Actions**: https://github.com/Alpaca-Network/gatewayz-backend/actions
- **Documentation**: See `docs/` directory

## Still Have Questions?

Read the detailed docs:
- Quick reference: `docs/AUTO_DEPLOY_QUICKSTART.md`
- Full setup: `docs/AUTO_DEPLOYMENT_SETUP.md`
- Technical details: `docs/AUTO_DEPLOYMENT_ARCHITECTURE.md`

---

## Key Points to Remember

✅ **Automatic** - No manual deployment commands needed
✅ **Safe** - Only deploys if tests pass
✅ **Fast** - ~7-10 minutes from merge to live
✅ **Monitored** - Health checks every 15 minutes
✅ **Reversible** - Can rollback anytime
✅ **Documented** - Comprehensive guides included

You're all set! 🚀

Questions? Check the docs or view workflow logs in the Actions tab.
