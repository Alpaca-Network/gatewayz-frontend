# gatewayz.ai - Auth Session Transfer Implementation Guide

## Quick Start: The Only Change You Need to Make

### Current Code (Line 72)
**File**: `src/components/providers/privy-provider.tsx`

```tsx
<GatewayzAuthProvider onAuthError={handleAuthError}>{renderChildren}</GatewayzAuthProvider>
```

### Updated Code

**Option 1: Simple (Hardcoded)**
```tsx
<GatewayzAuthProvider
  onAuthError={handleAuthError}
  enableBetaRedirect={true}
  betaDomain="https://beta.gatewayz.ai"
>
  {renderChildren}
</GatewayzAuthProvider>
```

**Option 2: Environment-Based (Recommended for flexibility)**
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

## What This Change Does

When enabled, users who login on gatewayz.ai will be automatically redirected to beta.gatewayz.ai with their authentication token.

### User Flow

```
User on gatewayz.ai
    ↓
Clicks "Sign In"
    ↓
Authenticates via Privy
    ↓
Backend returns API key
    ↓
[NEW] Auto-redirect to beta.gatewayz.ai?token=...&userId=...
```

---

## Implementation Steps

### Step 1: Make the Code Change
Edit `src/components/providers/privy-provider.tsx` line 72:
- Add `enableBetaRedirect={true}`
- Add `betaDomain="https://beta.gatewayz.ai"`

### Step 2: Run Tests
```bash
# Start development server
pnpm dev

# Test in browser:
# 1. Open http://localhost:3000
# 2. Click Sign In
# 3. Complete authentication
# 4. Verify redirect to beta domain
# 5. Check console for [SessionTransfer] logs
```

### Step 3: Verify Console Logs
Open DevTools → Console and look for:
```
[SessionTransfer] Redirecting to beta with session: {domain: "https://beta.gatewayz.ai", hasReturnUrl: false}
```

### Step 4: Coordinate with Beta Team
Share with beta team:
- `BETA_AUTH_TRANSFER.md` - Complete implementation guide
- Let them know the feature is live on your end

---

## Complete Implementation (Copy-Paste Ready)

Here's the complete updated `PrivyProviderWrapperInner` function with the change:

```tsx
function PrivyProviderWrapperInner({ children, className }: PrivyProviderWrapperProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "clxxxxxxxxxxxxxxxxxxx";
  const [showRateLimit, setShowRateLimit] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
      console.warn("NEXT_PUBLIC_PRIVY_APP_ID is not set - authentication will not work");
    }
  }, []);

  useEffect(() => {
    const rateLimitListener = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { status?: number; message?: string } | undefined;
      if (reason?.status === 429 || reason?.message?.includes("429")) {
        console.warn("Caught 429 error globally");
        setShowRateLimit(true);
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", rateLimitListener);
    return () => window.removeEventListener("unhandledrejection", rateLimitListener);
  }, []);

  const handleAuthError = useMemo(
    () => (error?: { status?: number; message?: string }) => {
      if (!error) return;
      if (error.status === 429 || error.message?.includes("429")) {
        setShowRateLimit(true);
      }
    },
    []
  );

  const renderChildren = className ? <div className={className}>{children}</div> : children;

  return (
    <>
      <RateLimitHandler show={showRateLimit} onDismiss={() => setShowRateLimit(false)} />
      <PrivyProvider
        appId={appId}
        config={{
          loginMethods: ["email", "google", "github"],
          appearance: {
            theme: "light",
            accentColor: "#000000",
            logo: "/logo_black.svg",
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
          defaultChain: base,
        }}
      >
        {/* CHANGE: Add enableBetaRedirect and betaDomain props */}
        <GatewayzAuthProvider
          onAuthError={handleAuthError}
          enableBetaRedirect={true}
          betaDomain="https://beta.gatewayz.ai"
        >
          {renderChildren}
        </GatewayzAuthProvider>
      </PrivyProvider>
    </>
  );
}
```

---

## Testing Checklist

### Pre-Change Baseline
- [ ] Login works normally on gatewayz.ai
- [ ] New users see onboarding page at `/onboarding`
- [ ] Existing users see dashboard

### Post-Change Testing

#### Test 1: New User Flow
- [ ] Open incognito/private browser window
- [ ] Go to `https://localhost:3000` (or `https://gatewayz.ai`)
- [ ] Click "Sign In"
- [ ] Authenticate with Email/Google/GitHub
- [ ] Verify redirect to `https://beta.gatewayz.ai?token=...&userId=...&returnUrl=/onboarding`
- [ ] Check console for `[SessionTransfer]` log on gatewayz.ai
- [ ] Check console for `[SessionInit]` log on beta.gatewayz.ai (once implemented by beta team)
- [ ] Verify URL shows `https://beta.gatewayz.ai/onboarding` (token removed from URL)
- [ ] Verify new user is on onboarding page

#### Test 2: Existing User Flow
- [ ] Login with existing account on gatewayz.ai
- [ ] Verify redirect to `https://beta.gatewayz.ai?token=...&userId=...`
- [ ] Check console for `[SessionTransfer]` log
- [ ] Verify URL is cleaned
- [ ] Verify user is authenticated on beta

#### Test 3: URL Security
- [ ] Check browser history (use back button)
- [ ] Verify token is NOT in URL history
- [ ] Token should only appear during the redirect moment
- [ ] After reaching beta, URL should be clean

#### Test 4: Logout
- [ ] Login to beta domain (from main domain redirect)
- [ ] Logout on beta
- [ ] Verify logout works
- [ ] Verify redirect to login screen

---

## Troubleshooting

### Issue: No redirect happens
**Cause**: `enableBetaRedirect` is not set to true
**Solution**: Check line 72 in `privy-provider.tsx` and verify both props are present

### Issue: Browser shows error on beta domain
**Cause**: Beta domain hasn't implemented `SessionInitializer` yet
**Solution**: Share `BETA_AUTH_TRANSFER.md` with beta team, they need to implement their side

### Issue: Token visible in browser history
**Cause**: Tokens should be cleaned - verify `cleanupSessionTransferParams()` is being called on beta
**Solution**: Check beta team's `SessionInitializer` component

### Issue: User sees error after redirect
**Possible causes**:
1. Different Privy App ID between domains
2. Different API base URL
3. Beta domain not receiving token properly

**Solutions**:
1. Verify both domains use same `NEXT_PUBLIC_PRIVY_APP_ID`
2. Verify both domains use same `NEXT_PUBLIC_API_BASE_URL`
3. Check browser console for error messages

---

## Disabling the Feature

If you need to disable the feature for any reason:

```tsx
// Simply change:
enableBetaRedirect={true}

// To:
enableBetaRedirect={false}
```

Or via environment variable:
```bash
NEXT_PUBLIC_ENABLE_BETA_REDIRECT=false
```

This will revert to original behavior where new users see onboarding on gatewayz.ai.

---

## FAQ

### Q: Is this a breaking change?
**A**: No. It's an opt-in feature that's disabled by default. Users not redirected won't be affected.

### Q: Do I need to change the backend?
**A**: No. Uses existing `/api/auth` endpoint.

### Q: What if beta domain isn't ready?
**A**: Keep `enableBetaRedirect={false}` until they're ready, then enable when they ask.

### Q: Can I test locally?
**A**: Yes. Use `http://localhost:3000` for main domain and `http://localhost:3001` (or another port) for beta. Update `betaDomain` to match:
```tsx
betaDomain="http://localhost:3001"
```

### Q: Will this affect existing users?
**A**: Yes, existing users will also be redirected. This is intentional - they use the beta domain for new features while gatewayz.ai stays as the main domain.

### Q: How long does the session last?
**A**: Token persists in sessionStorage for 10 minutes. After that, user needs to login again. Once on beta, normal authentication keeps them logged in.

---

## Performance Impact

- **Zero** performance impact on gatewayz.ai
- Uses existing localStorage/sessionStorage (native browser APIs)
- Redirect is a hard URL change (window.location.href)
- No extra API calls or network requests

---

## Security Review

✅ **Token Handling**:
- Passed in URL during redirect (unavoidable for session transfer)
- Immediately removed from URL history via `replaceState()`
- Stored in sessionStorage (domain-specific, auto-expires 10 min)

✅ **Storage**:
- API key stored in localStorage (same as current implementation)
- No additional exposure vs. current auth system

✅ **API Communication**:
- Uses existing Bearer token authentication
- Same security as all other API requests

✅ **Cross-Domain**:
- SessionStorage is domain-specific (browser security)
- Cannot be accessed by other domains

---

## Implementation Timeline

1. **Now**: Make the code change (5 minutes)
2. **Now**: Test locally (10 minutes)
3. **Within 24 hours**: Merge to main branch
4. **Within 24 hours**: Beta team implements their `SessionInitializer`
5. **End result**: Users automatically authenticate across both domains

---

## Summary

| Item | Details |
|------|---------|
| **Files to change** | 1 (`src/components/providers/privy-provider.tsx`) |
| **Lines to change** | 1 (line 72) |
| **Time estimate** | 5 min code + 10 min test = 15 min |
| **Risk level** | Very Low (backward compatible) |
| **Breaking changes** | None |
| **Backend changes** | None required |
| **New dependencies** | None |
| **Rollback plan** | Set `enableBetaRedirect={false}` |

---

## Need Help?

1. Check the troubleshooting section above
2. Review the console logs (look for `[SessionTransfer]` and `[Auth]` prefixes)
3. Compare your code with the examples in this guide
4. Review `BETA_AUTH_TRANSFER.md` for architecture details
