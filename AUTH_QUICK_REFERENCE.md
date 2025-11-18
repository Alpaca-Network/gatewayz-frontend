# Authentication System - Quick Reference Guide

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION LAYERS                        │
└────────────────────────────────────────────────────────────────┘

Layer 1: BROWSER STORAGE
├─ localStorage['gatewayz_api_key'] → Bearer token
├─ localStorage['gatewayz_user_data'] → User profile JSON
└─ sessionStorage['gatewayz_session_transfer_token'] → Cross-domain token (10 min TTL)

Layer 2: REACT CONTEXT (GatewayzAuthContext)
├─ status: idle → unauthenticated → authenticating → authenticated
├─ apiKey: String or null
├─ userData: UserData object or null
└─ Manages: login(), logout(), refresh()

Layer 3: PRIVY SDK (usePrivy)
├─ ready: Boolean (SDK initialized)
├─ authenticated: Boolean
├─ user: Privy User object
└─ Methods: login(), logout(), getAccessToken()

Layer 4: BACKEND API
├─ POST /api/auth → Validates Privy, creates/retrieves user account
├─ GET /api/user/me → User profile data
├─ GET /api/user/api-keys → API keys management
└─ Timeout: 10-15 seconds per request

Layer 5: APPLICATION
├─ Chat API calls with Bearer token
├─ Model selection and management
├─ Session operations
└─ User settings and preferences
```

---

## File Map

```
AUTHENTICATION FILES
├─ /root/repo/src/context/gatewayz-auth-context.tsx (683 lines)
│  └─ Global state management + backend sync
│
├─ /root/repo/src/components/providers/privy-provider.tsx (85 lines)
│  └─ Privy SDK initialization
│
└─ /root/repo/src/hooks/use-auth.ts (14 lines)
   └─ Simple Privy wrapper hook

SESSION TRANSFER FILES
├─ /root/repo/src/integrations/privy/auth-session-transfer.ts (250 lines)
│  └─ Cross-domain token transfer with security
│
├─ /root/repo/src/integrations/privy/auth-sync.ts (147 lines)
│  └─ Privy sync module (reusable)
│
└─ /root/repo/src/components/SessionInitializer.tsx (266 lines)
   └─ Automatic auth on beta domain

STORAGE FILES
└─ /root/repo/src/lib/api.ts (191 lines)
   ├─ saveApiKey() / getApiKey() / removeApiKey()
   ├─ saveUserData() / getUserData()
   ├─ makeAuthenticatedRequest()
   └─ processAuthResponse()

BACKEND PROXY FILES
├─ /root/repo/src/app/api/auth/route.ts (75 lines)
│  └─ POST /api/auth → Proxy to backend
│
├─ /root/repo/src/app/api/user/me/route.ts (56 lines)
│  └─ GET /api/user/me → User profile
│
├─ /root/repo/src/app/api/user/api-keys/route.ts (265 lines)
│  └─ GET/POST /api/user/api-keys → API key management
│
└─ /root/repo/src/app/api/middleware/auth.ts (35 lines)
   └─ validateApiKey() middleware

CHAT MANAGEMENT FILES
├─ /root/repo/src/lib/chat-history.ts (379 lines)
│  └─ ChatHistoryAPI class (create, list, save messages)
│
├─ /root/repo/src/app/api/chat/sessions/route.ts (87 lines)
│  └─ GET/POST /api/chat/sessions
│
└─ /root/repo/src/app/api/chat/completions/route.ts (579 lines)
   └─ POST /api/chat/completions (streaming + retry)
```

---

## Key Data Types

### AuthResponse (from backend)
```typescript
{
  success: boolean
  user_id: number
  api_key: string ← CRITICAL: Used for all future requests
  auth_method: string
  privy_user_id: string
  is_new_user: boolean
  display_name: string
  email: string
  credits: number
  tier?: 'basic' | 'pro' | 'max'
  tier_display_name?: string
  subscription_status?: 'active' | 'cancelled' | 'past_due' | 'inactive'
  subscription_end_date?: number (Unix timestamp)
}
```

### UserData (stored in localStorage)
```typescript
{
  user_id: number
  api_key: string
  auth_method: string
  privy_user_id: string
  display_name: string
  email: string
  credits: number
  tier?: 'basic' | 'pro' | 'max'
  tier_display_name?: string
  subscription_status?: string
  subscription_end_date?: number
}
```

### GatewayzAuthContextValue
```typescript
{
  status: 'idle' | 'unauthenticated' | 'authenticating' | 'authenticated' | 'error'
  apiKey: string | null
  userData: UserData | null
  privyUser: User | null
  privyReady: boolean
  privyAuthenticated: boolean
  error: string | null
  login(): Promise<void>
  logout(): Promise<void>
  refresh(options?: { force?: boolean }): Promise<void>
  redirectToBeta?: (returnUrl?: string) => void
}
```

---

## Storage Keys Summary

### localStorage
| Key | Type | Value | TTL |
|-----|------|-------|-----|
| `gatewayz_api_key` | String | Bearer token | Session |
| `gatewayz_user_data` | JSON | User profile | Session |
| `gatewayz_referral_code` | String | Referral code | Per signup |
| `gatewayz_show_referral_bonus` | Boolean | Flag | Per signup |

### sessionStorage
| Key | Type | Value | TTL |
|-----|------|-------|-----|
| `gatewayz_session_transfer_token` | JSON | Session with fingerprint | 10 min |

---

## Core Authentication Flow

```
User Click "Sign In"
    ↓
Privy Modal Opens (Email/Google/GitHub/Wallet)
    ↓
User Authenticates
    ↓
usePrivy().authenticated = true
    ↓
GatewayzAuthProvider detects change (useEffect)
    ↓
syncWithBackend() called
    ↓
Build auth request with Privy user data
    ↓
POST /api/auth → Backend validates Privy token
    ↓
Backend creates/retrieves Gatewayz user account
    ↓
Returns AuthResponse with API key
    ↓
saveApiKey() → localStorage['gatewayz_api_key']
saveUserData() → localStorage['gatewayz_user_data']
    ↓
Update context: status = "authenticated"
    ↓
✓ Ready for API requests
    ↓
Background: Upgrade temp API key if needed (non-blocking)
    ↓
New users: Show welcome dialog, redirect to /onboarding
Existing users: Proceed to requested route
```

---

## Session Transfer Flow (Main → Beta Domain)

```
Main Domain (gatewayz.ai)        Beta Domain (beta.gatewayz.ai)
User Authenticated
    ↓
redirectToBetaWithSession(
  apiKey,
  userId,
  betaDomain,
  returnUrl
)
    ↓
window.location.href = 
'https://beta.gatewayz.ai?token=XXX&userId=123&returnUrl=/chat'
                                    ↓ REDIRECT
                          SessionInitializer activates
                                    ↓
                          getSessionTransferParams()
                          → { token, userId, returnUrl }
                                    ↓
                          storeSessionTransferToken()
                          → sessionStorage (10 min TTL)
                                    ↓
                          saveApiKey(token)
                          → localStorage
                                    ↓
                          cleanupSessionTransferParams()
                          → Remove from URL
                                    ↓
                          fetchUserDataOptimized(token)
                          → GET /api/user/me (cached 1 min)
                                    ↓
                          saveUserData(userData)
                          → localStorage
                                    ↓
                          refresh() auth context
                                    ↓
                          If returnUrl: router.push(returnUrl)
                                    ↓
                          ✓ User authenticated on beta domain
```

---

## API Request Authentication Pattern

```typescript
// All API requests use Bearer token from localStorage

// Pattern 1: Direct API call (client-side)
const apiKey = localStorage.getItem('gatewayz_api_key');
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

// Pattern 2: Using ChatHistoryAPI
const chatAPI = new ChatHistoryAPI(apiKey);
const session = await chatAPI.createSession('Chat Title', 'gpt-4');

// Pattern 3: Using context
const { apiKey, userData } = useGatewayzAuth();
// apiKey is ready to use in any authenticated request

// Pattern 4: Through Next.js API route
// Browser → /api/chat/sessions → validateApiKey middleware → Backend
// API routes automatically validate Bearer token from Authorization header
```

---

## Timeouts Configuration

| Operation | Timeout | File |
|-----------|---------|------|
| Backend auth | 10 seconds | auth-context.tsx line 513 |
| User fetch (session init) | 3 seconds | SessionInitializer.tsx line 47 |
| API key fetch | 5 seconds | auth-context.tsx line 215 |
| Chat session create | 5 seconds | chat-history.ts line 156 |
| Save message | 10 seconds | chat-history.ts line 295 |
| Chat completions (non-streaming) | 30 seconds | completions/route.ts line 311 |
| Chat completions (streaming) | 120 seconds | completions/route.ts line 311 |
| API key upgrade | 5 seconds (total) | auth-context.tsx line 215 |

---

## Error Scenarios and Recovery

### 1. Backend Auth Fails (401)
```
syncWithBackend() → Backend returns 401
    ↓
clearStoredCredentials()
    ↓
status = "error"
    ↓
Trigger onAuthError callback
    ↓
User must re-authenticate
```

### 2. Session Transfer Token Expired
```
SessionInitializer checks sessionStorage
    ↓
Elapsed time > 10 minutes
    ↓
clearSessionTransferToken()
    ↓
Fall back to checking URL params or manual login
```

### 3. API Key Fetch Fails (API key upgrade)
```
GET /api/user/api-keys → Failed
    ↓
Log error (non-blocking)
    ↓
Keep existing temp key
    ↓
User continues with temp key
    ↓
Next successful payment: retry upgrade
```

### 4. Rate Limited (429)
```
POST /api/chat/completions → 429 response
    ↓
Calculate retry delay (exponential backoff)
    ↓
sleep(delay)
    ↓
Retry (up to 3 times)
    ↓
If all retries fail: return 429 to client
```

### 5. Network Timeout
```
Request exceeds timeout duration
    ↓
AbortController aborts request
    ↓
Return 504 Gateway Timeout (if backend)
    ↓
Return 502 Bad Gateway (if network error)
    ↓
Client-side: Show error message
```

---

## State Transitions

```
INITIAL STATE: "idle"
    ↓ Privy SDK initialized
    ↓
"unauthenticated"
    ↓ User clicks login AND Privy authenticates
    ↓
"authenticating" ← Backend sync in progress
    ↓
"authenticated" ← API key received and stored
                  OR
"error" ← Backend validation failed or timeout
    ↓ User clicks logout
    ↓
"unauthenticated" (back to start)

CACHE PATH: "idle" → "authenticated" (if cached credentials valid)
```

---

## Integration Checklist for New Features

When adding new authenticated features:

1. **Use Auth Context**
   ```typescript
   const { apiKey, userData, status } = useGatewayzAuth();
   ```

2. **Require Authentication**
   ```typescript
   if (status !== 'authenticated') {
     return <LoginRequired />;
   }
   ```

3. **Make API Calls**
   ```typescript
   const response = await fetch('/api/endpoint', {
     headers: { 'Authorization': `Bearer ${apiKey}` }
   });
   ```

4. **Handle 401 Responses**
   ```typescript
   if (response.status === 401) {
     // Credentials are cleared automatically
     // SessionInitializer should handle re-auth
   }
   ```

5. **Implement Proper Timeouts**
   ```typescript
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 10000);
   ```

---

## Debugging Tips

### Check Authentication Status
```javascript
// In browser console:
const storage = {
  apiKey: localStorage.getItem('gatewayz_api_key'),
  userData: JSON.parse(localStorage.getItem('gatewayz_user_data') || 'null'),
  sessionToken: JSON.parse(sessionStorage.getItem('gatewayz_session_transfer_token') || 'null')
};
console.log(storage);
```

### Trigger Manual Auth Refresh
```javascript
window.dispatchEvent(new Event('gatewayz:refresh-auth'));
```

### Check Context Value
```typescript
// In React component:
const auth = useGatewayzAuth();
console.log('Auth Status:', {
  status: auth.status,
  hasApiKey: !!auth.apiKey,
  userId: auth.userData?.user_id,
  credits: auth.userData?.credits
});
```

### Simulate Session Transfer
```javascript
// Add to beta.gatewayz.ai URL:
// ?token=YOUR_API_KEY&userId=YOUR_USER_ID&returnUrl=/chat
```

### Monitor Network Requests
```javascript
// In DevTools Network tab, filter:
// - /api/auth → Authentication request
// - /api/user/me → User data fetch
// - /api/user/api-keys → API key upgrade
// - /api/chat/sessions → Session operations
// - /api/chat/completions → Chat messages
```

---

## Production Deployment Checklist

- [ ] NEXT_PUBLIC_PRIVY_APP_ID environment variable set
- [ ] NEXT_PUBLIC_API_BASE_URL points to production backend
- [ ] HTTPS enforced (Bearer token always over HTTPS)
- [ ] localStorage enabled in browser
- [ ] sessionStorage enabled in browser
- [ ] CORS properly configured on backend
- [ ] API rate limiting configured (429 handling)
- [ ] Error logging configured (Sentry integration)
- [ ] Session transfer domain (beta.gatewayz.ai) configured
- [ ] Referral code tracking working
- [ ] Welcome dialog displaying for new users
- [ ] API key upgrade working after payment

