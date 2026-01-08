# Analytics Error Handling Implementation

## Overview

Comprehensive error handling has been added for analytics requests that are blocked by ad blockers and browser extensions. The system now gracefully degrades when network issues or security tools prevent analytics initialization and event logging.

## Changes Made

### 1. Enhanced Statsig Provider (`src/components/providers/statsig-provider.tsx`)

**Improvements:**
- Better error boundary with error categorization (network vs. initialization errors)
- Sets global flag `window.statsigAvailable` to track analytics availability
- Increased initialization timeout from 1s to 2s to reduce false positives
- Cleaner error logging that distinguishes between blocked requests and actual errors
- Always renders children regardless of analytics errors (analytics never blocks UI)

**Key Features:**
- Error boundary catches and handles Statsig initialization failures
- Detects network/ad blocker errors with pattern matching
- Sets `window.statsigAvailable = false` when analytics is blocked
- Sets `window.statsigAvailable = true` only when fully initialized

### 2. Enhanced Analytics Service (`src/lib/analytics.ts`)

**New Features:**
- `isAnalyticsAvailable()` function to check if analytics is operational
- 5-second timeout for analytics requests (prevents hanging on blocked requests)
- Timeout promise race to avoid waiting indefinitely for blocked requests
- Detailed error categorization (timeout, blocked, network, etc.)

**Error Handling:**
- Catches and categorizes different error types:
  - **Timeout errors**: Logged as debug (expected in slow networks)
  - **Blocked errors**: Logged as warnings (ad blockers detected)
  - **Network errors**: Logged as debug (connection issues)
  - **Other errors**: Logged as debug

**Single Event Logging (`logAnalyticsEvent`):**
```typescript
// Enhanced with:
- Request timeout handling
- Ad blocker detection
- Empty batch validation
- Categorized error logging
```

**Batch Event Logging (`logAnalyticsEventBatch`):**
```typescript
// Enhanced with:
- Same error handling as single events
- Empty batch validation
- Event count in logs
- Request timeout protection
```

### 3. Global Type Definitions (`src/types/global.d.ts`)

Added TypeScript definitions for the global `window.statsigAvailable` flag:
```typescript
declare global {
  interface Window {
    statsigAvailable?: boolean;
  }
}
```

## Error Detection

The system identifies the following error types:

### Network/Ad Blocker Errors
- `net::ERR_BLOCKED_BY_CLIENT` - Browser extension/ad blocker block
- `ERR_BLOCKED_BY_CLIENT` - Chromium network error
- Request status 0 with error statusText
- "blocked" in error message

### Timeout Errors
- Requests exceeding 5 second timeout
- Indicates slow network or service unavailability

### Network Errors
- `NetworkError` - Browser network error
- `Failed to fetch` - CORS or connectivity issue
- Regular fetch promise rejections

## Usage Examples

### Checking if analytics is available

```typescript
import { isAnalyticsAvailable } from '@/lib/analytics';

if (isAnalyticsAvailable()) {
  // Analytics is working - can use feature flags, etc.
} else {
  // Analytics is blocked - use fallback logic
}
```

### Logging events (automatically handles errors)

```typescript
import { logAnalyticsEvent } from '@/lib/analytics';

// Single event - automatically handles all errors
await logAnalyticsEvent('user_login', {
  provider: 'google',
  timestamp: new Date().toISOString(),
});

// Batch events - automatically handles all errors
import { logAnalyticsEventBatch } from '@/lib/analytics';

await logAnalyticsEventBatch([
  { event_name: 'page_view', metadata: { page: '/chat' } },
  { event_name: 'model_selected', value: 'gpt-4' },
]);
```

## Console Output Examples

### When ad blocker is detected:
```
[Statsig] Network/ad blocker error caught - analytics will be disabled: ...
[Analytics] Request blocked (likely ad blocker): user_login
```

### When timeout occurs:
```
[Statsig] Initialization timeout (likely ad blocker or slow network) - bypassing analytics
[Analytics] Event logging timed out: user_login
```

### When analytics works normally:
```
[Statsig] Client initialized successfully
// No errors in console
```

## Behavior

1. **Initialization Phase:**
   - Statsig provider attempts to initialize with 2-second timeout
   - If blocked or timeout, `window.statsigAvailable = false`
   - App renders normally regardless of initialization result

2. **Event Logging Phase:**
   - Analytics events include 5-second timeout protection
   - Blocked requests are detected and logged as warnings
   - Network errors are logged as debug (non-critical)
   - Events never throw - they gracefully fail

3. **Fallback:**
   - Server-side analytics still works via Next.js API routes
   - Client-side analytics degrades gracefully
   - No user-facing errors or UI freezes

## Testing

To test error handling:

### Simulate ad blocker:
1. Open DevTools > Network tab
2. Find `prodregistryv2.org` requests
3. Right-click > Block request URL
4. Refresh page
5. Check console for ad blocker detection logs

### Simulate network error:
1. Open DevTools > Network tab
2. Set throttling to "Offline"
3. Refresh page
4. Check console for network error logs
5. Restore normal network
6. Verify app still works

## Benefits

- **Reliability**: App works even when analytics is blocked
- **Debugging**: Clear console logs indicate why analytics failed
- **Performance**: Timeouts prevent hanging on blocked requests
- **User Experience**: No UI freezes or errors from analytics
- **Monitoring**: Global flag allows feature flags to respond to analytics availability
- **Server Fallback**: Critical analytics still logged server-side

## Files Modified

1. `src/components/providers/statsig-provider.tsx` - Enhanced Statsig initialization and error handling
2. `src/lib/analytics.ts` - Added timeout, error categorization, and helper functions
3. `src/types/global.d.ts` - New TypeScript definitions for global window properties

## Migration Notes

No breaking changes - all existing analytics calls work unchanged. The error handling is automatic and doesn't require any code changes in consuming components.
