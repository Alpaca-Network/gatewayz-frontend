# Vercel Deployment - Environment Variables Update

## Required Updates in Vercel Dashboard

Go to your Vercel project settings:
**https://vercel.com/your-team/gatewayz-backend/settings/environment-variables**

### 1. Update Supabase Variables (CRITICAL - New Project)

**Delete old variables:**
- ❌ Old `SUPABASE_URL` (poxomztzvdkxxpqotybo)
- ❌ Old `SUPABASE_KEY`

**Add new variables:**

| Variable Name | Value | Environment |
|--------------|--------|-------------|
| `SUPABASE_URL` | `https://ynleroehyrmaafkgjgmr.supabase.co` | Production, Preview, Development |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your service_role key) | Production, Preview, Development |

### 2. Add Stripe Variables (NEW - Production Keys)

| Variable Name | Value | Environment |
|--------------|--------|-------------|
| `STRIPE_SECRET_KEY` | `sk_live_51SAbMc...` (your live secret key from .env) | Production |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_51SAbMc...` (your publishable key from .env) | Production |
| `STRIPE_WEBHOOK_SECRET` | `whsec_lEQSob...` (your webhook secret from .env) | Production |

**Note:** Use test keys for Preview/Development environments if you want to test without real charges.

### 3. Verify Existing Variables (Keep These)

Make sure these are still present:

| Variable Name | Current Value | Notes |
|--------------|---------------|-------|
| `OPENROUTER_API_KEY` | `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` | Keep as-is |
| `OPENROUTER_SITE_URL` | `https://modelz.io` | Keep as-is |
| `OPENROUTER_SITE_NAME` | `Alpaca` | Keep as-is |
| `ADMIN_API_KEY` | `gjrxRyE-JjXwj8vR2HRTCwJ33fc5FmoDbJfRD_52UhQ` | Keep as-is |
| `RESEND_API_KEY` | `re_8nSfCD6U_B5AqufQerhUJMi2ckUtXRefs` | Keep as-is |
| `FROM_EMAIL` | `support@api.gatewayz.ai` | Keep as-is |
| `APP_NAME` | `Gatewayz` | Keep as-is |
| `FRONTEND_URL` | `https://gatewayz.ai` | Keep as-is |

### 4. Optional Variables (Add if Needed)

| Variable Name | Value | Purpose |
|--------------|--------|---------|
| `PORTKEY_API_KEY` | `qI5oh2MKDZ+B59yvv1esZrJTAQR+` | For Portkey model gateway |
| `CHUTES_API_KEY` | `cpk_ef9d6055429c45cab14ecb6ba073ba3f.e8060b822b7b5563847ade88501ef20a.Kv3kiiH1RInvHxtTCaJDN2Hmieu4frBW` | For Chutes integration |
| `CHUTES_BASE_URL` | `https://llm.chutes.ai` | Chutes endpoint |
| `DEEPINFRA_API_KEY` | (if using DeepInfra) | For image generation |

## Step-by-Step Instructions

### 1. Access Environment Variables

1. Go to: https://vercel.com/dashboard
2. Select your `gatewayz-backend` project
3. Click **Settings** tab
4. Click **Environment Variables** in the left sidebar

### 2. Remove Old Supabase Variables

1. Find `SUPABASE_URL` variable
2. Click **...** (three dots) → **Remove**
3. Confirm removal
4. Repeat for `SUPABASE_KEY`

### 3. Add New Supabase Variables

1. Click **Add New** button
2. Enter variable name: `SUPABASE_URL`
3. Enter value: `https://ynleroehyrmaafkgjgmr.supabase.co`
4. Select environments: ✅ Production, ✅ Preview, ✅ Development
5. Click **Save**
6. Repeat for `SUPABASE_KEY` with the service_role key

### 4. Add Stripe Variables

For each Stripe variable:

1. Click **Add New**
2. Enter variable name (e.g., `STRIPE_SECRET_KEY`)
3. Enter value from the table above
4. **IMPORTANT:** For secret keys, only select **Production** environment
5. Click **Save**

Repeat for:
- `STRIPE_SECRET_KEY` (Production only)
- `STRIPE_PUBLISHABLE_KEY` (All environments)
- `STRIPE_WEBHOOK_SECRET` (Production only)

### 5. Verify All Variables

Your environment variables should look like this:

```
✅ SUPABASE_URL (3 environments)
✅ SUPABASE_KEY (3 environments)
✅ STRIPE_SECRET_KEY (Production only)
✅ STRIPE_PUBLISHABLE_KEY (All environments)
✅ STRIPE_WEBHOOK_SECRET (Production only)
✅ OPENROUTER_API_KEY (existing)
✅ ADMIN_API_KEY (existing)
✅ RESEND_API_KEY (existing)
... (other existing variables)
```

## Deploy Changes

After updating environment variables:

### Option 1: Redeploy Current Deployment

1. Go to **Deployments** tab
2. Find latest deployment
3. Click **...** → **Redeploy**
4. Check **Use existing Build Cache**
5. Click **Redeploy**

### Option 2: Push New Commit

```bash
# From your stripe branch
git push origin stripe
```

Then merge to main if ready for production.

### Option 3: Deploy from Dashboard

1. Go to **Deployments** tab
2. Click **Deploy** button
3. Select branch: `stripe` or `main`
4. Click **Deploy**

## Verify Deployment

After deployment completes:

### 1. Check Health Endpoint

```bash
curl https://gatewayz-backend.vercel.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "openrouter": "connected"
}
```

### 2. Check Stripe Endpoint

```bash
curl https://gatewayz-backend.vercel.app/api/stripe/credit-packages
```

Should return credit packages.

### 3. Verify Database Connection

Check Vercel deployment logs for:
```
✅ Database initialized
✅ Stripe Payments (payments)
```

## Troubleshooting

### "Database connection failed"

**Problem:** Old Supabase credentials still cached

**Solution:**
1. Delete old `SUPABASE_URL` and `SUPABASE_KEY` completely
2. Add new ones
3. Trigger new deployment (don't use cache)

### "Stripe module not found"

**Problem:** `stripe` package not in requirements.txt

**Solution:**
1. Verify `requirements.txt` has `stripe==13.0.1`
2. Redeploy without cache

### "Webhook signature verification failed"

**Problem:** Wrong webhook secret or not updated

**Solution:**
1. Get fresh secret from Stripe dashboard
2. Update `STRIPE_WEBHOOK_SECRET` in Vercel
3. Redeploy

### Variables not taking effect

**Solution:**
1. Make sure you saved each variable
2. Redeploy **without** using build cache
3. Check deployment logs for variable loading

## Security Checklist

Before going live:

- [ ] Removed old Supabase credentials completely
- [ ] Using service_role key (not anon key) for SUPABASE_KEY
- [ ] Stripe secret key is only in Production environment
- [ ] Webhook secret matches Stripe dashboard
- [ ] No sensitive keys committed to git
- [ ] All environment variables marked as "Encrypted" in Vercel

## Production Readiness

After updating variables:

1. **Test in Preview Environment First**
   - Deploy to preview branch
   - Test all endpoints
   - Verify database connection
   - Test Stripe integration

2. **Deploy to Production**
   - Merge to main branch
   - Monitor deployment logs
   - Test health check
   - Test Stripe webhook

3. **Monitor First Payment**
   - Use Stripe test mode first if possible
   - Check webhook events in Stripe dashboard
   - Verify payment appears in Supabase
   - Confirm credits added to user

## Environment Variable Template

Copy this for your reference:

```env
# Supabase - NEW PROJECT
SUPABASE_URL=https://ynleroehyrmaafkgjgmr.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (copy from your .env file)

# Stripe - LIVE MODE
STRIPE_SECRET_KEY=sk_live_51SAbMc... (copy from your .env file)
STRIPE_PUBLISHABLE_KEY=pk_live_51SAbMc... (copy from your .env file)
STRIPE_WEBHOOK_SECRET=whsec_lEQSob... (copy from your .env file)

# Other (existing - keep as-is)
OPENROUTER_API_KEY=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
ADMIN_API_KEY=gjrxRyE-JjXwj8vR2HRTCwJ33fc5FmoDbJfRD_52UhQ
FRONTEND_URL=https://gatewayz.ai
```

## Next Steps

1. ✅ Update environment variables in Vercel
2. ✅ Deploy to production
3. ✅ Test health endpoint
4. ✅ Test Stripe endpoints
5. ✅ Monitor first payment
6. ✅ Update Stripe webhook URL if needed
