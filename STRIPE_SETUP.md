# Stripe Integration Setup Guide

This guide will help you set up Stripe payments for Gatewayz.

## Prerequisites

- Stripe account (sign up at https://dashboard.stripe.com/register)
- Supabase database with users table
- Python environment with dependencies installed

## Step 1: Create Payments Table in Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/poxomztzvdkxxpqotybo/sql/new

2. Copy the contents of `migrations/001_create_payments_table.sql`

3. Paste into the SQL Editor and click "Run"

4. Verify the table was created:
   ```sql
   SELECT * FROM payments LIMIT 1;
   ```

## Step 2: Get Stripe API Keys

1. Go to Stripe Dashboard: https://dashboard.stripe.com/apikeys

2. Copy your keys:
   - **Publishable key** (`pk_test_...`) - For frontend
   - **Secret key** (`sk_test_...`) - For backend

3. Add to your `.env` file:
   ```env
   STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
   STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
   ```

## Step 3: Set Up Stripe Webhooks

Webhooks allow Stripe to notify your backend when payments succeed or fail.

### Local Development (using Stripe CLI)

1. Install Stripe CLI:
   ```bash
   # Windows (with Scoop)
   scoop install stripe

   # Mac (with Homebrew)
   brew install stripe/stripe-cli/stripe

   # Or download from: https://github.com/stripe/stripe-cli/releases/latest
   ```

2. Login to Stripe CLI:
   ```bash
   stripe login
   ```

3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:8000/api/stripe/webhook
   ```

4. The CLI will output a webhook signing secret like `whsec_...`. Add it to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_from_stripe_cli
   ```

### Production (Vercel/Live Server)

1. Go to Stripe Dashboard > Developers > Webhooks: https://dashboard.stripe.com/webhooks

2. Click "Add endpoint"

3. Enter your webhook URL:
   ```
   https://your-domain.com/api/stripe/webhook
   ```

4. Select events to listen for:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`

5. Click "Add endpoint"

6. Copy the "Signing secret" and add to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_production_secret
   ```

## Step 4: Configure Frontend URL

Set your frontend URL in `.env` for Stripe redirects:

```env
FRONTEND_URL=https://gatewayz.ai
```

Or for local development:

```env
FRONTEND_URL=http://localhost:3000
```

## Step 5: Test the Integration

### 1. Start your server

```bash
python -m uvicorn src.main:app --reload --port 8000
```

### 2. Start Stripe webhook forwarding (local only)

```bash
stripe listen --forward-to localhost:8000/api/stripe/webhook
```

### 3. Test credit packages endpoint

```bash
curl http://localhost:8000/api/stripe/credit-packages
```

Expected response:
```json
{
  "packages": [
    {
      "id": "starter",
      "name": "Starter Pack",
      "credits": 1000,
      "amount": 1000,
      "currency": "usd",
      "description": "Perfect for trying out the platform"
    }
  ]
}
```

### 4. Test checkout session creation

```bash
curl -X POST http://localhost:8000/api/stripe/checkout-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_API_KEY" \
  -d '{
    "amount": 2000,
    "currency": "usd",
    "description": "2000 credits purchase"
  }'
```

Expected response:
```json
{
  "session_id": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/...",
  "payment_id": 1,
  "status": "pending",
  "amount": 2000,
  "currency": "usd",
  "expires_at": "2025-10-06T17:00:00Z"
}
```

### 5. Test payment with Stripe test cards

Use these test card numbers in Stripe Checkout:

- **Successful payment**: `4242 4242 4242 4242`
- **Requires authentication**: `4000 0025 0000 3155`
- **Declined card**: `4000 0000 0000 9995`

Use any future expiry date (e.g., 12/34), any 3-digit CVC, and any postal code.

### 6. Verify payment in database

```python
from src.db.payments import get_user_payments

payments = get_user_payments(user_id=YOUR_USER_ID)
print(payments)
```

## API Endpoints

### Public Endpoints

- `GET /api/stripe/credit-packages` - Get available credit packages

### Authenticated Endpoints

- `POST /api/stripe/checkout-session` - Create checkout session
- `GET /api/stripe/checkout-session/{session_id}` - Get checkout session
- `POST /api/stripe/payment-intent` - Create payment intent
- `GET /api/stripe/payment-intent/{payment_intent_id}` - Get payment intent
- `GET /api/stripe/payments` - Get payment history
- `GET /api/stripe/payments/{payment_id}` - Get payment details

### Webhook Endpoint

- `POST /api/stripe/webhook` - Stripe webhook handler (called by Stripe)

### Admin Endpoints

- `POST /api/stripe/refund` - Create refund (requires admin)

## Credit Calculation

- **1 credit = 1 cent USD**
- Example: $10.00 purchase = 1000 credits
- Credits are automatically added upon successful payment

## Troubleshooting

### Webhook not receiving events

1. Check Stripe CLI is running: `stripe listen --forward-to localhost:8000/api/stripe/webhook`
2. Verify webhook secret in `.env` matches CLI output
3. Check server logs for webhook errors

### Payment created but credits not added

1. Check webhook is configured correctly
2. Verify `checkout.session.completed` event is being sent
3. Check server logs for webhook processing errors
4. Verify user_id in payment metadata matches database

### Database errors

1. Ensure payments table exists: Run migration SQL
2. Check Supabase connection: Verify `SUPABASE_URL` and `SUPABASE_KEY`
3. Check RLS policies: Ensure service role can insert/update payments

### Stripe API errors

1. Verify API keys are correct (test vs live mode)
2. Check key permissions in Stripe dashboard
3. Ensure amount is >= 50 cents ($0.50 minimum)

## Security Best Practices

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use test keys in development** - Starts with `sk_test_` and `pk_test_`
3. **Validate webhook signatures** - Always verify `stripe-signature` header
4. **Use HTTPS in production** - Required for PCI compliance
5. **Implement rate limiting** - Prevent abuse of payment endpoints
6. **Log all transactions** - Keep audit trail in database
7. **Handle errors gracefully** - Don't expose internal errors to users

## Going Live

1. Switch to live API keys:
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_PUBLISHABLE_KEY=pk_live_...`

2. Configure production webhook endpoint in Stripe dashboard

3. Update `FRONTEND_URL` to production domain

4. Test with real (small) payment before launching

5. Enable Stripe Radar for fraud prevention

6. Set up email notifications for failed payments

## Support

- Stripe Documentation: https://docs.stripe.com
- Stripe Support: https://support.stripe.com
- Gatewayz Support: support@gatewayz.ai

## Additional Resources

- Stripe Testing: https://docs.stripe.com/testing
- Webhook Best Practices: https://docs.stripe.com/webhooks/best-practices
- Payment Intents API: https://docs.stripe.com/payments/payment-intents
- Checkout Sessions: https://docs.stripe.com/payments/checkout
