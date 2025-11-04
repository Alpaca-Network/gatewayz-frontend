# 🚀 Deployment Checklist - Featherless Fix

## Issue

Frontend shows **Featherless: 0 models** because `FEATHERLESS_API_KEY` is not set in production environment.

## ✅ Solution

Add the `FEATHERLESS_API_KEY` environment variable to your production deployment.

---

## Vercel Deployment

### Step 1: Add Environment Variable

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **gatewayz-backend**
3. Click **Settings** → **Environment Variables**
4. Add new variable:
   - **Name:** `FEATHERLESS_API_KEY`
   - **Value:** `your-featherless-api-key` (get from [featherless.ai](https://featherless.ai))
   - **Environments:** Check all (Production, Preview, Development)
5. Click **Save**

### Step 2: Redeploy

Option A - Auto Deploy (Recommended):
```bash
git push origin main
```

Option B - Manual Deploy:
```bash
vercel --prod
```

### Step 3: Verify

```bash
# Check environment variables
vercel env ls

# Test endpoint
curl "https://your-app.vercel.app/models?gateway=featherless&limit=5"
```

Expected response:
```json
{
  "total": 6382,
  "returned": 5,
  "gateway": "featherless"
}
```

---

## Railway Deployment

### Step 1: Add Environment Variable

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Select your project
3. Click **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Variable:** `FEATHERLESS_API_KEY`
   - **Value:** `your-featherless-api-key`
6. Click **Add**

### Step 2: Redeploy

Railway auto-deploys on environment variable changes. Or manually:

1. Go to **Deployments** tab
2. Click **Deploy** button

### Step 3: Verify

```bash
curl "https://your-app.railway.app/models?gateway=featherless&limit=5"
```

---

## All Provider Keys (Optional)

While you're adding environment variables, consider adding these for full functionality:

| Variable | Purpose | Models |
|----------|---------|--------|
| `FEATHERLESS_API_KEY` | Featherless.ai | 6,382 |
| `CHUTES_API_KEY` | Chutes.ai | 104 (optional - works without key) |
| `PORTKEY_API_KEY` | Portkey routing | Variable |

---

## Testing Locally

Before deploying, test locally:

```bash
# 1. Add to .env file
echo "FEATHERLESS_API_KEY=your-key-here" >> .env

# 2. Test loading
python3 test_featherless_endpoint.py

# 3. Start server
uvicorn src.main:app --reload

# 4. Test endpoint
curl "http://localhost:8000/models?gateway=featherless&limit=5"
```

Expected output:
```
✓ Successfully loaded 6382 Featherless models
```

---

## Quick Fix Summary

**Problem:** Featherless shows 0 models in production
**Cause:** Missing `FEATHERLESS_API_KEY` environment variable
**Solution:** Add the API key to your deployment platform
**Result:** 6,382 Featherless models will be available

---

## Getting Featherless API Key

1. Visit [https://featherless.ai](https://featherless.ai)
2. Sign up / Log in
3. Navigate to API Keys section
4. Generate new API key
5. Copy the key (starts with `rc_...`)
6. Add to your deployment environment variables

---

## All Available Gateways

After fixing Featherless, you'll have:

| Gateway | Endpoint | Models | Status |
|---------|----------|--------|--------|
| OpenRouter | `?gateway=openrouter` | ~200+ | ✅ Working |
| Portkey | `?gateway=portkey` | Variable | ✅ Working |
| Featherless | `?gateway=featherless` | 6,382 | ⚠️ Needs API key |
| Chutes | `?gateway=chutes` | 104 | ✅ Working |
| All | `?gateway=all` | Combined | ✅ Working |

---

## Support

If issues persist:
1. Check deployment logs
2. Verify API key is valid
3. Test the key locally first
4. Ensure key has proper permissions

**Questions?** Check docs/ENVIRONMENT_SETUP.md for detailed setup instructions.
