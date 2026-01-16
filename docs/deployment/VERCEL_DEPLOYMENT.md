# 🚀 Vercel Deployment - Subscription Fix

## ✅ Stripe Price IDs

Add these environment variables to **Vercel**:

```
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_1SNk2KLVT8n4vaEn7lHNPYWB
NEXT_PUBLIC_STRIPE_MAX_PRICE_ID=price_1SNk4ALVT8n4vaEnBpdJejhy
```

---

## 📋 How to Add Environment Variables in Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard:** https://vercel.com/dashboard
2. **Select your project** (gatewayz-frontend)
3. **Click "Settings"** tab
4. **Click "Environment Variables"** in the sidebar
5. **Add first variable:**
   - Name: `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`
   - Value: `price_1SNk2KLVT8n4vaEn7lHNPYWB`
   - Environment: Select **all** (Production, Preview, Development)
   - Click **"Save"**

6. **Add second variable:**
   - Name: `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID`
   - Value: `price_1SNk4ALVT8n4vaEnBpdJejhy`
   - Environment: Select **all** (Production, Preview, Development)
   - Click **"Save"**

7. **Redeploy:**
   - Go to **"Deployments"** tab
   - Click the **"..."** menu on the latest deployment
   - Click **"Redeploy"**
   - Wait for deployment to complete (1-3 minutes)

### Method 2: Via Vercel CLI

If you have Vercel CLI installed:

```bash
# Add variables
vercel env add NEXT_PUBLIC_STRIPE_PRO_PRICE_ID production
# When prompted, enter: price_1SNk2KLVT8n4vaEn7lHNPYWB

vercel env add NEXT_PUBLIC_STRIPE_MAX_PRICE_ID production
# When prompted, enter: price_1SNk4ALVT8n4vaEnBpdJejhy

# Redeploy
vercel --prod
```

---

## 🎯 Visual Guide

Your Vercel Environment Variables page should look like this:

```
┌────────────────────────────────────────────┬──────────────────────────────────┬────────────────────────┐
│ Name                                        │ Value                            │ Environments           │
├────────────────────────────────────────────┼──────────────────────────────────┼────────────────────────┤
│ NEXT_PUBLIC_STRIPE_PRO_PRICE_ID            │ price_1SNk2KLVT8n4vaEn7lHN...   │ Production, Preview... │
│ NEXT_PUBLIC_STRIPE_MAX_PRICE_ID            │ price_1SNk4ALVT8n4vaEnBpd...    │ Production, Preview... │
│ NEXT_PUBLIC_API_BASE_URL                   │ https://api.gatewayz.ai          │ Production, Preview... │
│ ... (other variables)                      │ ...                              │ ...                    │
└────────────────────────────────────────────┴──────────────────────────────────┴────────────────────────┘
```

---

## ⚠️ Important: Redeployment Required

**Critical:** Vercel needs to rebuild your app with the new environment variables. Simply adding them isn't enough!

**After adding variables, you MUST:**
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click **"..."** → **"Redeploy"**
4. Wait for build to complete

Or push a new commit to trigger automatic deployment.

---

## ✅ Testing After Deployment

Once Vercel finishes redeploying:

1. **Hard refresh:** `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. **Visit:** https://beta.gatewayz.ai/settings/credits
3. **Click "Get Started"** on Pro tier
4. **Expected:** Redirects to Stripe Checkout ✅
5. **Not expected:** "Subscription not configured" error ❌

---

## 🔍 Verify Variables Are Loaded

To check if variables are loaded in production:

1. **Open browser DevTools** (F12)
2. **Console tab**
3. **Type:** `process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`
4. **Should show:** `undefined` (it's only available at build time, not runtime)

Better way:
1. View page source
2. Search for `price_1SNk` in the JavaScript bundles
3. If you find it, variables are loaded ✅

---

## 🐛 Troubleshooting

### Issue: Variables added but error persists

**Cause:** Vercel hasn't rebuilt with new variables

**Solution:**
1. Go to Deployments tab
2. Redeploy the latest deployment
3. Wait for build to complete
4. Hard refresh browser

### Issue: Can't find Environment Variables section

**Steps:**
1. Click on your project
2. Click "Settings" (top navigation)
3. Look in left sidebar for "Environment Variables"
4. If missing, check you have project access

### Issue: Variables not showing in dropdown

**Solution:**
- Make sure to select **all environments** (Production, Preview, Development)
- Don't leave any unchecked

### Issue: Build fails after adding variables

**Solution:**
- Check build logs in Deployments tab
- Variables should not break the build
- Values might be malformed (check for extra spaces)

---

## 📊 Configuration Summary

### Environment Variables to Add:

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | `price_1SNk2KLVT8n4vaEn7lHNPYWB` | Pro tier ($10 CAD/month) |
| `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID` | `price_1SNk4ALVT8n4vaEnBpdJejhy` | Max tier ($75 CAD/month) |

### Already Configured (in code):

| Item | Value |
|------|-------|
| Pro Product ID | `prod_TKOqQPhVRxNp4Q` |
| Max Product ID | `prod_TKOraBpWMxMAIu` |
| API Route | `/api/stripe/subscribe` |

---

## 🎉 Success Checklist

- [ ] Opened Vercel Dashboard
- [ ] Went to project Settings → Environment Variables
- [ ] Added `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`
- [ ] Added `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID`
- [ ] Selected all environments for both variables
- [ ] Went to Deployments tab
- [ ] Redeployed latest deployment
- [ ] Waited for build to complete
- [ ] Hard refreshed browser
- [ ] Tested at `/settings/credits`
- [ ] Clicked "Get Started" on Pro tier
- [ ] Successfully redirected to Stripe Checkout ✅

---

## 🚀 Quick Commands

```bash
# If using Vercel CLI
vercel env add NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
vercel env add NEXT_PUBLIC_STRIPE_MAX_PRICE_ID
vercel --prod

# Or trigger redeploy via git push
git push origin main
```

---

## ⚙️ Alternative: Add via vercel.json (Not Recommended)

You can add to `vercel.json` but **environment variables in dashboard are preferred**:

```json
{
  "env": {
    "NEXT_PUBLIC_STRIPE_PRO_PRICE_ID": "price_1SNk2KLVT8n4vaEn7lHNPYWB",
    "NEXT_PUBLIC_STRIPE_MAX_PRICE_ID": "price_1SNk4ALVT8n4vaEnBpdJejhy"
  }
}
```

**Not recommended because:**
- Exposes sensitive IDs in version control
- Less flexible (can't change without code deploy)
- Dashboard method is more secure

---

## 📞 Need Help?

**If error persists after following all steps:**

1. Share screenshot of Vercel Environment Variables page
2. Share screenshot of latest deployment status
3. Check browser console for specific errors
4. Share deployment logs from Vercel

---

**Status:** Ready to deploy to Vercel ✅
**Next Step:** Add variables to Vercel dashboard and redeploy
