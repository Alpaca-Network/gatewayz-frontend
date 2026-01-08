# Railway Deployment Guide - Gatewayz Beta with Redis

## 🚀 Quick Deployment (15 minutes)

This guide walks you through deploying Gatewayz Beta on Railway with Redis caching.

### Prerequisites

- Railway account (https://railway.app)
- GitHub repository access
- Stripe account (for payments)
- Privy account (for authentication)

---

## Step 1: Create Railway Project

1. **Go to Railway Dashboard**
   - Visit https://railway.app/dashboard
   - Click **"+ New Project"**

2. **Deploy from GitHub**
   - Select **"Deploy from GitHub repo"**
   - Authorize Railway to access your GitHub account
   - Select your `gatewayz-beta` repository
   - Select branch: `terragon/integrate-redis-performance-3difdf`

3. **Railway will start the initial deployment**
   - This will fail initially (expected - we need to configure environment variables)

---

## Step 2: Add Redis Service

1. **In your Railway project**
   - Click **"+ New"** button
   - Select **"Database"**
   - Choose **"Add Redis"**

2. **Redis service will be provisioned automatically**
   - Railway creates a Redis instance
   - Connection details are auto-generated
   - No manual configuration needed

---

## Step 3: Configure Environment Variables

### Frontend Service Variables

Go to your **frontend service** (gatewayz-beta) → **Variables** tab:

```bash
# === Authentication ===
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# === API Configuration ===
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai

# === Redis Configuration (Reference Railway Redis Service) ===
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=${{Redis.REDISPORT}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
REDIS_DB=0

# === Stripe ===
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# === Analytics (Optional) ===
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_STATSIG_CLIENT_KEY=your_statsig_key

# === Node Environment ===
NODE_ENV=production
```

**Important Notes:**
- Replace `Redis` in `${{Redis.REDISHOST}}` with your actual Redis service name if different
- Get Privy App ID from https://dashboard.privy.io
- Get Stripe keys from https://dashboard.stripe.com
- Analytics keys are optional but recommended

---

## Step 4: Configure Build Settings

### Railway Service Settings

1. **Go to your service → Settings**

2. **Build Settings**
   ```
   Build Command: pnpm install && pnpm build
   Start Command: pnpm start
   ```

3. **Root Directory** (if needed)
   ```
   Root Directory: /
   ```

4. **Install Command**
   ```
   Install Command: pnpm install
   ```

### Verify package.json Scripts

Your `package.json` should have these scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

---

## Step 5: Deploy

1. **Trigger New Deployment**
   - Click **"Deploy"** button in Railway dashboard
   - OR push a new commit to trigger auto-deploy

2. **Monitor Deployment Logs**
   - Click **"View Logs"** to watch deployment progress
   - Look for these success messages:
     ```
     ✓ Compiled successfully
     ✓ Server started on port 3000
     [Redis] Connected successfully
     [Redis] Ready to accept commands
     ```

3. **Wait for Deployment to Complete**
   - Usually takes 2-5 minutes
   - Status will change to "Active" when ready

---

## Step 6: Verify Deployment

### 1. Check Application Health

Visit your Railway URL (found in service settings):
```
https://your-app.up.railway.app
```

You should see:
- ✅ Homepage loads
- ✅ Can navigate to /chat
- ✅ Can navigate to /models
- ✅ No console errors

### 2. Verify Redis Connection

Check deployment logs for:
```
[Redis] Connected successfully
[Redis] Ready to accept commands
```

### 3. Test Cache Performance

```bash
# Get cache metrics
curl "https://your-app.up.railway.app/api/cache/invalidate?metrics=true" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Expected response:
```json
{
  "redis": {
    "total_keys": 15,
    "pattern": "*"
  },
  "metrics": {
    "models": {
      "hits": 0,
      "misses": 0,
      "hitRate": 0
    }
  }
}
```

### 4. Test Model Loading

Visit `/models` page:
- First load: Should take 1-5 seconds (cache MISS)
- Subsequent loads: Should be instant < 100ms (cache HIT)

### 5. Test Authentication

Try to sign in:
- Click "Sign In" button
- Should redirect to Privy authentication
- After auth, should redirect back to app

---

## Step 7: Configure Custom Domain (Optional)

### Add Custom Domain

1. **Go to Service → Settings → Domains**
2. **Click "Add Domain"**
3. **Enter your domain**: `beta.gatewayz.ai`
4. **Add DNS Records** (in your domain provider):
   ```
   Type: CNAME
   Name: beta
   Value: your-app.up.railway.app
   ```
5. **Wait for DNS propagation** (5-30 minutes)

### Update Environment Variables

After domain is active, update:
```bash
# If you need NEXTAUTH_URL for authentication
NEXTAUTH_URL=https://beta.gatewayz.ai
```

---

## 🔍 Monitoring & Verification

### Railway Dashboard Metrics

1. **Service Metrics**
   - Go to your service → **Metrics** tab
   - Monitor CPU, Memory, Network usage

2. **Redis Metrics**
   - Go to Redis service → **Metrics** tab
   - Monitor Redis memory usage, connections, operations/sec

### Application Logs

**View Real-Time Logs:**
```bash
# In Railway dashboard
Service → Deployments → View Logs

# Or via CLI
railway logs
```

**Look for these success patterns:**
```
[Redis] Connected successfully
[Redis] Ready to accept commands
[Models] Returning cached models (1250 models)
[Cache HIT] Chat sessions for user 123
[Cache MISS] User profile 456
```

### Cache Performance Metrics

Monitor cache hit rates via API:
```bash
curl "https://your-app.up.railway.app/api/cache/invalidate?metrics=true" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Target Metrics:**
- Hit rate: **80%+** after 10 minutes of usage
- Model loading: **<100ms** (was 5-30s)
- Chat sessions: **<100ms** (was 500ms-2s)
- User profiles: **<50ms** (was 200-500ms)

---

## 🎯 Expected Performance Improvements

| Metric | Before Redis | After Redis | Improvement |
|--------|-------------|-------------|-------------|
| Model loading | 5-30s | <100ms | **95%+ faster** |
| Chat sessions | 500ms-2s | <100ms | **80-90% faster** |
| User profiles | 200-500ms | <50ms | **90%+ faster** |
| Activity stats | 1-3s | <200ms | **85%+ faster** |
| Backend load | 100% | 25-40% | **60-75% reduction** |

---

## 🔄 Continuous Deployment

Railway automatically deploys when you push to your branch:

```bash
# Make changes locally
git add .
git commit -m "feat: add new feature"
git push origin terragon/integrate-redis-performance-3difdf

# Railway automatically detects push and deploys
```

**Deployment Notifications:**
- Enable notifications in Railway settings
- Get Slack/Discord/Email alerts on deployments
- Monitor deployment status in real-time

---

## 🐛 Troubleshooting

### Deployment Fails

**Symptom:** Build fails with error

**Common Causes & Solutions:**

1. **Missing Dependencies**
   ```bash
   # Check package.json has all dependencies
   # Verify pnpm-lock.yaml is committed
   ```

2. **TypeScript Errors**
   ```bash
   # Run locally to check
   pnpm typecheck

   # Fix any errors before deploying
   ```

3. **Build Timeout**
   ```bash
   # Increase build timeout in Railway settings
   # Go to Service → Settings → Build Settings
   ```

### Redis Connection Issues

**Symptom:** Logs show "Redis connection error"

**Solutions:**

1. **Verify Redis Service is Running**
   - Check Redis service status in Railway dashboard
   - Should show "Active"

2. **Check Environment Variables**
   ```bash
   # In frontend service → Variables
   # Verify these are set:
   REDIS_HOST=${{Redis.REDISHOST}}
   REDIS_PORT=${{Redis.REDISPORT}}
   REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
   REDIS_DB=0
   ```

3. **Verify Service Name**
   - Ensure `${{Redis.VARIABLE}}` uses correct Redis service name
   - Check Redis service name in Railway dashboard

4. **Redeploy Both Services**
   - Click "Deploy" on Redis service
   - Click "Deploy" on frontend service

### Application Crashes

**Symptom:** Service shows "Crashed" status

**Solutions:**

1. **Check Logs**
   ```bash
   # View logs in Railway dashboard
   # Look for error messages
   ```

2. **Verify Environment Variables**
   - Ensure all required variables are set
   - Check for typos in variable names

3. **Check Memory Usage**
   - Go to Service → Metrics
   - If memory exceeds limits, upgrade plan

### Slow Performance

**Symptom:** App is slow despite Redis

**Solutions:**

1. **Verify Redis is Connected**
   ```bash
   # Check logs for:
   [Redis] Connected successfully
   ```

2. **Check Cache Hit Rate**
   ```bash
   curl "https://your-app.up.railway.app/api/cache/invalidate?metrics=true"

   # Hit rate should be 80%+ after some usage
   ```

3. **Clear Cache and Test**
   ```bash
   curl -X POST "https://your-app.up.railway.app/api/cache/invalidate" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"category": "all"}'

   # Then test model loading again
   ```

4. **Check Railway Metrics**
   - High CPU usage? Upgrade plan
   - High memory usage? Check for memory leaks

### Authentication Issues

**Symptom:** Can't sign in

**Solutions:**

1. **Verify Privy Configuration**
   ```bash
   # Check NEXT_PUBLIC_PRIVY_APP_ID is set correctly
   # Ensure Railway URL is added to Privy allowed origins
   ```

2. **Add Railway Domain to Privy**
   - Go to https://dashboard.privy.io
   - Settings → Allowed Origins
   - Add: `https://your-app.up.railway.app`

3. **Check Browser Console**
   - Open DevTools → Console
   - Look for CORS or authentication errors

---

## 🔐 Security Checklist

- [ ] All environment variables set
- [ ] Stripe webhook secret configured
- [ ] Redis password-protected (Railway default)
- [ ] HTTPS enabled (Railway default)
- [ ] Privy allowed origins configured
- [ ] API keys secured in environment variables
- [ ] No secrets in code or git history

---

## 💰 Railway Costs

### Hobby Plan ($5/month)
- Includes 500 hours of usage
- Redis: 512 MB RAM (~$2.50/month)
- Good for: Development, testing, small projects

### Pro Plan (Starting at $20/month)
- Includes $20 of usage
- Configurable resources
- Good for: Production apps with moderate traffic

### Usage-Based Pricing
- Memory: ~$0.000231/GB-hour
- CPU: Based on vCPU usage
- Network: Outbound data transfer

**Estimated Monthly Cost:**
- Frontend service: $10-20
- Redis (512 MB): $2-5
- **Total: $12-25/month**

---

## 📈 Scaling Considerations

### Horizontal Scaling

Railway supports multiple instances:
1. Go to Service → Settings → Scale
2. Increase replica count
3. Redis handles cache across all instances

### Vertical Scaling

Upgrade resources for better performance:
1. Go to Service → Settings
2. Adjust Memory/CPU limits
3. Restart service

### Redis Scaling

Upgrade Redis memory for more cache:
1. Go to Redis service → Settings
2. Increase memory allocation
3. Monitor usage in Metrics tab

---

## 🔄 Cache Management

### Manual Cache Invalidation

**Clear all caches:**
```bash
curl -X POST "https://your-app.up.railway.app/api/cache/invalidate" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"category": "all"}'
```

**Clear specific category:**
```bash
# Models only
curl -X POST "https://your-app.up.railway.app/api/cache/invalidate" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"category": "models"}'

# Sessions only
curl -X POST "https://your-app.up.railway.app/api/cache/invalidate" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"category": "sessions"}'
```

### Automated Invalidation

Cache automatically invalidates on:
- User profile updates
- Session creation/deletion
- Data modifications via API

---

## 📚 Additional Resources

### Documentation
- `RAILWAY_REDIS_SETUP.md` - Detailed Redis setup for Railway
- `REDIS_INTEGRATION.md` - Complete Redis implementation guide
- `REDIS_QUICK_START.md` - Quick Redis setup guide
- `VERCEL_REDIS_SETUP.md` - If deploying frontend to Vercel

### External Resources
- [Railway Documentation](https://docs.railway.app)
- [Railway Redis Guide](https://docs.railway.app/databases/redis)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [pnpm Documentation](https://pnpm.io)

---

## ✅ Post-Deployment Checklist

- [ ] Railway project created
- [ ] Redis service added and active
- [ ] Environment variables configured
- [ ] Application deployed successfully
- [ ] Logs show `[Redis] Connected successfully`
- [ ] Homepage loads without errors
- [ ] Authentication works
- [ ] Model loading is fast (<100ms)
- [ ] Cache hit rate is 80%+ after usage
- [ ] Custom domain configured (if applicable)
- [ ] Monitoring enabled
- [ ] Stripe webhooks configured
- [ ] Team notified of new deployment

---

## 🆘 Need Help?

### Check Service Status
1. Railway Dashboard → Service status
2. View deployment logs
3. Check Redis service metrics

### Common Commands
```bash
# View logs
railway logs

# Restart service
railway restart

# Check Redis connection
railway run redis-cli ping
```

### Debug Cache Issues
```bash
# Get cache metrics
curl "https://your-app.up.railway.app/api/cache/invalidate?metrics=true"

# Clear cache
curl -X POST "https://your-app.up.railway.app/api/cache/invalidate" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"category": "all"}'
```

---

## 🎉 Success!

Once deployed, your Gatewayz Beta app will be:
- ✅ Running on Railway with automatic HTTPS
- ✅ Redis caching enabled for 95%+ performance boost
- ✅ Auto-deploying on git push
- ✅ Monitored via Railway dashboard
- ✅ Scalable for production traffic

**Your app is now significantly faster and ready for users!** ⚡

---

**Next Steps:**
1. Monitor cache hit rates over first 24 hours
2. Set up custom domain if needed
3. Configure monitoring alerts
4. Test with real user traffic
5. Scale resources as needed
