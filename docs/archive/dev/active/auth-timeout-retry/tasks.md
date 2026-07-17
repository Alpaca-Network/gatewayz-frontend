# Authentication Timeout Fix - Task Checklist

## Phase 1: Fix Authenticating Timeout Guard

### Task 1.1: Update AUTHENTICATING_TIMEOUT_MS Constant
- **File**: `src/context/gatewayz-auth-context.tsx` (line 47)
- **Change**: 30000ms → 60000ms
- **Reason**: Account for full retry chain + safety margin
- **Status**: ⏳ Pending

### Task 1.2: Add Logging to setAuthTimeout Function
- **File**: `src/context/gatewayz-auth-context.tsx` (line 228-242)
- **Changes**:
  - Log when guard timeout is triggered
  - Include context (retry count, time elapsed)
  - Log guard cancellation on success
- **Status**: ⏳ Pending

### Task 1.3: Update MIN_AUTH_SYNC_TIMEOUT_MS Calculation
- **File**: `src/context/gatewayz-auth-context.tsx` (line 77-78)
- **Changes**:
  - Update calculation to account for 2 retries (not 3)
  - Add comments explaining the math
  - Should equal: ~55000ms (15s × 3 + ~1.5s backoff)
- **Status**: ⏳ Pending

---

## Phase 2: Align Retry Configuration

### Task 2.1: Update MAX_AUTH_RETRIES Constant
- **File**: `src/context/gatewayz-auth-context.tsx` (line 46)
- **Change**: 3 → 2
- **Reason**: Standardize across layers, faster failure feedback
- **Status**: ⏳ Pending

### Task 2.2: Update Context Layer Retry Configuration
- **File**: `src/context/gatewayz-auth-context.tsx` (line 733)
- **Change**: Update maxRetries from 3 → 2 (or reference MAX_AUTH_RETRIES)
- **Status**: ⏳ Pending

### Task 2.3: Update API Proxy Retry Configuration
- **File**: `src/app/api/auth/route.ts` (line 36)
- **Change**: maxRetries: 3 → 2
- **Reason**: Match context layer, reduce total retry time
- **Status**: ⏳ Pending

---

## Phase 3: Improve Logging & Observability

### Task 3.1: Add Retry Logging to API Proxy
- **File**: `src/app/api/auth/route.ts` (around line 24-42)
- **Changes**:
  - Log when retries start
  - Log each retry attempt
  - Log success/failure with retry count
- **Status**: ⏳ Pending

### Task 3.2: Enhance Context Layer Logging
- **File**: `src/context/gatewayz-auth-context.tsx`
- **Changes**:
  - Log calculated timeout values at start of sync
  - Log retry count when incrementing
  - Log decision points (already has good logging)
- **Status**: ⏳ Pending

### Task 3.3: Improve Error Messages with Retry Context
- **File**: `src/context/gatewayz-auth-context.tsx`
- **Changes**:
  - Include current retry count in error messages
  - Include timeout values used
- **Status**: ⏳ Pending

---

## Phase 4: Validate & Test

### Task 4.1: Verify Timeout Calculations Make Sense
- **File**: `src/context/gatewayz-auth-context.tsx` (lines 47, 74-78, 710-738)
- **Validation**:
  - AUTHENTICATING_TIMEOUT_MS = 60000ms ✓
  - MIN_AUTH_SYNC_TIMEOUT_MS ≥ API timeout × retries + backoff
  - Adaptive timeout multipliers are reasonable
- **Status**: ⏳ Pending

### Task 4.2: Verify Retry Counts Are Consistent
- **Files**:
  - `src/context/gatewayz-auth-context.tsx` (line 46 & 733)
  - `src/app/api/auth/route.ts` (line 36)
- **Validation**:
  - All three places specify maxRetries: 2
  - Total attempts: 1 initial + 2 retries = 3 ✓
- **Status**: ⏳ Pending

### Task 4.3: Test with Simulated Network Throttling
- **How**: Use browser DevTools or network simulation
- **Test Cases**:
  - Slow 3G (5.9Mbps down, 1.6Mbps up)
  - Simulate transient 504 errors
  - Verify auth completes within 60 seconds
- **Status**: ⏳ Pending

### Task 4.4: Verify Fast Networks Unaffected
- **How**: Test on fast connection
- **Expected**: Auth completes in <10 seconds (no retries needed)
- **Status**: ⏳ Pending

### Task 4.5: Check Retry Logs in Browser Console
- **Expected Output**:
  ```
  [Auth] Sync attempt 1/2
  [Auth] State transition: idle -> authenticating
  [retry] Retrying after 504 error (attempt 1/2, delay: Xms)
  [Auth] Sync attempt 2/2
  [retry] Retrying after 504 error (attempt 2/2, delay: Yms)
  [Auth] Backend authentication successful
  ```
- **Status**: ⏳ Pending

---

## Phase 5: Build & Verify

### Task 5.1: Run TypeScript Compiler
- **Command**: `pnpm typecheck`
- **Expected**: No errors
- **Status**: ⏳ Pending

### Task 5.2: Run Linter
- **Command**: `pnpm lint`
- **Expected**: No errors or warnings
- **Status**: ⏳ Pending

### Task 5.3: Build Project
- **Command**: `pnpm build`
- **Expected**: Build succeeds
- **Status**: ⏳ Pending

### Task 5.4: Verify No New Warnings
- **Check**: Build output for deprecation warnings
- **Expected**: No new warnings introduced
- **Status**: ⏳ Pending

---

## Summary

**Total Tasks**: 13
**Phases**: 5
**Estimated Time**: 60-90 minutes

**Implementation Order**:
1. Complete Phase 1 (timeout constant fix)
2. Complete Phase 2 (retry alignment)
3. Complete Phase 3 (logging improvements)
4. Complete Phase 4 (validation)
5. Complete Phase 5 (build & verify)

**Dependencies**:
- No external dependencies
- Changes are isolated to auth module
- Backward compatible

**Rollback Plan**:
- Revert to previous AUTHENTICATING_TIMEOUT_MS = 30000
- Revert retry counts to 3
- Revert log changes (optional)
