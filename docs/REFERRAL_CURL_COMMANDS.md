# Referral System - Curl Command Reference

Quick reference for all working curl commands used to test the referral system.

## Base URL
```bash
BASE_URL="http://localhost:8000"
```

## 1. User Registration

### Register without referral code
```bash
curl -X POST ${BASE_URL}/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "auth_method": "email"
  }'
```

### Register with referral code
```bash
curl -X POST ${BASE_URL}/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "bob",
    "email": "bob@example.com",
    "auth_method": "email",
    "referral_code": "ABC12345"
  }'
```

## 2. Get Referral Code

```bash
curl -X GET ${BASE_URL}/referral/code \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 3. Get Referral Stats

```bash
curl -X GET ${BASE_URL}/referral/stats \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 4. Validate Referral Code

```bash
curl -X POST ${BASE_URL}/referral/validate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "referral_code": "ABC12345"
  }'
```

## 5. Create Payment Checkout

```bash
curl -X POST ${BASE_URL}/api/stripe/checkout-session \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "usd"
  }'
```

## Complete Testing Flow (Copy-Paste Ready)

```bash
#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=== STEP 1: Register Alice (Referrer) ==="
ALICE_RESPONSE=$(curl -s -X POST ${BASE_URL}/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice_test",
    "email": "alice_test@example.com",
    "auth_method": "email"
  }')

echo "$ALICE_RESPONSE" | jq .

# Extract Alice's API key
ALICE_API_KEY=$(echo "$ALICE_RESPONSE" | jq -r '.api_key')
echo "Alice API Key: $ALICE_API_KEY"

echo ""
echo "=== STEP 2: Get Alice's Referral Code ==="
ALICE_CODE_RESPONSE=$(curl -s -X GET ${BASE_URL}/referral/code \
  -H "Authorization: Bearer $ALICE_API_KEY")

echo "$ALICE_CODE_RESPONSE" | jq .

# Extract Alice's referral code
ALICE_CODE=$(echo "$ALICE_CODE_RESPONSE" | jq -r '.referral_code')
echo "Alice Referral Code: $ALICE_CODE"

echo ""
echo "=== STEP 3: Register Bob with Alice's Referral Code ==="
BOB_RESPONSE=$(curl -s -X POST ${BASE_URL}/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"bob_test\",
    \"email\": \"bob_test@example.com\",
    \"auth_method\": \"email\",
    \"referral_code\": \"$ALICE_CODE\"
  }")

echo "$BOB_RESPONSE" | jq .

# Extract Bob's API key
BOB_API_KEY=$(echo "$BOB_RESPONSE" | jq -r '.api_key')
echo "Bob API Key: $BOB_API_KEY"

echo ""
echo "=== STEP 4: Check Alice's Stats (Before Purchase) ==="
curl -s -X GET ${BASE_URL}/referral/stats \
  -H "Authorization: Bearer $ALICE_API_KEY" | jq .

echo ""
echo "=== STEP 5: Create Checkout for Bob ($10) ==="
CHECKOUT_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/stripe/checkout-session \
  -H "Authorization: Bearer $BOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "usd"
  }')

echo "$CHECKOUT_RESPONSE" | jq .

# Extract checkout URL
CHECKOUT_URL=$(echo "$CHECKOUT_RESPONSE" | jq -r '.url')
echo ""
echo "Checkout URL: $CHECKOUT_URL"
echo "Open this URL in your browser and complete payment with test card: 4242 4242 4242 4242"

echo ""
echo "=== After Payment, Run These Commands: ==="
echo ""
echo "# Check Alice's Stats (Should show +$10)"
echo "curl -X GET ${BASE_URL}/referral/stats -H \"Authorization: Bearer $ALICE_API_KEY\" | jq ."
echo ""
echo "# Check Bob's Stats (Should show $20 total)"
echo "curl -X GET ${BASE_URL}/referral/stats -H \"Authorization: Bearer $BOB_API_KEY\" | jq ."
```

## Alternative: Manual Step-by-Step

### Step 1: Register Alice
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice_test",
    "email": "alice_test@example.com",
    "auth_method": "email"
  }'

# Save the api_key from response
ALICE_API_KEY="gw_live_..."
```

### Step 2: Get Alice's Referral Code
```bash
curl -X GET http://localhost:8000/referral/code \
  -H "Authorization: Bearer $ALICE_API_KEY"

# Save the referral_code from response
ALICE_CODE="ABC12345"
```

### Step 3: Register Bob with Alice's Code
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "bob_test",
    "email": "bob_test@example.com",
    "auth_method": "email",
    "referral_code": "ABC12345"
  }'

# Save the api_key from response
BOB_API_KEY="gw_live_..."
```

### Step 4: Check Alice's Initial Stats
```bash
curl -X GET http://localhost:8000/referral/stats \
  -H "Authorization: Bearer $ALICE_API_KEY"

# Expected: total_uses=0, total_earned=0, current_balance=0
```

### Step 5: Bob Creates Checkout
```bash
curl -X POST http://localhost:8000/api/stripe/checkout-session \
  -H "Authorization: Bearer $BOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "usd"
  }'

# Open the 'url' from response in browser
# Complete payment with test card: 4242 4242 4242 4242
```

### Step 6: Verify Alice Got Bonus
```bash
curl -X GET http://localhost:8000/referral/stats \
  -H "Authorization: Bearer $ALICE_API_KEY"

# Expected: total_uses=1, total_earned=10.0, current_balance=10.0
```

### Step 7: Verify Bob Got Payment + Bonus
```bash
curl -X GET http://localhost:8000/referral/stats \
  -H "Authorization: Bearer $BOB_API_KEY"

# Expected: current_balance=20.0 (10 payment + 10 bonus)
```

## Testing with jq (Pretty Print)

If you have `jq` installed, you can format the JSON output:

```bash
# Pretty print registration response
curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "auth_method": "email"
  }' | jq .

# Pretty print stats
curl -s -X GET http://localhost:8000/referral/stats \
  -H "Authorization: Bearer YOUR_API_KEY" | jq .
```

## Testing Multiple Referrals

```bash
# Alice refers multiple people
ALICE_API_KEY="gw_live_..."
ALICE_CODE="ABC12345"

# Register 3 users with Alice's code
for i in {1..3}; do
  echo "=== Registering User $i with Alice's code ==="

  curl -X POST http://localhost:8000/auth/register \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"user${i}\",
      \"email\": \"user${i}@example.com\",
      \"auth_method\": \"email\",
      \"referral_code\": \"$ALICE_CODE\"
    }"

  echo ""
done

# Check Alice's stats (should show total_uses will increase as each user purchases)
curl -X GET http://localhost:8000/referral/stats \
  -H "Authorization: Bearer $ALICE_API_KEY" | jq .
```

## Stripe CLI Testing

For local webhook testing:

```bash
# Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to http://localhost:8000/api/stripe/webhook

# In another terminal, trigger a test webhook
stripe trigger checkout.session.completed
```

## Environment Variables

Make sure these are set in your `.env` file:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=eyJh...
```

## Expected Responses

### Successful Registration
```json
{
  "user_id": 1,
  "username": "alice",
  "email": "alice@example.com",
  "api_key": "gw_live_NAcJooaBxUeOL4YcEqK75Lnep5l6VsONv6I2wfs-q-U",
  "credits": 0,
  "auth_method": "email",
  "subscription_status": "trial",
  "message": "Account created successfully",
  "timestamp": "2025-10-12T00:00:00Z"
}
```

### Referral Code Response
```json
{
  "referral_code": "ABC12345",
  "user_id": 1,
  "username": "alice",
  "created_at": "2025-10-12T00:00:00Z"
}
```

### Referral Stats (After 2 successful referrals)
```json
{
  "referral_code": "ABC12345",
  "total_uses": 2,
  "remaining_uses": 8,
  "max_uses": 10,
  "total_earned": 20.0,
  "current_balance": 20.0,
  "referred_by_code": null,
  "referrals": [
    {
      "user_id": 2,
      "username": "bob",
      "used_at": "2025-10-12T00:00:00Z",
      "bonus_earned": 10.0
    },
    {
      "user_id": 3,
      "username": "charlie",
      "used_at": "2025-10-12T00:10:00Z",
      "bonus_earned": 10.0
    }
  ]
}
```

### Checkout Session Response
```json
{
  "session_id": "cs_test_a1qD13wJ2FtnGmK7KP4WqJTq35nT4p5otio7qTLM0gE1YSUpDpcBcFUJz3",
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "payment_id": 1,
  "status": "pending",
  "amount": 1000,
  "currency": "usd",
  "expires_at": "2025-10-13T00:00:00Z"
}
```

## Troubleshooting Commands

### Check user data directly in Supabase
```bash
curl "http://127.0.0.1:54321/rest/v1/users?select=id,username,credits,has_made_first_purchase,referred_by_code&id=eq.1" \
  -H "apikey: YOUR_SUPABASE_SERVICE_KEY"
```

### Check referral records
```bash
curl "http://127.0.0.1:54321/rest/v1/referrals?select=*" \
  -H "apikey: YOUR_SUPABASE_SERVICE_KEY"
```

### Check credit transactions
```bash
curl "http://127.0.0.1:54321/rest/v1/credit_transactions?select=*&user_id=eq.1" \
  -H "apikey: YOUR_SUPABASE_SERVICE_KEY"
```
