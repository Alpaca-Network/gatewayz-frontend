# Sentry Error Capture Expansion - Implementation Summary

## Overview

Successfully expanded Sentry error capture coverage across the Gatewayz Beta application with a comprehensive utilities library, enhanced custom hooks, and instrumented API routes.

## 🎯 What Was Accomplished

### 1. **Created Comprehensive Sentry Utilities Library** ✅
**File:** `src/lib/sentry-utils.ts` (800+ lines)

A production-ready error capture utility library with:

#### Core Features
- **Error Tagging Constants** - Standardized categories and operations
  - 10 error types (API, hook, component, service, auth, payment, network, storage, validation, integration)
  - 15+ operation types (init, fetch, render, sync, etc.)

- **Hook Error Wrapper** - `captureHookError()`
  - Automatically tags errors with hook name and operation
  - Includes custom context

- **Component Error Wrapper** - `wrapComponentError()`
  - For event handlers and component functions
  - Catch and report with component context

- **Service Error Wrapper** - `wrapServiceError()`
  - For service functions (sync & async)
  - Automatic promise error handling

- **Async Error Wrapper** - `withAsyncErrorCapture()`
  - Timeout support
  - Automatic retry tracking with breadcrumbs
  - Exhausted retry detection

- **Span Wrapper** - `withSpanError()`
  - Performance tracking with error capture
  - Attribute setting for metrics
  - Status management

- **Breadcrumb Helpers**
  - `addAsyncBreadcrumb()` - For async operations
  - `addUserActionBreadcrumb()` - For user interactions
  - `addStateChangeBreadcrumb()` - For state mutations

- **Context Setters**
  - `setUserContext()` - Set user tracking
  - `clearUserContext()` - Clear on logout
  - `setCustomContext()` - Custom context
  - `setErrorTag()` - Custom tags

- **API Error Helpers**
  - `captureApiError()` - API-specific error capture
  - `withFetchErrorCapture()` - Fetch wrapper

- **Silent Error Capture**
  - `captureErrorSilently()` - Non-critical errors
  - `withSilentErrorCapture()` - With fallback values

### 2. **Enhanced All Critical Custom Hooks** ✅
Enhanced 4 critical hooks with error capture and context tracking:

#### `src/hooks/use-auth.ts`
- Error capture for Privy initialization
- Automatic user context setting/clearing
- Tag: `hook_name: 'useAuth'`, operation: `'privy_initialization'`

#### `src/hooks/use-tier.ts`
- Error capture around tier utility calculations
- Comprehensive try-catch wrapper
- Tag: `hook_name: 'useTier'`, operation: `'tier_utils_calculation'`

#### `src/hooks/useModelData.ts`
- Error boundaries around all useMemo computations
- Breadcrumb tracking for state changes
- Graceful fallback data on errors
- Tag: `hook_name: 'useModelData'`, specific operation for each memo

#### `src/hooks/use-toast.ts`
- Comprehensive error handling in:
  - Reducer function
  - Dispatch function
  - Individual listener callbacks
  - Update/dismiss operations
- Error isolation (one error doesn't affect others)
- Graceful fallback for toast creation
- Tag: `hook_name: 'useToast'`, operation per function

### 3. **Instrumented Critical API Routes** ✅
Added comprehensive Sentry span tracking to 4 critical routes:

#### `src/app/api/user/me/route.ts` (GET)
- Span wrapper with performance tracking
- Attributes: backend_status, response_size, error_type
- Auth error detection
- Response tracking

#### `src/app/api/user/activity/stats/route.ts` (GET)
- Span tracking with date parameters
- Attributes: date_from, date_to, backend_status, data_size
- Query parameter validation
- Error categorization

#### `src/app/api/chat/sessions/route.ts` (GET & POST)
- GET endpoint:
  - Query parameters (limit, offset) tracking
  - Sessions count attribute
  - Backend status monitoring

- POST endpoint:
  - Model and title tracking
  - Session ID attribute
  - Backend error detection
  - Creation metrics

### 4. **Created Comprehensive Documentation** ✅

#### `SENTRY_EXPANSION_GUIDE.md` (400+ lines)
Complete implementation guide including:
- Overview of all utilities
- Usage patterns and code examples
- Tagging schema reference
- Implementation priorities
- Configuration instructions
- Testing guide
- Best practices
- Troubleshooting
- Next steps for expansion

## 📊 Coverage Expansion

### Before
- **Files with Sentry**: 16 files
- **Primary Coverage**: API routes (8+), model sync service
- **Hook Coverage**: None
- **Component Coverage**: None

### After
- **Files with Sentry**: 20+ files
- **Hook Coverage**: 4 critical hooks (use-auth, use-tier, useModelData, use-toast)
- **API Route Coverage**: 4+ routes with comprehensive span tracking
- **Utilities**: 15+ helper functions for consistent error capture
- **Documentation**: 2 comprehensive guides

### Improvement
- **25% increase** in files with Sentry integration
- **100% coverage** of critical custom hooks
- **Standardized error handling** across layers
- **Consistent tagging schema** across all errors

## 🎨 Key Features

### Standardized Error Tagging
```javascript
// All errors automatically tagged with:
{
  error_type: 'category',      // api_error, hook_error, etc.
  operation: 'specific_op',    // fetch, init, render, etc.
  level: 'error|warning|info'  // Severity
}
```

### Automatic Context Tracking
```javascript
// Hooks automatically track:
- Hook name
- Operation type
- Custom context fields

// Components automatically track:
- Component name
- Event type
- Component context

// Services automatically track:
- Service name
- Operation
- Async status
```

### Breadcrumb Trail for Debugging
```javascript
// Automatic breadcrumbs for:
- User actions
- State changes
- Async operations
- Retry attempts
```

### Performance Metrics
```javascript
// Automatically tracked:
- Operation duration
- Response sizes
- Retry attempts
- Backend status codes
```

## 📁 Files Modified/Created

### New Files
1. `src/lib/sentry-utils.ts` - Utilities library (800+ lines)
2. `SENTRY_EXPANSION_GUIDE.md` - Implementation guide (400+ lines)
3. `SENTRY_EXPANSION_SUMMARY.md` - This summary

### Modified Files
1. `src/hooks/use-auth.ts` - Added error capture + user context
2. `src/hooks/use-tier.ts` - Added error capture
3. `src/hooks/useModelData.ts` - Added error capture + breadcrumbs
4. `src/hooks/use-toast.ts` - Added comprehensive error handling
5. `src/app/api/user/me/route.ts` - Added span tracking
6. `src/app/api/user/activity/stats/route.ts` - Added span tracking
7. `src/app/api/chat/sessions/route.ts` - Added span tracking

### Existing Files (Unchanged but Compatible)
- `src/app/api/middleware/error-handler.ts` - Already captures errors
- `sentry.server.config.ts` - Already configured
- `sentry.edge.config.ts` - Already configured
- `instrumentation.ts` - Already integrated

## 🚀 Implementation Patterns

### Pattern 1: Hook with Error Capture
```typescript
import { captureHookError } from '@/lib/sentry-utils';

export function useCustomData() {
  try {
    // ... hook logic ...
  } catch (error) {
    captureHookError(error, {
      hookName: 'useCustomData',
      operation: 'custom_operation'
    });
    throw error;
  }
}
```

### Pattern 2: Component Event Handler
```typescript
import { wrapComponentError } from '@/lib/sentry-utils';

const handleClick = wrapComponentError(
  () => { /* handler logic */ },
  { componentName: 'MyComponent', operation: 'handleClick' }
);
```

### Pattern 3: Service Function
```typescript
import { wrapServiceError } from '@/lib/sentry-utils';

export const myService = {
  fetchData: wrapServiceError(
    async () => { /* service logic */ },
    { serviceName: 'MyService', operation: 'fetchData' }
  )
};
```

### Pattern 4: API Route with Span
```typescript
import * as Sentry from '@sentry/nextjs';

export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/endpoint' },
    async (span) => {
      try {
        span.setAttribute('param', value);
        // ... operation ...
        span.setStatus('ok');
        return NextResponse.json(data);
      } catch (error) {
        span.setStatus('error');
        return handleApiError(error, 'Endpoint Name');
      }
    }
  );
}
```

## 📈 Next Steps (Recommendations)

### Priority 1: Component Error Boundaries (High Impact)
```typescript
Files to enhance:
- src/components/chat/ChatWindow.tsx
- src/components/chat/MessageList.tsx
- src/components/chat/ModelSelector.tsx
- src/components/models/ModelGrid.tsx
- src/components/models/ModelSearch.tsx
```

### Priority 2: Service Layer Instrumentation (Medium Impact)
```typescript
Files to wrap:
- src/lib/api.ts - All API client methods
- src/lib/chat-history.ts - Session/message operations
- src/lib/models-service.ts - Model fetching
- src/lib/stripe.ts - Payment operations
- src/lib/analytics.ts - Event tracking
```

### Priority 3: More API Routes (Medium Impact)
```typescript
Routes to enhance:
- src/app/api/user/api-keys/* - API key management
- src/app/api/chat/completions/* - Chat completion
- src/app/api/payments/* - Payment processing
- src/app/api/stripe/* - Stripe webhooks
```

## ✅ Quality Assurance

### Code Quality
- ✅ Full TypeScript support with proper types
- ✅ Comprehensive JSDoc comments
- ✅ Error handling patterns documented
- ✅ No breaking changes to existing code
- ✅ Backward compatible

### Testing
- ✅ Tested with existing `/api/sentry-test` endpoint
- ✅ Compatible with Sentry SDK 7.x
- ✅ Works with existing Session Replay
- ✅ Compatible with Privy error filtering

### Documentation
- ✅ Comprehensive implementation guide
- ✅ Usage patterns with examples
- ✅ Best practices documented
- ✅ Troubleshooting guide included

## 🔍 Error Categories Now Tracked

### 1. Hook Errors
- Privy auth initialization
- Tier utility calculations
- Model data processing
- Toast management

### 2. Component Errors
- Event handler failures
- Component rendering errors
- State update errors

### 3. API Errors
- Authentication failures
- Backend communication errors
- Data parsing errors
- Response validation errors

### 4. Service Errors
- API client failures
- Chat history operations
- Model fetching
- Stripe operations

### 5. Network Errors
- Timeouts
- Connection failures
- Retry exhaustion

### 6. Data Errors
- Validation failures
- Serialization errors
- Type mismatches

## 📊 Metrics You Can Track

### In Sentry Dashboard
1. **Error Volume** - Errors per hour/day
2. **Error Rate** - % of requests with errors
3. **Error Distribution** - By type, operation, route
4. **Most Affected Routes** - Which endpoints fail most
5. **User Impact** - % of sessions with errors

### Key Metrics to Monitor
- Hook errors frequency
- API route error rates
- Component error patterns
- Service error rates
- Network timeout frequency

## 🎓 Learning Resources

### In This Repository
1. `SENTRY_EXPANSION_GUIDE.md` - Complete implementation guide
2. `src/lib/sentry-utils.ts` - Source code with detailed comments
3. `src/components/examples/sentry-example-component.tsx` - Component example
4. `src/app/api/sentry-test/route.ts` - Test endpoint

### External Resources
- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Error Reporting](https://docs.sentry.io/product/error-monitoring/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)

## 🏁 Summary

This expansion of Sentry error capture provides:

1. **Comprehensive Utilities** - 15+ helper functions for consistent error capture
2. **Enhanced Hooks** - Full error tracking in 4 critical custom hooks
3. **Instrumented Routes** - Span tracking with metrics in 4 API routes
4. **Standardized Tagging** - Consistent categorization across all errors
5. **Automatic Context** - User and component context automatically tracked
6. **Complete Documentation** - Guides and examples for further implementation

The foundation is now in place for complete error monitoring across the application. Additional components and services can be instrumented following the documented patterns.

## 📝 Implementation Checklist

- [x] Create sentry-utils.ts with helper functions
- [x] Document error tagging schema
- [x] Enhance use-auth.ts with error capture
- [x] Enhance use-tier.ts with error capture
- [x] Enhance useModelData.ts with error capture
- [x] Enhance use-toast.ts with error capture
- [x] Add span tracking to /api/user/me
- [x] Add span tracking to /api/user/activity/stats
- [x] Add span tracking to /api/chat/sessions (GET & POST)
- [x] Create comprehensive implementation guide
- [x] Create examples and patterns documentation
- [ ] Instrument critical chat components (Next Phase)
- [ ] Instrument service layer (Next Phase)
- [ ] Add more API route tracking (Next Phase)

## 🤝 Support & Questions

For implementation questions:
1. Review `SENTRY_EXPANSION_GUIDE.md`
2. Check examples in modified hook files
3. Reference pattern examples in guide
4. Test with `/api/sentry-test` endpoint

---

**Status:** ✅ Phase 1 Complete
**Date:** 2025-11-23
**Impact:** 25% increase in Sentry integration coverage
