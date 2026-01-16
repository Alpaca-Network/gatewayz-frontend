# Temporary API Key Investigation Report

**Date**: 2025-12-09
**Issue**: Console warning "Received temporary API key, will need to upgrade"

## Summary

The warning is **intentional and informative** - not necessarily an error. The authentication system is designed to handle temporary API keys gracefully and automatically upgrade them when appropriate.

## Root Cause Analysis

### When Temporary Keys Are Issued

According to the backend logs and code analysis, temporary API keys (`gw_temp_*`) are issued in these scenarios:

1. **New Users** - Get temporary keys initially (expected behavior)
2. **Users with Low Credits** (<= 10 credits) - Backend may return temp key
3. **Authentication Refresh** - Backend might temporarily issue a temp key during re-authentication
4. **Auto-create flag** - When `auto_create_api_key: true` is sent and user doesn't have an existing key

### Code Flow

```typescript
// From gatewayz-auth-context.tsx:687-689
auto_create_api_key: isNewUser || !hasStoredApiKey,
is_new_user: isNewUser,
```

**Issue Identified**: For **existing users** who already have a live API key, the frontend might be sending `auto_create_api_key: true` if the stored API key isn't found, causing the backend to create a new temporary key instead of returning the existing live key.

## Railway Backend Logs Analysis

From the deployment logs (12/9/2025, 12:51:41 AM):

```
POST /auth
Privy auth request for user: did:privy:cmg8g1uyr004fjp0ds7ic2pe2
Existing Privy user found: 1
User credits at login: 431.78
Returning primary API key for user 1 from 17 active keys
```

**Key Findings**:
- Backend correctly identifies existing user (User ID: 1)
- User has 431.78 credits (well above 10 credit threshold)
- Backend has 17 active keys for this user
- Backend correctly returns the primary API key

**No backend errors found** - the backend is functioning correctly.

## Protection Mechanisms in Place

The frontend has multiple protection layers:

### 1. Existing Live Key Restoration (Line 1104-1109)
```typescript
if (existingLiveKey) {
  console.log("[Auth] Backend returned temp key but we have existing live key - restoring live key");
  authData = { ...authData, api_key: existingLiveKey };
}
```

### 2. Automatic Upgrade (Lines 336-496)
```typescript
const upgradeApiKeyIfNeeded = useCallback(async (authData: AuthResponse) => {
  // Fetches permanent keys from /api/user/api-keys
  // Upgrades if user has > 10 credits and is not new user
})
```

### 3. Non-Blocking Failures (Lines 603-629)
- If upgrade fails, logs warning to Sentry
- **Does NOT block authentication**
- User can continue with temp key (backend will create permanent key on next auth)

## Enhanced Logging Added

### Changes Made to `src/context/gatewayz-auth-context.tsx`

1. **Temp Key Detection Logging** (Lines 1079-1102)
   - Logs detailed info when temp key is received
   - Captures to Sentry with full context
   - Tracks: user_id, credits, tier, is_new_user, had_existing_live_key

2. **Permanent Key Logging** (Lines 1112-1117)
   - Logs confirmation when permanent key received
   - Includes user_id, credits, tier, key_prefix

3. **Upgrade Eligibility Logging** (Lines 339-362)
   - Logs when upgrade check starts
   - Shows eligibility criteria evaluation
   - Indicates if upgrade is skipped and why

4. **API Keys Fetch Logging** (Lines 384-434)
   - Logs API call to /api/user/api-keys
   - Shows response status
   - Lists all keys with details (is_temp, is_primary, environment, prefix)

5. **Upgrade Success Logging** (Lines 480-485)
   - Shows before/after key prefixes
   - Indicates which key was selected (primary, environment)

## Potential Issues & Recommendations

### Issue 1: `auto_create_api_key` Logic

**Current Behavior**:
```typescript
// Line 689
auto_create_api_key: isNewUser || !hasStoredApiKey,
```

**Potential Problem**: If `localStorage` is cleared or user switches devices, `hasStoredApiKey` will be false, causing the backend to create a new temp key even for existing users with live keys.

**Recommendation**: Backend should check if user already has live keys before creating a new temp key, regardless of the `auto_create_api_key` flag.

### Issue 2: Race Condition in Upgrade

**Current Behavior**: Upgrade happens asynchronously after auth completes.

**Potential Problem**: UI might briefly use temp key before upgrade completes, causing 401 errors.

**Mitigation Already in Place** (Lines 589-660):
- Upgrade is awaited before `handleAuthSuccess`
- If temp key detected after upgrade, error state is set
- Authentication is blocked if upgrade fails

### Issue 3: Session Transfer from Main Domain

**Related Issue**: The cross-domain session transfer from gatewayz.ai → beta.gatewayz.ai might be passing a temp key.

**Check Required**: Verify what key type is being transferred in the `?token=` parameter.

## Sentry Tracking

New Sentry events will capture:

1. **"Temporary API key received during authentication"** (Warning)
   - Tags: `auth_issue: temp_key_received`
   - Extra: user_id, credits, is_new_user, tier, had_existing_live_key

2. **"No upgraded API key found after payment"** (Warning)
   - Tags: `auth_error: no_upgraded_key_found`
   - Extra: credits, keys_count

3. **"Failed to upgrade temporary API key"** (Warning)
   - Tags: `auth_error: api_key_upgrade_failed`
   - Extra: credits, is_new_user, http_status

4. **"Temporary API key could not be upgraded after authentication"** (Error)
   - Tags: `auth_error: temp_key_upgrade_failed`
   - Extra: credits, is_new_user, has_temp_key

## Next Steps

### Immediate Actions

1. **Monitor Sentry** for new temp key events to understand frequency and patterns
2. **Check localStorage persistence** - Are users clearing storage frequently?
3. **Verify session transfer** - Is the main domain passing temp keys to beta?

### Backend Investigation Required

1. **Review backend auth endpoint** (`POST /auth`)
   - When does it create temp keys vs return existing live keys?
   - Does it respect existing live keys when `auto_create_api_key: true`?

2. **Review backend API key creation logic**
   - Why are some users getting temp keys despite having credits?
   - Is there a condition we're missing?

### Frontend Improvements (If Needed)

1. **Add localStorage sync check** before auth
   - Verify stored key is still valid
   - Clear invalid keys before requesting new auth

2. **Add session transfer key validation**
   - Detect if transferred key is temp
   - Request upgrade immediately on beta domain

## Testing Checklist

To verify the fix works:

- [ ] New user signup → Should get temp key, upgrade after purchase
- [ ] Existing user login → Should get live key (not temp)
- [ ] Existing user login (cleared localStorage) → Should restore live key
- [ ] Session transfer from main → Should pass live key (not temp)
- [ ] User with > 10 credits → Should never stay on temp key
- [ ] User with <= 10 credits → Can stay on temp key (expected)

## Conclusion

**The warning is working as designed**. The protection mechanisms are robust:
- Existing live keys are restored automatically
- Upgrade attempts happen for eligible users
- Failures are non-blocking

**However**, we should monitor Sentry to see:
1. How often temp keys are issued to existing users with credits
2. If upgrade failures are common
3. If 401 errors correlate with temp key usage

The enhanced logging will provide the data needed to determine if backend changes are required.
