# Subscription Configuration Fix

## Problem
Users see "Subscription not configured. Please contact support." when trying to subscribe to Pro or Max tiers.

## Root Cause
The environment variables `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` and `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID` are not configured, causing the subscription flow to fail.

## Solution

### Step 1: Get Stripe Price IDs

You need to retrieve the actual Stripe Price IDs for the Pro and Max products from your Stripe Dashboard.

1. **Log into Stripe Dashboard**: https://dashboard.stripe.com
2. **Navigate to Products**: Click on "Products" in the left sidebar
3. **Find Pro Product** (`prod_TKOqQPhVRxNp4Q`):
   - Search for product ID `prod_TKOqQPhVRxNp4Q`
   - Click on the product
   - Find the pricing section
   - Copy the **Price ID** (starts with `price_`)
   - It should be a **recurring price** set to **$10/month**

4. **Find Max Product** (`prod_TKOraBpWMxMAIu`):
   - Search for product ID `prod_TKOraBpWMxMAIu`
   - Click on the product
   - Find the pricing section
   - Copy the **Price ID** (starts with `price_`)
   - It should be a **recurring price** set to **$75/month**

### Step 2: Configure Environment Variables

#### For Local Development

Create a `.env.local` file in the root directory:

```bash
# Stripe Subscription Price IDs
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxx  # Replace with actual Pro price ID from Step 1
NEXT_PUBLIC_STRIPE_MAX_PRICE_ID=price_xxxxxxxxxxxxx  # Replace with actual Max price ID from Step 1

# Copy other required variables from .env.example
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_or_test_key
```

#### For Production Deployment

Add the environment variables to your deployment platform:

**Firebase App Hosting:**
```bash
firebase apphosting:secrets:set NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
firebase apphosting:secrets:set NEXT_PUBLIC_STRIPE_MAX_PRICE_ID
```

**Vercel:**
```bash
vercel env add NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
vercel env add NEXT_PUBLIC_STRIPE_MAX_PRICE_ID
```

**Or use the deployment platform's dashboard:**
- Go to your project settings
- Find Environment Variables section
- Add both variables with the price IDs from Step 1

### Step 3: Restart the Application

#### Local Development
```bash
# Stop the development server (Ctrl+C)
# Restart it
pnpm dev
```

#### Production
Redeploy the application after setting the environment variables.

### Step 4: Verify the Fix

1. Navigate to `/settings/credits` or the pricing section
2. Click "Get Started" on the Pro or Max tier
3. You should now be redirected to Stripe Checkout instead of seeing the error

## Alternative: Using Stripe CLI

If you have the Stripe CLI installed and authenticated:

```bash
# List all products and their prices
stripe products list --limit 100

# Get details for Pro product
stripe products retrieve prod_TKOqQPhVRxNp4Q

# Get prices for Pro product
stripe prices list --product prod_TKOqQPhVRxNp4Q

# Get details for Max product
stripe products retrieve prod_TKOraBpWMxMAIu

# Get prices for Max product
stripe prices list --product prod_TKOraBpWMxMAIu
```

## Creating Products and Prices (If They Don't Exist)

If the products don't exist in your Stripe account, you'll need to create them:

### Option 1: Stripe Dashboard

1. Go to Products → Create product
2. **Pro Product:**
   - Name: "Pro"
   - Description: "Scale with confidence"
   - Pricing: Recurring, $10/month
   - After creating, note the Product ID and Price ID

3. **Max Product:**
   - Name: "Max"
   - Description: "Higher limits, priority access"
   - Pricing: Recurring, $75/month
   - After creating, note the Product ID and Price ID

4. **Update the code** with the new Product IDs in:
   - `/root/repo/src/components/pricing/pricing-section.tsx` (lines 57 and 76)
   - `/root/repo/src/app/api/stripe/subscribe/route.ts` (line 43 comment)

### Option 2: Stripe CLI

```bash
# Create Pro product and price
stripe products create \
  --name "Pro" \
  --description "Scale with confidence"

# Note the product ID (prod_xxxxx), then create the price:
stripe prices create \
  --product prod_xxxxx \
  --unit-amount 1000 \
  --currency usd \
  --recurring interval=month

# Create Max product and price
stripe products create \
  --name "Max" \
  --description "Higher limits, priority access"

# Note the product ID, then create the price:
stripe prices create \
  --product prod_xxxxx \
  --unit-amount 7500 \
  --currency usd \
  --recurring interval=month
```

## Backend Requirements

Ensure your backend has the following endpoint implemented:

**POST `/api/stripe/subscription-checkout`**

Expected request body:
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

Expected response:
```json
{
  "session_id": "cs_xxxxx",
  "url": "https://checkout.stripe.com/pay/cs_xxxxx"
}
```

See `PRICING_SETUP.md` for complete backend implementation details.

## Troubleshooting

### Error: "Subscription not configured"
- **Cause**: Environment variables not set or empty
- **Solution**: Follow Step 1 and Step 2 above to configure the price IDs

### Error: "Price ID is required" (400)
- **Cause**: Frontend is sending an empty/undefined price ID
- **Solution**: Ensure environment variables are set and the app is restarted

### Error: Backend returns 404 for subscription-checkout
- **Cause**: Backend endpoint not implemented
- **Solution**: Implement the backend endpoint as described in PRICING_SETUP.md

### Error: Invalid price ID
- **Cause**: Wrong price ID or using test mode price ID in production
- **Solution**: Ensure you're using the correct price ID for your environment (test vs live)

### Subscription works but user tier not updated
- **Cause**: Webhook not processing subscription events
- **Solution**: Check webhook implementation and ensure it handles `checkout.session.completed` events

## Testing

### Test Mode (Recommended for initial setup)
1. Use Stripe test mode keys
2. Use test price IDs (start with `price_`)
3. Test card: `4242 4242 4242 4242`
4. Verify entire flow before going live

### Live Mode
1. Use live Stripe keys
2. Use live price IDs
3. Test with real payment method
4. Monitor Stripe Dashboard for successful subscriptions

## Quick Reference

**Environment Variables Required:**
- `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` - Stripe price ID for Pro tier ($10/month)
- `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID` - Stripe price ID for Max tier ($75/month)

**Files Involved:**
- `/root/repo/src/components/pricing/pricing-section.tsx` - Frontend pricing component
- `/root/repo/src/app/api/stripe/subscribe/route.ts` - API route for subscription checkout
- `/root/repo/.env.local` - Local environment variables (create this)
- `/root/repo/.env.example` - Example environment variables (reference only)

**Stripe Products:**
- Pro: `prod_TKOqQPhVRxNp4Q` ($10/month)
- Max: `prod_TKOraBpWMxMAIu` ($75/month)
