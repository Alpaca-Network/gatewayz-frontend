# Production Testing Guide: Referral System

## 🚀 Pre-Deployment Checklist

Before pushing to production, ensure:

- [ ] Environment variables are set in production:
  - `SUPABASE_URL`
  - `SUPABASE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - Other required API keys

- [ ] Database migration has been applied:
  ```bash
  # Check if the referral tables exist in production Supabase
  # Go to Supabase Dashboard > SQL Editor > Run:
  SELECT table_name
  FROM information_schema.tables
  WHERE table_name IN ('referrals', 'users')
  AND table_schema = 'public';
  ```

- [ ] Stripe webhook endpoint is configured:
  - URL: `https://your-domain.com/stripe/webhook`
  - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`

---

## 📝 Step-by-Step Production Testing

### **STEP 1: Verify Deployment** ✅

#### 1.1 Check Health Endpoint
```bash
curl https://your-domain.com/health
# Expected: {"status": "healthy", ...}
```

#### 1.2 Check API Documentation
Visit: `https://your-domain.com/docs`
- Look for **"referral"** tag in the endpoint list
- Verify these endpoints exist:
  - `GET /referral/code`
  - `GET /referral/stats`
  - `POST /referral/validate`
  - `POST /referral/generate`

#### 1.3 Check Logs
```bash
# Railway
railway logs

# OR Vercel
vercel logs

# Look for: "✅ Referral System (referral)"
```

---

### **STEP 2: Test API Endpoints** 🔌

#### 2.1 Get Your Referral Code

**Request:**
```bash
curl -X GET "https://your-domain.com/referral/code" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "referral_code": "ABC12345",
  "share_message": "Join Gatewayz and get $10 in credits! Use my referral code: ABC12345"
}
```

**✅ Success Criteria:**
- You receive an 8-character uppercase alphanumeric code
- Code is saved in your user profile

#### 2.2 Check Referral Stats

**Request:**
```bash
curl -X GET "https://your-domain.com/referral/stats" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "referral_code": "ABC12345",
  "total_uses": 0,
  "remaining_uses": 10,
  "max_uses": 10,
  "total_earned": 0.0,
  "current_balance": 10.0,
  "referred_by_code": null,
  "referrals": []
}
```

**✅ Success Criteria:**
- `max_uses` should be **10**
- `remaining_uses` should be **10**
- Stats are returned without errors

#### 2.3 Validate a Referral Code

**Request:**
```bash
curl -X POST "https://your-domain.com/referral/validate" \
  -H "Authorization: Bearer ANOTHER_USER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "referral_code": "ABC12345"
  }'
```

**Expected Response (if valid):**
```json
{
  "valid": true,
  "message": "Referral code is valid and can be used",
  "referrer_username": "your_username",
  "referrer_email": "your@email.com"
}
```

**✅ Success Criteria:**
- Code validation works
- Returns referrer information

---

### **STEP 3: Test Registration Flow** 👤

#### 3.1 Create Test User WITH Referral Code

**Option A: Via Your Frontend**
1. Go to your signup page
2. Enter test email: `test+referral1@yourdomain.com`
3. Enter referral code in the field
4. Complete registration

**Option B: Via API**
```bash
curl -X POST "https://your-domain.com/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testreferral1",
    "email": "test+referral1@yourdomain.com",
    "referral_code": "ABC12345",
    "auth_method": "EMAIL",
    "environment_tag": "live"
  }'
```

**Expected Response:**
```json
{
  "user_id": 123,
  "username": "testreferral1",
  "email": "test+referral1@yourdomain.com",
  "api_key": "gw_live_...",
  "credits": 10,
  "message": "Account created successfully"
}
```

#### 3.2 Verify in Database

**Go to Supabase Dashboard > SQL Editor:**
```sql
-- Check if referral code was stored
SELECT id, email, username, referred_by_code, has_made_first_purchase
FROM users
WHERE email = 'test+referral1@yourdomain.com';
```

**✅ Success Criteria:**
- `referred_by_code` should be `ABC12345`
- `has_made_first_purchase` should be `false`

---

### **STEP 4: Test Payment & Bonus Application** 💰

This is the most critical test - it confirms the entire flow works.

#### 4.1 Create Test Stripe Checkout

**Request:**
```bash
curl -X POST "https://your-domain.com/stripe/create-checkout-session" \
  -H "Authorization: Bearer TEST_USER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "usd",
    "description": "Test purchase for referral"
  }'
```

**Expected Response:**
```json
{
  "session_id": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "payment_id": 456,
  "status": "pending"
}
```

#### 4.2 Complete Stripe Payment

**IMPORTANT:** Use Stripe test card numbers in production TEST mode only!

1. Visit the checkout URL from the response
2. Use Stripe test card:
   - **Card number:** `4242 4242 4242 4242`
   - **Expiry:** Any future date (e.g., `12/25`)
   - **CVC:** Any 3 digits (e.g., `123`)
   - **ZIP:** Any 5 digits (e.g., `12345`)
3. Complete the payment

#### 4.3 Check Webhook Logs

**In your deployment platform:**
```bash
# Look for these log messages:
# "Checkout completed: Added 10.0 credits to user X"
# "Referral bonus applied! User X and referrer both received $10.0"
```

**In Stripe Dashboard:**
1. Go to **Developers > Webhooks**
2. Find your webhook endpoint
3. Click on recent events
4. Look for `checkout.session.completed`
5. Check if webhook succeeded (green checkmark)

#### 4.4 Verify Bonus in Database

**Supabase SQL Editor:**
```sql
-- Check if first purchase was marked
SELECT id, email, has_made_first_purchase, credits, balance
FROM users
WHERE email = 'test+referral1@yourdomain.com';

-- Expected:
-- has_made_first_purchase = true
-- credits should be 20.0 (10 initial + 10 bonus)

-- Check referral record was created
SELECT * FROM referrals
WHERE referred_user_id = (
  SELECT id FROM users WHERE email = 'test+referral1@yourdomain.com'
);

-- Expected: One row with status = 'completed', bonus_amount = 10.0

-- Check referrer's credits increased
SELECT id, email, credits, balance
FROM users
WHERE referral_code = 'ABC12345';

-- Expected: credits increased by 10.0
```

#### 4.5 Check Credit Transactions

```sql
-- View credit transaction history
SELECT * FROM credit_transactions
WHERE user_id IN (
  SELECT id FROM users WHERE email IN (
    'test+referral1@yourdomain.com',
    'your@email.com'
  )
)
ORDER BY created_at DESC
LIMIT 10;

-- Expected: 2 transactions with description containing "Referral bonus"
```

---

### **STEP 5: Test Edge Cases** ⚠️

#### 5.1 Test: User Can't Use Code Twice

Try to make another purchase with the same user who already got the bonus:

**Expected:** Payment succeeds, but NO referral bonus applied

**Verify:**
```sql
SELECT COUNT(*) FROM referrals
WHERE referred_user_id = (
  SELECT id FROM users WHERE email = 'test+referral1@yourdomain.com'
);

-- Expected: COUNT = 1 (still just one referral record)
```

#### 5.2 Test: Can't Use Own Code

1. Get User A's referral code
2. Try to register User A again with their own code
3. **Expected:** Validation fails with error "Cannot use your own referral code"

#### 5.3 Test: Purchase Under $10

1. Create checkout session for $5 (500 cents)
2. Complete payment
3. **Expected:** Payment succeeds, but NO referral bonus applied

**Verify in logs:**
```
# Should see:
# "Purchase succeeded but referral code requires minimum purchase of $10"
```

#### 5.4 Test: Max Uses Limit (10)

1. Create 10 different test users with the same referral code
2. Have all 10 make $10+ purchases
3. Try to create an 11th user with the same code
4. **Expected:** Validation fails with "This referral code has reached its usage limit (10 uses)"

**Verify:**
```sql
SELECT referral_code, COUNT(*) as uses
FROM referrals
WHERE referral_code = 'ABC12345' AND status = 'completed'
GROUP BY referral_code;

-- Expected: uses = 10
```

---

### **STEP 6: Test API Error Handling** 🛡️

#### 6.1 Invalid Referral Code
```bash
curl -X POST "https://your-domain.com/referral/validate" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"referral_code": "INVALID99"}'
```

**Expected:**
```json
{
  "valid": false,
  "message": "Invalid referral code"
}
```

#### 6.2 Missing API Key
```bash
curl -X GET "https://your-domain.com/referral/code" \
  -H "Content-Type: application/json"
```

**Expected:** `401 Unauthorized`

#### 6.3 Invalid API Key
```bash
curl -X GET "https://your-domain.com/referral/stats" \
  -H "Authorization: Bearer fake_key_123" \
  -H "Content-Type: application/json"
```

**Expected:** `401 Invalid API key`

---

## 🔍 Monitoring & Verification

### **Key Metrics to Monitor:**

1. **Referral Creation Rate**
   ```sql
   SELECT COUNT(*) as total_referrals
   FROM referrals
   WHERE created_at >= NOW() - INTERVAL '7 days';
   ```

2. **Successful Referral Conversion Rate**
   ```sql
   SELECT
     COUNT(*) as completed,
     COUNT(*) FILTER (WHERE status = 'pending') as pending
   FROM referrals
   WHERE created_at >= NOW() - INTERVAL '7 days';
   ```

3. **Total Bonuses Paid**
   ```sql
   SELECT SUM(bonus_amount) as total_bonuses_paid
   FROM referrals
   WHERE status = 'completed';
   ```

4. **Most Active Referrers**
   ```sql
   SELECT
     u.username,
     u.email,
     u.referral_code,
     COUNT(r.id) as referral_count,
     SUM(r.bonus_amount) as total_earned
   FROM users u
   LEFT JOIN referrals r ON u.id = r.referrer_id
   WHERE r.status = 'completed'
   GROUP BY u.id, u.username, u.email, u.referral_code
   ORDER BY referral_count DESC
   LIMIT 10;
   ```

### **Set Up Alerts:**

Monitor for these issues:
- Webhook failures (check Stripe dashboard)
- Referral bonus application failures (check logs)
- Database constraint violations
- Unusually high referral activity (potential abuse)

---

## 🚨 Troubleshooting

### **Issue: Referral code not generated**

**Check:**
```sql
SELECT id, username, email, referral_code
FROM users
WHERE referral_code IS NULL
LIMIT 10;
```

**Fix:** Call generate endpoint for each user
```bash
curl -X POST "https://your-domain.com/referral/generate" \
  -H "Authorization: Bearer USER_API_KEY"
```

### **Issue: Bonus not applied after payment**

**Check webhook logs:**
1. Stripe Dashboard > Webhooks > Click your endpoint
2. Check recent events
3. Look for `checkout.session.completed` event
4. Check response code (should be 200)

**If webhook failed:**
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check server logs for errors
- Manually retry webhook from Stripe dashboard

**Check user state:**
```sql
SELECT
  id,
  email,
  referred_by_code,
  has_made_first_purchase,
  credits,
  balance
FROM users
WHERE email = 'affected-user@email.com';
```

### **Issue: "Already used referral code" but user hasn't**

**Check:**
```sql
SELECT * FROM referrals
WHERE referred_user_id = (
  SELECT id FROM users WHERE email = 'user@email.com'
);
```

**Fix:** If no records exist, reset flag:
```sql
UPDATE users
SET has_made_first_purchase = false
WHERE email = 'user@email.com'
AND id NOT IN (SELECT referred_user_id FROM referrals);
```

---

## ✅ Production Test Checklist

Use this checklist to verify everything works:

- [ ] **Deployment successful**
  - [ ] No errors in deployment logs
  - [ ] Health endpoint returns 200
  - [ ] API docs show referral endpoints

- [ ] **Database migration applied**
  - [ ] `referrals` table exists
  - [ ] `users.referral_code` column exists
  - [ ] `users.referred_by_code` column exists
  - [ ] `users.has_made_first_purchase` column exists

- [ ] **API Endpoints working**
  - [ ] `GET /referral/code` returns valid code
  - [ ] `GET /referral/stats` returns correct stats
  - [ ] `POST /referral/validate` validates codes correctly
  - [ ] `POST /referral/generate` creates new codes

- [ ] **Registration flow**
  - [ ] Can register with referral code
  - [ ] Code is stored in database
  - [ ] Invalid codes are rejected

- [ ] **Payment & Bonus flow**
  - [ ] Stripe checkout session created
  - [ ] Payment completes successfully
  - [ ] Webhook receives event
  - [ ] Bonus applied to BOTH users
  - [ ] Credits appear in user accounts
  - [ ] Referral record created in database
  - [ ] First purchase flag set to true

- [ ] **Edge cases**
  - [ ] Can't use code twice
  - [ ] Can't use own code
  - [ ] Under $10 purchase doesn't trigger bonus
  - [ ] Max 10 uses enforced

- [ ] **Monitoring**
  - [ ] Logs show successful referrals
  - [ ] Stripe webhook succeeds
  - [ ] No errors in production logs

---

## 📊 Expected Results Summary

After completing all tests:

| Test | Expected Result |
|------|-----------------|
| Get referral code | 8-character code returned |
| Referral stats | Shows 0/10 uses initially |
| Register with code | Code stored in DB |
| $10+ purchase | Both users get $10 bonus |
| Second purchase | No bonus applied |
| Use own code | Validation fails |
| Under $10 purchase | No bonus applied |
| 11th use attempt | Validation fails (max 10) |

---

## 🎉 Success Criteria

Your referral system is working correctly in production if:

1. ✅ Users can generate unique referral codes
2. ✅ New users can register with referral codes
3. ✅ First purchase of $10+ triggers $10 bonus for BOTH users
4. ✅ Credits appear in both user accounts
5. ✅ Referral records are created in database
6. ✅ Users can view their referral stats
7. ✅ Edge cases are handled correctly (max 10 uses, $10 min, one-time use)
8. ✅ Stripe webhook integration works
9. ✅ No errors in production logs

---

## 📞 Need Help?

If you encounter issues:

1. Check production logs first
2. Verify Stripe webhook configuration
3. Check Supabase tables and data
4. Review this guide's troubleshooting section
5. Test in staging environment first if available

Good luck with your production deployment! 🚀
