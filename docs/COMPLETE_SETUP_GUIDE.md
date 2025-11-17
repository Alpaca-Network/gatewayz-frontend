# Complete Railway Setup Guide

Full end-to-end guide to set up automatic deployments from scratch.

## Overview

This guide covers everything needed to go from zero to fully automated deployments:

```
1. Create Railway Project
2. Deploy Initial Container (automated)
3. Configure Auto-Deployment (automated)
4. Test & Verify
5. Ongoing: Just merge PRs - deployment is automatic!
```

**Total time**: ~30 minutes (mostly waiting for build)

---

## Phase 1: Railway Project Creation (5 minutes)

### 1.1 Create Railway Account

If you don't have one:
1. Go to https://railway.app
2. Click **Sign Up**
3. Create account (GitHub recommended)

### 1.2 Create New Project

1. Go to https://railway.app
2. Click **"New Project"** (top right)
3. Select **"Blank Project"**
4. Name it: `Gatewayz Backend` (or your preferred name)
5. Copy the **Project ID** from URL or dashboard

Save these:
```
PROJECT_ID = ...
```

### 1.3 Create API Token

1. Click your **Account** (top right)
2. Go to **Settings** → **Tokens**
3. Click **"Create New Token"**
4. Copy the token (starts with `rwy_`)
5. Save it securely

Save this:
```
RAILWAY_TOKEN = rwy_...
```

---

## Phase 2: Initial Deployment (10 minutes)

### 2.1 Prerequisites

Ensure you have:
- [ ] Railway token (from Phase 1)
- [ ] Project ID (from Phase 1)
- [ ] Node.js installed (for Railway CLI)
- [ ] GitHub CLI installed (`gh`)

### 2.2 Prepare Environment Variables

Collect all environment variables needed. These are in your `.env` file or `src/config/config.py`:

```bash
# Create a file with all variables
cat > /tmp/railway-vars.txt << 'EOF'
ENVIRONMENT=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-key-here
OPENROUTER_API_KEY=sk-...
PORTKEY_API_KEY=...
FEATHERLESS_API_KEY=...
CHUTES_API_KEY=...
DEEPINFRA_API_KEY=...
FIREWORKS_API_KEY=...
TOGETHER_API_KEY=...
HUGGINGFACE_API_KEY=...
ENCRYPTION_KEY=...
ADMIN_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
RESEND_API_KEY=...
STATSIG_SDK_KEY=...
POSTHOG_API_KEY=...
JWT_SECRET=...
EOF
```

Fill in all the values with your actual keys.

### 2.3 Run Initial Deployment

```bash
# Set environment variables (or let script prompt)
export RAILWAY_TOKEN="rwy_..."
export RAILWAY_PROJECT_ID="project-id"

# Run the initialization script
bash scripts/init-railway-deployment.sh
```

The script will:
1. ✅ Authenticate with Railway
2. ✅ Select your project
3. ✅ Build and deploy container
4. ✅ Generate domain
5. ✅ Pause for environment variable setup

### 2.4 Configure Environment Variables in Railway

When the script pauses, go to Railway:

1. Open https://railway.app
2. Click your project
3. Click **"backend"** service (created by script)
4. Click **"Variables"** tab
5. Add all variables from `/tmp/railway-vars.txt`
6. Click **"Save"**

Variables available immediately - service auto-restarts.

### 2.5 Verify Initial Deployment

The script will automatically check health:

```bash
curl https://your-railway-domain.railway.app/health
```

Expected response:
```json
{"status": "healthy"}
```

If successful:
```
✓ Health check passed!
✓ Your app is live at: https://your-domain.railway.app
```

---

## Phase 3: Configure Auto-Deployment (5 minutes)

### 3.1 Run Auto-Deployment Setup

Now that you have a working container, set up automatic deployments:

```bash
bash scripts/setup-auto-deploy.sh
```

The script will prompt for:
- **Railway Token** - paste the one from Phase 1
- **Project ID** - paste from Phase 1
- **Domain** - paste the domain from Phase 2 (e.g., `api.railway.app`)

### 3.2 Verify Secrets

Check that GitHub secrets were configured:

```bash
gh secret list
```

Should show:
```
RAILWAY_TOKEN
RAILWAY_PROJECT_ID
RAILWAY_DOMAIN
```

---

## Phase 4: Test Auto-Deployment (10 minutes)

### 4.1 Create Test PR

```bash
git checkout -b test-auto-deploy
echo "# Test Auto-Deployment" >> README.md
git add README.md
git commit -m "test: verify auto-deployment works"
git push origin test-auto-deploy
```

### 4.2 Create Pull Request

1. Go to GitHub
2. Create PR from `test-auto-deploy` → `staging`
3. Get code review/approval (if branch protection enabled)
4. **Merge the PR to staging**

### 4.3 Watch Deployment

1. Go to GitHub **Actions** tab
2. Click **"Auto Deploy to Railway"**
3. Watch the workflow:
   - ✅ CI checks run (3-5 min)
   - ✅ Deploy starts (if tests pass)
   - ✅ Build container (1-2 min)
   - ✅ Health check (0-2 min)

Total: ~7-10 minutes

### 4.4 Verify Live

```bash
# Check domain
curl https://your-railway-domain.railway.app/health

# Should return healthy status
curl https://your-railway-domain.railway.app/
```

### 4.5 Confirm Deployment

You should see:
- ✅ Comment on PR with deployment status
- ✅ Green checkmark in Actions
- ✅ Service responding at domain
- ✅ Logs in Railway dashboard

---

## Phase 5: Production Setup (Optional)

If you want production deployments separate from staging:

### 5.1 Create Production Environment in Railway

1. https://railway.app → Project → Settings
2. Click **"Environments"** tab
3. Click **"Create Environment"**
4. Name it: `production`
5. Add production environment variables

### 5.2 Update Auto-Deploy Workflow (Optional)

For different settings per environment, modify `.github/workflows/deploy.yml`:

```yaml
# Add environment-specific settings:
- name: Deploy to production
  if: github.ref == 'refs/heads/main'
  run: railway environment switch --name production

- name: Deploy to staging
  if: github.ref == 'refs/heads/staging'
  run: railway environment switch --name staging
```

---

## Quick Reference

### One-Time Setup Commands

```bash
# 1. Deploy initial container
bash scripts/init-railway-deployment.sh

# 2. Configure auto-deployment secrets
bash scripts/setup-auto-deploy.sh

# 3. Verify secrets
gh secret list

# 4. Test by merging PR to staging
```

### Useful Commands

```bash
# View live logs
railway logs --follow

# View environment variables
railway env

# Manually redeploy
railway up --detach

# View deployment status
railway deployment list

# Get domain
railway domain

# Restart service
railway env --restore
```

### GitHub Actions

```bash
# View recent deployments
gh run list --workflow=deploy.yml --limit 5

# View logs of latest deployment
gh run view $(gh run list --workflow=deploy.yml --limit 1 -q | head -1) --log

# View monitoring runs
gh run list --workflow=monitor-deployment.yml --limit 5
```

---

## Troubleshooting

### Initial Deployment Fails

**Problem**: Build fails in `init-railway-deployment.sh`

**Solution**:
1. Check Railway logs: `railway logs --follow`
2. Look for Python import errors
3. Test locally: `python src/main.py`
4. Verify `requirements.txt` is correct

### Health Check Fails

**Problem**: `/health` endpoint not responding

**Solution**:
1. Verify endpoint exists in code
2. Check it returns HTTP 200
3. Check environment variables are set
4. View logs: `railway logs --follow`

### Auto-Deployment Not Triggering

**Problem**: Merging PR doesn't trigger deployment

**Solution**:
1. Verify secrets: `gh secret list`
2. Check workflow file exists: `.github/workflows/deploy.yml`
3. Verify pushing to `main` or `staging`
4. Check CI passes before deploy triggers

### Variables Not Taking Effect

**Problem**: App still using old values after updating variables

**Solution**:
1. Railway auto-restarts on variable save
2. Wait 30 seconds for restart
3. Manually restart: `railway env --restore`
4. Or manually redeploy: `railway up --detach`

---

## Security Checklist

- [ ] Railway token never committed to Git
- [ ] GitHub secrets used for all credentials
- [ ] Environment variables set in Railway (not committed)
- [ ] Branch protection enabled on `main`
- [ ] Code review required before merge (optional, recommended)
- [ ] Audit logs enabled
- [ ] Token will be rotated every 90 days

---

## Documentation Map

| Topic | Document |
|-------|----------|
| Initial setup (this doc) | `COMPLETE_SETUP_GUIDE.md` |
| Initial deployment (detailed) | `RAILWAY_INITIAL_SETUP.md` |
| Auto-deployment setup | `AUTO_DEPLOYMENT_SETUP.md` |
| Getting started with auto-deploy | `AUTO_DEPLOYMENT_GETTING_STARTED.md` |
| Quick reference | `AUTO_DEPLOY_QUICKSTART.md` |
| Architecture details | `AUTO_DEPLOYMENT_ARCHITECTURE.md` |

---

## Success Criteria

You're done when:

- [ ] Initial container deployed and running on Railway
- [ ] Health endpoint responds (HTTP 200)
- [ ] Environment variables configured
- [ ] GitHub secrets set (`RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_DOMAIN`)
- [ ] Auto-deploy workflow tested (PR merged to staging)
- [ ] Deployment completed automatically
- [ ] Domain shows live application

---

## What's Next

After setup:

1. **Daily Development**
   - Make code changes
   - Create PR
   - Merge to main/staging
   - Automatic deployment happens!

2. **Monitoring**
   - GitHub Actions shows deployment status
   - Health checks every 15 minutes
   - Issues created if unhealthy

3. **Maintenance**
   - Rotate Railway token every 90 days
   - Review logs periodically
   - Update environment variables as needed

---

## Support

### Resources
- **Railway Docs**: https://docs.railway.app
- **Railway CLI**: `railway --help`
- **GitHub Actions**: https://docs.github.com/en/actions

### Getting Help
1. Check relevant documentation
2. View logs: `railway logs --follow`
3. Review GitHub Actions workflow logs
4. Check GitHub Issues for errors

---

## Timeline Summary

| Phase | Time | Action |
|-------|------|--------|
| 1 | 5 min | Create Railway project & get token |
| 2 | 10 min | Run initial deployment script |
| 2 | - | Set environment variables in Railway |
| 3 | 5 min | Run auto-deploy setup script |
| 4 | 10 min | Test auto-deploy with PR merge |
| **Total** | **~30 min** | **Complete automated setup** |

---

**Ready to deploy? Start with Phase 1!**

Next command:
```bash
bash scripts/init-railway-deployment.sh
```

---

**Last Updated**: 2025-11-17
**Version**: 1.0
