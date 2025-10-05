# New Supabase Project Setup Guide

## ✅ Configuration Complete

Your `.env` file has been updated with:
- ✅ New Supabase URL: `https://ynleroehyrmaafkgjgmr.supabase.co`
- ✅ New Supabase Service Role Key
- ✅ Stripe Live Keys (Secret & Publishable)
- ✅ Stripe Webhook Secret

## Next Steps

### 1. Run Database Migration (5 minutes)

1. **Go to Supabase SQL Editor:**
   https://supabase.com/dashboard/project/ynleroehyrmaafkgjgmr/sql/new

2. **Copy the entire contents** of `migrations/000_init_database.sql`

3. **Paste into the SQL Editor** and click **"Run"**

4. **Verify tables were created** in the Table Editor:
   - `users`
   - `api_keys_new`
   - `payments`

### 2. Test the Connection

```bash
python -c "from src.supabase_config import get_supabase_client; client = get_supabase_client(); print('✓ Connected!')"
```

### 3. Start Your Server

```bash
python -m uvicorn src.main:app --reload --port 8000
```

### 4. Test Stripe Integration

**Get Credit Packages:**
```bash
curl http://localhost:8000/api/stripe/credit-packages
```

**Expected Response:**
```json
{
  "packages": [
    {
      "id": "starter",
      "name": "Starter Pack",
      "credits": 1000,
      "amount": 1000,
      "currency": "usd"
    }
  ]
}
```

## What's Been Configured

### Supabase Tables

**users** - User accounts with:
- username, email, api_key
- credits (starts with $10 trial)
- subscription_status ('trial' by default)
- privy_user_id for Privy authentication
- trial_expires_at (3 days from registration)

**api_keys_new** - Advanced API key management:
- Multiple keys per user
- Environment tags (live, test, staging)
- IP allowlist and domain restrictions
- Scope permissions
- Usage tracking

**payments** - Stripe payment tracking:
- Payment amounts and status
- Stripe IDs (payment_intent, session, customer)
- Credits purchased and bonus credits
- Metadata for additional tracking

### Stripe Configuration

**Live Mode Keys:**
- Secret Key: `sk_live_51SAbM...`
- Publishable Key: `pk_live_51SAbM...`
- Webhook Secret: `whsec_lEQSo...`

**Webhook URL:**
```
https://gatewayz-backend.vercel.app/api/stripe/webhook
```

**Events Configured:**
- checkout.session.completed
- checkout.session.expired
- payment_intent.succeeded
- payment_intent.payment_failed
- payment_intent.canceled
- charge.refunded

## Testing Checklist

- [ ] Database migration run successfully
- [ ] Can connect to new Supabase project
- [ ] Server starts without errors
- [ ] Credit packages endpoint works
- [ ] Stripe webhook endpoint responds
- [ ] Can create test user
- [ ] Can create test payment

## Environment Variables Summary

```env
# Supabase (NEW PROJECT)
SUPABASE_URL=https://ynleroehyrmaafkgjgmr.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (service_role)

# Stripe (LIVE MODE)
STRIPE_SECRET_KEY=sk_live_51SAbMcLVT8n4vaEn...
STRIPE_PUBLISHABLE_KEY=pk_live_51SAbMcLVT8n4vaEn...
STRIPE_WEBHOOK_SECRET=whsec_lEQSobKyvS1f5yAIta5...

# Frontend
FRONTEND_URL=https://gatewayz.ai
```

## Important Notes

⚠️ **Live Stripe Keys** - These are production keys, not test keys
⚠️ **Service Role Key** - Has admin access, never expose to frontend
⚠️ **Never commit .env** - Already in .gitignore

## Troubleshooting

### Can't connect to Supabase
- Verify URL and key are correct
- Check service_role key (not anon key)
- Ensure migrations have been run

### Stripe webhook not working
- Verify webhook secret matches dashboard
- Check webhook URL is correct
- Test with Stripe CLI: `stripe trigger payment_intent.succeeded`

### Tables don't exist
- Run `migrations/000_init_database.sql` in Supabase
- Check for errors in SQL editor
- Verify you're in the correct project

## Support

- Supabase Dashboard: https://supabase.com/dashboard/project/ynleroehyrmaafkgjgmr
- Stripe Dashboard: https://dashboard.stripe.com
- API Docs: http://localhost:8000/docs

## Next Development Steps

1. Run migrations ✅
2. Test basic endpoints
3. Create test user
4. Test Stripe payment flow
5. Deploy to Vercel
6. Update Vercel environment variables
