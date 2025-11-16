# gatewayz.ai Team - Auth Session Transfer Implementation Checklist

This document outlines exactly what the **gatewayz.ai team** needs to do to enable authentication session transfer to the beta domain.

---

## What Has Been Done ✅

The following has already been implemented in the gatewayz.ai codebase:

### 1. Session Transfer Module
- **File**: `src/integrations/privy/auth-session-transfer.ts`
- **Contains**: Functions for redirecting to beta, handling URL params, and managing sessionStorage tokens
- **Status**: ✅ Ready to use

### 2. Auth Sync Module
- **File**: `src/integrations/privy/auth-sync.ts`
- **Contains**: Reusable function to sync Privy auth with backend
- **Status**: ✅ Ready to use

### 3. Updated GatewayzAuthContext
- **File**: `src/context/gatewayz-auth-context.tsx`
- **Changes**: Added beta redirect support with config flags
- **Status**: ✅ Ready to use

### 4. Documentation
- **File**: `BETA_AUTH_TRANSFER.md`
- **Contains**: Complete guide for beta team implementation
- **Status**: ✅ Ready for beta team

---

## What You Need to Do

### Task 1: Enable Beta Redirect in PrivyProviderWrapper

**File to modify**: `src/components/providers/privy-provider.tsx`

**Current code** (lines 72-73):
```tsx
<GatewayzAuthProvider onAuthError={handleAuthError}>{renderChildren}</GatewayzAuthProvider>
```

**Change to**:
```tsx
<GatewayzAuthProvider
  onAuthError={handleAuthError}
  enableBetaRedirect={true}
  betaDomain="https://beta.gatewayz.ai"
>
  {renderChildren}
</GatewayzAuthProvider>
```

**What this does**:
- `enableBetaRedirect={true}` - Enables automatic redirect to beta domain after login
- `betaDomain="https://beta.gatewayz.ai"` - Specifies beta domain URL

**Alternative: Environment-based configuration** (if you want to toggle via env var):
```tsx
<GatewayzAuthProvider
  onAuthError={handleAuthError}
  enableBetaRedirect={process.env.NEXT_PUBLIC_ENABLE_BETA_REDIRECT === 'true'}
  betaDomain={process.env.NEXT_PUBLIC_BETA_DOMAIN || 'https://beta.gatewayz.ai'}
>
  {renderChildren}
</GatewayzAuthProvider>
```

Then add to `.env.local`:
```bash
NEXT_PUBLIC_ENABLE_BETA_REDIRECT=true
NEXT_PUBLIC_BETA_DOMAIN=https://beta.gatewayz.ai
```

---

### Task 2: Test the Implementation

After making the change, test the following scenarios:

#### Test Case 1: New User Redirect
1. Open `https://gatewayz.ai` in a fresh incognito/private window
2. Click "Sign In"
3. Authenticate with Email/Google/GitHub
4. Verify automatic redirect to `https://beta.gatewayz.ai?token=...&userId=...&returnUrl=/onboarding`
5. Verify URL is cleaned after landing on beta (should show `/` in address bar)

#### Test Case 2: Existing User Redirect
1. Login on `https://gatewayz.ai` with an existing account
2. Verify automatic redirect to `https://beta.gatewayz.ai?token=...&userId=...`
3. Verify user is authenticated on beta domain
4. Verify URL is cleaned

#### Test Case 3: Browser Console Logs
Open Developer Tools → Console and verify:
- `[SessionTransfer] Redirecting to beta with session:` log appears on gatewayz.ai
- `[SessionInit] Session transfer params detected` log appears on beta domain
- No token appears in the actual URL history (use browser back button to verify)

---

## Implementation Details

### How It Works

1. **User authenticates** on gatewayz.ai via Privy
2. **Backend returns API key** via existing `/api/auth` endpoint
3. **API key stored** in localStorage
4. **Token stored** in sessionStorage (10-minute expiry)
5. **Automatic redirect**:
   ```
   https://beta.gatewayz.ai?token=<API_KEY>&userId=<USER_ID>&returnUrl=<optional>
   ```
6. **Beta domain receives token** and establishes session
7. **URL cleaned** to remove sensitive params from history

### Key Points

- ✅ **No new backend API required** - uses existing `/api/auth` endpoint
- ✅ **No additional environment variables required** (unless using env-based config)
- ✅ **Backward compatible** - disabling `enableBetaRedirect` keeps original behavior
- ✅ **Secure** - tokens auto-expire after 10 minutes in sessionStorage
- ✅ **Optional return URL** - supports redirecting to specific pages (e.g., onboarding)

---

## Files Modified

| File | Change | Impact |
|------|--------|--------|
| `src/context/gatewayz-auth-context.tsx` | Added beta redirect logic | Medium - auth flow enhancement |
| `src/components/providers/privy-provider.tsx` | Enable redirect flag | Small - config change only |

---

## What Happens Next (Beta Team's Job)

Once you enable `enableBetaRedirect`, the beta team will:

1. Copy the following modules to their codebase:
   - `src/integrations/privy/auth-session-transfer.ts`
   - `src/integrations/privy/auth-sync.ts`
   - `src/context/gatewayz-auth-context.tsx`

2. Create a `SessionInitializer` component to handle incoming session params

3. Add `SessionInitializer` to their root layout

4. Configure same environment variables:
   - `NEXT_PUBLIC_PRIVY_APP_ID` (same as main domain)
   - `NEXT_PUBLIC_API_BASE_URL` (same as main domain)

Full implementation guide for beta team is in: `BETA_AUTH_TRANSFER.md`

---

## Rollback Plan

If you need to disable the feature:

```tsx
// Simply change:
enableBetaRedirect={true}

// To:
enableBetaRedirect={false}
```

Users will behave as before:
- New users redirected to `/onboarding`
- Existing users can access dashboard normally
- No data loss or side effects

---

## FAQ

### Q: Will this break existing functionality?
**A**: No. The feature is opt-in via the `enableBetaRedirect` flag. With it disabled (default before our change), behavior is identical to before.

### Q: Do I need to change the backend?
**A**: No. Uses existing `/api/auth` endpoint.

### Q: What if beta.gatewayz.ai is not ready?
**A**: Set `enableBetaRedirect={false}` or don't make the change yet. You can enable it anytime when beta is ready.

### Q: Can I customize the beta domain?
**A**: Yes, via the `betaDomain` prop:
```tsx
<GatewayzAuthProvider
  enableBetaRedirect={true}
  betaDomain="https://staging-beta.gatewayz.ai"  // Custom domain
>
```

### Q: Do new users see different onboarding on beta?
**A**: No. They're redirected to `/onboarding` on beta domain via the `returnUrl` param. Beta team can customize their onboarding separately.

### Q: What if user loses connection during redirect?
**A**: The token persists in sessionStorage for 10 minutes, so they can refresh and it will still work. After 10 minutes, they need to login again.

### Q: Can existing users manually trigger the redirect?
**A**: Yes, via the `useGatewayzAuth()` hook:
```tsx
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";

export function SomeComponent() {
  const { redirectToBeta } = useGatewayzAuth();

  return (
    <button onClick={() => redirectToBeta()}>
      Go to Beta
    </button>
  );
}
```

---

## Checklist

- [ ] Read and understand this document
- [ ] Review `src/context/gatewayz-auth-context.tsx` changes
- [ ] Modify `src/components/providers/privy-provider.tsx` to enable beta redirect
- [ ] Test new user login flow (verify redirect happens)
- [ ] Test existing user login (verify redirect happens)
- [ ] Check browser console for correct logs
- [ ] Verify token is cleaned from URL after redirect
- [ ] Communicate with beta team that feature is live
- [ ] Beta team implements `SessionInitializer` on their end
- [ ] Test end-to-end flow across both domains
- [ ] Celebrate 🎉

---

## Testing Commands

### Local Testing

```bash
# Install dependencies (if not already done)
pnpm install

# Run development server
pnpm dev

# Open http://localhost:3000
# Test login flow
```

### Production Testing

Once deployed, test on actual domain:
1. `https://gatewayz.ai/` - New user login test
2. `https://gatewayz.ai/` - Existing user login test
3. Verify redirect to `https://beta.gatewayz.ai`

---

## Support & Questions

### For gatewayz.ai team:
- Review changes in `src/context/gatewayz-auth-context.tsx`
- Check console logs with `[Auth]` and `[SessionTransfer]` prefixes
- Verify environment variables if using env-based config

### For integration with beta team:
- Share this checklist with beta team
- Share `BETA_AUTH_TRANSFER.md` for their implementation
- Ensure both teams use same Privy App ID
- Ensure both teams use same API base URL

---

## Summary

**What you need to do**:
1. Modify `src/components/providers/privy-provider.tsx` (1 file, ~5 lines)
2. Test the login flow
3. Coordinate with beta team

**Time estimate**: 15 minutes setup + 10 minutes testing = 25 minutes total

**Risk level**: Very low (backward compatible, easy to disable)

**Breaking changes**: None
