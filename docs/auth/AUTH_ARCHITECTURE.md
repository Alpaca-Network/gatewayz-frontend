# Comprehensive Authentication and Session Management Architecture

## 1. AUTHENTICATION SYSTEM OVERVIEW

### 1.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

Main Domain (gatewayz.ai)                  Beta Domain (beta.gatewayz.ai)
        │                                            │
        ├─ User Login (Privy)                      │
        │                                            │
        ├─ Backend: Create/Retrieve Account         │
        │                                            │
        ├─ API Key Issued                           │
        │                                            │
        ├─ Redirect with Token                      │
        │                 ────────────────────────→ │
        │                                      Token in URL
        │                                            │
        │                                      ├─ Receive Token
        │                                      ├─ Store in sessionStorage
        │                                      ├─ Save API Key to localStorage
        │                                      ├─ Clean URL
        │                                      ├─ Fetch User Data
        │                                      ├─ Update Auth Context
        │                                      └─ Authenticated ✓
```

### 1.2 Key Authentication Layers

1. **Privy Authentication** - Multi-provider auth (Email, Google, GitHub, Wallet)
2. **Backend API Authentication** - POST /auth endpoint validates Privy tokens
3. **API Key Storage** - Stored in localStorage for API requests
4. **Session Transfer** - Cross-domain authentication via URL parameters and sessionStorage
5. **Auth Context** - Global React Context manages authentication state

---

## 2. PRIVY INTEGRATION

### 2.1 Privy Provider Setup

**File:** `/root/repo/src/components/providers/privy-provider.tsx` (Lines 1-85)

```typescript
// Configuration:
- App ID: NEXT_PUBLIC_PRIVY_APP_ID environment variable
- Login Methods: Email, Google, GitHub
- Embedded Wallets: Ethereum on Base chain
- Theme: Light mode with black accent color

// Authentication Methods:
const PrivyProvider = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  config: {
    loginMethods: ["email", "google", "github"],
    embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
    defaultChain: base,
  }
}
```

### 2.2 usePrivy Hook

**Location:** Provided by @privy-io/react-auth

```typescript
Properties from usePrivy():
- ready: boolean - Privy SDK initialized
- authenticated: boolean - User logged in with Privy
- user: User - Privy user object
- login(): Promise<void> - Open Privy login modal
- logout(): Promise<void> - Clear Privy session
- getAccessToken(): Promise<string | null> - Get Privy access token
```

---

## 3. GATEWAYZ AUTH CONTEXT

### 3.1 Global Authentication State Management

**File:** `/root/repo/src/context/gatewayz-auth-context.tsx` (Lines 1-683)

```typescript
// Context Value Interface:
interface GatewayzAuthContextValue {
  status: "idle" | "unauthenticated" | "authenticating" | "authenticated" | "error"
  apiKey: string | null                    // Bearer token for API requests
  userData: UserData | null               // User profile data
  privyUser: User | null                 // Privy user object
  privyReady: boolean                    // Privy SDK ready
  privyAuthenticated: boolean            // Privy auth status
  error: string | null                   // Error message
  login(): Promise<void> | void          // Trigger Privy login
  logout(): Promise<void>                // Logout and clear credentials
  refresh(options?: { force?: boolean }) // Sync with backend
  redirectToBeta?: (returnUrl?: string) => void  // Cross-domain redirect
}

// Types:
type UserTier = 'basic' | 'pro' | 'max'
type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'inactive'

interface AuthResponse {
  success: boolean
  user_id: number
  api_key: string                    // Primary output
  auth_method: string
  privy_user_id: string
  is_new_user: boolean
  display_name: string
  email: string
  credits: number
  tier?: UserTier
  tier_display_name?: string
  subscription_status?: SubscriptionStatus
  subscription_end_date?: number    // Unix timestamp
}

interface UserData {
  user_id: number
  api_key: string
  auth_method: string
  privy_user_id: string
  display_name: string
  email: string
  credits: number
  tier?: UserTier
  tier_display_name?: string
  subscription_status?: SubscriptionStatus
  subscription_end_date?: number
}
```

### 3.2 Provider Implementation

**Key Features:**

1. **Fast Authentication Path (Lines 133-147)**
   - Check cached credentials in localStorage on component mount
   - Skip backend sync if valid credentials exist
   - Immediate status update to "authenticated"

2. **State Initialization (Lines 148-156)**
   - API Key from localStorage
   - User Data from localStorage
   - Status from cache validation

3. **Sync with Backend (Lines 448-599)**
   - Triggered when Privy authentication status changes
   - Deduplication: Only syncs if Privy user ID changes or force refresh
   - Prevents race conditions with in-flight sync promises

4. **Build Auth Request (Lines 399-446)**
   - Constructs Privy user data object
   - Handles referral codes from URL or localStorage
   - Determines if new user or existing user
   - Auto-creates API key for new users or users without stored key

**Auth Sync Flow:**
```
┌──────────────────────────────────────┐
│ 1. Privy Authentication Changed      │
└──────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ 2. Build Auth Request Body           │
│    - User ID, linked accounts        │
│    - Auth method, terms acceptance   │
│    - Referral code if present        │
└──────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ 3. POST /api/auth                    │
│    (Proxies to backend)              │
│    - Timeout: 10 seconds             │
│    - Returns API key + user data     │
└──────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ 4. Save to localStorage              │
│    - API Key → gatewayz_api_key      │
│    - User Data → gatewayz_user_data  │
└──────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ 5. Update Context State              │
│    - status = "authenticated"        │
│    - Update apiKey & userData        │
└──────────────────────────────────────┘
```

### 3.3 API Key Upgrade Logic (Lines 183-319)

**Purpose:** Upgrade temporary trial API keys to persistent production keys after payment

**Conditions:**
- Current key starts with "gw_temp_" prefix
- User has > 10 credits
- Not a new user

**Process:**
1. Fetch upgraded keys from `/api/user/api-keys`
2. Select preferred key: live environment + primary key
3. Update localStorage and context
4. Runs in background (non-blocking)

**File:** `/root/repo/src/lib/api.ts` (Lines 44-65)

---

## 4. STORAGE LAYER

### 4.1 localStorage Keys

**File:** `/root/repo/src/lib/api.ts`

| Key | Value | Purpose |
|-----|-------|---------|
| `gatewayz_api_key` | String | Bearer token for authenticated requests |
| `gatewayz_user_data` | JSON | User profile (id, email, credits, tier) |
| `gatewayz_referral_code` | String | Referral code for new user signups |
| `gatewayz_show_referral_bonus` | Boolean | Flag to show referral bonus dialog |

### 4.2 sessionStorage Keys

**File:** `/root/repo/src/integrations/privy/auth-session-transfer.ts` (Lines 8-11)

| Key | Value | Purpose | TTL |
|-----|-------|---------|-----|
| `gatewayz_session_transfer_token` | JSON | Session transfer data with fingerprint | 10 min |

**Session Transfer Token Structure:**
```typescript
{
  token: string              // API key
  userId: string             // User ID
  timestamp: number          // Creation time
  origin: string             // Window origin for CSRF validation
  fingerprint: string        // Browser fingerprint
}
```

### 4.3 Storage Utility Functions

**File:** `/root/repo/src/lib/api.ts` (Lines 45-120)

```typescript
// API Key Management
saveApiKey(apiKey: string): void
getApiKey(): string | null
removeApiKey(): void

// User Data Management
saveUserData(userData: UserData): void
getUserData(): UserData | null

// Authenticated Requests
makeAuthenticatedRequest(endpoint: string, options?: RequestInit): Promise<Response>
processAuthResponse(response: AuthResponse): void

// Auth Events
requestAuthRefresh(): void
```

---

## 5. SESSION TRANSFER BETWEEN DOMAINS

### 5.1 Cross-Domain Authentication Flow

**File:** `/root/repo/src/integrations/privy/auth-session-transfer.ts` (Lines 1-250)

**Problem Solved:** Users authenticate on gatewayz.ai (main) and need seamless access to beta.gatewayz.ai without re-login

**Solution:** URL parameter-based session transfer with security validations

**Flow:**

```
Step 1: Main Domain Redirect
└─ redirectToBetaWithSession(token, userId, betaDomain, returnUrl)
   └─ Constructs URL: https://beta.gatewayz.ai?token=XXX&userId=123&returnUrl=/chat
   └─ window.location.href = redirectUrl

Step 2: Beta Domain Receives Parameters
└─ getSessionTransferParams()
   └─ Parses URL search parameters
   └─ Returns: { token, userId, returnUrl, action }

Step 3: Store in sessionStorage
└─ storeSessionTransferToken(token, userId)
   └─ Stores JSON object with:
      - token (API key)
      - userId
      - timestamp
      - origin (CSRF validation)
      - fingerprint (browser validation)
   └─ TTL: 10 minutes

Step 4: Save to localStorage
└─ saveApiKey(token)
   └─ Store in: gatewayz_api_key

Step 5: Cleanup URL
└─ cleanupSessionTransferParams()
   └─ window.history.replaceState({}, document.title, pathname)
   └─ Remove parameters from browser history

Step 6: Fetch User Data
└─ fetchUserDataOptimized(token)
   └─ GET /api/user/me with Bearer token
   └─ Cache result for 1 minute
   └─ Timeout: 3 seconds

Step 7: Update Context
└─ refresh() auth context
   └─ Trigger re-sync to finalize auth state
```

### 5.2 Security Features

**Origin Validation (Line 205-209):**
```typescript
// Validate origin to prevent CSRF attacks
if (sessionData.origin && sessionData.origin !== window.location.origin) {
  console.error('[SessionTransfer] Origin mismatch - blocking potential CSRF attack');
  clearSessionTransferToken();
  return { token: null, userId: null };
}
```

**Fingerprint Validation (Line 197-202):**
```typescript
// Browser fingerprint includes:
- navigator.userAgent
- navigator.language
- Timezone offset
- Screen width/height
- Color depth

// Warning on mismatch (doesn't block - allows browser updates)
if (sessionData.fingerprint !== currentFingerprint) {
  console.warn('[SessionTransfer] Session fingerprint mismatch - potential security issue');
}
```

**Token Expiry (Line 189-195):**
```typescript
// Check if token expired
const elapsed = Date.now() - sessionData.timestamp;
if (elapsed > SESSION_TRANSFER_EXPIRY_MS) {  // 10 minutes
  console.log('[SessionTransfer] Session transfer token expired, clearing');
  clearSessionTransferToken();
  return { token: null, userId: null };
}
```

### 5.3 Session Transfer Parameters

**Redirect URL Format:**
```
https://beta.gatewayz.ai?token=API_KEY&userId=USER_ID&returnUrl=/chat&action=signin
```

**Parameters:**

| Parameter | Type | Purpose | Required |
|-----------|------|---------|----------|
| `token` | string | API key from main domain | Yes |
| `userId` | string | Gatewayz user ID | Yes |
| `returnUrl` | string | Where to redirect after auth | No |
| `action` | string | 'signin' or 'freetrial' | No |

---

## 6. SESSION INITIALIZER

### 6.1 Purpose

**File:** `/root/repo/src/components/SessionInitializer.tsx` (Lines 1-266)

Handles automatic authentication on beta domain when redirected from main domain

**Key Responsibilities:**
1. Detect session transfer parameters from URL
2. Store tokens in storage
3. Fetch user data from backend
4. Update auth context
5. Redirect to specified return URL
6. Handle fallback from stored tokens

### 6.2 Implementation Details

**Initialization Gate (Lines 86-106):**
```typescript
// Only initialize once per component mount
if (initializedRef.current) return;

// Wait for Privy to be ready if action is pending
const { action } = getSessionTransferParams();
if (action && !privyReady) {
  console.log("[SessionInit] Privy not ready yet, waiting...");
  return; // Don't mark initialized - retry when Privy is ready
}

// Mark as initialized BEFORE async operations
initializedRef.current = true;
```

**Session Transfer from URL (Lines 107-177):**
```typescript
// 1. Get parameters from URL
const { token, userId, returnUrl, action } = getSessionTransferParams();

if (token && userId) {
  // 2. Store in sessionStorage for persistence
  storeSessionTransferToken(token, userId);
  
  // 3. Save API key to localStorage
  saveApiKey(token);
  
  // 4. Clean URL to prevent history pollution
  cleanupSessionTransferParams();
  
  // 5. Fetch user data in background (non-blocking)
  fetchUserDataOptimized(token).then((userData) => {
    if (userData) {
      // 6. Save complete user data
      saveUserData(userDataToSave);
      
      // 7. Refresh auth context
      refresh();
    }
  });
  
  // 8. Redirect if returnUrl provided
  if (returnUrl) {
    router.push(returnUrl);
  }
}
```

**Fallback to Stored Token (Lines 179-232):**
```typescript
// Check for stored session transfer token if no URL params
const { token: storedToken, userId: storedUserId } = getStoredSessionTransferToken();

if (storedToken && storedUserId && !existingApiKey) {
  // Restore from sessionStorage if localStorage is empty
  saveApiKey(storedToken);
  
  // Fetch and update user data
  fetchUserDataOptimized(storedToken).then((userData) => {
    if (userData) {
      saveUserData(userDataToSave);
      refresh();
    }
  });
}
```

**Action Handler (Lines 234-250):**
```typescript
// If unauthenticated and action specified, trigger Privy login
if (status === "unauthenticated" && action) {
  console.log("[SessionInit] Action parameter detected, opening Privy popup");
  cleanupSessionTransferParams();
  try {
    await login();
  } catch (error) {
    console.error("[SessionInit] Failed to trigger login for action:", action);
  }
}
```

### 6.3 Integration in Root Layout

**File:** `/root/repo/src/app/layout.tsx` (Lines 15, 93)

```typescript
import { SessionInitializer } from '@/components/SessionInitializer';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PrivyProviderWrapper>
          <AnalyticsProvidersWrapper>
            {/* Session transfer from main domain - handles automatic authentication */}
            <SessionInitializer />
            {/* Rest of app */}
          </AnalyticsProvidersWrapper>
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
```

---

## 7. BACKEND API INTEGRATION

### 7.1 Authentication Endpoint

**File:** `/root/repo/src/app/api/auth/route.ts` (Lines 1-75)

**Endpoint:** `POST /api/auth` (Frontend proxy to backend)

**Request:**
```typescript
{
  user: {
    id: string                      // Privy user ID
    created_at: number              // Unix timestamp
    linked_accounts: Array          // Email, Google, GitHub, Wallet
    mfa_methods: Array
    has_accepted_terms: boolean
    is_guest: boolean
  }
  token: string | null              // Privy access token
  auto_create_api_key: boolean
  is_new_user: boolean
  has_referral_code: boolean
  referral_code: string | null
  privy_user_id: string
  trial_credits?: number            // 10 for new users
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  user_id: number
  api_key: string                    // Critical output
  auth_method: string
  privy_user_id: string
  is_new_user: boolean
  display_name: string
  email: string
  credits: number
  timestamp: string | null
  tier?: 'basic' | 'pro' | 'max'
  tier_display_name?: string
  subscription_status?: string
  subscription_end_date?: number
}
```

**Proxy Implementation:**
```typescript
const response = await proxyFetch(`${API_BASE_URL}/auth`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal: controller.signal,  // 15 second timeout
});
```

### 7.2 API Key Endpoints

**File:** `/root/repo/src/app/api/user/api-keys/route.ts`

**GET /api/user/api-keys** - Fetch user's API keys
- Proxy to backend with Bearer token
- Returns array of API keys with environment tags
- Retry logic for 500 errors (3 retries with exponential backoff)

**POST /api/user/api-keys** - Create new API key
- Proxy to backend with Bearer token
- Returns new API key object

**File:** `/root/repo/src/app/api/user/me/route.ts`

**GET /api/user/me** - Fetch current user profile
- Proxy to backend with Bearer token
- Returns UserData object

### 7.3 API Key Validation Middleware

**File:** `/root/repo/src/app/api/middleware/auth.ts` (Lines 1-35)

```typescript
export async function validateApiKey(request: NextRequest): Promise<{
  key: string;
  error?: NextResponse
}> {
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return {
      key: '',
      error: NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      )
    };
  }
  
  return { key: apiKey };
}
```

---

## 8. CHAT SESSION MANAGEMENT

### 8.1 Chat History API

**File:** `/root/repo/src/lib/chat-history.ts` (Lines 69-379)

**Class:** `ChatHistoryAPI`

**Constructor:**
```typescript
constructor(
  apiKey: string,
  baseUrl?: string,
  privyUserId?: string
)
```

**Methods:**

```typescript
// Create new chat session
async createSession(
  title?: string,
  model?: string
): Promise<ChatSession>

// Retrieve all sessions for user
async getSessions(
  limit: number = 50,
  offset: number = 0
): Promise<ChatSession[]>

// Get specific session with messages
async getSession(sessionId: number): Promise<ChatSession>

// Update session (title or model)
async updateSession(
  sessionId: number,
  title?: string,
  model?: string
): Promise<ChatSession>

// Delete session
async deleteSession(sessionId: number): Promise<boolean>

// Save message to session
async saveMessage(
  sessionId: number,
  role: 'user' | 'assistant',
  content: string,
  model?: string,
  tokens?: number
): Promise<ChatMessage>

// Search sessions
async searchSessions(
  query: string,
  limit: number = 20
): Promise<ChatSession[]>

// Get user stats
async getStats(): Promise<ChatStats>
```

### 8.2 Chat Session Types

```typescript
interface ChatSession {
  id: number
  user_id: number
  title: string
  model: string
  created_at: string              // ISO 8601
  updated_at: string
  is_active: boolean
  messages?: ChatMessage[]         // Only when fetching specific session
}

interface ChatMessage {
  id: number
  session_id: number
  role: 'user' | 'assistant'
  content: string
  model?: string
  tokens?: number
  created_at: string              // ISO 8601
}

interface ChatStats {
  total_sessions: number
  total_messages: number
  active_sessions: number
  total_tokens: number
  average_messages_per_session: number
}
```

### 8.3 Chat API Endpoints

**File:** `/root/repo/src/app/api/chat/sessions/route.ts`

**GET /api/chat/sessions** - List sessions
- Accepts: limit, offset query parameters
- Proxy to backend with Bearer token

**POST /api/chat/sessions** - Create session
- Body: { title?, model? }
- Returns: ChatSession object

**File:** `/root/repo/src/app/api/chat/completions/route.ts`

**POST /api/chat/completions** - Chat completion with streaming
- Supports both streaming and non-streaming responses
- Rate limit retry logic (3 attempts with exponential backoff)
- Timeout: 120s for streaming, 30s for non-streaming
- Returns: Server-sent events stream or JSON response

---

## 9. COMPLETE LOGIN TO CHAT FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE AUTHENTICATION FLOW                 │
└─────────────────────────────────────────────────────────────────┘

1. USER INITIATES LOGIN
   │
   ├─ clicks "Sign In" button
   └─ calls useGatewayzAuth().login()
   
2. PRIVY LOGIN MODAL OPENS
   │
   ├─ Email / Google / GitHub / Wallet options
   └─ User authenticates with Privy
   
3. PRIVY AUTHENTICATION COMPLETE
   │
   ├─ usePrivy().authenticated becomes true
   ├─ Privy user object populated
   └─ useEffect in GatewayzAuthProvider triggered
   
4. SYNC WITH BACKEND
   │
   ├─ Call syncWithBackend() in auth context
   ├─ Build auth request body with Privy user data
   ├─ POST /api/auth endpoint
   │  └─ Validates Privy token
   │  └─ Creates or retrieves Gatewayz user account
   │  └─ Returns API key + user data
   └─ Timeout: 10 seconds
   
5. PROCESS AUTH RESPONSE
   │
   ├─ Parse AuthResponse JSON
   ├─ Extract API key (critical field)
   ├─ saveApiKey(apiKey) → localStorage['gatewayz_api_key']
   ├─ saveUserData(userData) → localStorage['gatewayz_user_data']
   ├─ Update context state: apiKey, userData, status='authenticated'
   └─ Trigger handleAuthSuccessAsync()
   
6. BACKGROUND: UPGRADE TEMP API KEY (if applicable)
   │
   ├─ Check if key starts with 'gw_temp_'
   ├─ Check if credits > 10 and not new user
   ├─ GET /api/user/api-keys
   ├─ Find preferred key (live + primary)
   ├─ Update localStorage and context
   └─ Non-blocking (fire and forget)
   
7. NEW USER FLOW
   │
   ├─ if is_new_user flag set
   │  ├─ Clear referral code from localStorage
   │  ├─ Set 'gatewayz_show_referral_bonus' flag
   │  ├─ Dispatch NEW_USER_WELCOME_EVENT
   │  └─ Show welcome dialog with 10 trial credits
   └─ Redirect to /onboarding
   
8. EXISTING USER FLOW
   │
   └─ Proceed to requested route or dashboard
   
9. CREATE FIRST CHAT SESSION
   │
   ├─ User navigates to /chat
   ├─ Call ChatHistoryAPI.createSession(title, model)
   │  ├─ POST /api/chat/sessions
   │  ├─ Bearer token: localStorage['gatewayz_api_key']
   │  ├─ Returns ChatSession object
   │  └─ Timeout: 5 seconds
   └─ Session created and ready for messages
   
10. SEND MESSAGE AND GET RESPONSE
    │
    ├─ User types message in chat UI
    ├─ Save user message:
    │  └─ ChatHistoryAPI.saveMessage(sessionId, 'user', content)
    │     └─ POST /api/chat/sessions/{id}/messages
    │        └─ Timeout: 10 seconds
    ├─ POST /api/chat/completions (streaming)
    │  ├─ Body: { messages: [...], model: 'gpt-4', stream: true }
    │  ├─ Bearer token: localStorage['gatewayz_api_key']
    │  ├─ Receives Server-Sent Events stream
    │  ├─ Timeout: 120 seconds
    │  └─ Rate limit retry: 3 attempts with exponential backoff
    ├─ Save assistant message:
    │  └─ ChatHistoryAPI.saveMessage(sessionId, 'assistant', content)
    └─ Display in chat UI

┌─────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION STATE TIMELINE                │
└─────────────────────────────────────────────────────────────────┘

Time    Status              Storage                    Context
────────────────────────────────────────────────────────────────────
0ms     idle                empty                      idle
        ↓ User clicks Login
50ms    unauthenticated     empty                      unauthenticated
        ↓ Privy authenticates
100ms   authenticating      empty                      authenticating
        ↓ Backend validates, creates account
500ms   authenticating      empty                      authenticating
        ↓ API key received, stored
600ms   authenticated       api_key ✓                 authenticated
        ↓                   user_data ✓
        
        Ready for API requests with Bearer token
```

---

## 10. KEY FILES AND LINE NUMBERS

### Core Authentication

| File | Lines | Purpose |
|------|-------|---------|
| `/root/repo/src/context/gatewayz-auth-context.tsx` | 1-683 | Global auth context & sync logic |
| `/root/repo/src/components/providers/privy-provider.tsx` | 1-85 | Privy SDK setup & wrapper |
| `/root/repo/src/hooks/use-auth.ts` | 1-14 | Simple Privy hook wrapper |
| `/root/repo/src/lib/api.ts` | 1-191 | Storage utilities & API types |

### Session Transfer

| File | Lines | Purpose |
|------|-------|---------|
| `/root/repo/src/integrations/privy/auth-session-transfer.ts` | 1-250 | Cross-domain session transfer |
| `/root/repo/src/integrations/privy/auth-sync.ts` | 1-147 | Privy sync module (reusable) |
| `/root/repo/src/components/SessionInitializer.tsx` | 1-266 | Session initialization on beta |

### API Endpoints

| File | Lines | Purpose |
|------|-------|---------|
| `/root/repo/src/app/api/auth/route.ts` | 1-75 | Backend auth proxy |
| `/root/repo/src/app/api/user/me/route.ts` | 1-56 | User profile proxy |
| `/root/repo/src/app/api/user/api-keys/route.ts` | 1-265 | API keys management |
| `/root/repo/src/app/api/chat/sessions/route.ts` | 1-87 | Session CRUD proxy |
| `/root/repo/src/app/api/chat/completions/route.ts` | 1-579 | Chat completion proxy with retry |

### Chat Management

| File | Lines | Purpose |
|------|-------|---------|
| `/root/repo/src/lib/chat-history.ts` | 1-379 | Chat API service class |
| `/root/repo/src/app/api/chat/sessions/[id]/route.ts` | - | Individual session operations |

### Middleware

| File | Lines | Purpose |
|------|-------|---------|
| `/root/repo/src/app/api/middleware/auth.ts` | 1-35 | API key validation |
| `/root/repo/src/app/api/middleware/error-handler.ts` | 1-67 | Standardized error handling |

### Layout & Components

| File | Lines | Purpose |
|------|-------|---------|
| `/root/repo/src/app/layout.tsx` | 1-115 | Root layout with all providers |
| `/root/repo/src/components/auth-guard.tsx` | 1-23 | Protected route guard |

---

## 11. ENVIRONMENT VARIABLES

### Required

```bash
NEXT_PUBLIC_PRIVY_APP_ID=clxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai
```

### Optional

```bash
NEXT_PUBLIC_CHAT_HISTORY_API_URL=https://api.gatewayz.ai
BACKEND_URL=https://api.gatewayz.ai
```

---

## 12. ERROR HANDLING

### API Error Handling

**File:** `/root/repo/src/app/api/middleware/error-handler.ts`

```typescript
function handleApiError(error: unknown, context: string): NextResponse {
  // Logs error to console
  // Captures in Sentry with context tags
  // Returns JSON error with 500 status
}

function handleApiErrorWithStatus(error: unknown, context: string, status: number): NextResponse {
  // Same as above but with custom status code
}
```

### Auth Error Handling (Lines 527-578 in auth-context)

- Backend returns non-200: Clear credentials, set status="error"
- Missing API key in response: Log warning, clear credentials, trigger error callback
- Timeout errors: Return 504 Gateway Timeout
- Network errors: Return 502 Bad Gateway

### Chat API Error Handling

- 401 Unauthorized: Dispatch auth refresh event
- 404 Not Found: "Session not found"
- 429 Rate Limit: Retry with exponential backoff (3 attempts)
- 500 Server Error: Return 502 Bad Gateway

---

## 13. SECURITY CONSIDERATIONS

### API Key Handling

1. **Storage:** Stored in localStorage (browser accessible)
   - Alternative: sessionStorage for session-only duration
   - Used for Bearer token in Authorization header

2. **Transmission:** Always via Bearer token in Authorization header
   - Never in URL parameters (except during session transfer, then immediately cleaned)
   - HTTPS only in production

3. **Temporary Keys:** Marked with "gw_temp_" prefix
   - Upgraded to permanent keys after payment
   - Only temp keys created for new free trial users

4. **401 Handling:** If API returns 401, credentials are cleared
   - User must re-authenticate

### Session Transfer Security

1. **Origin Validation:** Checks window.location.origin matches stored origin
   - Prevents CSRF attacks from different domains

2. **Fingerprint:** Browser fingerprint generation
   - User agent, language, timezone, screen resolution
   - Warning (non-blocking) on mismatch

3. **Token Expiry:** 10-minute expiration on sessionStorage token
   - Prevents unauthorized access after delay

4. **URL Cleanup:** Parameters removed from history immediately
   - Uses window.history.replaceState()
   - Prevents token exposure in browser history

### Authentication State

1. **Race Condition Prevention:** Deduplication logic
   - Only one sync allowed per Privy user ID
   - Promise returned for in-flight requests
   - Force refresh flag for explicit updates

2. **Timeouts:** All network requests have timeouts
   - Backend auth: 10 seconds
   - User fetch: 3 seconds
   - API key fetch: 5 seconds
   - Chat completions: 30-120 seconds

3. **Error Recovery:** 
   - Automatic retry on 500 errors (API key fetch)
   - Retry on rate limits with exponential backoff
   - Clear credentials on 401 to trigger re-auth

---

## 14. INTEGRATION POINTS

### Where Auth Context is Used

```typescript
// Components can access auth via:
const { status, apiKey, userData, login, logout, refresh } = useGatewayzAuth();

// ChatHistoryAPI creation:
const chatAPI = new ChatHistoryAPI(apiKey, baseUrl, userData.privy_user_id);

// Authenticated API calls:
const response = await makeAuthenticatedRequest(endpoint, options);

// Manual refresh after events:
requestAuthRefresh();  // Dispatches custom event
```

### Event System

```typescript
// Event Names (from /root/repo/src/lib/api.ts):
AUTH_REFRESH_EVENT = 'gatewayz:refresh-auth'
NEW_USER_WELCOME_EVENT = 'gatewayz:new-user-welcome'

// Usage:
window.addEventListener(AUTH_REFRESH_EVENT, () => {
  // Manually trigger auth refresh
});

window.addEventListener(NEW_USER_WELCOME_EVENT, (event) => {
  // Show welcome dialog with event.detail.credits
});
```

---

## 15. TESTING

### Test Files

```
/root/repo/src/context/__tests__/
├─ gatewayz-auth-context.test.ts     # Auth context tests

/root/repo/src/integrations/privy/__tests__/
├─ auth-session-transfer.test.ts     # Session transfer tests
├─ auth-session-transfer-edge-cases.test.ts
├─ auth-sync.test.ts                 # Sync module tests

/root/repo/src/components/__tests__/
├─ SessionInitializer.test.tsx       # Session init tests
└─ privy-provider.test.tsx           # Privy provider tests

/root/repo/src/app/api/auth/__tests__/
└─ route.test.ts                     # Auth endpoint tests
```

### Key Test Scenarios

1. **Authentication Flow**
   - Valid credentials → authenticated state
   - Invalid token → error state
   - Timeout → timeout error
   - Race conditions → deduplication works

2. **Session Transfer**
   - Valid URL params → session restored
   - Expired token → cleared
   - Origin mismatch → blocked
   - Fingerprint change → warning only

3. **API Key Upgrade**
   - Temp key with credits → upgraded
   - Temp key with no credits → kept
   - No upgrade needed → skipped

---

## 16. FLOW SUMMARY

```
1. Privy Authentication (usePrivy)
   ↓
2. Build Auth Request (GatewayzAuthProvider)
   ↓
3. POST /api/auth → Backend (Privy validation)
   ↓
4. Receive API Key + User Data
   ↓
5. Save to localStorage
   ↓
6. Update Context (global state)
   ↓
7. Available for API Requests
   ├─ Chat API calls with Bearer token
   ├─ Model selection
   ├─ Session management
   └─ User settings
```

