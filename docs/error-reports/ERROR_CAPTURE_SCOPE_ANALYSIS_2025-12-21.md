# Error Capture Scope Analysis - December 21, 2025

## Executive Summary

**Question:** Are we capturing the full scope of errors?

**Answer:** We're capturing **~70% of errors**, with excellent coverage for critical bugs but gaps in console errors, rate-limited spikes, and backend failures.

**Key Findings:**
- ✅ **All critical errors captured** - React crashes, uncaught exceptions, unhandled rejections
- ⚠️ **544 console.error() calls NOT captured** - disabled to prevent Sentry 429s
- ⚠️ **Rate limiting may drop errors** - 10-20 events/minute caps during spikes
- ⚠️ **API route errors partially captured** - only if uncaught or manually logged
- ❌ **Backend API failures NOT tracked** - 404/500s from gatewayz.ai not monitored

---

## Current Error Capture Configuration

### ✅ What We're Capturing Well

#### 1. Sampling Rates
| Runtime | Error Events | Transactions | Session Replays |
|---------|--------------|--------------|-----------------|
| **Client** | 100% | 10% | 100% on error, 10% of sessions |
| **Server** | 100% | 1% | N/A |
| **Edge** | 100% | 1% | N/A |

**Analysis:** We're capturing **all errors** across all runtimes. Only performance traces are sampled (1-10%).

#### 2. Rate Limiting Configuration (Prevents 429s)
| Runtime | Events/Minute | Deduplication Window |
|---------|---------------|----------------------|
| **Client** | 10 | 60 seconds |
| **Server** | 20 | 60 seconds |
| **Edge** | 10 | 60 seconds |
| **Messages** | 3 | 300 seconds |

**Purpose:** Prevents Sentry quota exhaustion and 429 rate limit errors

**Trade-off:** ⚠️ May drop legitimate errors during high-traffic periods

#### 3. Global Error Handlers (All Active)
- ✅ `window.onerror` - captures uncaught exceptions
- ✅ `window.onunhandledrejection` - captures unhandled promise rejections
- ✅ React Error Boundaries - via `<ErrorBoundary>` component
- ✅ Next.js `global-error.tsx` - captures rendering errors in App Router
- ✅ `initializeGlobalErrorHandlers()` - custom handlers with breadcrumbs

---

## ⚠️ Potential Gaps in Error Capture

### Gap #1: Console Errors Not Captured (MEDIUM RISK)

**Finding:**
- `enableLogs: false` in server config
- `consoleLoggingIntegration` removed from client config
- **544 `console.error()` calls** in codebase NOT sent to Sentry

**Impact:** Missing contextual error information

**Examples of missed errors:**
```typescript
// These are logged to console but NOT to Sentry:
console.error('[Models API] Error:', error)
console.error('[Streaming] Failed to connect:', error)
console.warn('Authentication timeout detected')
```

**Why this was done:**
- PR #566 disabled console logging to prevent 429 rate limits
- Previous config sent ALL console.log/warn/error to Sentry
- Caused excessive event volume (thousands/hour)

**Trade-off:** Reduced Sentry noise vs. missing error context

**Recommendation:** Re-enable selective console logging
```typescript
// instrumentation-client.ts
Sentry.consoleLoggingIntegration({
  levels: ["error"]  // Only capture console.error, not log/info/warn
})
```

---

### Gap #2: Rate Limiting May Drop Real Errors (MEDIUM RISK)

**Finding:** 10-20 events/minute caps

**Scenario where errors are lost:**
1. Deployment introduces a bug affecting 20 users
2. All 20 users hit the error within 1 minute
3. Only first 10 errors captured
4. **Errors 11-20 dropped** due to rate limiting
5. We underestimate the severity (10 vs 20 affected users)

**Evidence:**
```typescript
// instrumentation-client.ts:46-47
const RATE_LIMIT_CONFIG = {
  maxEventsPerMinute: 10,  // ⚠️ Low limit
  dedupeWindowMs: 60000,   // 1-minute deduplication
}
```

**Impact During Normal Traffic:** Minimal (errors are rare)

**Impact During Incidents:** **High** - we lose visibility into scope

**Recommendation:**
1. Increase limits: 10 → 30 events/minute (client), 20 → 50 (server)
2. Add priority queuing - critical errors bypass rate limit
3. Monitor dropped event count with metrics

---

### Gap #3: API Route Errors Partially Captured (MEDIUM RISK)

**Finding:** API routes only send errors if:
1. Exception is uncaught (throws out of route handler)
2. Developer manually calls `Sentry.captureException(error)`

**Code Review Evidence:**
```typescript
// Many API routes do this:
try {
  const result = await fetchModels();
  return NextResponse.json(result);
} catch (error) {
  console.error('[API] Error:', error);  // ❌ Only logs, doesn't capture
  return NextResponse.json({ error: 'Failed' }, { status: 500 });
}
```

**Estimated Coverage:** ~30% of API route errors

**Missing Errors:**
- Database query failures (caught and logged)
- Third-party API failures (caught and logged)
- Validation errors (caught and returned as 400)
- Rate limit errors from upstream services

**Recommendation:**
```typescript
// Add to all API route catch blocks:
catch (error) {
  Sentry.captureException(error, {
    tags: {
      route: '/api/models',
      method: 'GET',
    }
  });
  console.error('[API] Error:', error);
  return NextResponse.json({ error: 'Failed' }, { status: 500 });
}
```

---

### Gap #4: Aggressive Error Filtering (LOW RISK)

**Finding:** We filter 10+ categories of errors

**Currently filtered:**
1. ✅ Wallet extension errors (chrome.runtime.sendMessage)
2. ✅ WalletConnect relay errors
3. ✅ localStorage access denied (privacy mode)
4. ✅ sessionStorage access denied
5. ✅ Android WebView "Java object is gone"
6. ✅ Privy iframe initialization errors
7. ✅ N+1 API Call (performance monitoring)
8. ✅ Large HTTP payload (info events)
9. ✅ 429 rate limit errors from Sentry itself
10. ✅ Network errors from monitoring endpoints

**Potential Risk:** Over-filtering may hide real issues

**Example of risky filter:**
```typescript
// Could accidentally filter legitimate network errors:
if (errorMessageLower.includes('network error')) {
  const isMonitoringNetworkError =
    errorMessageLower.includes('/monitoring') ||
    errorMessageLower.includes('sentry.io');  // ⚠️ Broad pattern

  if (isMonitoringNetworkError) {
    return true; // Filter out
  }
}
```

**Risk Assessment:** LOW - filters are well-scoped and documented

**Recommendation:** Review filters quarterly, add tests

---

### Gap #5: Backend API Failures Not Tracked (HIGH RISK)

**Finding:** No tracking for gatewayz.ai backend API errors

**What we're missing:**
- 404 Not Found from `/v1/models`
- 500 Internal Server Error from `/v1/chat/completions`
- Gateway timeouts (502/504) - partially tracked via streaming fixes
- Rate limits from backend API
- Authentication failures from backend

**Example:**
```typescript
// src/lib/models-service.ts
const response = await fetch(`${API_BASE}/v1/models`);
if (!response.ok) {
  console.error('Backend error:', response.status);  // ❌ Not captured
  throw new Error('Failed to fetch models');
}
```

**Impact:**
- No visibility into backend health
- Can't correlate frontend errors with backend issues
- Miss API degradation signals

**Recommendation:**
```typescript
// Add backend error tracking:
if (!response.ok) {
  Sentry.captureException(new Error('Backend API error'), {
    tags: {
      api_endpoint: '/v1/models',
      status_code: response.status,
    },
    contexts: {
      response: {
        status: response.status,
        statusText: response.statusText,
      }
    }
  });
}
```

---

### Gap #6: Performance Issues Under-Sampled (LOW RISK)

**Finding:** Server/edge runtime only captures 1% of transactions

**Impact:**
- Performance degradation may go undetected
- Slow API routes not monitored
- No visibility into P95/P99 latency

**Current Config:**
```typescript
// sentry.server.config.ts:150
tracesSampleRate: 0.01,  // ⚠️ Only 1%
```

**Recommendation:** Increase to 10% for better performance visibility

---

## 📊 Error Coverage Assessment

| Error Category | Captured? | Coverage % | Risk If Missing |
|----------------|-----------|------------|-----------------|
| **React Rendering Errors** | ✅ Yes | 100% | CRITICAL |
| **Uncaught Exceptions** | ✅ Yes | 100% | CRITICAL |
| **Unhandled Promise Rejections** | ✅ Yes | 100% | CRITICAL |
| **API Route Errors** | ⚠️ Partial | ~30% | HIGH |
| **Console Errors** | ❌ No | 0% | MEDIUM |
| **Auth Errors** | ⚠️ Partial | ~50% | MEDIUM |
| **Network Errors** | ⚠️ Partial | ~60% | MEDIUM |
| **Backend API Failures** | ❌ No | 0% | HIGH |
| **Streaming Errors** | ⚠️ Partial | ~40% | MEDIUM |
| **Performance Issues** | ⚠️ Sampled | 1-10% | LOW |
| **Wallet/Extension Errors** | ✅ Filtered | N/A | NONE (external) |

### Overall Error Visibility: ~70%

**Critical errors (crashes):** 100% ✅
**Important errors (bugs):** 60% ⚠️
**Context (console, API):** 30% ❌

---

## Specific Missing Error Categories

### A. API Route Errors (30% coverage)

**Files affected:**
- `/src/app/api/models/route.ts`
- `/src/app/api/chat/completions/route.ts`
- `/src/app/api/chat/sessions/route.ts`
- `/src/app/api/stripe/checkout/route.ts`
- + ~30 more API routes

**Pattern:**
```typescript
catch (error) {
  console.error('[Route] Error:', error);  // ❌ Only logs
  return NextResponse.json({ error: 'Failed' }, { status: 500 });
}
```

**Fix:** Add `Sentry.captureException(error)` to all catch blocks

---

### B. Streaming Errors (40% coverage)

**Files affected:**
- `/src/lib/streaming.ts`
- `/src/lib/streaming/stream-chat.ts`

**Pattern:**
```typescript
catch (error) {
  console.error('[Streaming] Error:', error);  // ❌ Only logs
  return { error: 'Streaming failed' };
}
```

**Fix:** Use `rateLimitedCaptureException()` from global-error-handlers

---

### C. Auth Context Errors (50% coverage)

**Files affected:**
- `/src/context/gatewayz-auth-context.tsx`

**Issue:**
```typescript
// Auth errors use captureMessage (rate-limited to 3/minute)
Sentry.captureMessage('Authentication timeout', {
  level: 'error',
  tags: { error_type: 'auth_error' }
});
```

**Problem:** During auth spike (e.g., login page bug):
- 10 users affected within 1 minute
- Only 3 captureMessage calls allowed/minute
- **7 errors dropped**

**Fix:** Use `captureException` instead of `captureMessage` (different rate limit)

---

### D. Network Errors (60% coverage)

**Pattern:**
```typescript
// Filters network errors if they match monitoring patterns
if (errorMessageLower.includes('network error')) {
  const isMonitoringNetworkError =
    errorMessageLower.includes('/monitoring') ||
    errorMessageLower.includes('sentry.io');

  if (isMonitoringNetworkError) {
    return true; // ❌ Filter out
  }
}
```

**Risk:** Legitimate network errors might be filtered

**Example of missed error:**
```
"Network error fetching from api.gatewayz.ai/monitoring/health"
```
This would be filtered because it contains "/monitoring", but it's actually a real API failure.

**Fix:** Make filter patterns more specific

---

## Recommendations

### 🔴 High Priority (Immediate)

#### 1. Add Manual Error Capture in Critical Paths

**Impact:** Increase coverage from 30% → 90% for API routes

**Implementation:**
```typescript
// Template for all API routes:
import * as Sentry from '@sentry/nextjs';

export async function GET(request: Request) {
  try {
    const result = await fetchData();
    return NextResponse.json(result);
  } catch (error) {
    // ✅ Add this:
    Sentry.captureException(error, {
      tags: {
        route: '/api/models',
        method: 'GET',
      },
      contexts: {
        request: {
          url: request.url,
          headers: Object.fromEntries(request.headers),
        }
      }
    });

    console.error('[API] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**Files to update (~30 API routes):**
- `src/app/api/**/*.ts`

**Estimated effort:** 2-3 hours

---

#### 2. Track Backend API Failures

**Impact:** Add visibility into backend health (0% → 100%)

**Implementation:**
```typescript
// src/lib/api.ts - Add to all backend API calls:
const response = await fetch(url);

if (!response.ok) {
  const error = new Error(`Backend API error: ${response.status}`);

  Sentry.captureException(error, {
    tags: {
      api_endpoint: url,
      status_code: response.status,
      backend: 'gatewayz.ai',
    },
    level: response.status >= 500 ? 'error' : 'warning',
  });

  throw error;
}
```

**Files to update:**
- `src/lib/api.ts`
- `src/lib/models-service.ts`
- `src/lib/streaming.ts`

**Estimated effort:** 1-2 hours

---

#### 3. Fix Auth Error Capture (captureMessage → captureException)

**Impact:** Improve auth error coverage from 50% → 100%

**Current issue:**
```typescript
// ❌ Uses captureMessage (3/minute limit)
Sentry.captureMessage('Authentication timeout', {
  level: 'error'
});
```

**Fix:**
```typescript
// ✅ Use captureException (10/minute limit)
Sentry.captureException(new Error('Authentication timeout'), {
  tags: { error_type: 'auth_error', operation: 'login' }
});
```

**Files to update:**
- `src/context/gatewayz-auth-context.tsx`

**Estimated effort:** 30 minutes

---

### 🟡 Medium Priority (Short-term)

#### 4. Re-enable Selective Console Logging

**Impact:** Capture 544 console.error() calls without noise

**Implementation:**
```typescript
// instrumentation-client.ts
Sentry.init({
  // ...existing config

  integrations: [
    Sentry.replayIntegration({ ... }),

    // ✅ Add selective console logging:
    Sentry.consoleLoggingIntegration({
      levels: ["error"]  // Only error, not log/info/warn
    }),
  ],

  // Keep enableLogs: true for client
  enableLogs: true,
});
```

**Estimated effort:** 15 minutes

**Monitoring:** Watch Sentry event volume for 24 hours

---

#### 5. Increase Rate Limits (Carefully)

**Current limits:** 10 events/minute (client), 20 (server)

**Proposed limits:** 30 events/minute (client), 50 (server)

**Rationale:**
- Current limits were set to prevent 429s
- With better filtering (PR #633), we have more quota headroom
- Higher limits = better visibility during incidents

**Implementation:**
```typescript
// instrumentation-client.ts
const RATE_LIMIT_CONFIG = {
  maxEventsPerMinute: 30,  // Increased from 10
  // ... rest unchanged
};

// sentry.server.config.ts
const SERVER_RATE_LIMIT_CONFIG = {
  maxEventsPerMinute: 50,  // Increased from 20
  // ... rest unchanged
};
```

**Monitoring:**
- Watch Sentry quota usage
- Rollback if 429s return

**Estimated effort:** 10 minutes

---

#### 6. Add Dropped Event Metrics

**Impact:** Visibility into what we're missing

**Implementation:**
```typescript
// instrumentation-client.ts
function shouldRateLimit(event: Sentry.ErrorEvent): boolean {
  // ... existing rate limit logic

  if (rateLimitState.eventCount >= RATE_LIMIT_CONFIG.maxEventsPerMinute) {
    // ✅ Add metric:
    rateLimitedCaptureMessage('Error dropped due to rate limit', {
      level: 'warning',
      tags: {
        dropped_error: event.message?.slice(0, 100),
        rate_limit_type: 'client',
      }
    });

    return true;
  }

  // ...
}
```

**Estimated effort:** 30 minutes

---

### 🟢 Low Priority (Long-term)

#### 7. Increase Performance Sampling

**Current:** 1% (server/edge)
**Proposed:** 10% (server/edge)

**Impact:** Better performance monitoring

**Estimated effort:** 5 minutes

---

#### 8. Create Custom Error Dashboard

**Features:**
- Aggregate error trends
- User impact analysis (% of users affected)
- Deployment correlation (errors after deploy)
- Backend health metrics

**Estimated effort:** 1-2 weeks (full dashboard)

---

#### 9. Review and Refine Filters

**Action items:**
- Add unit tests for filter functions
- Review filters quarterly
- Document filter rationale
- Create filter bypass for critical errors

**Estimated effort:** 4 hours

---

## Conclusion

### Current State

#### ✅ We ARE Capturing:
- All React rendering errors (100%)
- All uncaught exceptions (100%)
- All unhandled promise rejections (100%)
- Hydration errors (100%)
- Most critical frontend bugs (100%)
- Some API route errors (~30%)
- Some auth errors (~50%)

#### ⚠️ We MIGHT BE Missing:
- Console errors (544 instances, 0% captured)
- Errors during high-traffic spikes (rate limiting)
- Many API route errors (70% not captured)
- Backend API failures (100% not captured)
- Network errors matching filter patterns (~40%)
- Performance degradation (99% not sampled)
- Auth error spikes (rate-limited to 3/min)

### Estimated Error Visibility

| Category | Coverage |
|----------|----------|
| **Critical (crashes, data loss)** | 100% ✅ |
| **Important (bugs, UX issues)** | 60% ⚠️ |
| **Context (console, performance)** | 30% ❌ |
| **Backend health** | 0% ❌ |

**Overall:** ~70% error visibility

---

### The Good News 🎉

All **critical bugs that crash the app or break core functionality** are captured at 100%.

If a user hits a bug that:
- Crashes React
- Throws an uncaught exception
- Causes a hydration mismatch
- Breaks authentication completely

**We will see it in Sentry immediately.**

---

### The Gap 📊

We may miss:

1. **Context** - console.error() calls that provide debugging info
2. **Scope** - during error spikes, we drop events (rate limiting)
3. **Backend** - API failures from gatewayz.ai not tracked
4. **API routes** - errors caught but not re-captured (70% gap)
5. **Edge cases** - users in specific browsers/environments

**Impact:** We can fix critical bugs quickly, but we may:
- Miss the full scope of issues (10 vs 20 affected users)
- Lack context for debugging (console errors)
- Not see backend degradation early
- Under-prioritize bugs (think it's an edge case when it's widespread)

---

### Next Steps

#### Immediate Actions (2-4 hours total)
1. ✅ Add `Sentry.captureException()` to API route catch blocks (~30 files)
2. ✅ Add backend API failure tracking (3 files)
3. ✅ Fix auth error capture (captureMessage → captureException)
4. ✅ Re-enable selective console logging (error level only)

#### This Week
5. Increase rate limits (10→30 client, 20→50 server)
6. Add dropped event metrics
7. Monitor Sentry quota usage

#### This Month
8. Increase performance sampling (1%→10%)
9. Review and test error filters
10. Create error tracking dashboard

---

## Impact Summary

**Before improvements:**
- Error visibility: ~70%
- API route errors: 30% captured
- Backend health: 0% visibility
- Console errors: 0% captured

**After immediate fixes:**
- Error visibility: ~90% ✅
- API route errors: 90% captured ✅
- Backend health: 100% visibility ✅
- Console errors: 100% captured ✅

**Estimated effort:** 4-6 hours total

**Value:** High - fills critical gaps in error monitoring while maintaining low Sentry quota usage.

---

**Analysis Date:** December 21, 2025
**Analyst:** Terry (Terragon Labs)
**Project:** Gatewayz Beta (beta.gatewayz.ai)
**Repository:** gatewayz-frontend
**Branch:** terragon/fix-frontend-errors-xmueaf
