# Stripe Integration — Complete Unified Guide

A single, consolidated guide that merges **Setup**, **Webhook configuration**, and **Testing** into one place. This replaces the three separate files and removes duplicates while preserving all actionable steps.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Create Payments Table (Supabase)](#create-payments-table-supabase)
4. [Webhook Configuration](#webhook-configuration)
   - [Production](#production)
   - [Local Development (Stripe CLI)](#local-development-stripe-cli)
   - [Events to Listen For](#events-to-listen-for)
   - [Signature Verification](#signature-verification)
5. [Backend & Frontend URLs](#backend--frontend-urls)
6. [Start the Backend](#start-the-backend)
7. [API Endpoints Overview](#api-endpoints-overview)
8. [End-to-End Testing](#end-to-end-testing)
   - [Install Stripe CLI](#install-stripe-cli)
   - [Create a Test User (optional helper)](#create-a-test-user-optional-helper)
   - [Quick Route Checks](#quick-route-checks)
   - [Create Checkout Session](#create-checkout-session)
   - [Complete a Test Payment](#complete-a-test-payment)
   - [Verify Credits & Payments](#verify-credits--payments)
   - [Extra Test Scenarios](#extra-test-scenarios)
   - [One-Command Test Script](#one-command-test-script)
9. [Troubleshooting](#troubleshooting)
10. [Security Best Practices](#security-best-practices)
11. [Going Live Checklist](#going-live-checklist)
12. [Support & References](#support--references)

---

## Prerequisites

- A Stripe account and access to the Stripe Dashboard
- A Supabase project with connectivity from your backend
- Python environment and your backend application code
- (For local dev) Stripe CLI installed

> Tip: Keep **test** and **live** keys separate. Use test keys in development.

---

## Environment Variables

Create or update your `.env` with these values (test keys in dev):

```env
# Stripe keys
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Webhook signing secret (comes from Stripe CLI or Dashboard webhook endpoint)
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Frontend URL (for Stripe Checkout redirects)
FRONTEND_URL=http://localhost:3000
```

---

## Create Payments Table (Supabase)

Run the migration for your `payments` table (e.g., `migrations/001_create_payments_table.sql`) in the Supabase SQL editor, then verify:

```sql
SELECT * FROM payments LIMIT 1;
```

Ensure your service role / RLS policies allow inserts/updates for payment processing.

---

## Webhook Configuration

Stripe will notify your backend via webhooks when payments succeed/fail/expire, or when refunds occur.

### Production

Configure an endpoint in **Stripe Dashboard → Developers → Webhooks**:

```
https://your-domain.com/api/stripe/webhook
```

> If deploying to Vercel, use your deployed URL, e.g. `https://gatewayz-backend.vercel.app/api/stripe/webhook`

### Local Development (Stripe CLI)

1. Login to the CLI:

   ```bash
   stripe login
   ```

2. Forward webhooks to your backend:

   ```bash
   stripe listen --forward-to localhost:8000/api/stripe/webhook
   ```

3. Copy the generated signing secret (`whsec_...`) and put it in `.env` as `STRIPE_WEBHOOK_SECRET`.

### Events to Listen For

**Required:**

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`

**Recommended:**

- `charge.refunded`

(Optionally add customer/invoice events if you use subscriptions.)

### Signature Verification

Your webhook handler must verify the `stripe-signature` header using your signing secret. Never bypass this in production.

> Note: Sending manual `curl` POSTs to your webhook without the Stripe header will return 400 — this is expected. Use the Stripe Dashboard “Send test webhook” or Stripe CLI to test properly.

---

## Backend & Frontend URLs

- **Frontend:** `FRONTEND_URL` should be set to your site (e.g., `http://localhost:3000` in dev, your domain in prod).
- **Webhook URL:** Use your deploy URL in prod, or Stripe CLI forwarding for local dev.

---

## Start the Backend

```bash
uvicorn src.main:app --reload --port 8000
```

Keep the Stripe CLI webhook listener running in another terminal during local testing.

---

## API Endpoints Overview

- `GET  /api/stripe/credit-packages` — Public; returns available credit bundles.
- `POST /api/stripe/checkout-session` — Auth; create a Checkout Session.
- `GET  /api/stripe/checkout-session/{session_id}` — Auth; fetch session info.
- `POST /api/stripe/payment-intent` — Auth; create PaymentIntent (if used).
- `GET  /api/stripe/payment-intent/{id}` — Auth; fetch an intent.
- `GET  /api/stripe/payments` — Auth; list payments.
- `GET  /api/stripe/payments/{id}` — Auth; payment details.
- `POST /api/stripe/webhook` — Stripe calls this; verify signature & process.
- `POST /api/stripe/refund` — Admin only; create a refund.

**Credit Model:** *1 credit = $0.01*. Example: $10 purchase → 1000 credits.

---

## End-to-End Testing

### Install Stripe CLI

Install for your platform, then verify:

```bash
stripe --version
```

### Create a Test User (optional helper)

Create a small script that inserts a test user in Supabase and prints an API key, then export it:

```bash
export TEST_API_KEY="gw_live_..."
```

### Quick Route Checks

Ensure your Stripe routes are registered:

```bash
curl -s http://localhost:8000/openapi.json | jq '.paths | keys | .[] | select(contains("stripe"))'
```

### Create Checkout Session

```bash
curl -X POST http://localhost:8000/api/stripe/checkout-session   -H "Content-Type: application/json"   -H "Authorization: Bearer $TEST_API_KEY"   -d '{
    "amount": 1000,
    "currency": "usd",
    "description": "1000 credits purchase"
  }' | jq
```

You should receive `session_id` and a `url` for Stripe Checkout.

### Complete a Test Payment

Open the returned `url` in a browser and use a test card:

- Success: `4242 4242 4242 4242`
- 3DS required: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 9995`

(Any future expiry, any CVC/ZIP.)

Alternatively trigger events from CLI:

```bash
stripe trigger checkout.session.completed
stripe trigger payment_intent.payment_failed
stripe trigger checkout.session.expired
stripe trigger charge.refunded
```

### Verify Credits & Payments

- **User balance:**

  ```bash
  curl http://localhost:8000/user/balance     -H "Authorization: Bearer $TEST_API_KEY" | jq
  ```

- **Payment history:**

  ```bash
  curl http://localhost:8000/api/stripe/payments     -H "Authorization: Bearer $TEST_API_KEY" | jq
  ```

- **Stripe Dashboard:** Check **Test mode → Payments** for your charge.

- **Database:** Confirm `payments` row in Supabase and updated user credits.

### Extra Test Scenarios

- Declined card (`4000 0000 0000 0002`)
- Insufficient funds (`4000 0000 0000 9995`)
- Expired card (`4000 0000 0000 0069`)
- International card (`4000 0056 0000 0004`)

### One-Command Test Script

Create a script (optional) to exercise the flow (create session, show balance, etc.). You can adapt the following pseudocode-like steps:

1. Fetch credit packages
2. Create checkout session (auth header required)
3. Print `session_id` and `url`
4. Pause for payment, or trigger a test event
5. Re-check user balance and payments

> You can copy your own shell script into your repo for repeated testing.

---

## Troubleshooting

- **Webhook not received:** Ensure Stripe CLI forwarding is running and the signing secret matches your `.env`.
- **400 “Missing stripe-signature”:** You used `curl` directly; use the Dashboard or Stripe CLI to send real test events.
- **Invalid signature:** Double-check `STRIPE_WEBHOOK_SECRET` and restart the server after editing `.env`.
- **Credits not added:** Verify `checkout.session.completed` is selected and your webhook handler processes it; confirm `user_id` metadata is present.
- **DB errors:** Confirm migrations ran and RLS allows needed operations; check Supabase connection env vars.
- **Amount rejected:** Stripe requires minimum amounts (e.g., $0.50).

---

## Security Best Practices

1. Never commit `.env`.
2. Use **test** keys in development, **live** keys in production.
3. Always verify webhook signatures.
4. Serve production over HTTPS.
5. Add rate limiting to payment endpoints.
6. Keep an audit trail of transactions.
7. Fail gracefully without leaking internals.

---

## Going Live Checklist

- Switch to `sk_live_...` / `pk_live_...` in production.
- Production webhook endpoint configured & enabled.
- `FRONTEND_URL` points to your production site.
- Run a real small payment to validate end-to-end.
- Enable Stripe Radar & alerts for failures.
- Monitor logs and Stripe Dashboard “Events”.

---

## Support & References

- Stripe Docs (Payments, Checkout, Webhooks, Testing)
- Supabase Dashboard (SQL editor, Table editor, Logs)
- Your project documentation & logs

---

**Notes**  
- Your webhook handler should be **idempotent**, as events can be retried/out-of-order.  
- `1 credit = $0.01` convention is used in examples; adjust if your pricing changes.

