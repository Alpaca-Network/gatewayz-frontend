# Backend API Implementation Required

## 🎯 Summary

The frontend is correctly configured, but the **backend API** needs to implement the subscription endpoint.

## 📊 Current Architecture

```
User clicks "Get Started"
    ↓
Frontend: beta.gatewayz.ai/api/stripe/subscribe
    ↓ (proxies to)
Backend: api.gatewayz.ai/api/stripe/subscription-checkout ❌ (NOT IMPLEMENTED YET)
    ↓
Stripe: Creates Checkout Session
    ↓
Returns: Checkout URL to user
```

## ✅ Frontend Status (Already Done)

- ✅ Stripe Price IDs configured in Vercel
- ✅ `/api/stripe/subscribe` route exists in code (commit `8bb61c6`)
- ⏳ Needs Vercel redeploy to include this route
- ✅ Product IDs hardcoded in pricing component

## ❌ Backend Status (Needs Implementation)

**Missing Endpoint:** `POST /api/stripe/subscription-checkout`

This endpoint needs to be added to your backend at `https://api.gatewayz.ai`

---

## 🔧 Backend Implementation Required

### Endpoint Details

**URL:** `POST https://api.gatewayz.ai/api/stripe/subscription-checkout`

**Authentication:** Bearer token in `Authorization` header

**Request Body:**
```json
{
  "price_id": "price_1SNk2KLVT8n4vaEn7lHNPYWB",
  "product_id": "prod_TKOqQPhVRxNp4Q",
  "customer_email": "user@example.com",
  "success_url": "https://beta.gatewayz.ai/settings/credits?session_id={{CHECKOUT_SESSION_ID}}",
  "cancel_url": "https://beta.gatewayz.ai/settings/credits",
  "mode": "subscription"
}
```

**Expected Response:**
```json
{
  "session_id": "cs_test_xxxxx",
  "url": "https://checkout.stripe.com/pay/cs_test_xxxxx"
}
```

**Error Response:**
```json
{
  "detail": "Error message here"
}
```

---

## 💻 Implementation Example (Python/FastAPI)

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import stripe
from typing import Optional

router = APIRouter()

class SubscriptionCheckoutRequest(BaseModel):
    price_id: str
    product_id: str
    customer_email: Optional[str]
    success_url: str
    cancel_url: str
    mode: str = "subscription"

@router.post("/api/stripe/subscription-checkout")
async def create_subscription_checkout(
    request: SubscriptionCheckoutRequest,
    api_key: str = Depends(get_api_key_from_header),  # Your auth dependency
):
    """
    Create a Stripe Checkout Session for subscription
    """
    try:
        # Initialize Stripe
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

        # Get user from API key
        user = get_user_from_api_key(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Get or create Stripe customer
        customer_id = user.get("stripe_customer_id")

        if not customer_id and request.customer_email:
            # Create new Stripe customer
            customer = stripe.Customer.create(
                email=request.customer_email,
                metadata={
                    "user_id": user["id"],
                    "api_key": api_key[:20]  # Store partial key for reference
                }
            )
            customer_id = customer.id

            # Save customer ID to database
            update_user_stripe_customer(user["id"], customer_id)

        # Determine tier from product_id
        tier = "pro" if request.product_id == "prod_TKOqQPhVRxNp4Q" else "max"

        # Create Stripe Checkout Session
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price": request.price_id,
                "quantity": 1,
            }],
            mode=request.mode,
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            metadata={
                "user_id": user["id"],
                "product_id": request.product_id,
                "tier": tier,
                "api_key": api_key[:20]
            },
            subscription_data={
                "metadata": {
                    "user_id": user["id"],
                    "product_id": request.product_id,
                    "tier": tier
                }
            }
        )

        return {
            "session_id": checkout_session.id,
            "url": checkout_session.url
        }

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 📋 Backend Checklist

### 1. Install Dependencies
```bash
pip install stripe  # Python
# or
npm install stripe  # Node.js
```

### 2. Configure Stripe Secret Key
```bash
# In your backend .env file
STRIPE_SECRET_KEY=sk_live_xxxxx  # or sk_test_xxxxx for testing
```

### 3. Implement the Endpoint

Create the `/api/stripe/subscription-checkout` endpoint with:
- ✅ Validate API key from Authorization header
- ✅ Validate request body (price_id, product_id, etc.)
- ✅ Get or create Stripe customer for user
- ✅ Create Stripe Checkout Session in **subscription mode**
- ✅ Add metadata (user_id, product_id, tier)
- ✅ Return session_id and checkout URL

### 4. Implement Webhook Handler

You also need a webhook handler to process subscription events:

**Endpoint:** `POST /api/stripe/webhook`

**Events to Handle:**
- `checkout.session.completed` - Update user's tier and subscription status
- `customer.subscription.created` - Record subscription start
- `customer.subscription.updated` - Handle plan changes
- `customer.subscription.deleted` - Handle cancellations
- `invoice.paid` - Add credits to user account
- `invoice.payment_failed` - Handle failed payments

### 5. Database Updates Required

When subscription is confirmed (via webhook):

```sql
-- Add columns if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'basic';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_date BIGINT;

-- Update user when subscription is created
UPDATE users
SET
    tier = 'pro',  -- or 'max'
    stripe_product_id = 'prod_TKOqQPhVRxNp4Q',
    subscription_status = 'active',
    stripe_subscription_id = 'sub_xxxxx'
WHERE user_id = ?;
```

---

## 🧪 Testing

### Test Mode (Recommended First)

1. Use Stripe **test mode** keys:
   ```
   STRIPE_SECRET_KEY=sk_test_xxxxx
   ```

2. Frontend should use test price IDs (update in Vercel):
   ```
   NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_test_xxxxx
   NEXT_PUBLIC_STRIPE_MAX_PRICE_ID=price_test_xxxxx
   ```

3. Test card: `4242 4242 4242 4242`

### Test Flow

1. User clicks "Get Started" on Pro tier
2. Frontend calls: `POST /api/stripe/subscribe`
3. Frontend proxies to: `POST https://api.gatewayz.ai/api/stripe/subscription-checkout`
4. Backend creates Stripe Checkout Session
5. Backend returns: `{ session_id: "cs_test_xxx", url: "https://checkout.stripe.com/..." }`
6. Frontend redirects user to Stripe Checkout
7. User completes payment
8. Stripe redirects to: `https://beta.gatewayz.ai/settings/credits?session_id=cs_test_xxx`
9. Stripe webhook fires: `checkout.session.completed`
10. Backend updates user's tier to "pro"

---

## 🔍 Debugging

### Check Backend Logs

When frontend calls the endpoint, look for:
- Request received with correct body
- API key validation
- Stripe API calls
- Any errors

### Check Stripe Dashboard

- Go to https://dashboard.stripe.com/checkout/sessions
- Look for created sessions
- Verify they're in subscription mode
- Check metadata is included

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | API key not valid | Check Authorization header parsing |
| 400 Bad Request | Stripe error | Check Stripe secret key and price IDs |
| 500 Internal Error | Code exception | Check backend logs for stack trace |
| Session created but user not upgraded | Webhook not working | Implement webhook handler |

---

## 📚 Reference Documentation

- **PRICING_SETUP.md** - Original pricing setup guide (has backend example code)
- **SUBSCRIPTION_FIX.md** - Complete subscription fix documentation
- **Stripe Docs:** https://stripe.com/docs/billing/subscriptions/checkout
- **Stripe Checkout Sessions:** https://stripe.com/docs/api/checkout/sessions/create

---

## 🎯 Quick Start for Backend Developer

1. **Add endpoint:** `POST /api/stripe/subscription-checkout`
2. **Use Stripe SDK** to create checkout session in subscription mode
3. **Return:** `{ session_id, url }`
4. **Add webhook handler** for subscription events
5. **Test** with Stripe test mode first

---

## ✅ Success Criteria

Backend implementation is complete when:
- ✅ Endpoint responds without 404
- ✅ Returns valid Stripe Checkout URL
- ✅ Redirects user to Stripe successfully
- ✅ Webhook updates user's tier after payment
- ✅ Subscription visible in Stripe Dashboard
- ✅ User can access pro/max features

---

**Status:** Backend implementation required
**Priority:** High (blocking subscription feature)
**Estimated Time:** 2-4 hours for experienced backend developer
