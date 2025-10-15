# Referral System Documentation

## Overview

The referral system allows users to invite friends and earn rewards. When a referred user makes their first purchase of $10 or more, both the referrer and referee receive a $10 bonus.

## Key Features

- **$10 Minimum Purchase**: Referral bonus requires a minimum purchase of $10
- **$10 Bonus**: Both users (referrer and referee) receive $10 when conditions are met
- **10 Uses Per Code**: Each referral code can be used by up to 10 different users
- **First Purchase Only**: Referral bonus applies only on the referee's first purchase
- **Automatic Credit Addition**: Bonus credits are automatically added via webhook after payment

## How It Works

```
1. Alice registers → Gets referral code "ABC12345"
2. Bob registers with Alice's code → Stores referred_by_code = "ABC12345"
3. Bob makes first purchase of $10+ → Webhook processes payment
4. System checks:
   - Is this Bob's first purchase? ✓
   - Did Bob use a referral code? ✓
   - Is purchase >= $10? ✓
5. Apply bonus:
   - Bob gets $10 (payment) + $10 (bonus) = $20 total
   - Alice gets $10 (bonus) = $10 total
6. Mark Bob's first purchase complete
7. Create referral record for tracking
```

## Database Schema

### Users Table
```sql
- id (integer, primary key)
- username (string, unique)
- email (string, unique)
- credits (numeric) -- User's credit balance in dollars
- referral_code (string, 8 chars, unique) -- User's own referral code
- referred_by_code (string, 8 chars) -- Code user signed up with
- has_made_first_purchase (boolean) -- Tracks if bonus can be applied
- api_key (string) -- User's API authentication key
```

### Referrals Table
```sql
- id (integer, primary key)
- referrer_id (integer) -- User who owns the referral code
- referred_user_id (integer) -- User who used the code
- referral_code (string) -- The code that was used
- bonus_amount (numeric) -- Amount of bonus given (default $10)
- status (string) -- 'completed'
- completed_at (timestamp) -- When bonus was applied
```

## API Endpoints

### 1. Register New User (with optional referral code)

**Endpoint**: `POST /auth/register`

**Request**:
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "auth_method": "email",
    "referral_code": "OPTIONAL_CODE"
  }'
```

**Response**:
```json
{
  "user_id": 1,
  "username": "alice",
  "email": "alice@example.com",
  "api_key": "gw_live_...",
  "credits": 0,
  "auth_method": "email",
  "subscription_status": "trial",
  "message": "Account created successfully",
  "timestamp": "2025-10-12T00:00:00Z"
}
```

### 2. Get User's Referral Code

**Endpoint**: `GET /referral/code`

**Request**:
```bash
curl -X GET http://localhost:8000/referral/code \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response**:
```json
{
  "referral_code": "ABC12345",
  "user_id": 1,
  "username": "alice",
  "created_at": "2025-10-12T00:00:00Z"
}
```

**Notes**:
- If user doesn't have a referral code yet, one will be automatically generated
- Referral codes are 8 characters (uppercase letters + digits)
- Each code is unique across all users

### 3. Get Referral Statistics

**Endpoint**: `GET /referral/stats`

**Request**:
```bash
curl -X GET http://localhost:8000/referral/stats \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response**:
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
      "user_id": 5,
      "username": "bob",
      "used_at": "2025-10-12T00:00:00Z",
      "bonus_earned": 10.0
    },
    {
      "user_id": 6,
      "username": "charlie",
      "used_at": "2025-10-12T00:10:00Z",
      "bonus_earned": 10.0
    }
  ]
}
```

### 4. Validate Referral Code

**Endpoint**: `POST /referral/validate`

**Request**:
```bash
curl -X POST http://localhost:8000/referral/validate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "referral_code": "ABC12345"
  }'
```

**Response (Valid)**:
```json
{
  "valid": true,
  "message": "Referral code is valid",
  "referrer": {
    "username": "alice",
    "email": "alice@example.com"
  },
  "remaining_uses": 8
}
```

**Response (Invalid)**:
```json
{
  "valid": false,
  "message": "Invalid referral code",
  "error": "Code not found"
}
```

### 5. Create Checkout Session (Payment)

**Endpoint**: `POST /api/stripe/checkout-session`

**Request**:
```bash
curl -X POST http://localhost:8000/api/stripe/checkout-session \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "usd"
  }'
```

**Response**:
```json
{
  "session_id": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/...",
  "payment_id": 1,
  "status": "pending",
  "amount": 1000,
  "currency": "usd",
  "expires_at": "2025-10-13T00:00:00Z"
}
```

**Notes**:
- Amount is in cents (1000 = $10.00)
- User must complete payment at the returned URL
- Referral bonus is automatically applied via webhook after successful payment

## Complete Testing Flow

### Scenario: Alice refers Bob, Bob makes first purchase

```bash
# 1. ALICE REGISTERS
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "auth_method": "email"
  }'

# Save Alice's API key from response
ALICE_API_KEY="gw_live_..."

# 2. GET ALICE'S REFERRAL CODE
curl -X GET http://localhost:8000/referral/code \
  -H "Authorization: Bearer $ALICE_API_KEY"

# Save Alice's referral code from response (e.g., "ABC12345")
ALICE_CODE="ABC12345"

# 3. BOB REGISTERS WITH ALICE'S REFERRAL CODE
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "bob",
    "email": "bob@example.com",
    "auth_method": "email",
    "referral_code": "ABC12345"
  }'

# Save Bob's API key from response
BOB_API_KEY="gw_live_..."

# 4. CHECK ALICE'S STATS (should show 0 uses, no earnings yet)
curl -X GET http://localhost:8000/referral/stats \
  -H "Authorization: Bearer $ALICE_API_KEY"

# 5. BOB CREATES CHECKOUT SESSION FOR $10
curl -X POST http://localhost:8000/api/stripe/checkout-session \
  -H "Authorization: Bearer $BOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "usd"
  }'

# 6. BOB COMPLETES PAYMENT
# Open the URL from the response in a browser
# Use test card: 4242 4242 4242 4242

# 7. VERIFY ALICE'S STATS (should show 1 use, $10 earned)
curl -X GET http://localhost:8000/referral/stats \
  -H "Authorization: Bearer $ALICE_API_KEY"

# Expected response:
# {
#   "total_uses": 1,
#   "total_earned": 10.0,
#   "current_balance": 10.0,
#   "referrals": [
#     {
#       "user_id": 2,
#       "username": "bob",
#       "bonus_earned": 10.0
#     }
#   ]
# }

# 8. VERIFY BOB'S STATS (should show $20 total: $10 payment + $10 bonus)
curl -X GET http://localhost:8000/referral/stats \
  -H "Authorization: Bearer $BOB_API_KEY"

# Expected response:
# {
#   "current_balance": 20.0,
#   "referred_by_code": "ABC12345",
#   ...
# }
```

## Business Rules

### When Referral Bonus is Applied

The system checks these conditions when a user makes a purchase:

1. ✅ **First Purchase**: User's `has_made_first_purchase` must be `false`
2. ✅ **Has Referral Code**: User's `referred_by_code` must not be `null`
3. ✅ **Minimum Amount**: Purchase must be >= $10.00
4. ✅ **Code Not Maxed Out**: Referral code must have < 10 uses
5. ✅ **Not Self-Referral**: User cannot use their own referral code
6. ✅ **No Code Switching**: User cannot use a different referral code than the one they registered with

### When Referral Bonus is NOT Applied

- ❌ Purchase is less than $10.00
- ❌ User has already made a first purchase
- ❌ User didn't register with a referral code
- ❌ Referral code has already been used 10 times
- ❌ User tries to use their own referral code
- ❌ User tries to use a different referral code after registration

## Webhook Flow (Automatic Bonus Application)

When a payment completes, Stripe sends a webhook to your backend:

```
1. Stripe → POST /api/stripe/webhook
2. Webhook handler validates signature
3. For 'checkout.session.completed' events:
   a. Add payment credits to user
   b. Check if referral bonus conditions are met
   c. If yes:
      - Add $10 to referee (user who made purchase)
      - Add $10 to referrer (user who owns the code)
      - Create referral record
      - Mark user's first purchase as complete
   d. If no:
      - Just mark first purchase as complete
4. Return success response to Stripe
```

## Error Handling

### Common Errors

**Invalid Referral Code**:
```json
{
  "valid": false,
  "message": "Invalid referral code",
  "error": "Code not found"
}
```

**Code Already Used (by same user)**:
```json
{
  "valid": false,
  "message": "You have already used a different referral code"
}
```

**Self-Referral Attempt**:
```json
{
  "valid": false,
  "message": "Cannot use your own referral code"
}
```

**Code Usage Limit Reached**:
```json
{
  "valid": false,
  "message": "This referral code has reached its usage limit (10 uses)"
}
```

**Purchase Too Small**:
```json
{
  "success": false,
  "message": "Referral code requires a minimum purchase of $10"
}
```

## Frontend Integration Guide

### User Registration Flow

```typescript
// 1. User signs up (optional: with referral code)
const registerUser = async (username: string, email: string, referralCode?: string) => {
  const response = await fetch('http://localhost:8000/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      auth_method: 'email',
      referral_code: referralCode // Optional
    })
  });

  const data = await response.json();
  // Store data.api_key securely for future requests
  return data;
};

// 2. Validate referral code before registration (optional)
const validateCode = async (code: string, apiKey: string) => {
  const response = await fetch('http://localhost:8000/referral/validate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ referral_code: code })
  });

  return await response.json();
};
```

### Display User's Referral Code

```typescript
const getReferralCode = async (apiKey: string) => {
  const response = await fetch('http://localhost:8000/referral/code', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  const data = await response.json();
  // Display data.referral_code to user
  return data.referral_code;
};
```

### Display Referral Stats

```typescript
const getReferralStats = async (apiKey: string) => {
  const response = await fetch('http://localhost:8000/referral/stats', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  const data = await response.json();

  // Display to user:
  // - Total earnings: data.total_earned
  // - Current balance: data.current_balance
  // - Remaining uses: data.remaining_uses
  // - Referrals list: data.referrals

  return data;
};
```

### Create Payment Checkout

```typescript
const createCheckout = async (apiKey: string, amountInDollars: number) => {
  const response = await fetch('http://localhost:8000/api/stripe/checkout-session', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: amountInDollars * 100, // Convert dollars to cents
      currency: 'usd'
    })
  });

  const data = await response.json();
  // Redirect user to data.url for payment
  window.location.href = data.url;
};
```

## Testing with Stripe CLI

For local testing, use Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to http://localhost:8000/api/stripe/webhook

# Use the webhook secret displayed (starts with whsec_...)
# Add to .env file: STRIPE_WEBHOOK_SECRET=whsec_...

# Test a payment
stripe trigger checkout.session.completed
```

## Constants

These values are defined in `src/services/referral.py`:

```python
REFERRAL_CODE_LENGTH = 8           # 8-character codes
MAX_REFERRAL_USES = 10             # Each code can be used 10 times
MIN_PURCHASE_AMOUNT = 10.0         # $10 minimum purchase
REFERRAL_BONUS = 10.0              # $10 bonus for both users
```

## Security Notes

1. **API Key Protection**: Always store API keys securely (never in localStorage or cookies without encryption)
2. **HTTPS Only**: Use HTTPS in production for all API calls
3. **Rate Limiting**: The system has rate limiting to prevent abuse
4. **Webhook Verification**: Stripe webhooks are verified using signature validation
5. **No Replay Attacks**: Each referral code can only be used once per user

## Support & Troubleshooting

### Check if user has made first purchase
```bash
# Query database directly
curl "http://127.0.0.1:54321/rest/v1/users?select=id,username,credits,has_made_first_purchase&id=eq.USER_ID" \
  -H "apikey: YOUR_SUPABASE_KEY"
```

### Check referral records
```bash
# Query referrals table
curl "http://127.0.0.1:54321/rest/v1/referrals?select=*&referrer_id=eq.USER_ID" \
  -H "apikey: YOUR_SUPABASE_KEY"
```

### Reset test user for re-testing
```sql
-- Reset user for testing (run in Supabase SQL editor)
UPDATE users
SET has_made_first_purchase = false,
    credits = 0
WHERE id = USER_ID;

-- Delete referral records
DELETE FROM referrals WHERE referred_user_id = USER_ID;
```

## Changelog

- **2025-10-12**: Consolidated `balance` column into `credits` column
- **2025-10-12**: Fixed referral bonus application logic
- **2025-10-12**: Changed default user credits from $10 to $0
- **2025-10-12**: Updated MAX_REFERRAL_USES from 5 to 10
