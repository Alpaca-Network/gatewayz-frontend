# Beta Team Quick Start - Session Transfer Implementation

**If you're on the beta.gatewayz.ai team, start here!**

---

## What This Feature Does

Users who login on **gatewayz.ai** are automatically redirected to **beta.gatewayz.ai** with their authentication token. You don't need to do anything except implement the receiver side.

```
gatewayz.ai
    ↓
User logs in
    ↓
Token generated
    ↓
Redirect to beta.gatewayz.ai?token=...&userId=...
    ↓
beta.gatewayz.ai (YOUR DOMAIN)
    ↓
Receive token
    ↓
User automatically authenticated ✅
```

---

## Your Task (The ONLY Thing You Need to Do)

### 1. Copy 3 Files from gatewayz.ai Repo

Copy these files to your beta repo:

```
From: gatewayz-frontend repo
  → src/integrations/privy/auth-session-transfer.ts
  → src/integrations/privy/auth-sync.ts
  → src/context/gatewayz-auth-context.tsx

To: your beta repo (same paths)
```

**Why**: These files contain the utilities and updated auth context that handle session transfer.

### 2. Create SessionInitializer Component

Create: `src/components/SessionInitializer.tsx`

```tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import {
  getSessionTransferParams,
  cleanupSessionTransferParams,
  storeSessionTransferToken,
  getStoredSessionTransferToken,
} from "@/integrations/privy/auth-session-transfer";
import { saveApiKey } from "@/lib/api";

export function SessionInitializer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, refresh } = useGatewayzAuth();

  useEffect(() => {
    async function initializeSession() {
      // Check for URL params from session transfer
      const { token, userId, returnUrl } = getSessionTransferParams();

      if (token && userId) {
        console.log("[SessionInit] Session transfer params detected");

        // Store token for persistence
        storeSessionTransferToken(token, userId);

        // Save API key to localStorage
        saveApiKey(token);

        // Clean up URL to remove transfer params
        cleanupSessionTransferParams();

        // Trigger auth refresh to sync with context
        await refresh({ force: true });

        // Redirect to return URL or dashboard
        setTimeout(() => {
          if (returnUrl) {
            router.push(returnUrl);
          } else {
            router.push("/dashboard");
          }
        }, 100);

        return;
      }

      // Check for stored session transfer token (fallback)
      const { token: storedToken, userId: storedUserId } =
        getStoredSessionTransferToken();

      if (storedToken && storedUserId && !localStorage.getItem("gatewayz_api_key")) {
        console.log("[SessionInit] Using stored session transfer token");

        // Restore API key from sessionStorage
        saveApiKey(storedToken);

        // Trigger auth refresh
        await refresh({ force: true });

        return;
      }

      // If already authenticated, continue normally
      if (status === "authenticated") {
        console.log("[SessionInit] Already authenticated");
        return;
      }
    }

    initializeSession().catch((error) => {
      console.error("[SessionInit] Error initializing session:", error);
    });
  }, [refresh, router]);

  return null;
}
```

### 3. Add SessionInitializer to Root Layout

Update: `src/app/layout.tsx`

```tsx
import { SessionInitializer } from "@/components/SessionInitializer";
import { PrivyProviderWrapper } from "@/components/providers/privy-provider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <PrivyProviderWrapper>
          {/* Add this line */}
          <SessionInitializer />
          {children}
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
```

### 4. Verify Environment Variables

Make sure your `.env.local` has:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=<your-privy-app-id>
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai
```

**Important**: Use the **SAME Privy App ID** as gatewayz.ai!

### 5. Test It

1. Go to `https://gatewayz.ai`
2. Click "Sign In"
3. Authenticate
4. You should be automatically redirected to `https://beta.gatewayz.ai`
5. You should be logged in without needing to sign in again ✅

Check your browser console for these logs:
- `[SessionTransfer] Redirecting to beta with session:` (on gatewayz.ai)
- `[SessionInit] Session transfer params detected` (on beta.gatewayz.ai)

---

## ⚠️ IMPORTANT: What NOT to Do

### ❌ DO NOT:
- Set `enableBetaRedirect={true}` in your `privy-provider.tsx`
  - This is for the MAIN domain only
- Create a redirect from beta back to main
  - Users should stay on beta after transfer
- Change the session transfer URLs/tokens
  - They're handled automatically

### ✅ DO:
- Copy the 3 shared files
- Create the SessionInitializer component
- Add to your root layout
- Test that you receive sessions correctly
- Keep same Privy App ID as main domain

---

## How It Works (Technical Overview)

### When User Logs In on Main Domain

```
gatewayz.ai:
  1. User authenticates via Privy
  2. Backend returns API key
  3. GatewayzAuthProvider checks: enableBetaRedirect === true?
  4. Yes → Store token in sessionStorage
  5. Yes → Redirect to beta.gatewayz.ai?token=<key>&userId=<id>
  6. [Page unloads, redirects to beta]
```

### When Page Loads on Beta Domain

```
beta.gatewayz.ai:
  1. SessionInitializer component mounts
  2. Checks URL for params: ?token=...&userId=...
  3. Found → Store in sessionStorage
  4. Found → Save to localStorage as gatewayz_api_key
  5. Found → Clean URL (remove params from history)
  6. Found → Call refresh() to sync auth context
  7. Found → Redirect to /dashboard or specified return URL
  8. User is now authenticated on beta ✅
```

---

## Security Notes

- **Tokens in URL**: Removed from browser history immediately (via replaceState)
- **SessionStorage**: Domain-specific, not accessible from other domains
- **Token Expiry**: Auto-expires after 10 minutes
- **API Key**: Used for all subsequent authenticated requests via Bearer token

---

## Troubleshooting

### Issue: No session params received
**Check**:
1. Is gatewayz.ai's `enableBetaRedirect={true}`?
2. Check browser console for redirect log
3. Check URL for `?token=...` params

### Issue: User not authenticated after redirect
**Check**:
1. Is SessionInitializer in your root layout?
2. Check console for `[SessionInit]` logs
3. Is `refresh()` being called?
4. Check localStorage for `gatewayz_api_key`

### Issue: URL still shows token params
**Check**:
1. Is `cleanupSessionTransferParams()` being called?
2. Check browser console for cleanup log
3. This should happen automatically after extraction

### Issue: Different Privy App ID error
**Check**:
1. Verify your `NEXT_PUBLIC_PRIVY_APP_ID` matches main domain
2. Get the ID from gatewayz.ai team if needed
3. Restart dev server after changing env vars

---

## Testing Checklist

- [ ] Copied 3 files from gatewayz-frontend repo
- [ ] Created SessionInitializer component
- [ ] Added SessionInitializer to root layout
- [ ] Environment variables are correct (same Privy App ID)
- [ ] Login on gatewayz.ai redirects to beta.gatewayz.ai
- [ ] Check console for `[SessionInit]` logs
- [ ] User is authenticated on beta without re-login
- [ ] URL shows clean path (no token params)
- [ ] Logout works correctly
- [ ] Browser history doesn't contain token (press back button)

---

## Time Estimate

- Copy 3 files: 2 minutes
- Create SessionInitializer: 5 minutes
- Add to layout: 2 minutes
- Test: 10 minutes
- **Total: ~20 minutes**

---

## Need Help?

### Reference Docs

Full details available in:
- **`BETA_AUTH_TRANSFER.md`** - Complete implementation guide
- **`IMPLEMENTATION_VERIFICATION.md`** - Architecture verification

### Common Questions

**Q: Should we set enableBetaRedirect?**
A: No. That's for gatewayz.ai only. You only need SessionInitializer.

**Q: Do we redirect back to main?**
A: No. Users stay on beta after transfer.

**Q: What if token expires?**
A: After 10 minutes, users need to login again. That's normal.

**Q: Can we customize the redirect URL?**
A: Users are redirected to `/dashboard` by default. Use `returnUrl` param to customize.

---

## Summary

Your job is simple:

1. ✅ Copy 3 files
2. ✅ Create SessionInitializer component
3. ✅ Add to root layout
4. ✅ Test

That's it! Everything else is automatic. 🚀

---

**Questions?** See `BETA_AUTH_TRANSFER.md` for complete details.
