# Vercel Redis Setup Guide (Frontend Deployment)

## Overview

This guide shows you how to add Redis to your **Gatewayz Beta frontend** deployed on Vercel. The frontend uses Redis for caching to improve performance.

## 🎯 Architecture

```
Vercel (Frontend - Next.js)
    ↓ connects to
Redis Instance (Managed Service)
    ↓ caches data from
Backend API (api.gatewayz.ai)
```

**Important**: Your frontend on Vercel needs a Redis instance it can connect to. You have several options:

1. **Vercel KV** (Recommended) - Integrated with Vercel, serverless-friendly
2. **Upstash** - Serverless Redis, works great with Vercel
3. **Redis Cloud** - Managed Redis, reliable and scalable
4. **Railway Redis** - If your backend is on Railway, can share Redis instance

---

## 🚀 Option 1: Vercel KV (Recommended)

**Best for**: Vercel deployments, serverless-optimized, easy integration

### Step 1: Create Vercel KV Database

1. **Go to your Vercel dashboard**
   - Visit https://vercel.com/dashboard
   - Select your project (gatewayz-frontend)

2. **Navigate to Storage tab**
   - Click **"Storage"** in the top navigation
   - Click **"Create Database"**

3. **Select KV (Redis)**
   - Choose **"KV"** (Key-Value Store powered by Redis)
   - Select a region close to your users
   - Click **"Create"**

4. **Connect to your project**
   - Vercel will prompt you to connect the KV store to your project
   - Click **"Connect"**
   - Select your environment (Production, Preview, Development)

### Step 2: Environment Variables (Auto-configured)

Vercel KV automatically adds these environment variables to your project:

```bash
KV_REST_API_URL=https://your-kv-instance.kv.vercel-storage.com
KV_REST_API_TOKEN=your-token
KV_REST_API_READ_ONLY_TOKEN=your-read-only-token
KV_URL=redis://default:token@host:port
```

### Step 3: Update Code to Use Vercel KV

Since Vercel KV uses a REST API (different from traditional Redis), you need to update the Redis client:

**Install Vercel KV SDK:**
```bash
pnpm add @vercel/kv
```

**Update `src/lib/redis-client.ts`:**
```typescript
import { createClient } from '@vercel/kv';

// Check if using Vercel KV
const isVercelKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

let redisClient: any = null;

export function getRedisClient() {
  if (!redisClient) {
    if (isVercelKV) {
      // Use Vercel KV
      redisClient = createClient({
        url: process.env.KV_REST_API_URL!,
        token: process.env.KV_REST_API_TOKEN!,
      });
      console.log('[Redis] Using Vercel KV');
    } else {
      // Use ioredis for traditional Redis
      const Redis = require('ioredis');
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        // ... existing config
      });
      console.log('[Redis] Using traditional Redis');
    }
  }
  return redisClient;
}
```

**Note**: Vercel KV has the same Redis API, so your existing cache strategies will work without changes!

### Step 4: Deploy

Push your changes:
```bash
git add -A
git commit -m "feat: add Vercel KV support"
git push
```

Vercel will automatically deploy with Redis caching enabled. ✅

---

## 🚀 Option 2: Upstash (Serverless Redis)

**Best for**: Serverless deployments, pay-per-request pricing, global edge caching

### Step 1: Create Upstash Redis Database

1. **Sign up at Upstash**
   - Go to https://console.upstash.com/
   - Create a free account

2. **Create Redis Database**
   - Click **"Create Database"**
   - Choose a region close to your Vercel deployment
   - Select **"Global"** for edge caching (recommended)
   - Click **"Create"**

3. **Get Connection Details**
   - Copy **Endpoint** (e.g., `us1-sweet-possum-12345.upstash.io`)
   - Copy **Port** (usually `6379` or `6380`)
   - Copy **Password**

### Step 2: Configure Vercel Environment Variables

1. **Go to Vercel Dashboard**
   - Select your project
   - Go to **Settings** → **Environment Variables**

2. **Add Redis Variables**

```bash
REDIS_HOST=us1-sweet-possum-12345.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-upstash-password
REDIS_DB=0
```

3. **Apply to all environments**
   - Check: Production, Preview, Development
   - Click **"Save"**

### Step 3: Redeploy

Trigger a new deployment:
- Push a commit, or
- Go to Deployments → Redeploy

That's it! Redis caching is now active. ✅

---

## 🚀 Option 3: Redis Cloud

**Best for**: Production workloads, need high availability, want managed service

### Step 1: Create Redis Cloud Database

1. **Sign up at Redis Cloud**
   - Go to https://redis.com/try-free/
   - Create a free account (30 MB free)

2. **Create Database**
   - Click **"New Database"**
   - Select cloud provider (AWS, GCP, Azure)
   - Choose region close to your Vercel deployment region
   - Click **"Activate"**

3. **Get Connection Details**
   - Copy **Endpoint** (e.g., `redis-12345.c123.us-east-1-4.ec2.cloud.redislabs.com`)
   - Copy **Port** (usually custom port like `12345`)
   - Copy **Password** from Security settings

### Step 2: Configure Vercel Environment Variables

Same as Upstash - add to Vercel:

```bash
REDIS_HOST=redis-12345.c123.us-east-1-4.ec2.cloud.redislabs.com
REDIS_PORT=12345
REDIS_PASSWORD=your-redis-cloud-password
REDIS_DB=0
```

### Step 3: Redeploy

Push or redeploy on Vercel. ✅

---

## 🚀 Option 4: Railway Redis (Shared with Backend)

**Best for**: If your backend API is on Railway, can share the same Redis instance

### Step 1: Get Railway Redis Connection Details

1. **Go to Railway Dashboard**
   - Open your backend project
   - Select the Redis service

2. **Copy Connection Details**
   - Go to **Variables** tab
   - Copy: `REDISHOST`, `REDISPORT`, `REDISPASSWORD`

3. **Make Redis Publicly Accessible** (if needed)
   - Go to Redis service → **Settings**
   - Enable **Public Networking**
   - Note the public URL

### Step 2: Configure Vercel Environment Variables

Add to Vercel:

```bash
REDIS_HOST=railway-redis-public-url.railway.app
REDIS_PORT=6379
REDIS_PASSWORD=your-railway-redis-password
REDIS_DB=0
```

### Step 3: Redeploy

Deploy on Vercel. ✅

**Security Note**: Using public networking exposes Redis. Ensure strong password and consider IP restrictions.

---

## ✅ Verification

After deployment, verify Redis is working:

### 1. Check Vercel Deployment Logs

Go to Vercel → Deployments → Latest → Function Logs

Look for:
```
[Redis] Connected successfully
[Redis] Ready to accept commands
```

### 2. Test Cache Endpoint

```bash
curl "https://your-app.vercel.app/api/cache/invalidate?metrics=true" \
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
      "hits": 100,
      "misses": 5,
      "hitRate": 0.95
    }
  }
}
```

### 3. Check Performance

Test model loading:
```bash
# First request (cache miss)
time curl https://your-app.vercel.app/api/models?gateway=all
# ~15-30 seconds

# Second request (cache hit)
time curl https://your-app.vercel.app/api/models?gateway=all
# ~50ms ⚡
```

---

## 📊 Expected Performance

After Redis is active:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Model loading | 5-30s | <50ms | **95%+ faster** |
| Chat sessions | 500ms-2s | <100ms | **80-90% faster** |
| User profiles | 200-500ms | <20ms | **90%+ faster** |
| API rate limit | 100% | 25-40% | **60-75% reduction** |

---

## 💰 Cost Comparison

| Service | Free Tier | Paid Tier | Best For |
|---------|-----------|-----------|----------|
| **Vercel KV** | 256 MB, 100K requests/day | $1/GB/month | Vercel integration |
| **Upstash** | 10K commands/day | Pay-per-request | Serverless |
| **Redis Cloud** | 30 MB | $5/month (250MB) | Production |
| **Railway** | $5/month (shared) | Usage-based | Backend on Railway |

---

## 🔒 Security Best Practices

### 1. Use Environment Variables (Never Hardcode)

✅ **Good:**
```bash
REDIS_PASSWORD=${{ secrets.REDIS_PASSWORD }}
```

❌ **Bad:**
```typescript
const password = 'my-secret-password';  // Never do this!
```

### 2. Enable TLS/SSL in Production

For traditional Redis, add to environment:
```bash
REDIS_TLS=true
```

Update `redis-client.ts`:
```typescript
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
};
```

### 3. Use Read-Only Tokens When Possible

For Vercel KV:
```bash
KV_REST_API_READ_ONLY_TOKEN=your-read-only-token
```

### 4. Restrict IP Access (if possible)

Configure Redis firewall to only allow Vercel IPs.

---

## 🐛 Troubleshooting

### Issue: "ECONNREFUSED" Error

**Symptom**: Logs show connection refused

**Solutions**:
1. Check Redis is running and accessible
2. Verify `REDIS_HOST` and `REDIS_PORT` are correct
3. Check firewall rules allow Vercel IP ranges
4. Ensure Redis is publicly accessible (or use private network)

### Issue: "NOAUTH Authentication required"

**Symptom**: Authentication error

**Solutions**:
1. Verify `REDIS_PASSWORD` is set correctly
2. Check password doesn't have special characters causing issues
3. Try connecting with `redis-cli` to test credentials

### Issue: Cache Not Working

**Symptom**: No performance improvement

**Solutions**:
1. Check Vercel deployment logs for Redis connection messages
2. Test cache endpoint: `GET /api/cache/invalidate?metrics=true`
3. Verify environment variables are set in Vercel
4. Check Redis instance is not full (memory limit reached)

### Issue: "Too Many Open Connections"

**Symptom**: Connection pool exhausted

**Solutions**:
1. Check connection limits on your Redis plan
2. Reduce `maxRetriesPerRequest` in redis-client.ts
3. Upgrade Redis plan for more connections
4. Implement connection pooling properly

---

## 🚀 Production Deployment Checklist

- [ ] Redis instance created (Vercel KV, Upstash, or Redis Cloud)
- [ ] Environment variables configured in Vercel
- [ ] TLS/SSL enabled for production
- [ ] Strong password set (20+ characters)
- [ ] IP restrictions configured (if possible)
- [ ] Monitoring enabled (Vercel Analytics + Redis metrics)
- [ ] Backup strategy in place
- [ ] Cache invalidation workflow documented
- [ ] Team has access to Redis dashboard
- [ ] Verified Redis connection in production logs
- [ ] Tested cache performance in production

---

## 📈 Monitoring

### Vercel Dashboard

1. **Function Logs**
   - Go to Deployments → Function Logs
   - Filter for `[Redis]` or `[Cache]`

2. **Analytics**
   - Monitor API response times
   - Check for errors related to caching

### Redis Metrics

1. **Vercel KV Dashboard**
   - View requests, storage, and performance

2. **Upstash Console**
   - Monitor commands/sec, memory usage, hit rate

3. **Redis Cloud Dashboard**
   - Track throughput, memory, connections

### Cache Metrics API

```bash
# Check cache performance
curl "https://your-app.vercel.app/api/cache/invalidate?metrics=true"
```

---

## 🔄 Cache Invalidation

### Manual Invalidation

```bash
# Invalidate all caches
curl -X POST https://your-app.vercel.app/api/cache/invalidate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"category": "all"}'

# Invalidate specific category
curl -X POST https://your-app.vercel.app/api/cache/invalidate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"category": "models"}'
```

### Automatic Invalidation

Cache automatically invalidates on:
- Session creation/deletion
- User profile updates
- Data modifications

---

## 📚 Additional Resources

- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Upstash Documentation](https://docs.upstash.com/)
- [Redis Cloud Documentation](https://docs.redis.com/latest/rc/)
- Project Documentation:
  - `REDIS_INTEGRATION.md` - Complete implementation details
  - `REDIS_QUICK_START.md` - Quick setup guide
  - `RAILWAY_REDIS_SETUP.md` - Backend service setup

---

## ✅ Success Indicators

You'll know Redis is working when:

1. ✅ Vercel logs show `[Redis] Connected successfully`
2. ✅ Logs show `[Cache HIT]` messages
3. ✅ Cache metrics show 80%+ hit rates
4. ✅ Model loading is <100ms (was 5-30s)
5. ✅ Chat sessions load instantly
6. ✅ User profiles load <50ms
7. ✅ Vercel function execution times reduced significantly

---

**Redis integration on Vercel complete!** Your app is now significantly faster. ⚡
