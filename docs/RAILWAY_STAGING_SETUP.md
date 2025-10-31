# Railway Staging Environment Setup Guide

This guide walks you through setting up a staging environment on Railway for testing before deploying to production.

## Overview

You'll have two Railway deployments:
- **Production** (main branch) → `api.gatewayz.ai`
- **Staging** (staging branch) → `staging-api.gatewayz.ai`

## Step 1: Create Staging Branch

```bash
# From your backend directory
cd /Users/arminrad/Desktop/Alpaca-Network/Gatewayz/gatewayz-backend

# Create staging branch from main
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

## Step 2: Railway Project Setup

### Option A: Separate Projects (Recommended)

**Production Project:**
1. Go to [railway.app](https://railway.app)
2. Your existing project should be here
3. Rename it to `gatewayz-backend-production` (Settings → General)
4. Ensure it's connected to `main` branch

**Staging Project:**
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `gatewayz-backend` repository
4. Name: `gatewayz-backend-staging`
5. **Important:** Configure to deploy from `staging` branch:
   - Settings → Source → Branch: `staging`

### Option B: Single Project, Multiple Services

1. Go to your existing Railway project
2. Click "+ New" → "GitHub Repo"
3. Select `gatewayz-backend` again
4. Choose `staging` branch
5. Rename services:
   - Production service: `backend-prod`
   - Staging service: `backend-staging`

## Step 3: Configure Environment Variables

### Staging Environment Variables

In Railway Dashboard → Staging Project/Service → Variables:

```bash
# Environment
APP_ENV=staging

# Supabase (Staging Database)
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_KEY=your-staging-anon-key

# Stripe (TEST MODE - Important!)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# API Keys
OPENROUTER_API_KEY=sk-or-v1-...
PORTKEY_API_KEY=...

# Provider Keys (can reuse production or use test keys)
PROVIDER_OPENAI_API_KEY=sk-...
PROVIDER_ANTHROPIC_API_KEY=sk-ant-...
FIREWORKS_API_KEY=...
TOGETHER_API_KEY=...
GROQ_API_KEY=...

# Admin
ADMIN_EMAIL=your-admin@email.com

# Analytics (Optional - use separate project)
STATSIG_SERVER_SECRET_KEY=secret-...
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://us.i.posthog.com
```

### Production Environment Variables (Verify)

```bash
APP_ENV=production
SUPABASE_URL=https://your-prod-project.supabase.co
STRIPE_SECRET_KEY=sk_live_...  # LIVE MODE
# ... etc
```

## Step 4: Supabase Staging Setup

**Option A: Separate Staging Project (Recommended)**
1. Go to [supabase.com](https://supabase.com)
2. Create new project: `gatewayz-staging`
3. Copy database schema from production
4. Use this project's URL/key in staging env vars

**Option B: Same Project, Different Schema**
1. Use same Supabase project
2. Create separate schema: `staging`
3. Duplicate tables in staging schema
4. Use RLS policies to separate data

**Option C: Same Database (Quick Testing)**
- Use production database
- Add `staging_` prefix to test data
- ⚠️ Be careful not to modify production data!

## Step 5: Configure Custom Domains (Optional)

### Staging Domain:
1. Railway Dashboard → Staging Service → Settings → Domains
2. Click "Generate Domain" (you'll get something like `backend-staging-production.up.railway.app`)
3. Or add custom domain:
   - Add `staging-api.gatewayz.ai`
   - Update your DNS with the provided CNAME

### Production Domain:
- Should already be `api.gatewayz.ai`

## Step 6: Test the Staging Environment

```bash
# Check staging is live
curl https://your-staging-domain.railway.app/health

# Should return environment info showing staging
```

## Step 7: Development Workflow

### Daily Development:

```bash
# 1. Create feature branch from staging
git checkout staging
git pull origin staging
git checkout -b feature/new-payment-flow

# 2. Make changes, commit
git add .
git commit -m "Add new payment flow"

# 3. Push to feature branch
git push origin feature/new-payment-flow

# 4. Create PR to merge into staging
# GitHub → Pull Request → Base: staging ← Compare: feature/new-payment-flow

# 5. After PR merge, Railway auto-deploys to staging

# 6. Test on staging
# Visit: https://staging-api.gatewayz.ai
# Run integration tests

# 7. If tests pass, merge staging → main for production
git checkout main
git pull origin main
git merge staging
git push origin main

# 8. Railway auto-deploys to production
```

### Hotfix Workflow:

```bash
# For urgent production fixes
git checkout main
git checkout -b hotfix/critical-bug

# ... make fix ...

# Push directly to main (skip staging)
git checkout main
git merge hotfix/critical-bug
git push origin main

# Then update staging to include the hotfix
git checkout staging
git merge main
git push origin staging
```

## Step 8: Environment Comparison

| Feature | Development | Staging | Production |
|---------|------------|---------|------------|
| **Branch** | local | `staging` | `main` |
| **Railway** | - | Auto-deploy | Auto-deploy |
| **Database** | Local/.env | Staging Supabase | Prod Supabase |
| **Stripe** | Test keys | Test mode | Live mode |
| **Domain** | localhost:8000 | staging-api.gatewayz.ai | api.gatewayz.ai |
| **Frontend** | localhost:3000 | staging.gatewayz.ai | gatewayz.ai |
| **APP_ENV** | development | staging | production |

## Step 9: Monitoring & Logs

**View Logs:**
```bash
# Railway CLI (optional)
railway logs -s backend-staging
railway logs -s backend-production
```

**Or use Railway Dashboard:**
- Staging Service → Deployments → View Logs
- Production Service → Deployments → View Logs

## Step 10: Rollback (If Needed)

If staging deployment breaks:

1. **Railway Dashboard:**
   - Go to Deployments
   - Find last working deployment
   - Click "Redeploy"

2. **Or revert in Git:**
   ```bash
   git checkout staging
   git revert HEAD
   git push origin staging
   # Railway auto-deploys the reverted version
   ```

## Best Practices

✅ **DO:**
- Always test in staging before production
- Use Stripe test mode in staging
- Keep staging and production configs separate
- Review staging logs before merging to main
- Use same code structure in both environments

❌ **DON'T:**
- Use production API keys in staging
- Test with real user data in staging
- Deploy directly to main without staging test
- Share credentials between environments
- Skip staging for "small" changes

## Troubleshooting

**Staging not deploying?**
- Check Railway → Settings → Source → Verify branch is `staging`
- Check Railway → Deployments → View build logs
- Verify all env vars are set

**Database connection fails?**
- Check `SUPABASE_URL` and `SUPABASE_KEY` in Railway vars
- Verify Supabase project is accessible
- Check Supabase dashboard for connection issues

**CORS errors from frontend?**
- Verify `APP_ENV=staging` is set in Railway
- Check main.py CORS configuration includes staging domain
- Verify frontend is using correct staging API URL

## Summary

You now have a complete staging pipeline:

```
Local Development → Push to GitHub (staging branch)
    ↓
Railway Auto-Deploy to Staging
    ↓
Test on staging-api.gatewayz.ai
    ↓
Merge staging → main in GitHub
    ↓
Railway Auto-Deploy to Production
    ↓
Live on api.gatewayz.ai
```

This setup gives you a safe testing environment before changes reach your users! 🚀
