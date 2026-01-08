# Railway Deployment Configuration

## ✅ Stripe Price IDs Confirmed

Based on your Stripe Dashboard, here are the correct Price IDs:

- **Pro Tier:** `price_1SNk2KLVT8n4vaEn7lHNPYWB`
- **Max Tier:** `price_1SNk4ALVT8n4vaEnBpdJejhy`

## 🚀 Add to Railway Environment Variables

Go to your Railway project and add these environment variables:

### Required Variables:

```bash
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_1SNk2KLVT8n4vaEn7lHNPYWB
NEXT_PUBLIC_STRIPE_MAX_PRICE_ID=price_1SNk4ALVT8n4vaEnBpdJejhy
```

### Steps in Railway:

1. Go to your Railway project dashboard
2. Click on your service (frontend)
3. Go to the "Variables" tab
4. Click "New Variable"
5. Add both variables above
6. Click "Deploy" or wait for automatic redeployment

## 🧪 Local Testing (Optional)

To test locally before deploying:

```bash
# Create .env.local
cp .env.local.template .env.local

# Add these lines to .env.local:
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_1SNk2KLVT8n4vaEn7lHNPYWB
NEXT_PUBLIC_STRIPE_MAX_PRICE_ID=price_1SNk4ALVT8n4vaEnBpdJejhy

# Verify configuration
pnpm check-subscription

# Start dev server
pnpm dev
```

Then test at: http://localhost:3000/settings/credits

## ✅ Verification Checklist

After deploying to Railway:

- [ ] Environment variables added to Railway
- [ ] Railway redeployed successfully
- [ ] Visit: https://beta.gatewayz.ai/settings/credits
- [ ] Click "Get Started" on Pro tier
- [ ] Should redirect to Stripe Checkout (not show error)
- [ ] Complete test checkout with card: `4242 4242 4242 4242`
- [ ] Verify subscription appears in Stripe Dashboard

## ⚠️ Important Notes

### Currency Note:
Your Stripe products are configured in **CAD (Canadian Dollars)**:
- Pro: $10.00 CAD/month
- Max: $75.00 CAD/month

The frontend pricing display shows USD prices. You may want to verify this is intentional or update the frontend to show CAD.

### Product IDs (Already in Code):
These are already configured in the code and don't need to be changed:
- Pro Product: `prod_TKOqQPhVRxNp4Q` ✅
- Max Product: `prod_TKOraBpWMxMAIu` ✅

## 🐛 Troubleshooting

### If error persists after deployment:

1. **Check Railway logs:**
   ```bash
   # In Railway dashboard, check deployment logs
   # Verify environment variables are set
   ```

2. **Verify variables are loaded:**
   - Railway should show the variables in the Variables tab
   - Check that they start with `NEXT_PUBLIC_` (required for Next.js client-side)

3. **Force rebuild:**
   - Sometimes Railway caches builds
   - Trigger a manual redeploy in Railway dashboard

4. **Check browser console:**
   - Open DevTools → Console
   - Look for any Stripe-related errors
   - Verify the price IDs are being sent to the API

### If Stripe checkout fails:

1. **Verify backend endpoint exists:**
   - Your backend must have: `/api/stripe/subscription-checkout`
   - Check backend logs for errors

2. **Check Stripe webhook:**
   - Ensure webhook is configured to handle subscription events
   - Verify webhook secret is set in backend

3. **Test mode vs Live mode:**
   - These price IDs appear to be **live mode**
   - Ensure you're using live Stripe keys, not test keys
   - Or create test mode prices for testing first

## 📊 Stripe Configuration Summary

### Products (Already configured in code):
| Tier | Product ID | Price | Status |
|------|-----------|-------|--------|
| Pro | `prod_TKOqQPhVRxNp4Q` | $10 CAD/month | ✅ Active |
| Max | `prod_TKOraBpWMxMAIu` | $75 CAD/month | ✅ Active |

### Prices (Add to Railway):
| Tier | Price ID | Environment Variable |
|------|----------|---------------------|
| Pro | `price_1SNk2KLVT8n4vaEn7lHNPYWB` | `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` |
| Max | `price_1SNk4ALVT8n4vaEnBpdJejhy` | `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID` |

## 🎉 Success Criteria

Your subscription system is working when:
- ✅ No "Subscription not configured" error
- ✅ Redirects to Stripe Checkout with CAD pricing
- ✅ After payment, returns to credits page
- ✅ User's tier is updated in database
- ✅ Subscription visible in Stripe Dashboard

---

**Status:** Ready to deploy ✅
**Next Step:** Add variables to Railway and redeploy
