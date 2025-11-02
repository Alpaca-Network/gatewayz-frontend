# Subscription Configuration Error - Quick Fix Guide

## 🚨 Error Message
> "Subscription not configured. Please contact support."

This error appears when users try to subscribe to **Pro** or **Max** tiers.

---

## 🎯 Quick Fix (5 Minutes)

### 1. Get Your Stripe Price IDs

**Option A: Stripe Dashboard (Recommended)**

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Find **Pro** product: `prod_TKOqQPhVRxNp4Q`
   - Click on it → Copy the **Price ID** (starts with `price_`)
   - Should be **$10/month recurring**
3. Find **Max** product: `prod_TKOraBpWMxMAIu`
   - Click on it → Copy the **Price ID** (starts with `price_`)
   - Should be **$75/month recurring**

**Option B: Stripe CLI**

```bash
# List prices for Pro product
stripe prices list --product prod_TKOqQPhVRxNp4Q

# List prices for Max product
stripe prices list --product prod_TKOraBpWMxMAIu
```

### 2. Configure Environment Variables

**Local Development:**

```bash
# Create .env.local from template
cp .env.local.template .env.local

# Edit .env.local and add your price IDs:
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_1ABC...xyz  # Your Pro price ID
NEXT_PUBLIC_STRIPE_MAX_PRICE_ID=price_2DEF...uvw  # Your Max price ID
```

**Production (Firebase/Vercel/Other):**

Add these environment variables in your deployment platform:
- `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` → Your Pro price ID
- `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID` → Your Max price ID

### 3. Restart & Test

```bash
# Restart development server
pnpm dev

# Or for production, redeploy your app
```

Then test at: `http://localhost:3000/settings/credits`

### 4. Verify Configuration

Run the configuration checker:

```bash
node scripts/check-subscription-config.js
```

---

## 📋 Complete Checklist

- [ ] Stripe products exist with correct IDs:
  - [ ] Pro: `prod_TKOqQPhVRxNp4Q` ($10/month)
  - [ ] Max: `prod_TKOraBpWMxMAIu` ($75/month)
- [ ] Price IDs obtained from Stripe Dashboard
- [ ] `.env.local` created with price IDs
- [ ] Development server restarted
- [ ] Tested subscription flow at `/settings/credits`
- [ ] Production environment variables configured
- [ ] Backend endpoint `/api/stripe/subscription-checkout` implemented

---

## 🔍 Detailed Diagnosis

### Root Cause
The environment variables `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` and `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID` are not set, causing this check to fail:

**File:** `src/components/pricing/pricing-section.tsx:123`
```typescript
if (!tier.stripePriceId) {
  alert('Subscription not configured. Please contact support.');
  return;
}
```

### Flow Diagram
```
User clicks "Get Started" (Pro/Max)
    ↓
Frontend checks: tier.stripePriceId exists?
    ↓ NO
Error: "Subscription not configured"
    ↓ YES
Call: /api/stripe/subscribe
    ↓
Backend: Create Stripe Checkout Session
    ↓
Redirect user to Stripe Checkout
```

---

## 🛠️ Advanced Setup

### If Products Don't Exist in Stripe

Create them using Stripe CLI:

```bash
# Create Pro product
stripe products create \
  --name "Pro" \
  --description "Scale with confidence - $10/month" \
  --id prod_TKOqQPhVRxNp4Q

# Create Pro price
stripe prices create \
  --product prod_TKOqQPhVRxNp4Q \
  --unit-amount 1000 \
  --currency usd \
  --recurring interval=month

# Create Max product
stripe products create \
  --name "Max" \
  --description "Higher limits, priority access - $75/month" \
  --id prod_TKOraBpWMxMAIu

# Create Max price
stripe prices create \
  --product prod_TKOraBpWMxMAIu \
  --unit-amount 7500 \
  --currency usd \
  --recurring interval=month
```

**Important:** If you create new products with different IDs, update these files:
- `src/components/pricing/pricing-section.tsx` (lines 57, 76)
- `src/app/api/stripe/subscribe/route.ts` (line 43)

### Backend Requirements

Your backend must implement:

**Endpoint:** `POST /api/stripe/subscription-checkout`

**Request:**
```json
{
  "price_id": "price_xxxxx",
  "product_id": "prod_TKOqQPhVRxNp4Q",
  "customer_email": "user@example.com",
  "success_url": "https://beta.gatewayz.ai/settings/credits?session_id={{CHECKOUT_SESSION_ID}}",
  "cancel_url": "https://beta.gatewayz.ai/settings/credits",
  "mode": "subscription"
}
```

**Response:**
```json
{
  "session_id": "cs_xxxxx",
  "url": "https://checkout.stripe.com/pay/cs_xxxxx"
}
```

See `PRICING_SETUP.md` for complete backend implementation.

---

## 🧪 Testing

### Test Mode (Recommended First)
1. Use test mode Stripe keys (`pk_test_...`, `sk_test_...`)
2. Use test price IDs
3. Test card: `4242 4242 4242 4242`
4. Verify full subscription flow

### Production
1. Use live mode keys
2. Use live price IDs
3. Test with real payment (or use test mode in production initially)

### Manual Test Steps
1. Go to `/settings/credits`
2. Click "Get Started" on Pro tier
3. Should redirect to Stripe Checkout (not show error)
4. Complete checkout with test card
5. Should redirect back to `/settings/credits?session_id=cs_...`
6. Verify user tier is updated to "Pro"

---

## 🐛 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Subscription not configured" | Env vars not set | Set `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` and `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID` |
| "Price ID is required" (400) | Frontend sending empty price ID | Restart app after setting env vars |
| Backend 404 error | Endpoint not implemented | Implement `/api/stripe/subscription-checkout` in backend |
| "Invalid price" from Stripe | Wrong price ID | Verify price ID matches your Stripe environment (test/live) |
| User tier not updated | Webhook not working | Check webhook handler for `checkout.session.completed` |

---

## 📚 Related Documentation

- **SUBSCRIPTION_FIX.md** - Detailed fix guide with all options
- **PRICING_SETUP.md** - Complete pricing system setup
- **.env.local.template** - Environment variable template
- **.env.example** - Example environment configuration

---

## 🆘 Still Having Issues?

1. Run the config checker:
   ```bash
   node scripts/check-subscription-config.js
   ```

2. Check the logs:
   - Frontend: Browser console
   - Backend: Server logs for `/api/stripe/subscription-checkout`

3. Verify Stripe Dashboard:
   - Products exist with correct IDs
   - Prices are recurring (not one-time)
   - Using correct environment (test vs live)

4. Contact support with:
   - Error message screenshot
   - Config checker output
   - Browser console logs
   - Backend logs (if accessible)

---

## ✅ Success Criteria

You'll know it's working when:
- ✅ No error message when clicking "Get Started"
- ✅ Redirects to Stripe Checkout page
- ✅ After payment, returns to credits page
- ✅ User's tier is updated in database
- ✅ Subscription visible in Stripe Dashboard

---

**Last Updated:** 2025-10-30
