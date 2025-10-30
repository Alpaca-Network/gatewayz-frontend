# 🚀 Quick Start: Fix Subscription Error

**Error:** "Subscription not configured. Please contact support."

## ⚡ 3-Step Fix (5 minutes)

### Step 1: Get Stripe Price IDs
Go to: https://dashboard.stripe.com/products

Find these products and copy their **Price IDs** (start with `price_`):
- **Pro** (`prod_TKOqQPhVRxNp4Q`) - Should be $10/month
- **Max** (`prod_TKOraBpWMxMAIu`) - Should be $75/month

### Step 2: Configure
```bash
# Copy template
cp .env.local.template .env.local

# Edit .env.local and add:
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_your_actual_pro_price_id
NEXT_PUBLIC_STRIPE_MAX_PRICE_ID=price_your_actual_max_price_id
```

### Step 3: Verify
```bash
# Check configuration
pnpm check-subscription

# If OK, restart dev server
pnpm dev
```

## ✅ Test
1. Go to: http://localhost:3000/settings/credits
2. Click "Get Started" on Pro tier
3. Should redirect to Stripe (not show error)

## 📚 Need More Help?
- **Quick Guide:** SUBSCRIPTION_CONFIG_README.md
- **Detailed Guide:** SUBSCRIPTION_FIX.md
- **Summary:** FIX_SUMMARY.md

## 🔧 Production Deployment
Add to your deployment platform:
```
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_MAX_PRICE_ID=price_xxxxx
```

Then redeploy.

---

**That's it!** 🎉
