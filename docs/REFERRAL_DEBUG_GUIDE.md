# Referral Code System - Debug Guide

## Overview

The referral system tracks when users sign up with a referral code and applies bonuses when they make their first purchase.

**Flow**:
1. User signs up with referral code: `?ref=CODE`
2. Frontend captures and stores code in localStorage
3. Frontend sends code to backend `/auth` endpoint
4. Backend validates and stores `referred_by_code`
5. On first purchase, `apply_referral_bonus()` is called to credit both users

## Frontend Flow (✅ Already Working)

### Signup Page
File: `src/app/signup/page.tsx`

```javascript
// Captures referral code from URL parameter
const ref = searchParams.get('ref');
if (ref) {
    localStorage.setItem('gatewayz_referral_code', ref);
}
```

### Auth Provider
File: `src/components/providers/privy-provider.tsx`

```javascript
// Reads referral code from localStorage
const referralCode = localStorage.getItem('gatewayz_referral_code');

// Sends to backend
const authBody = {
    ...userAuth,
    referral_code: referralCode,  // Sent here
    is_new_user: isNewUser
};
```

## Backend Flow (Fixed - Now Working)

### Request Schema
File: `src/schemas/auth.py:39`

```python
class PrivyAuthRequest(BaseModel):
    user: PrivyUserData
    token: str
    email: Optional[str] = None
    referral_code: Optional[str] = None  # FIXED: Added this field
```

### Auth Endpoint
File: `src/routes/auth.py:22-258`

#### For New Users (Lines 174-233):

1. **Receives referral code** (Line 27-28):
   ```python
   if request.referral_code:
       logger.info(f"Referral code provided in auth request: {request.referral_code}")
   ```

2. **Validates code exists** (Lines 189-197):
   ```python
   referrer_result = client.table('users').select('id').eq('referral_code', request.referral_code).execute()
   if referrer_result.data:
       referral_code_valid = True
       logger.info(f"Valid referral code provided during signup: {request.referral_code}")
   ```

3. **Stores for new user** (Lines 200-205):
   ```python
   client.table('users').update({
       'referred_by_code': request.referral_code
   }).eq('id', user_data['user_id']).execute()
   ```

4. **Logs to activity** (Lines 238-257):
   ```python
   activity_metadata = {
       "referral_code": request.referral_code,
       "referral_code_valid": referral_code_valid
   }
   ```

## Database Schema

### Users Table

Key fields for referral system:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | INT | User ID |
| `referral_code` | STRING | Unique code generated for this user (8 chars) |
| `referred_by_code` | STRING | The code they used when signing up |
| `has_made_first_purchase` | BOOL | Flag for bonus eligibility |

### Referrals Table

Tracks completed referrals:

| Field | Type | Purpose |
|-------|------|---------|
| `referrer_id` | INT | User who shared the code |
| `referred_user_id` | INT | User who used the code |
| `referral_code` | STRING | The code used |
| `bonus_amount` | FLOAT | Amount credited ($10) |
| `status` | STRING | 'completed' or other |
| `completed_at` | TIMESTAMP | When bonus was applied |

## Bonus System

File: `src/services/referral.py`

### Constants
```python
REFERRAL_CODE_LENGTH = 8
MAX_REFERRAL_USES = 10  # Per code
MIN_PURCHASE_AMOUNT = 10.0  # Minimum to qualify
REFERRAL_BONUS = 10.0  # $10 for each user
```

### Bonus Application Flow

Called during checkout/payment processing:

```python
apply_referral_bonus(
    user_id=new_user_id,
    referral_code=referred_by_code,
    purchase_amount=amount
)
```

**Steps**:
1. Validates purchase amount >= $10
2. Validates referral code exists
3. Creates referral record
4. Credits both users $10
5. Updates `referred_by_code` in database

## How to Debug

### Step 1: Check Frontend Sending

**Open DevTools** (F12):

```javascript
// In browser console:
localStorage.getItem('gatewayz_referral_code')  // Should show your code

// Check network tab:
// Find POST request to /auth
// Look at request body - should have referral_code field
```

### Step 2: Check Backend Logs

**Look for these log messages**:

```
INFO: Privy auth request for user: USER_ID
INFO: Referral code provided in auth request: YOUR_CODE
INFO: Valid referral code provided during signup: YOUR_CODE
INFO: Stored referral code YOUR_CODE for new user USER_ID
INFO: Referral code processing result for new user USER_ID: valid=True
```

**OR error logs**:
```
WARNING: Invalid referral code provided during signup: INVALID_CODE
ERROR: Error processing referral code: [error details]
```

### Step 3: Verify Database

**Check if referral was stored**:

```sql
-- Check new user
SELECT id, referred_by_code FROM users WHERE email = 'new_user@example.com';
-- Should show: referred_by_code = "YOUR_CODE"

-- Check referrer
SELECT id, referral_code FROM users WHERE email = 'referrer@example.com';
-- Should show: referral_code = "THE_CODE"

-- Check referrals table (after purchase)
SELECT * FROM referrals WHERE referral_code = 'YOUR_CODE';
-- Should show: status = 'completed'
```

### Step 4: Test Full Flow

**Manual test**:

1. Get a referral code from existing user
2. Copy URL: `https://beta.gatewayz.ai/signup?ref=YOUR_CODE`
3. Sign up in incognito window with new email
4. Check DevTools console for logs
5. Verify backend logs show code was processed
6. Check database for `referred_by_code` entry
7. Make a purchase
8. Verify `referrals` table entry was created
9. Verify both users received $10 bonus

## Common Issues

### Issue: Referral code not in auth request

**Symptoms**: Frontend logs show code captured but backend doesn't see it

**Debug**:
```javascript
// Check if code is being sent
const body = /* auth body */;
console.log('Auth body:', body);
console.log('Has referral_code:', 'referral_code' in body);
```

**Solution**: Ensure frontend is using latest code that sends `referral_code`

### Issue: "Invalid referral code" in backend logs

**Causes**:
1. Code doesn't exist in database
2. User hasn't created a referral code yet
3. Typo in code

**Solution**: Generate referral code for the referrer first via `/referral/stats` endpoint

### Issue: Referral code valid but not stored

**Symptoms**: Backend logs say "Valid" but database shows NULL for `referred_by_code`

**Debug**:
```python
# Check database update result
result = client.table('users').update({...}).eq('id', new_user_id).execute()
print("Update result:", result.data)  # Should show data
```

**Solution**: Check Supabase permissions and connection

### Issue: Bonus not applied on purchase

**Causes**:
1. `referred_by_code` is NULL in database
2. `apply_referral_bonus()` not called during checkout
3. Purchase amount < $10

**Debug**:
1. Verify `referred_by_code` exists (see database checks above)
2. Check payment processing code calls `apply_referral_bonus()`
3. Verify purchase amount >= $10

## Testing Checklist

- [ ] Referral code captured from URL param
- [ ] Code stored in localStorage
- [ ] Code sent in auth request body
- [ ] Backend logs show code received
- [ ] Backend validates code exists
- [ ] Database has `referred_by_code` set for new user
- [ ] No errors in backend logs
- [ ] Purchase triggers bonus application
- [ ] Both users receive $10 credit
- [ ] Referrals table has record with status='completed'

## Files Modified

**Latest fix** (Commit: 8c70790):

1. `src/schemas/auth.py:47` - Added referral_code field
2. `src/routes/auth.py:27-29` - Added logging for referral code receipt
3. `src/routes/auth.py:187-209` - Added referral code validation and storage
4. `src/routes/auth.py:234` - Added logging of result
5. `src/routes/auth.py:238-246` - Added referral data to activity log

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/services/referral.py` | Referral business logic |
| `src/db/referral.py` | Database operations |
| `src/routes/referral.py` | API endpoints |
| `src/routes/auth.py` | Authentication endpoint (FIXED) |
| `src/schemas/auth.py` | Request/response schemas (FIXED) |

## Next Steps

1. **Restart backend** to load changes
2. **Test signup with referral link**
3. **Check backend logs** for referral code processing
4. **Verify database** shows `referred_by_code` set
5. **Make purchase** to test bonus application

## Support

If issues persist after fix:

1. Enable verbose logging: `logging.basicConfig(level=logging.DEBUG)`
2. Check all files for required imports
3. Verify database schema has all required fields
4. Check API key permissions for Supabase
