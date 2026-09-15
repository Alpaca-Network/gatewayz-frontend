# Stripe Subscription Upgrade Fix - Documentation

## Problem Statement

Trial users were not being properly upgraded to Pro or Max accounts after completing Stripe payments for subscriptions.

## Root Cause

The frontend Stripe webhook handler (`/api/stripe/webhook`) was incorrectly processing **all** `checkout.session.completed` events the same way, including subscription purchases. This caused the following issues:

1. When a user completed a subscription purchase (Pro/Max tier), the webhook received the `checkout.session.completed` event
2. The webhook tried to process it as a one-time credit purchase
3. It sent the payment data to the `/user/credits` endpoint, which is designed for credit purchases, not subscription tier upgrades
4. The backend's own webhook handler couldn't properly process the tier upgrade because the frontend had already "handled" the event incorrectly
5. Result: Users' payments were successful, but their tier remained as "trial" instead of upgrading to "pro" or "max"

## Solution

Modified the webhook handler to distinguish between subscription checkouts and one-time purchases:

### Key Changes

**File:** `src/app/api/stripe/webhook/route.ts`

1. **Added subscription detection**: Check `session.mode === 'subscription'` to identify subscription checkouts
2. **Early return for subscriptions**: When a subscription is detected, the frontend webhook returns early and lets the backend webhook handle the tier upgrade
3. **Preserved credit purchase flow**: One-time credit purchases (`mode === 'payment'`) continue to be processed through `/user/credits` endpoint
4. **Enhanced logging**: Added detailed logging for subscription events to aid in debugging

### Code Changes

```typescript
// For subscription checkouts, the backend webhook handles tier upgrades
// Frontend webhook should only process one-time credit purchases
if (session.mode === 'subscription') {
  console.log('Subscription checkout detected - backend will handle tier upgrade via webhook');
  console.log('Subscription details:', {
    mode: session.mode,
    tier,
    userId,
    userEmail,
    subscriptionId: session.subscription,
  });
  // Return 200 - backend webhook will handle the tier upgrade
  return NextResponse.json(
    { received: true, message: 'Subscription handled by backend webhook' },
    { status: 200 }
  );
}
```

## Architecture

### Before the Fix

```
User completes subscription payment
         ↓
Stripe sends webhook to frontend
         ↓
Frontend webhook processes as credit purchase
         ↓
Calls /user/credits endpoint (WRONG)
         ↓
Backend webhook also receives event
         ↓
Backend tries to update tier (conflicts/fails)
         ↓
User remains on "trial" tier ❌
```

### After the Fix

```
User completes subscription payment
         ↓
Stripe sends webhook to frontend
         ↓
Frontend webhook detects mode === 'subscription'
         ↓
Returns early, logs subscription details
         ↓
Backend webhook receives event
         ↓
Backend updates user tier to "pro" or "max"
         ↓
User is properly upgraded ✅
```

## Testing

### Test Coverage

Created comprehensive tests in `src/app/api/stripe/webhook/__tests__/route.test.ts`:

1. **Subscription handling tests**
   - Verifies subscription checkouts skip frontend processing
   - Confirms `/user/credits` is NOT called for subscriptions
   - Validates subscription details are logged for debugging

2. **One-time payment tests**
   - Confirms credit purchases still work correctly
   - Verifies `/user/credits` IS called for one-time payments
   - Handles missing credits metadata gracefully

3. **Webhook security tests**
   - Validates signature verification
   - Handles missing configuration
   - Returns appropriate status codes

4. **Edge case tests**
   - Handles unhandled event types
   - Validates error handling

### Manual Testing Steps

1. **Test Pro Tier Upgrade:**
   ```
   1. Sign up as a new trial user
   2. Navigate to /settings/credits
   3. Click "Get Started" on Pro tier ($10/month)
   4. Complete Stripe checkout with test card: 4242 4242 4242 4242
   5. Verify redirect to success page
   6. Check user tier is now "pro" (not "trial")
   7. Verify subscription is active in Stripe dashboard
   ```

2. **Test Max Tier Upgrade:**
   ```
   1. Use an existing trial user
   2. Navigate to /settings/credits
   3. Click "Get Started" on Max tier ($75/month)
   4. Complete Stripe checkout with test card
   5. Verify tier upgrades to "max"
   ```

3. **Test Credit Purchase Still Works:**
   ```
   1. Navigate to /settings/credits
   2. Click "Buy Credits" button
   3. Complete one-time purchase
   4. Verify credits are added to account
   ```

### Monitoring

Check webhook logs for successful processing:

**For subscriptions (should see):**
```
Checkout session completed: { sessionId: 'cs_...', mode: 'subscription' }
Subscription checkout detected - backend will handle tier upgrade via webhook
Subscription details: { mode: 'subscription', tier: 'pro', userId: '123', ... }
```

**For credit purchases (should see):**
```
Checkout session completed: { sessionId: 'cs_...', mode: 'payment' }
Crediting 10000 credits to user 123
Successfully processed payment and credited user
```

## Backend Requirements

For this fix to work properly, the backend must:

1. **Handle `checkout.session.completed` webhook events** from Stripe
2. **Extract metadata** from the checkout session:
   - `user_id` or `email` to identify the user
   - `tier` to know which tier to upgrade to ('pro' or 'max')
   - `product_id` to verify the subscription product

3. **Update user record** in database:
   ```python
   # Example backend webhook handler
   if event['type'] == 'checkout.session.completed':
       session = event['data']['object']
       
       if session['mode'] == 'subscription':
           user_id = session['metadata']['user_id']
           tier = session['metadata']['tier']  # 'pro' or 'max'
           
           # Update user tier
           await db.execute(
               "UPDATE users SET tier = $1, subscription_status = 'active' WHERE user_id = $2",
               tier, user_id
           )
   ```

4. **Ensure webhook is properly configured** in Stripe dashboard to send events to backend

## Deployment Checklist

- [x] Frontend webhook updated to detect subscription mode
- [x] Tests created to validate subscription handling
- [x] Documentation written for future reference
- [ ] Backend webhook handler validated to process subscriptions
- [ ] Stripe webhook endpoint configured in Stripe dashboard
- [ ] Test in staging environment with test mode Stripe
- [ ] Verify existing trial users can upgrade
- [ ] Verify new users can subscribe directly
- [ ] Monitor production logs after deployment

## Related Files

- `src/app/api/stripe/webhook/route.ts` - Webhook handler (modified)
- `src/app/api/stripe/webhook/__tests__/route.test.ts` - Tests (created)
- `src/app/api/stripe/subscribe/route.ts` - Subscription checkout endpoint
- `src/lib/tier-utils.ts` - Tier detection utilities
- `docs/BACKEND_TIER_INTEGRATION.md` - Backend integration docs

## References

- [Stripe Webhook Documentation](https://stripe.com/docs/webhooks)
- [Stripe Checkout Sessions](https://stripe.com/docs/api/checkout/sessions)
- [Gatewayz Backend Integration Guide](../docs/BACKEND_TIER_INTEGRATION.md)
- [Subscription Setup Guide](../docs/implementation/PRICING_SETUP.md)
