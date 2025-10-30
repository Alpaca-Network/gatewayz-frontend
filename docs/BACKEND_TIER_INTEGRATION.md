# Backend Integration Instructions for Tier Display Feature

## Overview

The frontend requires the backend to return a `tier` field in authentication responses to display PRO/MAX badges instead of credit counts in the header.

---

## Required Changes

### 1. Database Schema

Add a `tier` column to your `users` table:

```sql
-- Add tier column if not exists
ALTER TABLE users
ADD COLUMN tier VARCHAR(10) DEFAULT 'basic';

-- Add index for performance
CREATE INDEX idx_users_tier ON users(tier);

-- Valid values: 'basic', 'pro', 'max'
ALTER TABLE users
ADD CONSTRAINT check_tier_values
CHECK (tier IN ('basic', 'pro', 'max'));

-- Optional: Add subscription fields if not present
ALTER TABLE users
ADD COLUMN subscription_status VARCHAR(20) DEFAULT NULL,
ADD COLUMN subscription_end_date BIGINT DEFAULT NULL;
```

### 2. Authentication Endpoint

**Endpoint:** `POST /auth`

**Current Response (missing tier):**
```json
{
  "success": true,
  "user_id": 123,
  "api_key": "gw_...",
  "auth_method": "email",
  "privy_user_id": "did:privy:...",
  "display_name": "John Doe",
  "email": "john@example.com",
  "credits": 5000,
  "is_new_user": false
}
```

**Required Response (with tier):**
```json
{
  "success": true,
  "user_id": 123,
  "api_key": "gw_...",
  "auth_method": "email",
  "privy_user_id": "did:privy:...",
  "display_name": "John Doe",
  "email": "john@example.com",
  "credits": 5000,
  "is_new_user": false,
  "tier": "pro",                           // ← ADD THIS
  "subscription_status": "active",         // ← ADD THIS
  "subscription_end_date": 1730000000      // ← ADD THIS (optional)
}
```

**Implementation Example (Python/FastAPI):**

```python
@app.post("/auth")
async def authenticate_user(request: AuthRequest):
    # ... existing authentication logic ...

    # Fetch user from database
    user = await db.fetch_one(
        """
        SELECT user_id, api_key, display_name, email, credits,
               tier, subscription_status, subscription_end_date
        FROM users
        WHERE privy_user_id = $1
        """,
        privy_user_id
    )

    return {
        "success": True,
        "user_id": user["user_id"],
        "api_key": user["api_key"],
        "auth_method": "email",
        "privy_user_id": privy_user_id,
        "display_name": user["display_name"],
        "email": user["email"],
        "credits": user["credits"],
        "is_new_user": False,
        "tier": user["tier"] or "basic",           # DEFAULT to 'basic'
        "subscription_status": user["subscription_status"],
        "subscription_end_date": user["subscription_end_date"]
    }
```

**Implementation Example (Node.js/Express):**

```javascript
app.post('/auth', async (req, res) => {
  // ... existing authentication logic ...

  const user = await db.query(
    `SELECT user_id, api_key, display_name, email, credits,
            tier, subscription_status, subscription_end_date
     FROM users
     WHERE privy_user_id = $1`,
    [privyUserId]
  );

  res.json({
    success: true,
    user_id: user.user_id,
    api_key: user.api_key,
    auth_method: 'email',
    privy_user_id: privyUserId,
    display_name: user.display_name,
    email: user.email,
    credits: user.credits,
    is_new_user: false,
    tier: user.tier || 'basic',           // DEFAULT to 'basic'
    subscription_status: user.subscription_status,
    subscription_end_date: user.subscription_end_date
  });
});
```

### 3. Stripe Webhook Integration

Update the Stripe webhook handler to set the `tier` when users subscribe:

**Webhook Event:** `checkout.session.completed`

```python
@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return {"error": "Invalid payload"}, 400
    except stripe.error.SignatureVerificationError:
        return {"error": "Invalid signature"}, 400

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session['client_reference_id']

        # Map Stripe price_id to tier
        price_id = session['line_items']['data'][0]['price']['id']
        tier = get_tier_from_price_id(price_id)  # 'pro' or 'max'

        # Update user tier
        await db.execute(
            """
            UPDATE users
            SET tier = $1,
                subscription_status = 'active',
                subscription_end_date = $2
            WHERE user_id = $3
            """,
            tier,
            session['subscription']['current_period_end'],
            user_id
        )

    return {"received": True}

def get_tier_from_price_id(price_id: str) -> str:
    """Map Stripe price ID to tier name"""
    # Your actual Stripe price IDs
    PRICE_TO_TIER = {
        'price_pro_monthly': 'pro',
        'price_pro_annual': 'pro',
        'price_max_monthly': 'max',
        'price_max_annual': 'max',
    }
    return PRICE_TO_TIER.get(price_id, 'basic')
```

### 4. Handle Subscription Cancellations

**Webhook Event:** `customer.subscription.deleted`

```python
if event['type'] == 'customer.subscription.deleted':
    subscription = event['data']['object']
    user_id = subscription['metadata']['user_id']

    # Downgrade to basic tier
    await db.execute(
        """
        UPDATE users
        SET tier = 'basic',
            subscription_status = 'cancelled'
        WHERE user_id = $1
        """,
        user_id
    )
```

### 5. Handle Failed Payments

**Webhook Event:** `invoice.payment_failed`

```python
if event['type'] == 'invoice.payment_failed':
    invoice = event['data']['object']
    user_id = invoice['metadata']['user_id']

    # Mark as past_due but keep tier for grace period
    await db.execute(
        """
        UPDATE users
        SET subscription_status = 'past_due'
        WHERE user_id = $1
        """,
        user_id
    )
```

---

## Data Migration

For existing users with subscriptions, run a migration:

```sql
-- Set tier based on existing subscription data
UPDATE users
SET tier = CASE
    WHEN subscription_plan = 'pro' THEN 'pro'
    WHEN subscription_plan = 'max' THEN 'max'
    ELSE 'basic'
END
WHERE tier IS NULL;

-- Verify migration
SELECT tier, COUNT(*)
FROM users
GROUP BY tier;
```

---

## Testing

### 1. Test Authentication Response

```bash
# Test auth endpoint returns tier field
curl -X POST https://api.gatewayz.ai/auth \
  -H "Content-Type: application/json" \
  -d '{
    "user": {...},
    "token": "...",
    "privy_user_id": "..."
  }' | jq '.tier'

# Expected output: "pro" or "max" or "basic"
```

### 2. Test Tier Values

```bash
# Check database has correct tiers
psql -d gatewayz -c "
SELECT tier, subscription_status, COUNT(*)
FROM users
GROUP BY tier, subscription_status;
"
```

Expected output:
```
 tier  | subscription_status | count
-------+--------------------+-------
 basic | NULL               | 1000
 pro   | active             | 50
 max   | active             | 10
```

### 3. Test Stripe Integration

Create a test subscription and verify:
```sql
SELECT user_id, tier, subscription_status, credits
FROM users
WHERE email = 'test@example.com';
```

---

## API Specification

### Tier Field

**Type:** `string | null | undefined`

**Valid Values:**
- `"basic"` - Free tier, shows credit count
- `"pro"` - PRO subscription, shows PRO badge
- `"max"` - MAX subscription, shows MAX badge

**Case Sensitivity:**
- Frontend normalizes to lowercase
- Backend can return any case, but lowercase is preferred

**Default Behavior:**
- If `tier` is `null`, `undefined`, or missing → shows credit count
- If `tier` is `"basic"` → shows credit count
- If `tier` is `"pro"` → shows PRO badge 👑
- If `tier` is `"max"` → shows MAX badge 👑

---

## Common Issues

### Issue: Users have subscriptions but tier is not set

**Solution:**
```sql
-- Update existing users with Stripe subscriptions
UPDATE users u
SET tier = CASE
    WHEN s.plan_name LIKE '%pro%' THEN 'pro'
    WHEN s.plan_name LIKE '%max%' THEN 'max'
    ELSE 'basic'
END
FROM stripe_subscriptions s
WHERE u.user_id = s.user_id
  AND s.status = 'active'
  AND (u.tier IS NULL OR u.tier = 'basic');
```

### Issue: Webhook not updating tier

**Checklist:**
- [ ] Webhook endpoint is receiving events
- [ ] Webhook signature verification is working
- [ ] `client_reference_id` is set in checkout session
- [ ] Database update query is executing
- [ ] No errors in webhook logs

**Debug:**
```python
# Add logging to webhook handler
logger.info(f"Webhook received: {event['type']}")
logger.info(f"User ID: {user_id}")
logger.info(f"New tier: {tier}")
logger.info(f"Database updated: {result.rowcount} rows")
```

### Issue: Auth endpoint not returning tier

**Checklist:**
- [ ] Database query includes `tier` column
- [ ] Response JSON includes `tier` field
- [ ] No null handling removing the field
- [ ] TypeScript/Schema allows optional tier field

---

## Environment Variables

Add these to your backend `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Tier/Price Mappings
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_MAX_MONTHLY=price_...
STRIPE_PRICE_MAX_ANNUAL=price_...
```

---

## Monitoring

### Metrics to Track

1. **Tier Distribution**
```sql
SELECT tier, COUNT(*) as user_count
FROM users
GROUP BY tier;
```

2. **Active Subscriptions**
```sql
SELECT tier, subscription_status, COUNT(*)
FROM users
WHERE tier IN ('pro', 'max')
GROUP BY tier, subscription_status;
```

3. **Recent Tier Changes**
```sql
SELECT user_id, tier, updated_at
FROM users
WHERE updated_at > NOW() - INTERVAL '24 hours'
  AND tier IN ('pro', 'max')
ORDER BY updated_at DESC;
```

---

## Support & Troubleshooting

### Frontend Verification

Users can verify their tier data:
1. Visit https://app.gatewayz.ai/test-tier-display
2. Click "Check Current"
3. See what tier value is stored

### Backend Verification

```bash
# Check user's tier in database
psql -d gatewayz -c "
SELECT user_id, email, tier, subscription_status, credits
FROM users
WHERE email = 'user@example.com';
"
```

### Full Integration Test

1. **Create test user** in database
2. **Set tier to 'pro'**
3. **Get auth token** from Privy
4. **Call /auth endpoint**
5. **Verify response** includes `"tier": "pro"`
6. **Open frontend** and check header shows PRO badge 👑

---

## Rollout Checklist

- [ ] Database schema updated with tier column
- [ ] Auth endpoint returns tier field
- [ ] Existing users migrated to correct tiers
- [ ] Stripe webhook updates tier on subscription
- [ ] Webhook handles cancellations
- [ ] Webhook handles failed payments
- [ ] Tested with real Stripe events
- [ ] Monitoring queries created
- [ ] Rollback plan documented
- [ ] Frontend tested with new API response

---

## Questions?

If you need help implementing these changes:

1. Check the frontend troubleshooting guide: `docs/TIER_DISPLAY_TROUBLESHOOTING.md`
2. Test the frontend implementation: http://localhost:3000/test-tier-display
3. Verify frontend is working correctly (it is!)
4. Focus on backend returning the tier field

The frontend is **100% ready** and tested. The backend just needs to return the `tier` field in the `/auth` response.
