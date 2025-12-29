# Auth Refresh Fix - Context & Architectural Details

## Current System Architecture

### Three Independent Systems (Problem)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHAT LAYER                                    │
│  src/app/chat/page.tsx                                          │
│  - Manual updateApiKeyState() function                          │
│  - Polling interval: 1500ms                                      │
│  - Storage event listener                                        │
│  - Custom AUTH_REFRESH_EVENT listener                           │
│  → Problem: 3 ways to sync, arbitrary polling                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓↑ (loose coupling)
┌─────────────────────────────────────────────────────────────────┐
│                  STREAMING LAYER                                 │
│  src/lib/streaming.ts                                           │
│  - Catches 401 errors                                            │
│  - Calls requestAuthRefresh() (fire-and-forget)                 │
│  - Throws error immediately                                      │
│  - Stream reader stops                                           │
│  → Problem: Doesn't wait for refresh, stream dies               │
└─────────────────────────────────────────────────────────────────┘
                            ↓↑ (loose coupling)
┌─────────────────────────────────────────────────────────────────┐
│                AUTH CONTEXT LAYER                                │
│  src/context/gatewayz-auth-context.tsx                          │
│  - Listens for AUTH_REFRESH_EVENT                               │
│  - Calls syncWithBackend({ force: true })                       │
│  - No signal when complete                                       │
│  - Existing requestAuthRefresh() is void (no return)            │
│  → Problem: Completes asynchronously, no way to wait            │
└─────────────────────────────────────────────────────────────────┘
                            ↓↑
┌─────────────────────────────────────────────────────────────────┐
│                STORAGE LAYER                                     │
│  src/lib/api.ts (localStorage)                                  │
│  - API key stored in localStorage['gatewayz_api_key']           │
│  - User data in localStorage['gatewayz_user_data']              │
│  → Problem: No event when keys are written during refresh       │
└─────────────────────────────────────────────────────────────────┘
```

### Timing Problem Illustrated

```
Timeline showing race condition:

TIME    STREAMING LAYER              AUTH CONTEXT               STORAGE
────    ───────────────              ────────────               ───────

0ms     Send message
        Headers: {apiKey: KEY_1}

10ms    Backend streams response

100ms   401 error arrives
        requestAuthRefresh()  ──────→ AUTH_REFRESH_EVENT
                                      getAccessToken() called
                                      (async Privy call)

110ms   Stream throws error
        (calls throw, returns)

120ms                                Awaiting Privy token...

140ms                                Token received ✓

150ms                                POST /api/auth
                                      ↓
                                      localStorage updated
                                      ['gatewayz_api_key'] = KEY_2

160ms   Chat polling fires
        updateApiKeyState() reads localStorage
        Gets KEY_2 ✓

170ms   But stream already ended ✗

Result: User sees broken stream + error message
        New API key available but too late
```

---

## Data Structures & Types

### Auth Event Constants
```typescript
// src/lib/api.ts (lines 33-34)
export const AUTH_REFRESH_EVENT = 'gatewayz:refresh-auth';           // Current
export const AUTH_REFRESH_COMPLETE_EVENT = 'gatewayz:refresh-complete'; // NEW

// These need unique names to avoid conflicts in window.dispatchEvent()
```

### Auth Context State Machine
```typescript
// Valid transitions (src/context/gatewayz-auth-context.tsx, lines 37-43)
idle:             → unauthenticated | authenticating | authenticated
unauthenticated:  → authenticating | authenticated
authenticating:   → authenticated | unauthenticated | error
authenticated:    → authenticating | unauthenticated | error
error:            → unauthenticated | authenticating

// Key insight: "authenticating" is a real state, not transient
// System can get stuck if transition takes >30s
```

### Ref-based Race Condition Prevention
```typescript
// src/context/gatewayz-auth-context.tsx (lines 191-198)
const syncInFlightRef = useRef(false);           // Atomic sync flag
const syncPromiseRef = useRef<Promise<void> | null>(null);  // Deduplicate
const lastSyncedPrivyIdRef = useRef<string | null>(null);   // Skip redundant
const authRetryCountRef = useRef(0);             // Retry limiter (max 3)
const authTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 30s timeout

// These refs prevent multiple simultaneous syncs
// New StreamCoordinator should use similar pattern
```

### StreamCoordinator Design Pattern (From Existing Code)

The auth context already does this pattern:
```typescript
// Check if work already in progress
if (syncPromiseRef.current && !options?.force) {
  return syncPromiseRef.current;  // Return existing promise
}

// Mark work as in progress
syncInFlightRef.current = true;

// Create work promise
const syncPromise = (async () => {
  try {
    // Do async work
  } finally {
    syncInFlightRef.current = false;
    syncPromiseRef.current = null;
  }
})();

syncPromiseRef.current = syncPromise;
return syncPromise;
```

**StreamCoordinator will use identical pattern** to prevent concurrent refreshes.

---

## Key Callsites for Auth Refresh

### Where requestAuthRefresh() is Currently Called

1. **Streaming Layer** (src/lib/streaming.ts, line 308)
   ```typescript
   if (response.status === 401) {
     requestAuthRefresh();  // ← Fire-and-forget
     throw new Error('Authentication failed...');
   }
   ```
   **Change**: `await requestAuthRefresh()` + retry

2. **Chat History API** (src/lib/chat-history.ts, lines 149-150)
   ```typescript
   if (response.status === 401) {
     window.dispatchEvent(new Event('gatewayz:refresh-auth'));
     throw new Error('Session authentication failed...');
   }
   ```
   **Change**: Use new await pattern, but different error handling (session vs stream)

3. **Rate Limit Handling** (src/lib/streaming.ts, lines 246-303)
   ```typescript
   if (response.status === 429) {
     // Retries with backoff
     // Does NOT call requestAuthRefresh()
   }
   ```
   **Note**: Rate limit handling separate, only retries same credentials

### Important: When NOT to Refresh

Rate limit (429) handling is separate and should **not trigger auth refresh**:
- 429 means we're hitting rate limits, not auth failure
- Retrying with same credentials is correct
- If refresh needed, it's a follow-up 401 on the retry

---

## Event Flow in Auth Context

### Current Event Processing
```typescript
// src/context/gatewayz-auth-context.tsx, lines 992-1009
useEffect(() => {
  const handler = () => {
    console.log("[Auth] Received refresh event");
    syncWithBackend({ force: true }).catch((err) => {
      console.error("[Auth] Error refreshing auth:", err);
    });
  };

  window.addEventListener(AUTH_REFRESH_EVENT, handler);

  return () => {
    window.removeEventListener(AUTH_REFRESH_EVENT, handler);
  };
}, [syncWithBackend]);
```

**Problem**: `.catch()` swallows error, doesn't signal completion

### New Event Processing (Planned)
```typescript
// After syncWithBackend completes (success or error):
if (typeof window !== 'undefined') {
  // Signal that refresh operation is complete
  // Clients can now retry or recover
  window.dispatchEvent(new Event(AUTH_REFRESH_COMPLETE_EVENT));
}
```

---

## Storage Synchronization

### Storage Events vs Custom Events

**Storage Events**:
- Fire when localStorage is modified in **different tabs**
- Don't fire in same tab (where modification originated)
- Automatic browser API

**Custom Events**:
- Fire in same tab where dispatched
- Require manual dispatch
- Allow event metadata

### Why 1500ms Polling Exists

From chat/page.tsx (lines 1603-1604):
```typescript
// Storage event doesn't fire in same tab
// So polling is fallback for same-tab updates

// Poll as a fallback for same-tab updates since the storage event doesn't fire
const pollInterval = window.setInterval(updateApiKeyState, 1500);
```

**Solution**: Use custom event for same-tab, storage event for cross-tab
**Result**: No polling needed, event-driven only

---

## Stream Coordinator State Machine

### Desired Behavior

```
INITIAL STATE (apiKey: KEY_1)
    ↓
Send message to API with KEY_1
    ↓
Server responds with 401 (KEY_1 expired)
    ↓
COORDINATOR: setRefreshing(true)
    ↓
COORDINATOR: await requestAuthRefresh()
    Waits for AUTH_REFRESH_COMPLETE_EVENT
    ↓
AUTH CONTEXT: Completes sync
    Emits AUTH_REFRESH_COMPLETE_EVENT
    localStorage updated to KEY_2
    ↓
COORDINATOR: Promise resolves
COORDINATOR: getApiKey() returns KEY_2
    ↓
STREAMING: Retry with KEY_2
    ↓
SUCCESS ✓
```

### Edge Cases to Handle

1. **Auth refresh already in progress**
   - Multiple 401s in quick succession
   - Coordinator: Reuse existing refresh promise

2. **Auth refresh timeout (>30s)**
   - Coordinator: Reject promise
   - Streaming: Throw error instead of hanging

3. **Auth refresh fails**
   - Coordinator: getApiKey() still returns old/null key
   - Streaming: Retry fails again
   - User sees auth error (correct behavior)

4. **Network error during stream (not 401)**
   - Coordinator: Not involved
   - Streaming: Existing retry logic applies

---

## Performance Implications

### Polling Removal Impact
- **Current**: Every 1500ms, updates API key state
- **New**: Only when storage event (cross-tab) or custom event (same-tab)
- **Result**: Fewer updates, lower CPU usage, same effectiveness

### Auth Context Load
- **Current**: Single sync handler, multiple calls deduplicated
- **New**: Same, but now emits completion signal
- **Result**: Minimal overhead (single event dispatch)

### Stream Coordinator Load
- **Current**: No coordinator
- **New**: Single instance per stream (lightweight class)
- **Result**: Negligible overhead (<1KB memory per request)

---

## Error Handling Strategy

### 401 in Streaming (Current)
```
requestAuthRefresh()  // void, fire-and-forget
throw new Error('Authentication failed')
```

### 401 in Streaming (New)
```
await requestAuthRefresh()  // throws if timeout
retry with new apiKey       // uses KEY_2 from localStorage
if retry succeeds: continue stream
if retry fails: throw auth error
if timeout: throw auth error
```

### 401 in Chat History API (Current)
```
dispatchEvent(AUTH_REFRESH_EVENT)
throw new Error('Session authentication failed')
```

### 401 in Chat History API (New)
```
// Option 1: Use same coordinator
await requestAuthRefresh()
retry request with new apiKey

// Option 2: Keep simple error handling
// (decide during implementation)
```

---

## Testing Scenarios

### Unit Tests (stream-coordinator.ts)

1. **Happy path**: 401 → refresh → retry succeeds
2. **Already refreshing**: Multiple 401s → reuse refresh promise
3. **Refresh timeout**: Stuck refresh → promise rejects
4. **Refresh fails**: API unavailable → getApiKey returns old key
5. **No API key after refresh**: Refresh empty → coordinator can't retry

### Integration Tests (auth + streaming)

1. **Real 401 during stream**: Send message → get 401 → verify refresh → verify retry
2. **Rate limit then 401**: Get 429 (retry) → get 401 on retry → verify refresh
3. **Cross-tab auth sync**: Logout in tab A → chat in tab B → verify update via storage event
4. **Multiple streams**: Two streams, both get 401 → coordinator handles both

### E2E Tests (full chat flow)

1. **User sends message → gets 401 → stream resumes**: Verify in UI
2. **No visible interruption**: Measure latency
3. **Old API key cleared**: Verify localStorage updated
4. **Error state recovery**: After 401, new message works

---

## Files Using AUTH_REFRESH_EVENT

### Current Listeners
- `src/context/gatewayz-auth-context.tsx` (line 1001) - Triggers sync
- `src/app/chat/page.tsx` (line 1601) - Updates API key state

### Current Dispatchers
- `src/lib/api.ts` (line 140) - requestAuthRefresh()
- `src/lib/streaming.ts` (line 308) - On 401
- `src/lib/chat-history.ts` (line 150) - On 401

### New Event (AUTH_REFRESH_COMPLETE_EVENT)
- Will be dispatched by: `src/context/gatewayz-auth-context.tsx` (after sync)
- Will be listened by: `src/lib/api.ts` (in requestAuthRefresh promise)

---

## Implementation Checkpoints

### Checkpoint 1: Awaitable Auth Refresh
- ✓ requestAuthRefresh() returns Promise
- ✓ Completion event dispatches from auth context
- ✓ Promise resolves on completion
- ✓ Promise rejects on timeout
- ✓ Works without breaking existing code

### Checkpoint 2: Stream Coordinator
- ✓ Class exists and is importable
- ✓ Deduplicates multiple 401s
- ✓ Waits for refresh promise
- ✓ Returns new API key
- ✓ Unit tests pass

### Checkpoint 3: Streaming Integration
- ✓ 401 handler uses coordinator
- ✓ Retries with new API key
- ✓ 429 handling unchanged
- ✓ Network errors still work
- ✓ Stream doesn't hang on timeout

### Checkpoint 4: Cleanup
- ✓ Polling removed
- ✓ Chat uses auth context directly
- ✓ No stale state issues
- ✓ Tests pass
- ✓ Performance same or better

---

## Key Decisions Made

1. **Promise > Void**: Allows await, better error handling, aligns with async patterns
2. **Completion Event**: Signals when refresh operation done, enables promise resolution
3. **Coordinator Pattern**: Prevents concurrent refreshes, matches existing auth patterns
4. **Retry with new key**: Best UX, most errors are auth-related
5. **Remove polling**: Event-driven is cleaner, more efficient, more reactive
