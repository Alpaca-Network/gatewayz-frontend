# Pricing Page Setup Guide

This guide explains how to set up the Stripe subscription pricing for the Gatewayz platform.

## Overview

The pricing page has been added to `/settings/credits` and displays four tiers:

1. **Starter** ($0/month) - Free tier with $10 monthly credits
2. **Pro** ($10/month) - 50% discount on first $10 credits, access to 10,000+ models
3. **Max** ($75/month) - 50% discount on $150 credits, 10x more usage
4. **Enterprise** (Custom) - Contact sales for enterprise solutions

## Stripe Configuration

### Step 1: Stripe Products and Prices

The pricing page is already configured with the following Stripe Product IDs:

- **Pro Tier:** `prod_TKOqQPhVRxNp4Q` - $10/month
- **Max Tier:** `prod_TKOraBpWMxMAIu` - $75/month

These product IDs are hardcoded in the frontend and will be sent to the backend for database storage.

In your Stripe Dashboard (https://dashboard.stripe.com):

1. **Verify Pro Tier Product (prod_TKOqQPhVRxNp4Q):**
   - Go to Products → Find product with ID `prod_TKOqQPhVRxNp4Q`
   - Copy the Price ID (starts with `price_`)
   - This should be a recurring $10/month price

2. **Verify Max Tier Product (prod_TKOraBpWMxMAIu):**
   - Go to Products → Find product with ID `prod_TKOraBpWMxMAIu`
   - Copy the Price ID (starts with `price_`)
   - This should be a recurring $75/month price

### Step 2: Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Stripe Subscription Price IDs
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxx  # Replace with actual Pro price ID
NEXT_PUBLIC_STRIPE_MAX_PRICE_ID=price_xxxxxxxxxxxxx  # Replace with actual Max price ID
```

### Step 3: Backend API Integration

The frontend makes calls to the following API endpoints:

1. **Subscription Checkout** (`/api/stripe/subscribe`)
   - Frontend route: `/root/repo/src/app/api/stripe/subscribe/route.ts`
   - Calls backend: `POST ${backendUrl}/api/stripe/subscription-checkout`

   Expected backend request body:
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

   **Important:** The `product_id` field will be one of:
   - `prod_TKOqQPhVRxNp4Q` for Pro tier
   - `prod_TKOraBpWMxMAIu` for Max tier

   The backend should store this product ID in the database to track the user's subscription tier.

   Expected backend response:
   ```json
   {
     "session_id": "cs_xxxxx",
     "url": "https://checkout.stripe.com/pay/cs_xxxxx"
   }
   ```

2. **Credit Purchase** (`/api/stripe/checkout`)
   - Existing endpoint for one-time credit purchases
   - Not modified, continues to work for "Buy Credits" button

### Step 4: Backend Requirements

Your backend needs to implement the following endpoint:

**`POST /api/stripe/subscription-checkout`**

This endpoint should:
1. Validate the user's API key (from Authorization header)
2. Create or retrieve Stripe customer for the user
3. Create a Stripe Checkout Session in `subscription` mode
4. Return the session ID and checkout URL

Example backend implementation (Python/FastAPI):
```python
@router.post("/api/stripe/subscription-checkout")
async def create_subscription_checkout(
    request: SubscriptionCheckoutRequest,
    user_id: int = Depends(get_current_user_id)
):
    stripe.api_key = settings.STRIPE_SECRET_KEY

    # Get or create Stripe customer
    customer = get_or_create_stripe_customer(user_id, request.customer_email)

    # Create checkout session
    checkout_session = stripe.checkout.Session.create(
        customer=customer.id,
        payment_method_types=['card'],
        line_items=[{
            'price': request.price_id,
            'quantity': 1,
        }],
        mode='subscription',
        success_url=request.success_url,
        cancel_url=request.cancel_url,
        metadata={
            'user_id': user_id,
            'product_id': request.product_id,  # Store product ID in metadata
            'tier': 'pro' if request.product_id == 'prod_TKOqQPhVRxNp4Q' else 'max'
        }
    )

    return {
        'session_id': checkout_session.id,
        'url': checkout_session.url
    }
```

**Database Schema Recommendation:**
When the webhook confirms the subscription, store the `product_id` in your users table:
```sql
ALTER TABLE users ADD COLUMN stripe_product_id VARCHAR(255);
-- Then set to 'prod_TKOqQPhVRxNp4Q' for Pro or 'prod_TKOraBpWMxMAIu' for Max
```

### Step 5: Webhook Handling

Ensure your webhook handler processes these events:

- `checkout.session.completed` - Update user's tier and subscription status
  - Extract `product_id` from session metadata
  - Store `prod_TKOqQPhVRxNp4Q` or `prod_TKOraBpWMxMAIu` in user's database record
  - Set user tier to 'pro' or 'max' accordingly
- `customer.subscription.created` - Create subscription record
- `customer.subscription.updated` - Update subscription status
- `customer.subscription.deleted` - Handle cancellation
  - Clear the `stripe_product_id` field
  - Downgrade user to 'basic' tier
- `invoice.paid` - Add credits to user's account
- `invoice.payment_failed` - Handle failed payments

**Example Webhook Handler for checkout.session.completed:**
```python
if event['type'] == 'checkout.session.completed':
    session = event['data']['object']
    user_id = session['metadata']['user_id']
    product_id = session['metadata']['product_id']

    # Update user in database
    await update_user_subscription(
        user_id=user_id,
        stripe_product_id=product_id,
        stripe_customer_id=session['customer'],
        subscription_status='active'
    )
```

## Files Modified/Created

### New Files
1. `/src/components/pricing/pricing-section.tsx` - Pricing cards component
2. `/src/app/api/stripe/subscribe/route.ts` - Subscription checkout API route

### Modified Files
1. `/src/app/settings/credits/page.tsx` - Added `<PricingSection />` component
2. `/.env.example` - Added Stripe price ID environment variables

## Testing

1. **Local Testing:**
   ```bash
   npm run dev
   ```
   Navigate to http://localhost:3000/settings/credits

2. **Test Stripe Integration:**
   - Use Stripe test mode price IDs (start with `price_`)
   - Use test card: 4242 4242 4242 4242
   - Verify redirect to Stripe Checkout
   - Verify redirect back to success URL

3. **Test Webhooks:**
   - Use Stripe CLI for local webhook testing:
   ```bash
   stripe listen --forward-to localhost:8000/api/stripe/webhook
   ```

## Pricing Logic

- **Starter:** Free tier, no Stripe interaction needed
- **Pro & Max:** Redirect to Stripe Checkout for subscription
- **Enterprise:** Opens email client to contact sales

## User Flow

1. User clicks "Get Started" on Pro or Max tier
2. Frontend checks authentication
3. Frontend calls `/api/stripe/subscribe` with price ID
4. Backend creates Stripe Checkout Session
5. User redirected to Stripe Checkout
6. After payment, user redirected back to credits page
7. Success message shown, credits updated

## Troubleshooting

**Issue:** "Subscription not configured" error
- **Solution:** Ensure `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` and `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID` are set in `.env.local`

**Issue:** Backend returns 404 for subscription-checkout
- **Solution:** Implement the `/api/stripe/subscription-checkout` endpoint in your backend

**Issue:** User not authenticated
- **Solution:** Ensure user is signed in before attempting to subscribe

## Support

For questions or issues, contact the development team or refer to:
- Stripe Documentation: https://stripe.com/docs/billing/subscriptions/checkout
- Gatewayz Backend API Documentation
