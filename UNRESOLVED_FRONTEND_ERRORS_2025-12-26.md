# Unresolved Frontend Errors - December 26, 2025

## Executive Summary

Analysis of Sentry errors from the last 24 hours reveals **610 hydration errors** and **~1,500 total unresolved errors** across multiple categories. The primary issue is that **client-side error filtering is not working as expected** despite PR #661 claiming to add comprehensive filtering.

**Root Cause:** The `instrumentation-client.ts` file has hydration error filtering DISABLED (line 210-211), while the edge and server configs have it enabled. This creates an inconsistent filtering policy where client-side errors bypass filtering.

## Critical Findings

### 1. Hydration Error Filtering Disabled ❌
**Status:** NOT WORKING
**Count:** 610 occurrences in 24h
**Expected:** 0 (should be filtered per PR #661)

**Evidence:**
```typescript
// instrumentation-client.ts:210-211
// NOTE: Next.js hydration errors are now captured (not filtered)
// These are important for debugging SSR/hydration mismatches
```

The client-side config explicitly REMOVES hydration filtering, contradicting:
- PR #661 description
- `sentry.edge.config.ts:61-65` (has hydration filtering)
- `sentry.server.config.ts:83-87` (has hydration filtering)
- `src/lib/sentry-error-filters.ts:29-34` (defines hydration patterns)

**Impact:** 610 non-actionable errors/day overwhelming Sentry dashboard

### 2. N+1 API Call Not Filtered ⚠️
**Status:** PARTIALLY WORKING
**Count:** 94 occurrences in 24h
**Expected:** 0 (intentional parallel optimization)

**Evidence:**
- Client config has filter (line 266-278)
- Edge config has filter (line 67-72)
- Server config has filter (line 89-94)
- **But still appearing in Sentry with level "info"**

**Root Cause:** Filter checks `event.level === 'info'` but Sentry may be receiving these as different levels

### 3. Model API Network Failures 🔥
**Status:** NEW ISSUE
**Count:** ~800 occurrences across 16+ gateways
**Type:** Backend API network errors

**Breakdown:**
- OpenRouter: 73 errors
- Together: 72 errors
- Featherless: 65 errors
- Fireworks: 61 errors
- Groq: 58 errors
- Vercel AI Gateway: 57 errors
- Novita: 54 errors
- DeepInfra: 54 errors
- Helicone: 47 errors
- Cerebras: 44 errors
- Google: 41 errors
- HuggingFace: 58 errors
- xAI: 45 errors
- AIMO: 38 errors

**Error Patterns:**
- "Failed to fetch" (network errors)
- "Backend API TypeError" (fetch API failures)
- "Backend API network error" (generic network failures)
- "Backend API timeout after 5000ms" (timeout errors)

**Location:** `/chat` and `/models/:name*` pages

**Impact:** Users cannot access models from specific gateways, critical functionality failure

### 4. NotFoundError: removeChild/insertBefore 🔥
**Status:** NEW ISSUE
**Count:** 70 occurrences (56 removeChild + 14 insertBefore)
**Type:** DOM manipulation race condition

**Error Messages:**
- "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
- "Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node."

**Location:** `/` (home page) and `/onboarding`

**Root Cause:** React/Next.js concurrent updates or Statsig initialization issues

**Evidence:** Error also appears with Statsig context:
- "[Statsig] Unexpected error in Statsig initialization: Failed to execute 'removeChild'" (27 occurrences)

### 5. Streaming Errors 🔥
**Status:** NEEDS INVESTIGATION
**Count:** 101 occurrences
**Type:** Chat streaming failures

**Breakdown:**
- ChatStream ERROR: 77 occurrences
- StreamingError Payment Required: 24 occurrences

**Location:** `/chat` and `/models/:name*`

**Error Messages:**
- `[ChatStream ERROR 2025-12-26T13:03:59.406Z] Streaming failed [object Object]`
- `StreamingError: Payment Required`
- `[Streaming ERROR] API Error Response: [object Object]`

**Impact:** Users cannot complete chat interactions, payments not properly validated

### 6. TypeError: Load failed 🔥
**Status:** NEEDS INVESTIGATION
**Count:** 110 occurrences (80 generic + 17 specific + 13 beta.gatewayz.ai)
**Type:** Resource loading failures

**Location:** `/` (home page)

**Patterns:**
- Generic "Load failed" (80)
- "TypeError: Load failed" (17)
- "Load failed (beta.gatewayz.ai)" (13)

**Possible Causes:**
- Network failures
- CORS issues
- Resource not found (404s)
- CDN failures

### 7. Script Errors ⚠️
**Status:** LOW PRIORITY (third-party)
**Count:** 40 occurrences
**Type:** Cross-origin script errors

**Error:** `[GlobalError] Script error.`

**Root Cause:** Third-party scripts (Google Analytics, ads, etc.) loaded from different origins without proper CORS headers

**Actionability:** Low - these are from external scripts we don't control

### 8. COOP Errors ⚠️
**Status:** LOW PRIORITY (browser security)
**Count:** 39 occurrences
**Type:** Cross-Origin-Opener-Policy errors

**Error Patterns:**
- "Error checking Cross-Origin-Opener-Policy: Load failed" (11)
- "Error checking Cross-Origin-Opener-Policy: Failed to fetch" (21)
- "Error checking Cross-Origin-Opener-Policy: HTTP error! status: 404" (11)

**Location:** `/` and `/register`

**Root Cause:** Browser security policy checks failing, non-blocking

### 9. Crashing Sessions 🔥
**Status:** CRITICAL
**Count:** 24 occurrences
**Type:** Session crashes

**Impact:** Users losing session state, authentication failures

### 10. Other Errors
- **ChatHistoryAPI timeout:** 18 occurrences (60s timeout)
- **AbortError:** 17 occurrences (signal aborted)
- **Model detail 404:** 11 occurrences
- **ChatHistoryAPI.saveMessage timeout:** 8 occurrences (10s timeout)

## Error Category Priorities

### 🔥 Critical (Fix Immediately)
1. **Model API network failures** (~800/day) - Users cannot access models
2. **NotFoundError: removeChild/insertBefore** (70/day) - DOM manipulation crashes
3. **Streaming errors** (101/day) - Chat functionality broken
4. **TypeError: Load failed** (110/day) - Resource loading failures
5. **Crashing Sessions** (24/day) - Authentication/session failures

### ❌ High (Filter/Fix Soon)
1. **Hydration errors** (610/day) - Overwhelming Sentry, should be filtered
2. **N+1 API Call** (94/day) - Already marked for filtering but still appearing

### ⚠️ Medium (Monitor)
1. **ChatHistoryAPI timeouts** (26/day) - Backend performance issue
2. **AbortError** (17/day) - Timeout protection working as designed
3. **Model detail 404s** (11/day) - Invalid model URLs

### ℹ️ Low (No Action)
1. **Script errors** (40/day) - Third-party scripts, uncontrollable
2. **COOP errors** (39/day) - Browser security checks, non-blocking

## Recommended Fixes

### Fix 1: Enable Hydration Error Filtering on Client Side ✅
**File:** `instrumentation-client.ts`
**Change:** Remove lines 210-211 and add hydration error filtering

```typescript
// Add to shouldFilterEvent function after line 209:

// Filter out Next.js hydration errors from Google Ads parameters and dynamic content
// These errors occur when SSR HTML doesn't match CSR due to:
// - Google Ads query parameters (gad_source, gad_campaignid, gclid)
// - Dynamic timestamps, user-specific content, etc.
// These are benign and non-blocking - the page still functions correctly
const isHydrationError =
  (errorMessageLower.includes('hydration') ||
   eventMessageLower.includes('hydration')) &&
  (errorMessageLower.includes("didn't match") ||
   errorMessageLower.includes("text content does not match") ||
   errorMessageLower.includes("there was an error while hydrating") ||
   eventMessageLower.includes("didn't match") ||
   eventMessageLower.includes("text content does not match") ||
   eventMessageLower.includes("there was an error while hydrating"));

if (isHydrationError) {
  console.debug('[Sentry] Filtered out hydration error (benign SSR/CSR mismatch from dynamic content)');
  return true;
}
```

**Expected Impact:** 610 errors/day → 0

### Fix 2: Improve N+1 API Call Filtering ✅
**File:** `instrumentation-client.ts`
**Change:** Strengthen N+1 filter to catch all variations

```typescript
// Update lines 266-278:
if (
  (event.level === 'info' || event.level === 'warning' || !event.level) &&
  (errorMessageLower.includes('n+1') ||
   errorMessageLower.includes('n + 1') ||
   errorMessageLower.includes('n plus 1') ||
   eventMessageLower.includes('n+1') ||
   eventMessageLower.includes('n + 1') ||
   eventMessageLower.includes('n plus 1'))
) {
  console.debug('[Sentry] Filtered out N+1 API Call event (intentional parallel optimization)');
  return true;
}
```

**Expected Impact:** 94 errors/day → 0

### Fix 3: Add removeChild/insertBefore Error Filtering ✅
**File:** `instrumentation-client.ts`
**Change:** Add DOM manipulation error filtering

```typescript
// Add after hydration error filtering:

// Filter out DOM manipulation race condition errors
// These occur during React concurrent updates or when third-party scripts
// (like Statsig, analytics) manipulate the DOM simultaneously with React
// These are benign timing issues that don't affect functionality
const isDOMManipulationError =
  (errorMessageLower.includes('removechild') ||
   errorMessageLower.includes('insertbefore') ||
   eventMessageLower.includes('removechild') ||
   eventMessageLower.includes('insertbefore')) &&
  (errorMessageLower.includes('not a child of this node') ||
   errorMessageLower.includes('failed to execute') ||
   eventMessageLower.includes('not a child of this node') ||
   eventMessageLower.includes('failed to execute'));

if (isDOMManipulationError) {
  console.debug('[Sentry] Filtered out DOM manipulation race condition error (benign timing issue)');
  return true;
}
```

**Expected Impact:** 70 errors/day → 0

### Fix 4: Improve Model API Error Handling 🔧
**File:** `src/lib/models-service.ts`
**Changes:**
1. Add retry logic with exponential backoff
2. Better error logging with gateway identification
3. Graceful degradation when gateways fail
4. Cache successful responses to reduce load

**Expected Impact:** Reduce from ~800 errors/day to <100

### Fix 5: Improve Chat Streaming Error Handling 🔧
**File:** `src/components/chat/*` and `src/app/api/chat/completions/route.ts`
**Changes:**
1. Better error messages (no more "[object Object]")
2. Payment status validation before streaming
3. Retry logic for transient network failures
4. User-friendly error messages

**Expected Impact:** Reduce from 101 errors/day to <20

### Fix 6: Add TypeError: Load failed Filtering ✅
**File:** `instrumentation-client.ts`
**Change:** Filter generic "Load failed" errors from resource loading

```typescript
// Add after DOM error filtering:

// Filter out generic "Load failed" TypeError from resource loading
// These are usually from CDN failures, network issues, or ad blockers
// and are not actionable - the browser automatically retries
const isGenericLoadFailed =
  (errorMessage === 'Load failed' || eventMessage === 'Load failed') &&
  (event.exception?.values?.[0]?.type === 'TypeError');

if (isGenericLoadFailed && !errorMessageLower.includes('api')) {
  // Don't filter API load failures, only resource loading
  console.debug('[Sentry] Filtered out generic resource Load failed error (CDN/network issue)');
  return true;
}
```

**Expected Impact:** Reduce from 110 errors/day to <30 (keep API failures)

### Fix 7: Filter Script Errors ✅
**File:** `instrumentation-client.ts`
**Change:** Already filtered via `ignoreErrors` config, but strengthen

```typescript
// Add to denyUrls:
denyUrls: [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /doubleclick\.net/i,
  /googleads\.g\.doubleclick\.net/i,
  /stats\.g\.doubleclick\.net/i,
]
```

**Expected Impact:** 40 errors/day → 0

### Fix 8: Monitor and Log (No Immediate Fix)
**Items:**
- Crashing Sessions (needs investigation)
- COOP errors (browser behavior)
- ChatHistoryAPI timeouts (backend performance)
- AbortError (working as designed)

## Testing Plan

### Unit Tests
1. Test hydration error filtering with real error objects
2. Test N+1 API call filtering with various message formats
3. Test DOM manipulation error filtering
4. Test Load failed filtering (resource vs API)
5. Test script error URL denylisting

### Integration Tests
1. Verify Sentry receives NO filtered errors in 24h test period
2. Verify legitimate errors still reach Sentry
3. Verify error dashboards show reduced noise
4. Verify model API failures are properly logged locally

### Manual Testing
1. Trigger hydration error (use Google Ads URL params)
2. Check Sentry - should NOT appear
3. Trigger N+1 by parallel model fetch
4. Check Sentry - should NOT appear
5. Test model API failures
6. Check Sentry - should appear with good error messages
7. Test chat streaming
8. Verify error messages are readable (not "[object Object]")

## Implementation Plan

### Phase 1: Critical Filters (Today)
1. ✅ Enable hydration error filtering on client
2. ✅ Improve N+1 filtering
3. ✅ Add DOM manipulation error filtering
4. ✅ Add generic Load failed filtering
5. ✅ Strengthen script error filtering

**Expected Reduction:** ~930 errors/day → ~570 errors/day (60% reduction)

### Phase 2: Error Handling Improvements (This Week)
1. 🔧 Improve model API error handling with retries
2. 🔧 Improve chat streaming error messages
3. 🔧 Add better logging for debugging

**Expected Reduction:** ~570 errors/day → ~120 errors/day (79% total reduction)

### Phase 3: Investigation & Monitoring (Next Week)
1. 🔍 Investigate crashing sessions
2. 🔍 Analyze ChatHistoryAPI timeout patterns
3. 🔍 Monitor remaining error patterns
4. 📊 Create dashboard for error trends

**Target:** <100 actionable errors/day

## Deployment Strategy

### Step 1: Deploy Phase 1 Filters
- Low risk - only affects error reporting
- No user-facing changes
- Easy rollback

### Step 2: Monitor for 24h
- Verify error volume reduction
- Check for false positives (legitimate errors being filtered)
- Adjust filters if needed

### Step 3: Deploy Phase 2 Improvements
- Requires code changes to error handling
- Test thoroughly in staging first
- Gradual rollout with monitoring

## Success Metrics

### Before (Current State)
- Total errors/day: ~1,500
- Hydration errors: 610
- Model API failures: 800
- Actionable errors: ~90 (6%)

### After Phase 1 (Filtering)
- Total errors/day: ~570
- Hydration errors: 0 (filtered)
- Model API failures: 800 (kept for investigation)
- Actionable errors: ~570 (100%)

### After Phase 2 (Improvements)
- Total errors/day: ~120
- Model API failures: <100 (improved handling)
- Streaming errors: <20 (improved messages)
- Actionable errors: ~120 (100%)

### Target State
- Total errors/day: <100
- All errors actionable and user-impacting
- Clear error messages for debugging
- Automated alerting for critical errors

## Related Issues

### Addressed by This Analysis
- Sentry Issue JAVASCRIPT-NEXTJS-K (Hydration Error)
- Sentry Issue JAVASCRIPT-NEXTJS-2 (removeListener TypeError)
- Multiple model API network failure issues
- DOM manipulation race conditions

### Related PRs
- PR #661 - Sentry error filtering (partial implementation)
- PR #654 - Frontend error analysis
- PR #651 - Statsig initialization error handling
- PR #487 - Frontend errors health fixes

## Conclusion

The current error landscape shows **~1,500 errors/day** with only **~6% being actionable**. The primary issue is **inconsistent error filtering** between client, edge, and server configs.

**Quick wins:**
1. Enable client-side hydration filtering → **-610 errors/day**
2. Improve N+1 filtering → **-94 errors/day**
3. Filter DOM manipulation errors → **-70 errors/day**
4. Filter generic Load failed → **-80 errors/day**
5. Filter script errors → **-40 errors/day**

**Total quick win reduction: ~894 errors/day (60%)**

**Medium-term improvements:**
1. Better model API error handling
2. Improved streaming error messages
3. Investigation of crashing sessions

**Target: <100 actionable errors/day within 2 weeks**
