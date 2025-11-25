# Auth Refresh Coordination Fix - Implementation Plan

## Executive Summary

The current auth refresh system is **fire-and-forget**: when a 401 error occurs during chat streaming, the code dispatches an event and immediately throws an error. This causes:
- Streams to end abruptly
- Chat UX to break mid-response
- Race conditions between auth context and chat layers
- Arbitrary polling creating stale API key windows

This plan implements **coordinated, awaitable auth refresh** with stream recovery.

---

## Problem Analysis

### Current Flow (Broken)
```
401 Error in Stream
  ↓
requestAuthRefresh() → window.dispatchEvent(EVENT)  [Fire-and-forget]
  ↓
Streaming code immediately throws error, stream ends
  ↓
Auth context processes event asynchronously
  ↓
New API key available but stream already closed
  ↓
User sees broken experience
```

### Root Causes

1. **Fire-and-forget dispatch** - No mechanism to await completion
2. **No stream coordination** - Streaming doesn't know about auth state
3. **Multiple independent systems** - localStorage + custom event + polling
4. **Stale API key window** - 1500ms polling = up to 1.5s of stale requests
5. **No request queuing** - Failed requests aren't retried with new credentials

---

## Solution Architecture

### Phase 1: Make Auth Refresh Awaitable

**Goal**: Replace fire-and-forget event dispatch with promise-based coordination

**Files Modified**:
- `src/lib/api.ts` - Add completion signal system
- `src/context/gatewayz-auth-context.tsx` - Dispatch completion event

**Changes**:
```typescript
// BEFORE (fire-and-forget)
export function requestAuthRefresh(): void {
  window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
}

// AFTER (returns promise, waits for completion)
export function requestAuthRefresh(): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => {
      window.removeEventListener(AUTH_REFRESH_COMPLETE_EVENT, handler);
      resolve();
    };

    window.addEventListener(AUTH_REFRESH_COMPLETE_EVENT, handler);
    window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));

    // Timeout after 30s to prevent hanging
    const timeout = setTimeout(() => {
      window.removeEventListener(AUTH_REFRESH_COMPLETE_EVENT, handler);
      reject(new Error('Auth refresh timeout'));
    }, 30000);
  });
}
```

**Auth Context Changes**:
- After successful sync completes → dispatch `AUTH_REFRESH_COMPLETE_EVENT`
- After error state → dispatch completion (not success) so clients can handle

### Phase 2: Create Stream Coordinator

**Goal**: Coordinate streaming with auth refresh, allowing streams to pause/resume

**Files Created**:
- `src/lib/stream-coordinator.ts` - New module for stream state management

**Design**:
```typescript
class StreamCoordinator {
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  async handleAuthError(error: Response): Promise<void> {
    // Mark as refreshing, prevent multiple refreshes
    if (this.isRefreshing) {
      // Wait for existing refresh
      await this.refreshPromise;
      return;
    }

    this.isRefreshing = true;
    try {
      // Wait for auth refresh to complete (now awaitable!)
      await requestAuthRefresh();
    } finally {
      this.isRefreshing = false;
    }
  }

  getApiKey(): string | null {
    // Get fresh API key from auth context
    return getApiKey();
  }
}
```

### Phase 3: Update Streaming Layer

**Goal**: Leverage StreamCoordinator for 401 handling

**Files Modified**:
- `src/lib/streaming.ts` - Use coordinator for 401 errors

**Changes**:
```typescript
if (response.status === 401) {
  try {
    const coordinator = new StreamCoordinator();
    await coordinator.handleAuthError(response);

    // After successful refresh, retry with new API key
    const newApiKey = coordinator.getApiKey();
    if (newApiKey && newApiKey !== apiKey) {
      // Retry streaming with new credentials
      yield* streamChatResponse(url, newApiKey, requestBody, retryCount, maxRetries);
      return;
    }
  } catch (refreshError) {
    throw new Error(
      'Authentication failed after refresh attempt. ' +
      'Please log in again.'
    );
  }

  throw new Error('Authentication failed');
}
```

### Phase 4: Eliminate Redundant Polling

**Goal**: Remove 1500ms polling, rely only on event system

**Files Modified**:
- `src/app/chat/page.tsx` - Remove polling interval

**Changes**:
```typescript
// REMOVE this:
// const pollInterval = window.setInterval(updateApiKeyState, 1500);

// Keep only:
window.addEventListener('storage', handleStorageChange);
window.addEventListener(AUTH_REFRESH_EVENT, handleAuthRefresh);
```

### Phase 5: Unify Chat Auth State

**Goal**: Chat uses `useGatewayzAuth()` directly instead of manual polling

**Files Modified**:
- `src/app/chat/page.tsx` - Use auth context hook

**Changes**:
```typescript
// BEFORE: Manual API key fetching
const [hasApiKey, setHasApiKey] = useState(false);
useEffect(() => {
  const apiKey = getApiKey();
  setHasApiKey(!!apiKey);
  // polling...
}, []);

// AFTER: Use auth context
const { apiKey, status } = useGatewayzAuth();
const hasApiKey = !!apiKey;
```

---

## Implementation Phases

### Phase 1: Auth Refresh Coordination (Priority 1)
**Time**: ~2-3 hours
**Risk**: Medium (event system changes)
**Testing**: Test event firing order

**Tasks**:
1. Add `AUTH_REFRESH_COMPLETE_EVENT` constant in `api.ts`
2. Modify `requestAuthRefresh()` to return Promise
3. Update auth context to dispatch completion event after sync
4. Add tests for promise resolution/rejection
5. Test 401 scenarios with new flow

### Phase 2: Stream Coordinator (Priority 2)
**Time**: ~2-3 hours
**Risk**: Medium (new abstraction)
**Testing**: Unit test coordinator class

**Tasks**:
1. Create `stream-coordinator.ts` with coordinator class
2. Implement `handleAuthError()` method
3. Add `getApiKey()` method
4. Write unit tests
5. Test with chat scenarios

### Phase 3: Streaming Layer Integration (Priority 3)
**Time**: ~2-3 hours
**Risk**: High (affects core chat UX)
**Testing**: E2E test with real chat

**Tasks**:
1. Import coordinator in `streaming.ts`
2. Update 401 handler to use coordinator
3. Implement retry with new API key
4. Test rate limiting still works
5. Test network errors still work
6. Manual E2E chat test

### Phase 4: Remove Polling (Priority 4)
**Time**: ~30 mins
**Risk**: Low (cleanup only)
**Testing**: Verify no regressions

**Tasks**:
1. Remove polling interval from `chat/page.tsx`
2. Keep event listeners
3. Test chat still detects auth changes
4. Monitor localStorage access

### Phase 5: Unify Auth State (Priority 5)
**Time**: ~1-2 hours
**Risk**: Medium (state management)
**Testing**: Verify no stale state issues

**Tasks**:
1. Replace manual `getApiKey()` calls with `useGatewayzAuth()`
2. Remove `hasApiKey` state variable
3. Update dependencies
4. Test auth state flows
5. Verify no race conditions

---

## Files Affected

### Create
- `src/lib/stream-coordinator.ts` - New coordinator class

### Modify
- `src/lib/api.ts` - Make refresh awaitable
- `src/context/gatewayz-auth-context.tsx` - Emit completion event
- `src/lib/streaming.ts` - Use coordinator for 401 handling
- `src/app/chat/page.tsx` - Remove polling, use auth context
- `src/lib/chat-history.ts` - Update for awaitable refresh (minor)

### Test
- `src/lib/__tests__/api.test.ts` - Test auth refresh promise
- `src/__tests__/integration/auth-to-chat-flow.integration.test.ts` - E2E

---

## Key Decisions

### Decision 1: Promise-based Coordination vs Callback-based
**Choice**: Promise-based (async/await)
**Reason**: Cleaner API, better error handling, aligns with modern JS patterns

### Decision 2: Singleton vs Instance-per-request StreamCoordinator
**Choice**: Singleton per request
**Reason**: Prevents multiple simultaneous refreshes, simpler state management

### Decision 3: Retry after refresh vs Give up
**Choice**: Retry with new API key
**Reason**: Maximizes recovery, improves UX, most errors are auth-related

### Decision 4: Kill polling immediately vs Gradual migration
**Choice**: Immediate (after phase 3)
**Reason**: Polling creates stale windows, better to remove cleanly after new system works

### Decision 5: localStorage vs In-memory sync for API key
**Choice**: Keep localStorage as source of truth
**Reason**: Necessary for tab sync, coordinator reads from localStorage

---

## Backward Compatibility

✅ **Fully backward compatible**:
- Event listeners still work
- localStorage still used for persistence
- Auth context API unchanged (just adds completion signal)
- Existing error handling preserved
- Graceful fallback if refresh fails

---

## Testing Strategy

### Unit Tests
- `stream-coordinator.ts` - Mock auth refresh events
- `api.ts` - Test promise resolution/rejection

### Integration Tests
- Complete auth refresh flow with streaming
- 401 during stream → refresh → retry
- Multiple 401s in quick succession
- Auth refresh timeout handling
- Storage event + custom event coordination

### E2E Tests
- Real chat with 401 injection
- Verify stream resumes after refresh
- Verify UI updates properly
- Verify no double messages

### Manual Testing
- Real chat scenarios
- Network throttling to trigger 401
- Multi-tab auth sync
- Performance monitoring

---

## Rollback Plan

If issues arise:
1. Revert `stream-coordinator.ts` and streaming changes
2. Keep `requestAuthRefresh()` as async but don't call await
3. Re-enable 1500ms polling as fallback
4. Existing error handling ensures graceful degradation

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Race conditions in coordinator | Medium | Thorough test coverage, ref-based locking |
| Streams stuck during refresh | Medium | 30s timeout, explicit error throw |
| Multiple refreshes in flight | Medium | Coordinator queue + deduplication |
| Auth key becomes stale mid-stream | Low | Immediate retry with new key on 401 |
| Polling removal breaks edge case | Low | Keep storage event listener as fallback |
| Performance impact | Low | Coordinator is minimal abstraction |

---

## Success Criteria

✅ No more broken streams on 401
✅ Auth refresh completes before stream retry
✅ Chat UX smooth during refresh (no visible interruption)
✅ Polling removed (no 1500ms stale windows)
✅ All tests pass (unit + integration + E2E)
✅ No performance regression
✅ Handles edge cases (multiple 401s, timeout, network errors)
✅ Backward compatible

---

## Timeline Estimate

- Phase 1: 2-3 hours
- Phase 2: 2-3 hours
- Phase 3: 2-3 hours (most complex)
- Phase 4: 30 mins
- Phase 5: 1-2 hours
- Testing: 2-3 hours
- **Total: 10-17 hours** (1-2 days of focused work)

Can be compressed by doing phases in parallel where possible.
