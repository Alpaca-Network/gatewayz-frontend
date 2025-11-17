# Auto-Deployment Architecture

Technical deep-dive into the automatic deployment system.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       GitHub Repository                          │
│  (main, staging branches)                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼ (PR Merged)
┌─────────────────────────────────────────────────────────────────┐
│              GitHub Actions CI/CD Pipeline                       │
│                                                                   │
│  1. Code Quality (Ruff, Black, isort)                            │
│  2. Security (Bandit, Safety)                                    │
│  3. Tests (4-way parallel with pytest)                           │
│  4. Coverage Report                                              │
│  5. Build Verification                                           │
│                                                                   │
│  Status: All checks must PASS before deployment                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼ (if all pass)
┌─────────────────────────────────────────────────────────────────┐
│              Auto Deploy Workflow (deploy.yml)                    │
│                                                                   │
│  1. Setup environment (prod/staging)                             │
│  2. Verify CI status (poll GitHub checks)                        │
│  3. Deploy to Railway:                                           │
│     - Authenticate with RAILWAY_TOKEN                            │
│     - Build container (Nixpacks)                                 │
│     - Start container                                            │
│  4. Health check (retry 12x with 10s delay)                      │
│  5. Comment on PR with status                                    │
│  6. Trigger monitoring workflow                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Railway Environment                            │
│                                                                   │
│  Container running:                                              │
│  - FastAPI application (uvicorn)                                 │
│  - Health endpoint at /health                                    │
│  - Connected to Supabase DB                                      │
│  - Connected to Redis cache                                      │
│                                                                   │
│  Status: Live and serving traffic                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼ (every 15 min)
┌─────────────────────────────────────────────────────────────────┐
│         Monitor Deployment Workflow                              │
│                                                                   │
│  - Check /health endpoint                                        │
│  - Collect metrics                                               │
│  - Create issue if unhealthy                                     │
│  - Generate health report                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Workflow Files

### 1. `deploy.yml` - Main Deployment Workflow

**Trigger**: `push` to `main` or `staging` branches

**Jobs**:

#### Job 1: `setup-environment`
```yaml
Outputs:
  - environment: 'production' | 'staging'
  - railway_environment: environment name for Railway CLI
```

Determines which environment to deploy to based on branch.

#### Job 2: `check-ci-status`
```yaml
Dependencies: setup-environment

Process:
1. Polls GitHub API for check runs on current commit
2. Waits max 5 minutes for CI completion
3. Verifies all critical checks passed:
   - Code Quality Checks
   - Security Scan
   - Run Tests (shards 1-4)
   - Coverage Report
   - Build Verification
4. Fails job if any check failed
```

Uses `github.rest.checks.listForRef()` to monitor CI progress.

#### Job 3: `deploy-railway`
```yaml
Dependencies: setup-environment, check-ci-status
Environment: production | staging

Steps:
1. Install Railway CLI via npm
2. Authenticate: railway login --token ${{ secrets.RAILWAY_TOKEN }}
3. Select project: railway project switch --id $RAILWAY_PROJECT_ID
4. Select environment: railway environment switch --name $RAILWAY_ENVIRONMENT
5. Trigger deployment: railway up --service backend --detach
6. Wait for startup (60 seconds)
7. Health check with 12 retries (10s delay)
   - Curl https://$RAILWAY_DOMAIN/health
   - Expect HTTP 200
8. If healthy, exit 0; if all retries fail, still exit 0 (best effort)
```

#### Job 4: `notify-deployment`
```yaml
Dependencies: setup-environment, deploy-railway
Runs: always

Steps:
1. Find recently merged PR (within last 60s)
2. Comment with deployment status:
   - Success: Includes domain, environment, commit
   - Failure: Links to workflow run for debugging
3. Try to trigger monitoring workflow
4. Print deployment summary
```

### 2. `monitor-deployment.yml` - Health Monitoring

**Triggers**:
- `workflow_dispatch` (manual)
- `schedule`: Every 15 minutes

**Jobs**:

#### Job 1: `monitor-health`
```yaml
Process:
1. Connect to Railway
2. Check production health:
   - Curl https://$RAILWAY_DOMAIN/health
   - Expect HTTP 200
3. If healthy: log success
4. If unhealthy:
   - Fetch logs from Railway
   - Create GitHub issue with:
     * Title: "Production Deployment Health Check Failed"
     * Labels: deployment-alert, urgent
     * Details: time, environment, action items
5. Check staging health (similar process)
```

#### Job 2: `collect-metrics`
```yaml
Process:
1. Connect to Railway
2. Query deployment metrics (if available)
3. List active services
4. Generate markdown report with:
   - Timestamp
   - Environment status
   - Quick links to dashboards
5. Upload as artifact (7-day retention)
```

## Authentication & Secrets

### Required Secrets

```
RAILWAY_TOKEN          # API token from Railway
RAILWAY_PROJECT_ID     # Project ID from Railway dashboard
RAILWAY_DOMAIN         # Production domain
STAGING_RAILWAY_DOMAIN # Staging domain (optional)
```

### How They're Used

**In deploy.yml**:
```bash
railway login --token ${{ secrets.RAILWAY_TOKEN }}
railway project switch --id ${{ secrets.RAILWAY_PROJECT_ID }}
```

**In deploy.yml health check**:
```bash
curl https://${{ secrets.RAILWAY_DOMAIN }}/health
```

## Environment Variables

The app running in Railway needs:

```
ENVIRONMENT=production
SUPABASE_URL=...
SUPABASE_KEY=...
OPENROUTER_API_KEY=...
# ... other provider keys
```

These are set in Railway dashboard, not in GitHub secrets.

## Error Handling

### Deploy Workflow

```
┌─ Merge PR
│
├─ CI checks fail?
│  └─ STOP (don't deploy)
│
├─ Railway deployment fails?
│  └─ Log error, create GitHub issue
│
├─ Health check fails?
│  └─ Still mark success (deployment was triggered)
│     Monitoring will catch unhealthy state
│
└─ All passed → Deployment complete
```

### Monitoring Workflow

```
Health check fails?
├─ Search for existing issue
├─ If not exists:
│  └─ Create new issue with:
│     • Title, description
│     • Labels: deployment-alert
│     • Action items for debugging
└─ If exists:
   └─ Don't create duplicate
```

## Retry Logic

### CI Status Check
- **Max retries**: 30 (5 minutes)
- **Retry delay**: 10 seconds
- **Condition**: Wait for all checks to complete

### Health Check
- **Max retries**: 12 (2 minutes)
- **Retry delay**: 10 seconds
- **HTTP codes**: Only 200 is success

## Performance Characteristics

### Deployment Timeline

```
1. PR Merge              → 0s
2. CI starts             → 5s (GitHub delay)
3. CI completes          → 3-5 min
4. Deploy starts         → 0s (immediate after CI)
5. Railway build         → 1-2 min
6. Container startup     → 30-60s
7. Health check          → 0-2 min
────────────────────────────────────
Total                    → 7-10 minutes
```

### Resource Usage

**GitHub Actions**:
- ~15-20 runner-minutes per deployment
- Mostly waiting for health check

**Railway**:
- Container memory: As configured in project
- Build time: 1-2 minutes
- Restart policy: ON_FAILURE with 10 retries

## Deployment Strategies

### Current: Direct Push

```
Feature branch → PR → Review → Merge → Deploy to Production
```

**Pros**:
- Simple
- Fast
- Direct feedback

**Cons**:
- No staging validation
- High blast radius if broken

### Recommended: Staged Rollout

```
Feature branch → PR → Merge to staging
Staging tests  → Manual approval
              → Merge to main → Deploy to production
```

**Implementation**: Create separate PRs for staging and main.

### Alternative: Canary Deployment

Would require:
- Multiple Railway services
- Traffic splitting logic
- Gradual rollout (5% → 25% → 100%)

**Not currently configured** - can add if needed.

## Monitoring & Observability

### Logs

**GitHub Actions Logs**:
- `deploy.yml`: Workflow → Run details → Logs
- `monitor-deployment.yml`: Same location

**Railway Logs**:
- Dashboard → Service → Logs
- CLI: `railway logs --follow`

### Metrics

From monitoring workflow:
- Health check status (per 15 min)
- Response time
- HTTP status codes
- Container uptime

### Alerts

**Automatic Issue Creation** when:
- Health check fails consistently
- Deployment takes too long
- Multiple successive failures

**Action**: Check GitHub Issues → Filter by `deployment-alert` label

## Security Considerations

### Token Management

1. **Token Rotation**
   - Rotate Railway token every 90 days
   - Old token is immediately revoked
   - New token added to GitHub secrets

2. **Token Scope**
   - Use minimal permissions needed
   - Never commit tokens to Git
   - Use GitHub secrets for all credentials

### Deployment Safety

1. **Approval Gates**
   - Require passing CI
   - Recommend code reviews before merge
   - Can't deploy to production without merge to main

2. **Rollback**
   - Previous deployments stored in Railway
   - Can redeploy any previous version
   - Rollback time: ~1 minute

3. **Audit Trail**
   - All deployments logged in GitHub Actions
   - All deployments logged in Railway
   - Merged commits traceable to GitHub user

## Disaster Recovery

### If Deployment Breaks Production

1. **Immediate**: Redeploy previous version
   - Railway Dashboard → Service → Deployments
   - Select previous deployment → Redeploy
   - Time to recovery: ~2 minutes

2. **Investigation**: Check logs
   - GitHub Actions: Run logs
   - Railway: Container logs
   - GitHub Issues: deployment-alert issues

3. **Fix & Redeploy**: Push fix and merge
   - Full deployment: ~7-10 minutes

### If CI is Broken

Deployments won't proceed until fixed:

1. Check GitHub Actions logs
2. Fix code locally
3. Push to branch → Test with new PR
4. When CI passes, deployment proceeds

## Future Enhancements

### Potential Improvements

1. **Slack Notifications**
   - Real-time deployment status
   - Links to logs
   - Action buttons

2. **Metrics Dashboard**
   - Deployment frequency
   - Average deployment time
   - Success rate
   - MTTR (Mean Time To Recovery)

3. **Advanced Routing**
   - Blue-green deployments
   - Canary releases
   - Gradual rollout to 100%

4. **Custom Checks**
   - Database migration validation
   - Smoke tests post-deployment
   - Performance regression checks

5. **ChatOps**
   - Trigger deployments from Slack
   - Status commands
   - Manual approval flows

## Troubleshooting Guide

### Workflow Not Triggering

**Check**:
1. Is the file `.github/workflows/deploy.yml` present?
2. Are you pushing to `main` or `staging`?
3. Did you modify deployment-related files?

**Fix**:
```bash
git push origin main  # Explicitly trigger
```

### CI Never Completes

**Check**:
1. GitHub status page: status.github.com
2. Repository Actions settings (not disabled)
3. Sufficient runner quota

**Fix**:
1. Wait for in-progress CI to complete
2. Cancel stuck workflow manually
3. Contact GitHub support if runners unavailable

### Health Check Fails

**Common Causes**:
1. App not starting (missing env vars)
2. Database connection issues
3. Wrong port (must use $PORT)
4. Health endpoint not implemented

**Debug**:
```bash
railway logs --follow
# Look for startup errors
```

### Railway Build Fails

**Common Causes**:
1. Invalid Python code (import errors)
2. Missing dependencies in requirements.txt
3. Outdated lock file

**Fix**:
1. Test build locally: `python -m pip install -r requirements.txt`
2. Push code changes
3. Merge to main again

## References

- Railway Documentation: https://docs.railway.app
- GitHub Actions: https://docs.github.com/en/actions
- GitHub CLI: https://cli.github.com/manual

---

**Last Updated**: 2025-11-17
**Version**: 1.0
