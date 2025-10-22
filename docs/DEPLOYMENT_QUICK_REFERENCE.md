# Deployment Quick Reference

Quick commands and checklist for deploying to staging and production.

## 🚀 Quick Deploy Checklist

### Deploying to Staging

```bash
# 1. Create feature branch
git checkout staging
git checkout -b feature/your-feature

# 2. Make changes and commit
git add .
git commit -m "Add your feature"

# 3. Push to GitHub
git push origin feature/your-feature

# 4. Create PR: feature/your-feature → staging

# 5. After merge, Railway auto-deploys to staging

# 6. Test staging deployment
curl https://staging-api.gatewayz.ai/health
```

### Deploying to Production

```bash
# 1. Ensure staging is working
# Test thoroughly on staging!

# 2. Merge staging to main
git checkout main
git pull origin main
git merge staging

# 3. Push to GitHub
git push origin main

# 4. Railway auto-deploys to production

# 5. Verify production
curl https://api.gatewayz.ai/health

# 6. Monitor logs in Railway dashboard
```

## 📋 Pre-Deploy Checklist

- [ ] All tests passing locally
- [ ] Code reviewed
- [ ] Database migrations tested (if any)
- [ ] Environment variables updated (if needed)
- [ ] Tested on staging environment
- [ ] No breaking changes to API
- [ ] Changelog/commit messages updated
- [ ] Rollback plan ready

## 🔧 Railway Environment Variables

### Required for All Environments
```bash
APP_ENV=staging|production
SUPABASE_URL=https://...
SUPABASE_KEY=...
OPENROUTER_API_KEY=...
PORTKEY_API_KEY=...
```

### Environment-Specific

**Staging:**
```bash
APP_ENV=staging
STRIPE_SECRET_KEY=sk_test_...  # TEST mode
```

**Production:**
```bash
APP_ENV=production
STRIPE_SECRET_KEY=sk_live_...  # LIVE mode
```

## 🔍 Health Check URLs

| Environment | Health Check | API Docs |
|-------------|--------------|----------|
| Local | http://localhost:8000/health | http://localhost:8000/docs |
| Staging | https://staging-api.gatewayz.ai/health | https://staging-api.gatewayz.ai/docs |
| Production | https://api.gatewayz.ai/health | https://api.gatewayz.ai/docs |

## 🐛 Troubleshooting Commands

```bash
# View Railway logs (requires Railway CLI)
railway logs -s backend-staging
railway logs -s backend-production

# Check current branch
git branch

# Check git status
git status

# View recent commits
git log --oneline -5

# Check Railway deployment status
# Visit: https://railway.app → Your Project → Deployments
```

## 🔄 Rollback

### Railway Dashboard
1. Go to Deployments
2. Find last working deployment
3. Click "Redeploy"

### Git Revert
```bash
# For staging
git checkout staging
git revert HEAD
git push origin staging

# For production (use with caution!)
git checkout main
git revert HEAD
git push origin main
```

## 📊 Monitoring

**Check Application Logs:**
- Railway Dashboard → Service → Deployments → Logs

**Check Database:**
- Supabase Dashboard → Table Editor / Logs

**Check Analytics:**
- Statsig Dashboard
- PostHog Dashboard

## 🎯 Common Tasks

### Add New Environment Variable
1. Railway Dashboard → Service → Variables
2. Click "New Variable"
3. Add name and value
4. Redeploy service

### Update Python Dependencies
1. Update `requirements.txt`
2. Commit and push
3. Railway auto-rebuilds with new deps

### Database Migration
1. Test migration in staging first
2. Run migration script
3. Verify data integrity
4. Then deploy to production

## 🔐 Security Notes

- ✅ Never commit `.env` files
- ✅ Use test Stripe keys in staging
- ✅ Rotate API keys regularly
- ✅ Review access logs
- ✅ Keep dependencies updated
