# Error Monitoring Guide - Gatewayz Beta

## Overview

This guide provides comprehensive information on error monitoring, handling, and debugging in the Gatewayz Beta application.

## Table of Contents

1. [Error Handling Architecture](#error-handling-architecture)
2. [Sentry Integration](#sentry-integration)
3. [Error Boundaries](#error-boundaries)
4. [Global Error Handlers](#global-error-handlers)
5. [Error Classification](#error-classification)
6. [Monitoring Best Practices](#monitoring-best-practices)
7. [Troubleshooting Common Errors](#troubleshooting-common-errors)
8. [Performance Considerations](#performance-considerations)

---

## Error Handling Architecture

### Multi-Layer Error Handling

```
┌─────────────────────────────────────────┐
│   Global Error Handlers                 │  ← Catches unhandled rejections
│   (window.onerror, unhandledrejection)  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Global Error Boundary                 │  ← Root-level React errors
│   (GlobalErrorBoundary)                 │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Feature Error Boundaries              │  ← Feature-specific errors
│   (ChatErrorBoundary, etc.)             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Component Error Wrappers              │  ← Component-level errors
│   (captureComponentError)               │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Try-Catch Blocks                      │  ← Function-level errors
│   (API calls, async operations)        │
└─────────────────────────────────────────┘
```

All errors ultimately flow to **Sentry** for aggregation and analysis.

---

## Sentry Integration

### Configuration

**Location:** `instrumentation-client.ts`

**Key Features:**
- Release tracking via git commit SHA
- Session replay on errors (100% sampling)
- Console logging integration
- Error filtering for noise reduction
- Global error handler integration

### Error Filtering

The following errors are **automatically filtered** to reduce noise:

1. **Wallet Extension Errors**
   - `chrome.runtime.sendMessage` from Privy wallet provider
   - `removeListener` from wallet extensions (MetaMask, Phantom, etc.)
   - Originates from `inpage.js` or `app:///`

2. **External Script Errors**
   - Errors from third-party domains (ads, analytics)
   - Filtered in global error handler

### Sentry Tags

All errors are tagged with:

| Tag | Description | Example Values |
|-----|-------------|----------------|
| `error_type` | Category of error | `auth_error`, `api_error`, `component_error` |
| `operation` | What was being attempted | `auth_login`, `api_fetch`, `chat_send` |
| `component_name` | Component where error occurred | `ChatInterface`, `ModelSelector` |
| `api_route` | API endpoint that failed | `/api/auth`, `/api/chat/completions` |
| `level` | Severity level | `info`, `warning`, `error`, `fatal` |

---

## Error Boundaries

### 1. Global Error Boundary

**Location:** `src/components/error/global-error-boundary.tsx`

**Purpose:** Catch all uncaught React errors at the root level

**Features:**
- Full-page fallback UI
- Sentry error reporting with event ID
- Recovery options (retry, go home, refresh)
- User feedback dialog integration
- Development error details

**Usage:**
```tsx
import { GlobalErrorBoundary } from '@/components/error/global-error-boundary';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <GlobalErrorBoundary>
          {children}
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
```

---

### 2. Chat Error Boundary

**Location:** `src/components/error/chat-error-boundary.tsx`

**Purpose:** Catch errors specific to the chat interface

**Features:**
- Contextual error UI
- Retry functionality
- Integration with chat recovery logic

**Usage:**
```tsx
import { ChatErrorBoundary } from '@/components/error/chat-error-boundary';

<ChatErrorBoundary
  onError={(error) => console.error('Chat error:', error)}
  onReset={() => resetChatState()}
>
  <ChatInterface />
</ChatErrorBoundary>
```

---

### 3. Creating Custom Error Boundaries

**Template:**
```tsx
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { captureComponentError } from '@/lib/sentry-utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CustomErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureComponentError(error, {
      componentName: 'CustomErrorBoundary',
      operation: 'render',
      componentStack: errorInfo.componentStack,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong</div>;
    }
    return this.props.children;
  }
}
```

---

## Global Error Handlers

**Location:** `src/lib/global-error-handlers.ts`

### Initialization

Global error handlers are automatically initialized in `instrumentation-client.ts`:

```typescript
import { initializeGlobalErrorHandlers } from './src/lib/global-error-handlers';

// After Sentry.init()
if (typeof window !== 'undefined') {
  initializeGlobalErrorHandlers();
}
```

### Captured Error Types

1. **Unhandled Promise Rejections**
   ```javascript
   // This will be caught and reported to Sentry
   async function badFunction() {
     throw new Error('Unhandled error');
   }
   badFunction(); // No .catch()
   ```

2. **Global Errors (window.onerror)**
   ```javascript
   // This will be caught
   undefined.doSomething(); // ReferenceError
   ```

3. **Resource Loading Errors**
   ```html
   <!-- Failed script/stylesheet loads -->
   <script src="/nonexistent.js"></script>
   <link rel="stylesheet" href="/missing.css">
   ```

---

## Error Classification

### Error Types

#### 1. Authentication Errors (`auth_error`)

**Common Operations:**
- `auth_login` - Login failures
- `auth_logout` - Logout failures
- `auth_sync` - Sync failures
- `auth_timeout` - Timeout during auth
- `api_key_upgrade_failure` - Failed to upgrade temp key

**Example:**
```typescript
import { captureAuthError } from '@/lib/sentry-utils';

try {
  await authenticateUser();
} catch (error) {
  captureAuthError(error, {
    operation: 'auth_login',
    method: 'email',
  });
}
```

---

#### 2. API Errors (`api_error`)

**Common Operations:**
- `api_fetch` - API request failures
- `api_parse` - Response parsing errors
- `api_timeout` - Request timeout

**Example:**
```typescript
import { captureApiError } from '@/lib/sentry-utils';

try {
  const response = await fetch('/api/models');
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
} catch (error) {
  captureApiError(error, {
    endpoint: '/api/models',
    method: 'GET',
    statusCode: response?.status,
  });
}
```

---

#### 3. Component Errors (`component_error`)

**Common Operations:**
- `component_render` - Render errors
- `component_mount` - Mount errors
- `component_event` - Event handler errors

**Example:**
```typescript
import { wrapComponentError } from '@/lib/sentry-utils';

const handleClick = wrapComponentError(
  () => {
    // Your click handler logic
  },
  {
    componentName: 'MyComponent',
    operation: 'component_event',
  }
);
```

---

#### 4. Service Errors (`service_error`)

**Common Operations:**
- `service_call` - Service function failures
- `service_init` - Initialization errors
- `service_sync` - Sync failures

**Example:**
```typescript
import { wrapServiceError } from '@/lib/sentry-utils';

const fetchModels = wrapServiceError(
  async () => {
    // Fetch logic
  },
  {
    serviceName: 'ModelService',
    operation: 'service_call',
  }
);
```

---

#### 5. Hook Errors (`hook_error`)

**Common Operations:**
- `hook_init` - Hook initialization
- `hook_state_update` - State update errors
- `hook_fetch` - Data fetching errors

**Example:**
```typescript
import { captureHookError } from '@/lib/sentry-utils';

function useCustomHook() {
  try {
    // Hook logic
  } catch (error) {
    captureHookError(error, {
      hookName: 'useCustomHook',
      operation: 'hook_init',
    });
  }
}
```

---

## Monitoring Best Practices

### 1. Sentry Dashboard Setup

**Recommended Views:**

#### Critical Errors View
```
is:unresolved level:error OR level:fatal
environment:production
```

#### Authentication Issues
```
error_type:auth_error is:unresolved
```

#### API Failures
```
error_type:api_error status_code:[500 TO 599]
```

#### High-Impact Errors
```
is:unresolved userCount:>10
```

---

### 2. Alert Configuration

**Recommended Alerts:**

| Alert | Condition | Action |
|-------|-----------|--------|
| Critical Auth Errors | `error_type:auth_error` > 100/hour | Slack notification to on-call |
| Payment Failures | `error_type:payment_error` > 5/hour | Email to billing team |
| High Error Rate | Error rate > 5% | Page on-call engineer |
| New Error Types | New error appears | Slack notification to dev team |

---

### 3. Weekly Review Process

**Monday Morning Review:**

1. **Top Errors by Frequency**
   - Sort by event count
   - Identify patterns
   - Prioritize fixes

2. **Top Errors by User Impact**
   - Sort by user count
   - Assess business impact
   - Create tickets

3. **Trend Analysis**
   - Compare week-over-week
   - Identify growing issues
   - Check deployment correlation

4. **Environment Comparison**
   - Compare production vs staging
   - Identify environment-specific issues

---

### 4. Error Prioritization Matrix

| Severity | User Impact | Frequency | Priority | SLA |
|----------|-------------|-----------|----------|-----|
| Fatal | High (>100 users) | High (>1000/day) | P0 | 1 hour |
| Error | High (>100 users) | Medium (>100/day) | P1 | 24 hours |
| Error | Medium (10-100) | High (>1000/day) | P1 | 24 hours |
| Error | Low (<10) | Medium (>100/day) | P2 | 1 week |
| Warning | Any | Any | P3 | 2 weeks |

---

## Troubleshooting Common Errors

### 1. "Authentication timeout - stuck in authenticating state"

**Location:** `src/context/gatewayz-auth-context.tsx:236`

**Symptoms:**
- User stuck on login screen
- Authentication spinner never stops
- No error message shown

**Root Causes:**
- Backend API slow/down
- Network connectivity issues
- Privy authentication failure

**Resolution Steps:**
1. Check backend API health: `curl https://api.gatewayz.ai/health`
2. Check Privy status: https://status.privy.io/
3. Review Sentry for related errors
4. Increase timeout if network is slow
5. Add user-facing error message

**Fix Applied:** ✅ Auth timeout increased to 60 seconds with graceful fallback

---

### 2. "Temporary API key could not be upgraded"

**Location:** `src/context/gatewayz-auth-context.tsx:521`

**Symptoms:**
- User authenticates successfully
- App shows authenticated state
- API calls fail with 401

**Root Causes:**
- Backend upgrade endpoint failure
- Race condition in auth flow
- Session timing issue

**Resolution Steps:**
1. Check if user has valid temp key in localStorage
2. Check backend logs for upgrade failures
3. Review Sentry for auth_sync errors
4. Retry authentication

**Fix Applied:** ✅ Now logs warnings instead of errors, continues with cached credentials

---

### 3. Hydration Errors

**Location:** Various pages (e.g., `src/app/page.tsx`)

**Symptoms:**
- React hydration error in console
- Content flickers on page load
- Warning: "Text content did not match"

**Root Causes:**
- Server renders different content than client
- localStorage/window access during SSR
- Date/time differences

**Resolution Steps:**
1. Add `isClient` state guard
2. Use `useEffect` for client-only logic
3. Ensure consistent rendering

**Fix Applied:** ✅ Client-side guards added to home page and API key display

**Pattern:**
```typescript
const [isClient, setIsClient] = useState(false);

useEffect(() => {
  setIsClient(true);
}, []);

return (
  <div>
    {isClient ? <ClientContent /> : <ServerContent />}
  </div>
);
```

---

### 4. Wallet Extension Errors

**Symptoms:**
- Sentry flooded with wallet errors
- `chrome.runtime.sendMessage` errors
- `removeListener` errors

**Root Causes:**
- Privy wallet detection
- Wallet extension cleanup
- Normal browser extension behavior

**Resolution Steps:**
1. These are expected and non-blocking
2. Ensure Sentry filter is active
3. No action needed

**Fix Applied:** ✅ Sentry filters added in `instrumentation-client.ts:56-90`

---

## Performance Considerations

### Sentry Quota Management

**Current Settings (Development):**
```typescript
tracesSampleRate: 1.0,           // 100% transaction sampling
replaysSessionSampleRate: 0.1,   // 10% session replays
replaysOnErrorSampleRate: 1.0,   // 100% error replays
```

**Recommended Production Settings:**
```typescript
tracesSampleRate: 0.1,           // 10% transaction sampling
replaysSessionSampleRate: 0.05,  // 5% session replays
replaysOnErrorSampleRate: 1.0,   // 100% error replays (keep this)
```

**Estimated Impact:**
- Reduces Sentry quota usage by ~80%
- Maintains 100% error capture
- Reduces performance overhead
- Still provides sufficient data for analysis

---

### Error Filtering Impact

**Before Filtering:**
- ~1000 errors/day from wallet extensions
- 30-40% of total errors
- High noise, low signal

**After Filtering:**
- Wallet errors filtered out
- Focus on actionable errors
- Improved signal-to-noise ratio

---

## Development Tools

### Testing Error Boundaries

```typescript
// Test component
function ErrorTrigger() {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error('Test error');
  }

  return <button onClick={() => setShouldError(true)}>Trigger Error</button>;
}

// Wrap in error boundary
<ChatErrorBoundary>
  <ErrorTrigger />
</ChatErrorBoundary>
```

---

### Testing Global Handlers

```typescript
// Test unhandled rejection
Promise.reject(new Error('Test unhandled rejection'));

// Test global error
setTimeout(() => {
  throw new Error('Test global error');
}, 100);
```

---

### Local Sentry Testing

1. **Set up environment:**
   ```bash
   NEXT_PUBLIC_SENTRY_DSN=your-dsn
   ```

2. **Trigger test error:**
   ```typescript
   import * as Sentry from '@sentry/nextjs';

   Sentry.captureException(new Error('Test error'));
   ```

3. **Check Sentry dashboard:**
   - Navigate to Issues
   - Verify error appears
   - Check tags and context

---

## Additional Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Error Handling Best Practices](https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react)

---

## Support

For questions or issues:
- **Slack:** #engineering channel
- **Email:** dev@gatewayz.ai
- **Sentry Dashboard:** [Your Sentry URL]

---

**Last Updated:** December 1, 2025
**Maintained By:** Engineering Team
