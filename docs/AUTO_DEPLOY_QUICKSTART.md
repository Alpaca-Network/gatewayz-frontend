# Auto-Deployment Quick Start

Get automatic deployments running in 5 minutes.

## Minimal Setup (3 Steps)

### 1. Get Railway Token
- Visit https://railway.app → Account Settings → Tokens
- Create new token → Copy it

### 2. Run Setup Script
```bash
bash scripts/setup-auto-deploy.sh
```
- Paste Railway token when prompted
- Enter Project ID (from Railway dashboard)
- Enter domain (e.g., `api.railway.app`)

### 3. That's It!
From now on, when you merge a PR to `main` or `staging`:
1. ✅ CI checks run
2. ✅ Tests pass
3. ✅ Container deploys to Railway
4. ✅ Health check confirms it's live

## What Happens During Deployment

```
1. You merge PR to main/staging
          ↓
2. GitHub Actions runs CI tests
          ↓
3. If all pass, Railway builds container
          ↓
4. Container starts and runs health check
          ↓
5. Comment posted on PR with deployment status
```

## Manual Deployment

If you need to deploy without merging a PR:

1. Go to **Actions** → **Auto Deploy to Railway**
2. Click **Run workflow** (top right)
3. Select environment (production/staging)
4. Click **Run workflow**

## Verify It's Working

### Check Recent Deployments
```bash
# View workflow runs
gh run list --workflow=deploy.yml --limit 5

# View logs of latest run
gh run view $(gh run list --workflow=deploy.yml --limit 1 -q | head -1)
```

### Check Railway
- https://railway.app → Your Project → Deployments
- See list of recent deployments with timestamps

### Manual Health Check
```bash
curl https://your-domain.railway.app/health
# Should return: {"status": "healthy"}
```

## GitHub Secrets Set

Verify in Repository Settings → Secrets:
- ✅ RAILWAY_TOKEN
- ✅ RAILWAY_PROJECT_ID
- ✅ RAILWAY_DOMAIN

## Troubleshooting

### Nothing deploying?
1. Check that secrets are set: `gh secret list`
2. View workflow logs: **Actions** → **Auto Deploy to Railway**
3. Look for error messages in the logs

### Deployment fails?
1. Check Railway logs: https://railway.app → Deployments → View Logs
2. Verify environment variables in Railway
3. Ensure health endpoint works: `curl https://your-domain/health`

### Tests failing?
1. Fix code to pass local tests
2. Merge to staging first to debug
3. Check GitHub Actions logs

## Monitoring

### Health Checks (Every 15 Minutes)
The system automatically checks if your app is healthy. If it fails:
- ✅ Issue is created automatically
- ✅ You'll be notified
- ✅ Check GitHub Issues → deployments-alert label

### View Monitoring Logs
**Actions** → **Monitor Deployment Health** → Latest run

## Rollback

If something breaks after deployment:

```bash
# Quick rollback via Railway CLI
railway up --detach  # Redeploy latest

# Or go to Railway Dashboard:
# Deployments → Previous version → Redeploy
```

## Optional: Branch Protection

For safety, require code review before merge:

1. Settings → Branches → Add rule
2. Pattern: `main`
3. ✅ Require status checks to pass
4. ✅ Require 1 approval before merge

This ensures only reviewed code gets deployed.

## Environment Variables

Your app needs these in Railway. Set them in:
Railway Dashboard → Project → Environment → Production/Staging

Required:
```
SUPABASE_URL=...
SUPABASE_KEY=...
OPENROUTER_API_KEY=...
ENCRYPTION_KEY=...
```

See `docs/RAILWAY_DEPLOYMENT.md` for full list.

## FAQ

**Q: How long does deployment take?**
A: ~7-10 minutes (CI + build + startup)

**Q: Can I deploy without merging?**
A: Yes, use workflow_dispatch (see "Manual Deployment" above)

**Q: What if I want different settings for staging vs production?**
A: Set different environment variables in each Railway environment

**Q: Where are deployment logs?**
A:
- GitHub Actions: Actions tab
- Railway: Dashboard → Service → Logs

**Q: Can I disable auto-deploy?**
A: Temporarily disable workflow in Actions tab, or delete `deploy.yml`

## Next Steps

1. ✅ Run `bash scripts/setup-auto-deploy.sh`
2. ✅ Verify secrets with `gh secret list`
3. ✅ Test with a PR merge to staging
4. ✅ Check deployment in Railway dashboard
5. ✅ Set up branch protection (optional)

## Full Documentation

- **Detailed setup**: `docs/AUTO_DEPLOYMENT_SETUP.md`
- **Railway guide**: `docs/RAILWAY_DEPLOYMENT.md`
- **Error monitoring**: `docs/RAILWAY_ERROR_MONITORING_WORKFLOW.md`

---

Need help? Check GitHub Actions logs or read the full deployment guide.
