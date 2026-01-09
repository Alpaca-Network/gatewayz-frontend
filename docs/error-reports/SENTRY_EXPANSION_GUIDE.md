# Sentry Error Capture Expansion Guide

## Overview

This document outlines the comprehensive expansion of Sentry error capture across the Gatewayz Beta application. The implementation includes utilities, patterns, and best practices for consistent error tracking across all layers of the application.

## What's Been Added

### 1. **Sentry Utilities Library** (`src/lib/sentry-utils.ts`)

A comprehensive set of error capture helpers and wrappers:

#### Error Tagging Constants
- `ERROR_TAGS` - Standardized error categories (API_ERROR, HOOK_ERROR, COMPONENT_ERROR, etc.)
- `ERROR_OPERATIONS` - Standardized operation types (HOOK_INIT, COMPONENT_RENDER, API_FETCH, etc.)

#### Hook Error Wrapper
```typescript
captureHookError(error, {
  hookName: 'useCustomData',
  operation: 'data_fetch',
});
```
Use when hooks throw errors to automatically tag them with hook context.

#### Component Error Wrapper
```typescript
const handleClick = wrapComponentError(
  () => { /* handler logic */ },
  { componentName: 'MyButton', operation: 'onClick' }
);
```
Use for component event handlers and functions to catch and report errors with component context.

#### Service Error Wrapper
```typescript
const fetchData = wrapServiceError(
  async () => { /* service logic */ },
  { serviceName: 'DataService', operation: 'fetchData' }
);
```
Use for service functions to catch both sync and async errors.

#### Async Error Wrapper with Retry
```typescript
const result = await withAsyncErrorCapture(
  async () => { return await fetch('/api/data'); },
  {
    operationName: 'fetchData',
    timeout: 5000,
    retries: 3
  }
);
```
Wraps async operations with timeout and automatic retry tracking.

#### Span Wrapper for Performance
```typescript
const result = await withSpanError(
  async (span) => {
    span.setAttribute('user_id', userId);
    const data = await fetchData(userId);
    span.setAttribute('data_size', data.length);
    return data;
  },
  { operationName: 'fetchUserData' }
);
```
Tracks performance metrics and errors together.

#### Breadcrumb Helpers
```typescript
// Track async operations
addAsyncBreadcrumb('Fetching user data', { userId: 123 });

// Track user actions
addUserActionBreadcrumb('Clicked submit button', { formId: 'contact' });

// Track state changes
addStateChangeBreadcrumb('Dashboard', 'selectedTab', 'analytics');
```

#### Context Setters
```typescript
// Set user context for error tracking
setUserContext(userId, userEmail);

// Clear on logout
clearUserContext();

// Add custom context
setCustomContext('subscription', { tier: 'pro', status: 'active' });

// Set tags for categorization
setErrorTag('environment', 'production');
```

#### API Error Helpers
```typescript
// Capture API errors with endpoint context
captureApiError(error, {
  endpoint: '/api/users',
  method: 'POST',
  statusCode: 500
});

// Wrap fetch requests with error capture
const data = await withFetchErrorCapture(
  () => fetch('/api/data'),
  { endpoint: '/api/data', method: 'GET' }
);
```

#### Silent Error Capture
```typescript
// For non-critical background operations
captureErrorSilently(error, { operation: 'background_sync' });

// Or with a fallback value
const result = withSilentErrorCapture(
  () => JSON.parse(data),
  { operation: 'parse_json' },
  {} // fallback value
);
```

### 2. **Custom Hooks Enhanced**

All critical custom hooks now include error capture:

#### `use-auth.ts`
- Captures Privy authentication initialization errors
- Automatically sets/clears user context based on auth state
- Tags: `hook_name: 'useAuth'`, `operation: 'privy_initialization'`

#### `use-tier.ts`
- Captures tier utility calculation errors
- Includes try-catch around all tier-related computations
- Tags: `hook_name: 'useTier'`, `operation: 'tier_utils_calculation'`

#### `useModelData.ts`
- Wrapped all useMemo calculations with error boundaries
- Tracks state changes with breadcrumbs
- Includes fallback data on errors
- Tags: `hook_name: 'useModelData'`, specific operation for each memo

#### `use-toast.ts`
- Comprehensive error handling in reducer, dispatch, and listener functions
- Graceful fallback for toast creation on error
- Error isolation so one toast error doesn't affect others
- Tags: `hook_name: 'useToast'`, `operation: reducer|dispatch|update|dismiss`

### 3. **API Routes Enhanced**

Critical API routes now include Sentry span tracking:

#### Enhanced Routes
- `GET /api/user/me` - User profile fetching
- `GET /api/user/activity/stats` - Activity statistics
- `GET /api/chat/sessions` - List chat sessions
- `POST /api/chat/sessions` - Create chat sessions

#### Span Attributes Added
Each route tracks:
- Request parameters (with sanitization)
- Backend response status
- Error types and messages
- Response data size
- Query parameters
- Model/resource information

Example:
```typescript
return Sentry.startSpan(
  { op: 'http.server', name: 'GET /api/chat/sessions' },
  async (span) => {
    try {
      // ... operation logic ...
      span.setAttribute('sessions_count', data.length);
      span.setStatus('ok');
      return NextResponse.json(data);
    } catch (error) {
      span.setStatus('error');
      return handleApiError(error, 'Chat Sessions API - GET');
    }
  }
);
```

## Implementation Patterns

### Pattern 1: Hook with Error Capture
```typescript
import { captureHookError } from '@/lib/sentry-utils';

export function useCustomData() {
  try {
    const [data, setData] = useState(null);
    useEffect(() => {
      // ... hook logic ...
    }, []);
    return data;
  } catch (error) {
    captureHookError(error, {
      hookName: 'useCustomData',
      operation: 'custom_operation',
      customField: 'value'
    });
    throw error;
  }
}
```

### Pattern 2: Component Event Handler
```typescript
import { wrapComponentError } from '@/lib/sentry-utils';

export function MyComponent() {
  const handleClick = wrapComponentError(
    async () => {
      // ... event logic ...
    },
    { componentName: 'MyComponent', operation: 'handleClick' }
  );

  return <button onClick={handleClick}>Click me</button>;
}
```

### Pattern 3: Service Function
```typescript
import { wrapServiceError } from '@/lib/sentry-utils';

export const myService = {
  fetchData: wrapServiceError(
    async (id) => {
      // ... fetch logic ...
    },
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
        span.setAttribute('error', true);
        return handleApiError(error, 'Endpoint Name');
      }
    }
  );
}
```

### Pattern 5: Async Operation with Retry
```typescript
import { withAsyncErrorCapture } from '@/lib/sentry-utils';

const result = await withAsyncErrorCapture(
  async () => {
    return await externalApiCall();
  },
  {
    operationName: 'externalApiCall',
    timeout: 5000,
    retries: 2
  }
);
```

## Tagging Schema

### Standard Tags (Applied Automatically)

All errors include:
- `error_type` - Category of error (api_error, hook_error, etc.)
- `operation` - Specific operation that failed
- `level` - Severity level (error, warning, info)

### API Errors
```javascript
{
  error_type: 'api_error',
  endpoint: '/api/users',
  method: 'POST',
  status_code: '500'
}
```

### Hook Errors
```javascript
{
  error_type: 'hook_error',
  hook_name: 'useAuth',
  operation: 'privy_initialization'
}
```

### Component Errors
```javascript
{
  error_type: 'component_error',
  component_name: 'MyComponent',
  operation: 'handleClick'
}
```

### Service Errors
```javascript
{
  error_type: 'service_error',
  service_name: 'ModelsService',
  operation: 'fetchModels'
}
```

## Next Steps for Expansion

### Priority 1: Critical Components (High Impact)
1. **Chat Components**
   - `ChatWindow` - Main chat interface
   - `MessageList` - Message rendering
   - `ModelSelector` - Model selection logic
   - `MessageInput` - Input handling

2. **Models Components**
   - `ModelGrid` - Model grid rendering
   - `ModelSearch` - Search functionality
   - `ModelFilter` - Filter logic

3. **Settings Components**
   - `SettingsLayout` - Settings page structure
   - Account settings operations
   - Payment/subscription settings

### Priority 2: Service Layer (Medium Impact)
1. **API Layer** (`src/lib/api.ts`)
   - Wrap all API client methods
   - Track request/response times
   - Capture network errors

2. **Chat History** (`src/lib/chat-history.ts`)
   - Session management operations
   - Message history operations
   - Persistence errors

3. **Models Service** (`src/lib/models-service.ts`)
   - Gateway fetching errors
   - Model deduplication errors
   - Caching errors

4. **Stripe Integration** (`src/lib/stripe.ts`)
   - Payment initialization errors
   - Checkout session errors
   - Subscription update errors

5. **Analytics** (`src/lib/analytics.ts`)
   - Event tracking errors
   - Event batching errors
   - Analytics service errors

### Priority 3: User Interactions & Navigation (Lower Impact)
1. Form submission error tracking
2. Modal/dialog error boundaries
3. Navigation error handling
4. Search operation error tracking

### Priority 4: Third-Party Integrations
1. **Privy Integration**
   - Login/logout failures
   - Wallet connection failures
   - Account linking errors

2. **Model Gateways**
   - Provider-specific error handling
   - Gateway selection errors
   - Rate limit tracking

## Configuration

### Environment Variables
Ensure your Sentry DSN is configured:
```bash
NEXT_PUBLIC_SENTRY_DSN=https://[key]@sentry.io/[project]
```

### Sentry Dashboard
After implementation, watch these metrics:
- Error rate by error type (hook, component, API, service)
- Error distribution by operation
- Most affected routes and components
- User impact (sessions with errors)

## Testing

### Using the Sentry Test Endpoint
Test your error capture:
```bash
# Test all types
curl http://localhost:3000/api/sentry-test?type=all

# Test specific type
curl http://localhost:3000/api/sentry-test?type=logging
curl http://localhost:3000/api/sentry-test?type=spans
curl http://localhost:3000/api/sentry-test?type=error
curl http://localhost:3000/api/sentry-test?type=nested
curl http://localhost:3000/api/sentry-test?type=template
```

### Manual Testing
```typescript
import { captureHookError, wrapComponentError } from '@/lib/sentry-utils';

// Test hook error
captureHookError(new Error('Test hook error'), {
  hookName: 'testHook',
  operation: 'test'
});

// Test component error
const handler = wrapComponentError(
  () => { throw new Error('Test component error'); },
  { componentName: 'TestComponent', operation: 'test' }
);
```

## Best Practices

### 1. Always Include Context
```typescript
// ❌ Bad - No context
captureException(error);

// ✅ Good - Includes context
captureHookError(error, {
  hookName: 'useAuth',
  operation: 'login',
  userId: user?.id
});
```

### 2. Use Appropriate Wrappers
```typescript
// ❌ Bad - Using hook wrapper for service
wrapComponentError(serviceFunction, { componentName: 'Service' });

// ✅ Good - Using service wrapper
wrapServiceError(serviceFunction, { serviceName: 'MyService' });
```

### 3. Sanitize Sensitive Data
```typescript
// ❌ Bad - Including sensitive data
captureHookError(error, {
  hookName: 'useAuth',
  password: user.password  // ❌ Never include passwords
});

// ✅ Good - Only non-sensitive context
captureHookError(error, {
  hookName: 'useAuth',
  userId: user.id,
  email: user.email
});
```

### 4. Use Breadcrumbs for User Actions
```typescript
// ❌ Bad - No context for debugging
try {
  await submitForm(data);
} catch (error) {
  captureException(error);
}

// ✅ Good - Breadcrumb trail
addUserActionBreadcrumb('Form submission started', { formId: 'contact' });
try {
  await submitForm(data);
} catch (error) {
  captureException(error);  // Has breadcrumb context
}
```

### 5. Set User Context Early
```typescript
// In auth hook or context provider
if (authenticated && user?.id) {
  setUserContext(user.id, user.email);
  setCustomContext('subscription', {
    tier: userTier,
    status: subscriptionStatus
  });
}
```

## Monitoring & Metrics

### Key Metrics to Track
1. **Error Volume** - Total errors per hour/day
2. **Error Rate** - % of sessions with errors
3. **Error Distribution** - By type, operation, route
4. **Performance Impact** - Errors vs no-error operations
5. **User Impact** - % of users affected by errors

### Alerts to Set Up
1. Error rate > 5% of requests
2. New error patterns emerging
3. Specific critical routes failing (chat, auth)
4. High error severity in production

## Troubleshooting

### Errors Not Appearing in Sentry
1. Verify `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. Check browser console for Sentry initialization messages
3. Ensure error is not filtered by `beforeSend` hook
4. Verify Privy error filtering isn't blocking legitimate errors

### Too Much Noise
1. Review Privy wallet extension error filtering
2. Adjust `repaysSessionSampleRate` if needed
3. Implement better error categorization with tags
4. Consider ignoring known benign errors

### Performance Impact
1. Session replay may impact performance
2. Consider adjusting `replaysSessionSampleRate` from 0.1 to 0.05
3. Verify source maps upload isn't slowing down build

## Related Documentation

- **SENTRY_EXPANSION_GUIDE.md** - This file
- **src/lib/sentry-utils.ts** - Comprehensive utilities and examples
- **src/components/examples/sentry-example-component.tsx** - Component example
- **src/app/api/sentry-test/route.ts** - Test endpoint
- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

## Summary of Changes

| Layer | Changes | Files |
|-------|---------|-------|
| **Utilities** | New sentry-utils library with 15+ helper functions | src/lib/sentry-utils.ts |
| **Hooks** | Error capture in 4 critical hooks | use-auth.ts, use-tier.ts, useModelData.ts, use-toast.ts |
| **API Routes** | Span tracking added to 4+ routes | user/*, chat/sessions/* |
| **Documentation** | This comprehensive guide | SENTRY_EXPANSION_GUIDE.md |

## Questions & Support

For questions about implementing Sentry error capture:
1. Review examples in `src/components/examples/sentry-example-component.tsx`
2. Check existing implementations in updated hooks
3. Test with `/api/sentry-test` endpoint
4. Review Sentry SDK documentation
