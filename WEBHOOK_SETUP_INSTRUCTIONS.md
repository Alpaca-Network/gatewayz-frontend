# Stripe Webhook Setup Instructions

## Step-by-Step Guide to Configure Stripe Webhooks

### 1. Access Stripe Dashboard

Go to: https://dashboard.stripe.com/webhooks

### 2. Click "Add endpoint"

Click the blue "Add endpoint" button in the top right.

### 3. Enter Webhook URL

**For Production (Vercel):**
```
https://gatewayz-backend.vercel.app/api/stripe/webhook
```

**For Local Testing (requires ngrok or Stripe CLI):**
```
http://localhost:8002/api/stripe/webhook
```

### 4. Select Events to Listen For

Click "Select events" and choose these events:

#### Payment Events (Required)
- ✅ `checkout.session.completed` - User completed checkout
- ✅ `checkout.session.expired` - Checkout session expired
- ✅ `payment_intent.succeeded` - Payment succeeded
- ✅ `payment_intent.payment_failed` - Payment failed
- ✅ `payment_intent.canceled` - Payment was canceled

#### Refund Events (Recommended)
- ✅ `charge.refunded` - Charge was refunded

#### Optional Events (for enhanced tracking)
- `customer.created` - Customer created
- `customer.updated` - Customer updated
- `invoice.paid` - Invoice paid (for subscriptions)
- `invoice.payment_failed` - Invoice payment failed

### 5. Click "Add endpoint"

Review your settings and click the blue "Add endpoint" button.

### 6. Copy the Signing Secret

After creating the endpoint, you'll see a **Signing secret** that starts with `whsec_...`

Click "Reveal" next to "Signing secret" and copy it.

### 7. Update Your .env File

Add the webhook secret to your `.env` file:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_actual_signing_secret_here
```

Replace `whsec_your_actual_signing_secret_here` with the actual secret you copied.

### 8. Restart Your Server

After updating `.env`, restart your application to load the new secret:

```bash
# Stop current server
# Then restart
python -m uvicorn src.main:app --port 8002
```

## Testing the Webhook

### Option 1: Stripe Dashboard Test

1. Go to your webhook in the dashboard
2. Click "Send test webhook"
3. Select an event (e.g., `checkout.session.completed`)
4. Click "Send test event"
5. Check your server logs for webhook processing

### Option 2: Real Payment Test

1. Create a checkout session through your API
2. Complete payment using Stripe test card: `4242 4242 4242 4242`
3. Check that webhook receives the event
4. Verify credits are added to user account

### Option 3: Stripe CLI (Local Development)

```bash
# Install Stripe CLI (if not already installed)
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8002/api/stripe/webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

## Webhook URL Verification

Your webhook endpoints:
- Production: `https://gatewayz-backend.vercel.app/api/stripe/webhook`
- Local (port 8002): `http://localhost:8002/api/stripe/webhook`

## Webhook Signature Verification

The webhook endpoint automatically verifies signatures using:
- Webhook payload (raw body)
- Stripe signature header (`stripe-signature`)
- Webhook signing secret from `.env`

**Security Note:** Never disable signature verification in production!

## Troubleshooting

### Webhook returns 400 "Missing stripe-signature header"
- ✅ This is expected for manual curl requests
- Stripe webhooks include this header automatically
- Use Stripe CLI or dashboard to test

### Webhook returns 400 "Invalid signature"
- Check that `STRIPE_WEBHOOK_SECRET` matches the dashboard
- Ensure you copied the full secret starting with `whsec_`
- Restart server after updating `.env`

### Events not being received
- Verify webhook URL is correct in dashboard
- Check endpoint is "Enabled" in dashboard
- Ensure production URL is accessible (not localhost)
- Check server logs for errors

### Credits not being added after payment
- Verify `checkout.session.completed` event is selected
- Check webhook logs in Stripe dashboard for errors
- Ensure user_id is in session metadata
- Check database for payment record

## Production Deployment Checklist

- [ ] Webhook URL points to production domain
- [ ] All required events are selected
- [ ] Webhook signing secret is in `.env`
- [ ] `.env` is not committed to git
- [ ] Server is using live Stripe keys (sk_live_...)
- [ ] Database migration has been run
- [ ] Payments table exists in Supabase
- [ ] Test payment completed successfully

## Webhook Event Flow

1. **User initiates payment** → Checkout session created
2. **User completes payment** → Stripe sends `checkout.session.completed` webhook
3. **Your server receives webhook** → Verifies signature
4. **Webhook handler processes event** → Extracts user_id and credits
5. **Credits added to database** → User balance updated
6. **Payment record updated** → Status set to "completed"

## Important Notes

- Webhooks are idempotent - safe to process same event multiple times
- Events may arrive out of order - handle gracefully
- Webhook endpoint must respond within 5 seconds
- Failed webhooks are retried automatically by Stripe
- Check "Recent events" tab in dashboard to debug issues

## Next Steps

After webhook is configured:

1. **Run database migration** (if not done)
   - Copy SQL from `migrations/001_create_payments_table.sql`
   - Run in Supabase dashboard SQL editor

2. **Test end-to-end flow**
   - Create checkout session
   - Complete test payment
   - Verify webhook received
   - Check credits added to user

3. **Monitor webhooks**
   - Check Stripe dashboard "Events" tab
   - Review server logs for errors
   - Set up alerts for failed webhooks

## Support

- Stripe Webhooks Guide: https://docs.stripe.com/webhooks
- Stripe Dashboard: https://dashboard.stripe.com/webhooks
- Test Event Reference: https://docs.stripe.com/testing#trigger-events
