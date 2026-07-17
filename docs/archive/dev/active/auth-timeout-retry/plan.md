# Authentication Timeout & Retry Optimization Plan

## Problem Statement

The authentication flow times out with 504 Gateway Timeout errors. The current retry logic has a fundamental mismatch:

- **API Route timeout**: 15 seconds (backend auth call)
- **Backend proxy retries**: 3 retries with exponential backoff
- **Backoff delays**: ~500ms + 1s + 2s = ~3.5 seconds between attempts
- **Total possible time**: ~60 seconds (15s × 3 retries + 3.5s backoff)
- **Authenticating state guard timeout**: 30 seconds (fires before retries complete)

**Root Cause**: The 30-second guard timeout fires before the retry mechanism completes, transitioning auth to "error" state prematurely.

## Current Architecture

### Three-Layer Authentication Flow
1. **Frontend (Privy)**: Multi-provider authentication (Email, Google, GitHub, Wallet)
2. **Next.js API Proxy** (`/api/auth`): Acts as proxy with 3x retries on 502/503/504
3. **Backend API**: Validates user and generates API key

### Key Timeout Points
- Token retrieval: 5-10 seconds (adaptive)
- Backend sync: 10-25 seconds (adaptive to network)
- Authenticating guard: 30 seconds (hardcoded)
- API proxy: 15 seconds per attempt

### Retry Configuration
- **Retries at API layer**: 3 max retries on 502/503/504
- **Retries at context layer**: 2 max retries on 502/503/504
- **Exponential backoff**: 500ms → 1s → 2s (with jitter)

## Issues to Fix

### Issue 1: Authenticating Timeout Fires Too Early
- **File**: `src/context/gatewayz-auth-context.tsx:228-242`
- **Problem**: 30-second timeout doesn't account for retries
- **Impact**: Auth fails prematurely on slow networks

### Issue 2: Timeout Configuration Mismatch
- **File**: `src/context/gatewayz-auth-context.tsx:710-738`
- **Problem**: MIN_AUTH_SYNC_TIMEOUT_MS calculation doesn't match actual retry timing
- **Impact**: Network-adaptive timeout can be less than actual request time

### Issue 3: Retry Count Mismatch
- **File**: `src/context/gatewayz-auth-context.tsx:732-738` vs `src/app/api/auth/route.ts:36-41`
- **Problem**: Frontend retries 2x, but API proxy retries 3x (inconsistent)
- **Impact**: Confusing behavior, hard to debug

### Issue 4: Minimal Logging During Retry Chain
- **Problem**: Can't tell if retries are happening at API layer vs frontend layer
- **Impact**: Difficult to debug timeout issues

## Implementation Phases

### Phase 1: Fix Authenticating Timeout Guard
**Goal**: Make timeout proportional to actual request time needed

**Changes**:
1. Calculate expected auth time: `(15s × maxRetries) + backoff delays`
2. Add safety margin for network jitter: +5s
3. Set authenticating timeout to accommodate full retry chain
4. Add logging when timeout is triggered

**Files to modify**:
- `src/context/gatewayz-auth-context.tsx` (lines 47, 228-242, 710-738)

**Expected outcome**: Timeout guard will fire only if retries genuinely fail to complete

---

### Phase 2: Align Retry Configuration
**Goal**: Make retry counts consistent across layers

**Changes**:
1. Standardize on 2 retries at both API and context layers
2. Reason: 1 initial attempt + 2 retries = 3 total attempts (sufficient for transient errors)
3. Reduces total retry time from ~60s to ~40s
4. Faster failure feedback to user

**Files to modify**:
- `src/app/api/auth/route.ts` (line 36)
- `src/context/gatewayz-auth-context.tsx` (line 46, 733)

**Expected outcome**: Consistent retry behavior, faster completion

---

### Phase 3: Improve Logging & Observability
**Goal**: Make it clear what's happening during auth

**Changes**:
1. Log when API proxy retries trigger
2. Log calculated timeout values
3. Log at key decision points (timeout guard set, success, failure)
4. Include retry count and attempt in error messages

**Files to modify**:
- `src/app/api/auth/route.ts` (add retry logging)
- `src/context/gatewayz-auth-context.tsx` (enhance existing logging)

**Expected outcome**: Clear audit trail for debugging timeout issues

---

### Phase 4: Validate Network-Aware Timeouts
**Goal**: Verify adaptive timeout calculation works correctly

**Files to check**:
- `src/lib/network-timeouts.ts`
- Ensure multipliers make sense for actual network speeds

---

## Detailed Fix Strategy

### Fix for Authenticating Timeout

**Current code** (line 47, 228-242):
```typescript
const AUTHENTICATING_TIMEOUT_MS = 30000; // 30 seconds (too short!)
```

**New approach**:
```typescript
// Calculate timeout based on actual retry chain:
// - 1 initial attempt: 15s
// - Retry 1: 15s + 500ms backoff
// - Retry 2: 15s + 1500ms backoff
// Total: ~45-50s
// + 10s safety margin for network jitter
// = 55-60s

const AUTHENTICATING_TIMEOUT_MS = 60000; // 60 seconds (for 2 retries + margin)
```

### Fix for Retry Count Alignment

**Current**:
- API proxy: `maxRetries: 3` (line 36 in auth/route.ts)
- Context: `maxRetries: 2` (line 733 in context)

**New**:
- Both layers: `maxRetries: 2` (1 initial + 2 retries = 3 total attempts)

### Fix for Timeout Calculation

**Current** (line 77-78):
```typescript
const MIN_AUTH_SYNC_TIMEOUT_MS =
  BACKEND_PROXY_TIMEOUT_MS * BACKEND_PROXY_MAX_RETRIES + BACKEND_PROXY_SAFETY_BUFFER_MS;
// = 15000 * 3 + 5000 = 50000ms
```

**New** (after reducing retries to 2):
```typescript
// With 2 retries (1 initial + 2 retries):
// - 15s per attempt × 3 attempts = 45s
// - Backoff delays: ~500ms + 1s = ~1.5s
// - Safety buffer: 5s
// Total: ~51.5s, round up to 55s
const MIN_AUTH_SYNC_TIMEOUT_MS = 55000;
```

## Testing Strategy

1. **Timeout Test**: Verify auth completes within 60 seconds on slow networks
2. **Retry Test**: Verify 2 retries occur on transient errors (502/503/504)
3. **Logging Test**: Verify logs show clear retry progression
4. **Mobile Test**: Verify adaptive timeouts work on 2G/3G networks

## Risk Assessment

**Low Risk**: Changes are isolated to timeout values and logging
- No business logic changes
- No data model changes
- Backward compatible

**Potential Issues**:
- Users on extremely slow networks may still timeout
- Solution: Can further increase timeout if needed based on monitoring

## Success Criteria

✅ Auth completes successfully within 60 seconds on slow networks
✅ Retry logs show clear progression: "attempt 1/3" → "attempt 2/3" → "attempt 3/3"
✅ No premature timeout errors on transient 504s
✅ Consistent retry behavior across all layers

## Files Modified

1. `src/context/gatewayz-auth-context.tsx`
   - Update AUTHENTICATING_TIMEOUT_MS from 30s → 60s
   - Update MAX_AUTH_RETRIES from 3 → 2 (if aligning)
   - Update MIN_AUTH_SYNC_TIMEOUT_MS calculation
   - Enhance logging in timeout guard

2. `src/app/api/auth/route.ts`
   - Update maxRetries from 3 → 2 (if aligning)
   - Add logging for retry attempts

## Timeline

- Phase 1 (Fix timeout): 15 minutes
- Phase 2 (Align retries): 10 minutes
- Phase 3 (Improve logging): 10 minutes
- Phase 4 (Validate): 5 minutes
- Testing: 10 minutes

**Total**: ~50 minutes

## Deployment Considerations

1. Monitor error rates after deployment
2. Watch for timeout errors in Sentry
3. Check authentication success rates
4. Verify no increase in slow auth times for fast networks
