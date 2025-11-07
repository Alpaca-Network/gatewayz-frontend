# Beta Domain Authentication Session Transfer

This document explains how the authentication session transfer works between gatewayz.ai and beta.gatewayz.ai. Users who authenticate on the main domain are automatically authenticated on the beta domain.

---

## Overview

When a user logs in on **gatewayz.ai**, they are automatically redirected to **beta.gatewayz.ai** with their authentication token embedded in the URL. The beta domain receives this token and establishes the session automatically, logging the user in without requiring another authentication step.

```
gatewayz.ai (Main Domain)
    ↓
User authenticates via Privy (Email/Google/GitHub)
    ↓
Backend creates/retrieves account, returns API key
    ↓
Automatic redirect to:
https://beta.gatewayz.ai?token=<API_KEY>&userId=<USER_ID>
    ↓
beta.gatewayz.ai (Beta Domain)
    ↓
Receives URL params, establishes session
    ↓
User automatically logged in
```

---

## Main Domain Implementation (gatewayz.ai)

The main Gatewayz application has been updated to support session transfer via the `enableBetaRedirect` flag.

### Configuration

Update the `PrivyProviderWrapper` in your app layout to enable beta redirect:

```tsx
// src/app/layout.tsx or wherever you use PrivyProviderWrapper

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
          {/* Pass enableBetaRedirect prop to GatewayzAuthProvider */}
          {/* This is currently set to false by default */}
          {children}
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
```

To enable beta redirect, modify `src/components/providers/privy-provider.tsx`:

```tsx
// src/components/providers/privy-provider.tsx

export const PrivyProviderWrapper = dynamic(
  () => Promise.resolve(PrivyProviderWrapperInner),
  { ssr: false }
);

// Inside PrivyProviderWrapperInner:
<GatewayzAuthProvider
  onAuthError={handleAuthError}
  enableBetaRedirect={true}  // Enable beta redirect
  betaDomain="https://beta.gatewayz.ai"  // Optional: customize domain
>
  {renderChildren}
</GatewayzAuthProvider>
```

### Flow on Main Domain

1. **User authenticates**: Privy modal (Email, Google, GitHub)
2. **Privy token retrieved**: `getAccessToken()` returns JWT
3. **Backend sync**: POST `/api/auth` with Privy data
4. **API key created**: Backend returns `AuthResponse` with `api_key`
5. **Storage**: API key saved to localStorage
6. **Redirect (if enabled)**:
   - New users: Redirect to `https://beta.gatewayz.ai?token=...&userId=...&returnUrl=/onboarding`
   - Existing users: Can manually trigger with `redirectToBeta()` from context
7. **SessionStorage**: Token stored for 10-minute persistence

---

## Beta Domain Implementation (beta.gatewayz.ai)

The beta domain needs to implement a `SessionInitializer` component to handle the incoming session transfer parameters.

### Step 1: Create SessionInitializer Component

Create a new component to handle session initialization:

```tsx
// src/components/SessionInitializer.tsx
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
import { saveApiKey, saveUserData } from "@/lib/api";

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

### Step 2: Add SessionInitializer to Root Layout

```tsx
// src/app/layout.tsx (on beta domain)

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
          {/* SessionInitializer handles URL params and establishes session */}
          <SessionInitializer />
          {children}
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
```

### Step 3: Ensure Shared Dependencies

Beta domain needs the following files from the main domain:

```
src/
├── lib/
│   ├── api.ts                    (storage functions)
│   └── privy.ts                  (Privy config)
├── context/
│   └── gatewayz-auth-context.tsx (auth context)
├── components/
│   └── providers/
│       └── privy-provider.tsx    (Privy provider wrapper)
└── integrations/
    └── privy/
        └── auth-session-transfer.ts  (session transfer utilities)
```

**Important**: Beta domain must use:
- **Same Privy App ID** (`NEXT_PUBLIC_PRIVY_APP_ID`)
- **Same API base URL** (`NEXT_PUBLIC_API_BASE_URL`)
- **Same backend API** for authentication and user management

### Step 4: Environment Variables

Ensure beta domain has same environment variables:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=<your-privy-app-id>
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai
```

---

## API Reference

### Session Transfer Utilities

These functions are available in `src/integrations/privy/auth-session-transfer.ts`:

#### `redirectToBetaWithSession(token, userId, betaDomain?, returnUrl?)`

Redirects to beta domain with session transfer parameters.

**Parameters:**
- `token: string` - API key or session token
- `userId: string | number` - Gatewayz user ID
- `betaDomain?: string` - Beta domain URL (default: `https://beta.gatewayz.ai`)
- `returnUrl?: string` - URL to return to after auth on beta domain

**Example:**
```typescript
import { redirectToBetaWithSession } from "@/integrations/privy/auth-session-transfer";

redirectToBetaWithSession(apiKey, userId, undefined, "/dashboard");
```

#### `getSessionTransferParams()`

Extracts session transfer parameters from URL.

**Returns:**
```typescript
{
  token: string | null;      // API key from URL
  userId: string | null;     // User ID from URL
  returnUrl: string | null;  // Return URL from URL params
}
```

**Example:**
```typescript
import { getSessionTransferParams } from "@/integrations/privy/auth-session-transfer";

const { token, userId, returnUrl } = getSessionTransferParams();

if (token && userId) {
  // Handle session transfer
}
```

#### `cleanupSessionTransferParams()`

Removes session transfer parameters from URL to maintain clean history.

**Example:**
```typescript
import { cleanupSessionTransferParams } from "@/integrations/privy/auth-session-transfer";

cleanupSessionTransferParams();
// URL changes from ?token=...&userId=... to just /
```

#### `storeSessionTransferToken(token, userId)`

Stores session transfer token in sessionStorage for 10-minute persistence.

**Parameters:**
- `token: string` - API key to store
- `userId: string | number` - User ID to store

**Example:**
```typescript
import { storeSessionTransferToken } from "@/integrations/privy/auth-session-transfer";

storeSessionTransferToken(apiKey, userId);
```

#### `getStoredSessionTransferToken()`

Retrieves stored session transfer token, auto-expires after 10 minutes.

**Returns:**
```typescript
{
  token: string | null;   // API key if valid, null if expired or missing
  userId: string | null;  // User ID if valid, null if expired or missing
}
```

**Example:**
```typescript
import { getStoredSessionTransferToken } from "@/integrations/privy/auth-session-transfer";

const { token, userId } = getStoredSessionTransferToken();

if (token && userId) {
  // Token is still valid
}
```

#### `isSessionTransferTokenValid()`

Quick check if session transfer token exists and is valid.

**Returns:** `boolean` - true if token exists and not expired

**Example:**
```typescript
import { isSessionTransferTokenValid } from "@/integrations/privy/auth-session-transfer";

if (isSessionTransferTokenValid()) {
  // Token can be used
}
```

---

## Auth Sync Module

The `src/integrations/privy/auth-sync.ts` module provides utilities for syncing authentication with the backend.

#### `syncPrivyToGatewayz(privyUser, privyAccessToken, existingUserData)`

Syncs Privy authentication with Gatewayz backend.

**Parameters:**
- `privyUser: User` - Privy user object from `usePrivy()`
- `privyAccessToken: string | null` - Access token from `getAccessToken()`
- `existingUserData: UserData | null` - Existing user data if available

**Returns:**
```typescript
Promise<{
  authResponse: AuthResponse;  // Backend auth response with API key
  privyAccessToken: string | null;  // Privy token for session transfer
}>
```

**Example:**
```typescript
import { syncPrivyToGatewayz } from "@/integrations/privy/auth-sync";
import { usePrivy } from "@privy-io/react-auth";

const { user, getAccessToken } = usePrivy();

const { authResponse, privyAccessToken } = await syncPrivyToGatewayz(
  user,
  await getAccessToken(),
  null
);

console.log("API Key:", authResponse.api_key);
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ gatewayz.ai (Main Domain)                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User clicks "Sign In"                                   │
│        ↓                                                     │
│  2. Privy Modal Opens (Email/Google/GitHub)                 │
│        ↓                                                     │
│  3. Privy Authenticates                                     │
│        ↓                                                     │
│  4. GatewayzAuthProvider.syncWithBackend()                  │
│        ├─ getAccessToken() → Privy JWT                      │
│        ├─ POST /api/auth with Privy data                    │
│        └─ Backend creates/retrieves account                 │
│        ↓                                                     │
│  5. AuthResponse received                                   │
│        ├─ api_key                                           │
│        ├─ user_id                                           │
│        ├─ is_new_user                                       │
│        └─ ... other user data                               │
│        ↓                                                     │
│  6. processAuthResponse() - Save to localStorage             │
│        ├─ gatewayz_api_key = api_key                        │
│        ├─ gatewayz_user_data = {user_id, ...}              │
│        └─ gatewayz_referral_code (if applicable)            │
│        ↓                                                     │
│  7. Check: enableBetaRedirect = true?                       │
│        ├─ YES → Go to step 8                                │
│        └─ NO → Normal flow (onboarding or dashboard)        │
│        ↓                                                     │
│  8. redirectToBetaIfEnabled()                               │
│        ├─ storeSessionTransferToken() → sessionStorage      │
│        └─ redirectToBetaWithSession()                       │
│              └─ window.location.href = https://beta...      │
│                 ?token=<api_key>&userId=<user_id>           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ (HARD REDIRECT - NEW PAGE)
┌─────────────────────────────────────────────────────────────┐
│ beta.gatewayz.ai (Beta Domain)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Page loads with URL params: ?token=...&userId=...       │
│        ↓                                                     │
│  2. SessionInitializer component mounts                     │
│        ↓                                                     │
│  3. getSessionTransferParams()                              │
│        ├─ token = URL param                                 │
│        ├─ userId = URL param                                │
│        └─ returnUrl = URL param (if present)                │
│        ↓                                                     │
│  4. storeSessionTransferToken(token, userId)                │
│        └─ sessionStorage stores for 10 minutes              │
│        ↓                                                     │
│  5. saveApiKey(token)                                       │
│        └─ localStorage['gatewayz_api_key'] = token          │
│        ↓                                                     │
│  6. cleanupSessionTransferParams()                          │
│        └─ window.history.replaceState() - clean URL         │
│        ↓                                                     │
│  7. refresh({ force: true })                                │
│        ├─ GatewayzAuthProvider syncs with context           │
│        ├─ updateStateFromStorage()                          │
│        └─ setStatus("authenticated")                        │
│        ↓                                                     │
│  8. Redirect to dashboard or returnUrl                      │
│        └─ User fully authenticated on beta domain           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

### Token Handling

1. **URL Parameters**: Tokens are passed in URL during initial redirect (unavoidable for session transfer)
   - URL is cleaned immediately after extraction via `cleanupSessionTransferParams()`
   - Token is not logged or exposed in browser console (only in debug logs with prefix)

2. **SessionStorage**: Tokens stored in `sessionStorage` (domain-specific, cleared on tab close)
   - Not accessible across domains (browser security)
   - Not accessible from other tabs (sessionStorage is per-tab)
   - Auto-expires after 10 minutes

3. **localStorage**: API key stored in `localStorage` after initial setup
   - Persists across tab/browser close (user stays logged in)
   - Used for all authenticated API requests via Bearer token

### HTTPS Only

- Both domains must use HTTPS for production
- Tokens in URLs and storage require secure transport

### API Key Security

- API keys are valid for the entire session
- If compromised, backend can revoke via user account
- 401 responses automatically clear stored credentials

---

## Troubleshooting

### Issue: User not redirected to beta

**Cause**: `enableBetaRedirect` not enabled on main domain

**Solution**: Set `enableBetaRedirect={true}` in `PrivyProviderWrapper`

```tsx
<GatewayzAuthProvider
  enableBetaRedirect={true}
  betaDomain="https://beta.gatewayz.ai"
>
  {children}
</GatewayzAuthProvider>
```

### Issue: Token not found on beta domain

**Cause**: SessionStorage token expired or URL params not extracted

**Solution**: Check browser console for `[SessionTransfer]` logs

```typescript
// Verify params are present
const { token, userId } = getSessionTransferParams();
console.log("Token:", token);
console.log("UserID:", userId);

// Verify stored token
const { token: stored } = getStoredSessionTransferToken();
console.log("Stored Token:", stored);
```

### Issue: User not authenticated after redirect

**Cause**: Auth context not properly initialized

**Solution**: Ensure `SessionInitializer` is in root layout and calls `refresh()`

```tsx
// Make sure this is in your root layout
<SessionInitializer />

// And GatewayzAuthProvider is wrapping the app
<PrivyProviderWrapper>
  <SessionInitializer />
  {children}
</PrivyProviderWrapper>
```

### Issue: Browser console shows 401 errors

**Cause**: API key not properly transferred

**Solution**: Verify API key is saved before making requests

```typescript
import { getApiKey } from "@/lib/api";

const key = getApiKey();
console.log("Stored API Key:", key ? "Found" : "Not found");
```

### Issue: CORS errors when calling backend

**Cause**: Different API base URLs between domains

**Solution**: Ensure both domains use same `NEXT_PUBLIC_API_BASE_URL`

```bash
# Both main and beta domain .env.local
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai
```

---

## Testing

### Manual Testing Checklist

- [ ] User can login with Email on main domain
- [ ] User can login with Google on main domain
- [ ] User can login with GitHub on main domain
- [ ] New users are redirected to beta domain
- [ ] Existing users can manually trigger beta redirect
- [ ] URL params are cleaned after extraction
- [ ] Token is stored in sessionStorage
- [ ] Token auto-expires after 10 minutes
- [ ] User is authenticated on beta domain without second login
- [ ] Logout on beta domain works correctly
- [ ] Browser back button doesn't expose token in URL history
- [ ] New user onboarding works on beta domain (`?returnUrl=/onboarding`)

### Automated Testing Example

```typescript
// __tests__/auth-session-transfer.test.ts

import {
  redirectToBetaWithSession,
  getSessionTransferParams,
  storeSessionTransferToken,
  getStoredSessionTransferToken,
} from '@/integrations/privy/auth-session-transfer';

describe('Auth Session Transfer', () => {
  it('should store and retrieve session transfer token', () => {
    const token = 'gw_test_token_123';
    const userId = '456';

    storeSessionTransferToken(token, userId);

    const { token: stored, userId: storedId } = getStoredSessionTransferToken();

    expect(stored).toBe(token);
    expect(storedId).toBe(userId);
  });

  it('should expire token after 10 minutes', async () => {
    // Mock Date.now() to advance 11 minutes
    // Should return null when calling getStoredSessionTransferToken()
  });

  it('should extract params from URL', () => {
    // Mock window.location.search with test params
    // Should correctly extract token, userId, returnUrl
  });
});
```

---

## Migration Path

### For Existing Beta Users

If beta domain already has users, implement a fallback for existing sessions:

```typescript
// In SessionInitializer component
useEffect(() => {
  const { token, userId } = getSessionTransferParams();

  if (token && userId) {
    // Session transfer from main domain
    handleSessionTransfer(token, userId);
  } else if (status === "authenticated") {
    // Already authenticated on beta domain (existing session)
    console.log("User already authenticated");
  } else {
    // Not authenticated, user must login
    // Privy modal will show on next page interaction
  }
}, [status]);
```

---

## Questions or Issues?

For implementation questions or issues:

1. Check browser console for `[SessionTransfer]`, `[Auth]`, and `[SessionInit]` debug logs
2. Verify environment variables are set correctly
3. Ensure both domains use same Privy App ID
4. Confirm backend API is reachable from beta domain
5. Check network tab for CORS or 401 errors

---

## Future Enhancements

Potential improvements to consider:

1. **Session Transfer Tokens**: Replace API key in URL with short-lived transfer tokens
2. **Cross-Domain Analytics**: Track session transfers in analytics
3. **Fallback Flow**: Redirect back to main domain if session transfer fails
4. **Refresh Token Rotation**: Implement automatic token refresh
5. **Device Verification**: Add device fingerprinting for extra security
