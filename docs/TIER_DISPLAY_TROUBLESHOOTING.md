# Tier Display Troubleshooting Guide

## Overview

The CreditsDisplay component shows either a **tier badge** (PRO/MAX) or **credit count** (Basic) in the application header. This guide helps troubleshoot issues where the tier badge doesn't appear.

## How It Works

### Frontend Implementation

**Location:** `/src/components/layout/credits-display.tsx`

The component reads user data from localStorage and renders:
- **PRO/MAX users**: Crown icon 👑 + tier name
- **Basic users**: Coins icon 🪙 + credit count

```typescript
const showPlanName = tier === 'pro' || tier === 'max';
```

### Data Flow

1. **Authentication** → User logs in via Privy
2. **Backend API** → `/api/auth` returns user data including `tier` field
3. **LocalStorage** → Data saved to `gatewayz_user_data`
4. **Component** → CreditsDisplay reads from localStorage and displays tier/credits

## Common Issues & Solutions

### Issue 1: Tier Badge Not Showing (Most Common)

**Symptoms:**
- User has PRO/MAX subscription but sees credit count instead
- No badge appears in header

**Root Cause:**
Backend is not returning `tier` field in auth response

**Diagnosis:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for logs: `[CreditsDisplay] Normalized tier`
4. Check if tier is `undefined`

**Solution:**
Check backend authentication endpoint ensures it returns:
```json
{
  "user_id": 123,
  "credits": 5000,
  "tier": "pro",
  "subscription_status": "active"
}
```

### Issue 2: Case Sensitivity

**Symptoms:**
- Backend returns "PRO"/"MAX" in uppercase
- Frontend expects lowercase

**Solution:**
Frontend already handles this! The component normalizes tier values:
```typescript
const normalizedTier = userData.tier?.toLowerCase() as UserTier | undefined;
```

If you see uppercase in logs but badge doesn't show, verify the normalization is working.

### Issue 3: Cached Data

**Symptoms:**
- User upgraded to PRO/MAX but still sees old credit display
- Tier data is stale

**Solution:**
1. **Force refresh auth:**
   ```javascript
   localStorage.removeItem('gatewayz_user_data');
   localStorage.removeItem('gatewayz_api_key');
   // Then log in again
   ```

2. **Or wait for auto-refresh** (polls every 10 seconds)

### Issue 4: Missing Subscription Status

**Symptoms:**
- Tier is set but component behaves oddly
- Logs show tier but no badge

**Diagnosis:**
The component only checks `tier`, not `subscription_status`. However, the status should still be included for completeness.

**Expected Data:**
```json
{
  "tier": "pro",
  "subscription_status": "active",
  "subscription_end_date": 1730000000
}
```

## Debugging Checklist

### Step 1: Check LocalStorage

```javascript
// Open browser console and run:
JSON.parse(localStorage.getItem('gatewayz_user_data'))
```

**Expected Output (PRO user):**
```json
{
  "user_id": 123,
  "credits": 5000,
  "tier": "pro",
  "subscription_status": "active"
}
```

**Expected Output (Basic user):**
```json
{
  "user_id": 456,
  "credits": 1000,
  "tier": "basic"
}
```

### Step 2: Check Console Logs

Enable console and look for:
```
[CreditsDisplay] Loading credits from userData: {...}
[CreditsDisplay] Normalized tier: { original: 'pro', normalized: 'pro', isPro: true, isMax: false }
[CreditsDisplay] Rendering: { credits: 5000, tier: 'pro', showPlanName: true, planName: 'PRO' }
```

### Step 3: Check Network Response

1. Open DevTools → Network tab
2. Log in or refresh the page
3. Find the `/api/auth` request
4. Check the response JSON for `tier` field

### Step 4: Manual Test

Use the test page at `/test-tier-display`:

```bash
# Start dev server
pnpm dev

# Visit http://localhost:3000/test-tier-display
```

This page allows you to:
- Simulate different tier scenarios
- View component preview
- See detailed logs
- Test tier switching

## Backend Requirements

### Authentication Endpoint

**Endpoint:** `POST https://api.gatewayz.ai/auth`

**Required Response Fields:**
```typescript
interface AuthResponse {
  success: boolean;
  user_id: number;
  api_key: string;
  credits: number;
  tier?: 'basic' | 'pro' | 'max';  // ← REQUIRED for tier badges
  subscription_status?: 'active' | 'cancelled' | 'past_due' | 'inactive';
  subscription_end_date?: number;  // Unix timestamp
}
```

### Database Schema

Ensure your users table includes:
```sql
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  tier VARCHAR(10) DEFAULT 'basic',  -- 'basic', 'pro', or 'max'
  subscription_status VARCHAR(20),
  subscription_end_date BIGINT
);
```

### Stripe Webhook Integration

When a user subscribes via Stripe, ensure the webhook updates:
```typescript
// On checkout.session.completed
await updateUser(userId, {
  tier: 'pro',  // or 'max' based on price_id
  subscription_status: 'active',
  subscription_end_date: subscriptionEndDate
});
```

## Testing

### Automated Tests

Run the test suite:
```bash
pnpm test -- src/components/layout/__tests__/credits-display.test.tsx
```

**Coverage:**
- ✅ Basic tier shows credits
- ✅ PRO tier shows badge
- ✅ MAX tier shows badge
- ✅ Uppercase tier handling
- ✅ Real-time updates
- ✅ Edge cases (null, undefined)

### Manual Testing Script

Use the test script in `/scripts/test-tier-display.js`:

```javascript
// Copy functions into browser console

// Test PRO user
testProUser();

// Test MAX user
testMaxUser();

// Test Basic user
testBasicUser();

// Check current data
checkCurrentUser();

// Clear test data
clearTestData();
```

## Visual Reference

### Expected Display

**Basic Tier:**
```
┌─────────────────┐
│ 🪙 1,000        │
└─────────────────┘
```

**PRO Tier:**
```
┌─────────────────┐
│ 👑 PRO          │
└─────────────────┘
```

**MAX Tier:**
```
┌─────────────────┐
│ 👑 MAX          │
└─────────────────┘
```

## Related Files

- **Component:** `/src/components/layout/credits-display.tsx`
- **Test:** `/src/components/layout/__tests__/credits-display.test.tsx`
- **Test Page:** `/src/app/test-tier-display/page.tsx`
- **Test Script:** `/scripts/test-tier-display.js`
- **API Types:** `/src/lib/api.ts`
- **Auth Context:** `/src/context/gatewayz-auth-context.tsx`

## Support

If you're still experiencing issues after following this guide:

1. Check browser console for errors
2. Verify backend logs for auth responses
3. Ensure database has correct tier values
4. Test with the `/test-tier-display` page
5. Check that Stripe webhooks are firing correctly

## Quick Fix Checklist

- [ ] Backend returns `tier` field in `/auth` response
- [ ] Tier value is lowercase ('pro', 'max', 'basic')
- [ ] User data is saved to localStorage correctly
- [ ] No JavaScript errors in browser console
- [ ] Component is rendering (check React DevTools)
- [ ] CreditsDisplay component is imported in header
- [ ] User has credits > 0 (component doesn't render if credits is null)

## Known Limitations

1. **Component doesn't render without credits** - Even PRO/MAX users need the credits field set (can be 0+)
2. **Polling delay** - Changes may take up to 10 seconds to appear
3. **Cross-tab sync** - Uses storage events, may have slight delay
4. **Initial load** - Requires page refresh after subscription change in some cases
