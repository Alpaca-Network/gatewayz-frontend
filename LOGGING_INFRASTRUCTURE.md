# Enhanced Logging Infrastructure

## Overview

The Gatewayz Beta application now features a comprehensive logging infrastructure with:

- **Release SHA tracking** for correlating errors to specific deployments
- **Stable error fingerprinting** for grouping identical errors together
- **User impact assessment** for prioritizing error resolution
- **Environment and service metadata** for multi-service debugging
- **Source map support** for production error debugging
- **Structured logging** with consistent format across all components

## Architecture

### Core Components

#### 1. Logger Service (`src/lib/logger.ts`)

The central logging service provides:

- **Structured Log Entries**: Consistent format with all metadata
- **Error Fingerprinting**: SHA-256 based stable fingerprints for error grouping
- **User Context**: Automatic capture of user ID, tier, and session
- **Request Context**: URL, path, user agent, referrer
- **User Impact Levels**: Classification for error prioritization
- **Source Location**: File, line, column, and function information

**Usage Example:**

```typescript
import { createLogger, UserImpact } from '@/lib/logger';

const logger = createLogger('ChatService', ['chat', 'api']);

// Info logging
logger.info('Chat session created', { sessionId: '123' });

// Error logging with impact assessment
logger.error('Failed to send message', error, {
  userImpact: UserImpact.HIGH,
  context: { sessionId: '123', modelId: 'gpt-4' },
  tags: ['chat-error', 'model-api'],
});
```

#### 2. Build Information (`src/lib/build-info.ts`)

Auto-generated file containing:

```typescript
export const buildInfo = {
  sha: '016160dfe8c3f4b4f459110b4abad261ad74dd45',
  shortSha: '016160d',
  branch: 'main',
  version: '0.1.0',
  timestamp: '2025-11-11T05:48:33.658Z',
  environment: 'production',
  serviceName: 'gatewayz-beta',
} as const;
```

Generated during build via `scripts/inject-build-info.js`.

#### 3. Error Handler Middleware (`src/app/api/middleware/error-handler.ts`)

Enhanced API error handling with:

- Automatic user impact determination based on context
- Structured logging with fingerprints
- Release SHA included in error responses
- Context-aware impact assessment

**Usage Example:**

```typescript
import { handleApiError, UserImpact } from '@/app/api/middleware/error-handler';

export async function POST(request: Request) {
  try {
    // Your API logic
  } catch (error) {
    return handleApiError(error, 'Chat Completions API', {
      userImpact: UserImpact.HIGH,
      metadata: { modelId: 'gpt-4', sessionId: '123' },
      tags: ['chat-api', 'completion-error'],
    });
  }
}
```

#### 4. Enhanced ErrorBoundary (`src/components/error-boundary.tsx`)

React error boundary with:

- Automatic component-based impact assessment
- Structured error logging with fingerprints
- Component stack capture
- Custom fallback UI support

**Usage Example:**

```tsx
<ErrorBoundary
  context="ChatInterface"
  fallback={<CustomErrorUI />}
>
  <YourComponent />
</ErrorBoundary>
```

#### 5. Enhanced Analytics Service (`src/lib/analytics.ts`)

Analytics events now include:

- Release SHA and version
- Environment metadata
- Service name
- Timestamp

All analytics events are automatically enriched with build information.

## Error Fingerprinting

### How It Works

Error fingerprints are stable SHA-256 hashes generated from:

1. **Error Type**: `TypeError`, `ReferenceError`, etc.
2. **Normalized Message**: Dynamic values removed (numbers → 'N', UUIDs → 'UUID', etc.)
3. **Stack Structure**: Function names from first 5 stack frames
4. **Context**: Component/service name where error occurred

### Example

Two errors from the same bug:

```
Error 1: TypeError: Cannot read property 'length' of undefined at line 42
Error 2: TypeError: Cannot read property 'length' of undefined at line 42
```

Both generate the same fingerprint: `a3f2d8b9c1e5f6a7`

This allows error tracking services to group identical errors together.

### Benefits

- **Automatic Grouping**: Identical errors across users bucket together
- **Trend Analysis**: Track error frequency over time
- **Impact Assessment**: See how many users affected by each unique error
- **Release Correlation**: Identify if new deployments introduce errors

## User Impact Levels

### Classification

| Level | Description | Examples |
|-------|-------------|----------|
| **NONE** | Background error, user unaffected | Analytics tracking failure |
| **LOW** | Minor UI glitch, functionality works | Icon loading failure, tooltip error |
| **MEDIUM** | Feature degraded but usable | Search slower than expected |
| **HIGH** | Feature broken, workaround exists | Chat model switch fails but refresh works |
| **CRITICAL** | Core functionality blocked | Authentication failure, payment processing down |

### Automatic Assessment

The system automatically determines impact based on:

- **Context**: Which service/component had the error
- **Error Type**: Auth errors = HIGH, Analytics errors = LOW
- **HTTP Status**: 401/403 = HIGH, 500 = context-dependent
- **Component Stack**: Errors in `AuthProvider` = CRITICAL

## Source Maps

### Configuration

Source maps are now enabled for production (`next.config.ts`):

```typescript
productionBrowserSourceMaps: true
```

### Usage with Error Tracking Services

1. **Upload Source Maps**: During deployment, upload `.map` files to your error tracking service (Sentry, Rollbar, etc.)
2. **Associate with Release**: Use the release SHA from `build-info.json`
3. **Stack Traces**: Get original TypeScript file/line numbers instead of minified JS

### Security

Source maps are served from your domain and should be:

- Uploaded to error tracking service
- Restricted to authenticated users or removed from public CDN
- Associated with specific release SHAs

## Build Process

### Automatic Injection

The build process automatically injects build information:

```bash
npm run build
# Runs: prebuild → inject-build-info.js → next build
```

### Manual Injection

```bash
npm run inject-build-info
```

### Generated Files

1. **`.env.local`**: Environment variables for Next.js
   ```
   NEXT_PUBLIC_RELEASE_SHA=016160dfe8c3f4b4f459110b4abad261ad74dd45
   NEXT_PUBLIC_RELEASE_VERSION=0.1.0
   ...
   ```

2. **`public/build-info.json`**: JSON format for API access
   ```json
   {
     "sha": "016160dfe8c3f4b4f459110b4abad261ad74dd45",
     "version": "0.1.0",
     ...
   }
   ```

3. **`src/lib/build-info.ts`**: Type-safe TypeScript module
   ```typescript
   export const buildInfo = { ... } as const;
   ```

## Integration with External Services

### Sentry Example

```typescript
import * as Sentry from '@sentry/nextjs';
import { buildInfo } from '@/lib/build-info';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: buildInfo.sha,
  environment: buildInfo.environment,
  // ... other config
});
```

### Datadog Example

```typescript
import { datadogLogs } from '@datadog/browser-logs';
import { buildInfo } from '@/lib/build-info';

datadogLogs.init({
  clientToken: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN,
  site: 'datadoghq.com',
  forwardErrorsToLogs: true,
  sessionSampleRate: 100,
  service: buildInfo.serviceName,
  env: buildInfo.environment,
  version: buildInfo.sha,
});
```

## Log Entry Structure

### Complete Example

```typescript
{
  // Core message
  level: "error",
  message: "Failed to complete chat request",
  timestamp: "2025-11-11T05:48:33.658Z",

  // Service metadata
  service: "gatewayz-beta",
  environment: "production",
  releaseSha: "016160dfe8c3f4b4f459110b4abad261ad74dd45",
  releaseVersion: "0.1.0",

  // Error details
  error: {
    name: "TypeError",
    message: "Cannot read property 'length' of undefined",
    stack: "...",
    fingerprint: "a3f2d8b9c1e5f6a7",  // Stable hash
    code: "ERR_INVALID_RESPONSE"
  },

  // User context
  user: {
    id: "12345",
    email: "user@example.com",
    tier: "pro",
    sessionId: "abc-123"
  },

  // Request context
  request: {
    method: "POST",
    url: "https://beta.gatewayz.ai/api/chat/completions",
    path: "/api/chat/completions",
    userAgent: "Mozilla/5.0...",
    referrer: "https://beta.gatewayz.ai/chat"
  },

  // Impact assessment
  userImpact: "high",

  // Custom metadata
  context: {
    modelId: "gpt-4",
    sessionId: "session-123",
    retryCount: 2
  },

  // Tags for filtering
  tags: ["chat-api", "completion-error", "model-gpt-4"],

  // Source location
  source: {
    file: "/api/chat/completions/route.ts",
    line: 42,
    column: 15,
    function: "POST"
  }
}
```

## Best Practices

### 1. Always Use Structured Logging

**Bad:**
```typescript
console.error('Chat failed:', error);
```

**Good:**
```typescript
logger.error('Chat completion failed', error, {
  userImpact: UserImpact.HIGH,
  context: { modelId, sessionId },
  tags: ['chat-api'],
});
```

### 2. Include Relevant Context

```typescript
logger.error('Payment processing failed', error, {
  userImpact: UserImpact.CRITICAL,
  context: {
    userId: user.id,
    amount: chargeAmount,
    currency: 'USD',
    paymentMethod: 'stripe',
    stripeCustomerId: customerId,
  },
  tags: ['payment', 'stripe', 'critical'],
});
```

### 3. Use Appropriate Impact Levels

- Authentication failures → HIGH or CRITICAL
- Core feature failures → HIGH
- Secondary feature issues → MEDIUM
- UI glitches → LOW
- Analytics/tracking → NONE or LOW

### 4. Add Meaningful Tags

Tags help filter and search logs:

```typescript
tags: ['api-route', 'chat', 'openai', 'rate-limit']
```

### 5. Create Context-Specific Loggers

```typescript
// In ChatService.ts
const logger = createLogger('ChatService', ['chat', 'service']);

// In UserAuth.ts
const logger = createLogger('UserAuth', ['auth', 'user']);
```

## Querying and Analysis

### By Fingerprint

Group all occurrences of the same error:

```sql
SELECT COUNT(*), user_impact, MAX(timestamp)
FROM error_logs
WHERE error_fingerprint = 'a3f2d8b9c1e5f6a7'
GROUP BY user_impact;
```

### By Release

Find errors introduced in a specific release:

```sql
SELECT error_fingerprint, COUNT(*) as occurrences
FROM error_logs
WHERE release_sha = '016160dfe8c3f4b4f459110b4abad261ad74dd45'
  AND timestamp > '2025-11-11T00:00:00Z'
GROUP BY error_fingerprint
ORDER BY occurrences DESC;
```

### By User Impact

Prioritize critical issues:

```sql
SELECT error_fingerprint, error_message, COUNT(*) as affected_users
FROM error_logs
WHERE user_impact IN ('critical', 'high')
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY error_fingerprint, error_message
ORDER BY affected_users DESC;
```

## Deployment Considerations

### Environment Variables

Ensure these are set in production:

```bash
NEXT_PUBLIC_RELEASE_SHA=<git-sha>
NEXT_PUBLIC_RELEASE_VERSION=<version>
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_SERVICE_NAME=gatewayz-beta
```

### Vercel Deployment

These are automatically set by Vercel:

- `VERCEL_GIT_COMMIT_SHA` → `NEXT_PUBLIC_RELEASE_SHA`
- `VERCEL_GIT_COMMIT_REF` → `NEXT_PUBLIC_RELEASE_BRANCH`
- `VERCEL_ENV` → `NEXT_PUBLIC_ENVIRONMENT`

### Source Map Upload

After build, upload source maps:

```bash
# Example with Sentry
npx @sentry/cli releases files <release-sha> upload-sourcemaps .next/static
```

## Performance Impact

### Minimal Overhead

- Fingerprint generation: ~1ms per error
- Log entry creation: ~2ms per entry
- External service call: Async, non-blocking
- No impact on successful requests

### Error Handling

All logging operations:

- Never throw exceptions
- Fail silently if service unavailable
- Don't block application flow
- Use try-catch for safety

## Future Enhancements

### Planned

1. **Log Aggregation**: Send logs to Datadog/Splunk/ELK
2. **Real-time Alerts**: Alert on HIGH/CRITICAL errors
3. **Dashboard**: Visualize error trends by fingerprint
4. **Performance Monitoring**: Add request timing and performance logs
5. **Distributed Tracing**: Correlation IDs across services

### Integration Opportunities

- Sentry for error tracking
- Datadog for log aggregation
- PagerDuty for critical alerts
- Slack notifications for HIGH impact errors

## Support and Maintenance

### Adding New Log Contexts

```typescript
// Create logger for new feature
const logger = createLogger('NewFeature', ['feature', 'tag']);

// Use throughout the feature
logger.info('Feature initialized');
logger.error('Feature failed', error, {
  userImpact: UserImpact.MEDIUM
});
```

### Updating Fingerprint Logic

To change how errors are grouped, modify:

- `generateErrorFingerprint()` in `src/lib/logger.ts`
- `normalizeErrorMessage()` for message normalization
- `normalizeStackTrace()` for stack structure

### Troubleshooting

**Q: Build info shows "unknown"**

A: Run `npm run inject-build-info` before build, or ensure git is available in CI/CD.

**Q: Errors not grouping correctly**

A: Check that context parameter is consistent across error logs for the same component.

**Q: Source maps not working**

A: Ensure `productionBrowserSourceMaps: true` in `next.config.ts` and maps are uploaded.

## References

- [Logger Service](src/lib/logger.ts)
- [Build Info Script](scripts/inject-build-info.js)
- [Error Handler Middleware](src/app/api/middleware/error-handler.ts)
- [ErrorBoundary Component](src/components/error-boundary.tsx)
- [Analytics Service](src/lib/analytics.ts)

---

**Last Updated**: 2025-11-11
**Version**: 1.0.0
