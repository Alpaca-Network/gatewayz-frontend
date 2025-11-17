# Automatic Container Deployment on PR Merge

This guide explains how to configure automatic deployment of new containers to Railway when PRs are merged to `main` or `staging` branches.

## Overview

The system includes two GitHub Actions workflows:

1. **`deploy.yml`** - Automatically deploys when PRs are merged
2. **`monitor-deployment.yml`** - Monitors deployment health

### Deployment Flow

```
PR Merged to main/staging
         ↓
    CI Pipeline Runs
    (lint, test, build)
         ↓
   All Checks Pass?
         ↓ Yes
  Verify CI Complete
         ↓
Deploy to Railway
         ↓
Health Check (5 min)
         ↓
Comment on PR with status
```

## Configuration

### Step 1: Get Railway CLI Token

1. Go to [Railway Dashboard](https://railway.app)
2. Navigate to **Account Settings** → **Tokens**
3. Create a new token with appropriate permissions
4. Copy the token (starts with `rwy_`)

### Step 2: Get Project ID

1. In Railway Dashboard, open your project
2. The Project ID is shown in the top-left corner
3. Or find it in the project URL: `https://railway.app/project/{PROJECT_ID}`

### Step 3: Set GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to **Repository Settings** → **Secrets and variables** → **Actions**

2. Add new secrets:

   ```
   RAILWAY_TOKEN
   Value: rwy_... (from Step 1)

   RAILWAY_PROJECT_ID
   Value: (from Step 2)

   RAILWAY_DOMAIN
   Value: your-domain.railway.app (or custom domain)
   ```

3. Optional - For deployment environments:

   ```
   STAGING_RAILWAY_DOMAIN
   Value: staging-your-domain.railway.app
   ```

### Step 4: Configure Branch Protection Rules

1. Go to **Repository Settings** → **Branches**
2. Click **Add rule** under Branch protection rules
3. For `main` branch:
   - Pattern: `main`
   - Require status checks to pass before merging (select all CI checks)
   - Require code reviews: 1 (recommended)
   - Allow auto-merge

4. For `staging` branch:
   - Pattern: `staging`
   - Require status checks to pass
   - Allow auto-merge (optional)

## How It Works

### Automatic Deployment

When you merge a PR to `main` or `staging`:

1. **CI Pipeline Runs**
   - Code quality checks (linting, formatting)
   - Security scans
   - Unit & integration tests
   - Build verification

2. **Deploy Job Waits for CI**
   - Polls GitHub for CI completion
   - Verifies all checks passed
   - Proceeds only if successful

3. **Railway Deployment**
   - Authenticates with Railway via token
   - Deploys to appropriate environment
   - Waits for container startup
   - Performs health check

4. **Notification**
   - Comments on merged PR with deployment status
   - Includes domain and commit info
   - Reports any failures

### Health Monitoring

The `monitor-deployment.yml` workflow:

- Runs every 15 minutes (configurable)
- Checks `/health` endpoint on production
- Creates GitHub issues if unhealthy
- Can be manually triggered

## Triggering Manual Deployments

To manually deploy without merging a PR:

1. Go to **Actions** → **Auto Deploy to Railway**
2. Click **Run workflow**
3. Select environment: `production` or `staging`
4. Click **Run workflow**

## Deployment Environments

### Production (main branch)

- Auto-deploys on merge to `main`
- Requires all CI checks to pass
- Health checks every 15 minutes
- Issues created on health failures

### Staging (staging branch)

- Auto-deploys on merge to `staging`
- Requires all CI checks to pass
- Useful for testing before production

## Environment Variables

Both deployment environments need these Railway environment variables configured:

### Production
```
ENVIRONMENT=production
SUPABASE_URL=...
SUPABASE_KEY=...
OPENROUTER_API_KEY=...
# ... other provider keys
```

### Staging
```
ENVIRONMENT=staging
SUPABASE_URL=... (test database)
SUPABASE_KEY=...
# ... test credentials
```

Configure these in Railway dashboard:
1. Project → Environment → Production/Staging
2. Variables → Add variable

## Rollback Procedures

### Rollback to Previous Version

If deployment causes issues:

1. **Quick Rollback**:
   - Go to Railway Dashboard
   - Open the service
   - Click "Deployments"
   - Select previous deployment
   - Click "Redeploy"

2. **Via GitHub**:
   - Create empty commit on previous working commit
   - Push to trigger deployment

   ```bash
   git reset --soft HEAD~1
   git commit --allow-empty -m "Rollback to previous deployment"
   git push origin main
   ```

3. **Via CLI**:
   ```bash
   railway up --detach  # Redeploy current
   ```

## Troubleshooting

### Deployment Fails After CI Passes

1. Check Railway dashboard for errors
2. View application logs:
   ```bash
   railway logs --follow
   ```
3. Verify environment variables are set correctly
4. Check if port is correctly bound to `$PORT`

### Health Check Fails

Common causes:
- Application startup issues
- Database connection failures
- Missing environment variables
- Port not listening on `$PORT`

Debug:
1. SSH into Railway container (if enabled)
2. Check application logs
3. Verify `/health` endpoint is accessible
4. Check network configuration

### GitHub Action Times Out

If deployment takes longer than expected:
1. Increase timeout in workflow
2. Check Railway build logs
3. Verify dependencies are cached

## Performance Tips

### Faster Deployments

1. **Pin Dependencies** - Already done in `requirements.txt`
2. **Use Caching** - CI workflow caches wheels
3. **Minimal Docker Image** - Railway uses Nixpacks
4. **Skip Unnecessary Tests** - Focus on critical tests

### Current Timing

Typical deployment times:
- CI checks: 3-5 minutes
- Railway build: 1-2 minutes
- Startup & health check: 1-2 minutes
- **Total**: ~7-10 minutes

## Monitoring

### View Deployment History

1. **GitHub Actions**
   - Repository → Actions → "Auto Deploy to Railway"
   - View workflow runs and logs

2. **Railway Dashboard**
   - Project → Deployments
   - View deployment status and logs

3. **Health Monitoring**
   - Repository → Actions → "Monitor Deployment Health"
   - View health check results

## Advanced Configuration

### Deployment Groups

To deploy to multiple Railway projects:

1. Add additional secrets:
   ```
   RAILWAY_PROJECT_ID_PRODUCTION
   RAILWAY_PROJECT_ID_STAGING
   ```

2. Modify `deploy.yml` to use the appropriate secret

### Custom Domains

If using custom domains instead of railway.app:

1. Add to GitHub secrets:
   ```
   CUSTOM_DOMAIN=api.example.com
   ```

2. Update health check in `deploy.yml`:
   ```yaml
   DOMAIN: ${{ secrets.CUSTOM_DOMAIN }}
   ```

### Slack Notifications

To add Slack notifications on deployment:

1. Create Slack webhook
2. Add to GitHub secrets: `SLACK_WEBHOOK_URL`
3. Add step to `deploy.yml`:
   ```yaml
   - name: Notify Slack
     uses: slackapi/slack-github-action@v1
     with:
       webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
   ```

## Security Best Practices

1. **Rotate Tokens Regularly**
   - Railway tokens every 90 days
   - GitHub deployment tokens as needed

2. **Limit Token Permissions**
   - Use minimal required permissions
   - Never commit tokens to repository

3. **Audit Deployments**
   - Review GitHub Actions logs
   - Monitor Railway deployments
   - Track who merged what code

4. **Branch Protection**
   - Require status checks before merge
   - Require code review (minimum 1)
   - Dismiss stale reviews on push

## CI/CD Pipeline Reference

### Current Checks

The deployment waits for these CI checks:
- ✅ Code Quality Checks
- ✅ Security Scan
- ✅ Run Tests (all shards)
- ✅ Coverage Report
- ✅ Build Verification

All must pass for deployment to proceed.

### Adding New Checks

To add additional pre-deployment checks:

1. Add job to `.github/workflows/ci.yml`
2. Add job name to `check-ci-status` in `deploy.yml`
3. Ensure job has consistent naming

## FAQ

**Q: Can I skip CI and deploy directly?**
A: Not recommended, but possible by manually triggering in Railway dashboard.

**Q: How do I deploy to multiple environments?**
A: Create separate workflows or use `environment` matrix strategy.

**Q: Can I schedule deployments?**
A: Yes, add `schedule` trigger to workflow for automated releases.

**Q: What if I need to rollback?**
A: Use Railway Dashboard to redeploy previous version, or revert commit and push.

## Next Steps

1. ✅ Add GitHub secrets (RAILWAY_TOKEN, RAILWAY_PROJECT_ID, RAILWAY_DOMAIN)
2. ✅ Test with a PR merge to staging
3. ✅ Monitor health checks
4. ✅ Set up branch protection rules
5. ✅ Configure Slack/email notifications (optional)

---

**See Also:**
- [Railway Deployment Guide](./RAILWAY_DEPLOYMENT.md)
- [Railway Error Monitoring](./RAILWAY_ERROR_MONITORING_WORKFLOW.md)
- [CI/CD Configuration](../README.md#cicd)
