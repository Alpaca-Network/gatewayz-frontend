# Sentry Setup Summary

## Overview

Sentry has been successfully integrated into the Gatewayz Beta application for comprehensive error tracking, performance monitoring, and structured logging.

## What Was Installed

### Package
- **@sentry/nextjs** v10.24.0 - Official Sentry SDK for Next.js

### Configuration Files Created

1. **`sentry.client.config.ts`** - Client-side Sentry configuration
   - Automatically loaded by Sentry Next.js plugin
   - Session Replay enabled (100% on errors, 10% on normal sessions)
   - Console logging integration
   - Structured logging enabled with `enableLogs: true`

2. **`sentry.server.config.ts`** - Server-side Sentry configuration
   - Loaded via `instrumentation.ts` for Node.js runtime
   - Console logging integration
   - Structured logging enabled with `enableLogs: true`

3. **`sentry.edge.config.ts`** - Edge runtime Sentry configuration
   - Loaded via `instrumentation.ts` for Edge runtime
   - Minimal configuration for edge functions
   - Structured logging enabled with `enableLogs: true`

4. **`instrumentation.ts`** - Next.js instrumentation file
   - Automatically loads server and edge configs based on runtime
   - Required for server-side Sentry initialization

5. **`.sentryclirc`** - Sentry CLI configuration
   - Organization: alpaca-network
   - Project: javascript-nextjs

6. **`next.config.ts`** - Updated with Sentry webpack plugin
   - Automatic source map uploads
   - Tunnel route: `/monitoring`
   - Vercel Cron Monitors enabled

## Integration Points

### 1. Error Handler Middleware
**File**: `src/app/api/middleware/error-handler.ts`

All API errors are automatically captured in Sentry with:
- Context tags
- Error type classification
- Appropriate severity levels

### 2. API Route Instrumentation
**Example**: `src/app/api/models/route.ts`

Demonstrates:
- Performance span tracking
- Request parameter logging
- Success/error metrics
- Exception capturing

### 3. Example Component
**File**: `src/components/examples/sentry-example-component.tsx`

Shows best practices for:
- UI interaction tracking
- Async operation monitoring
- Form submission tracking
- User navigation tracking
- Structured logging

### 4. Test Endpoint
**File**: `src/app/api/sentry-test/route.ts`

Test Sentry integration by visiting:
- `/api/sentry-test` - Run all tests
- `/api/sentry-test?type=error` - Test error capturing
- `/api/sentry-test?type=logging` - Test structured logging
- `/api/sentry-test?type=spans` - Test span tracking
- `/api/sentry-test?type=nested` - Test nested spans
- `/api/sentry-test?type=template` - Test template literals

## Environment Variables

Add these to your `.env.local`:

```bash
# Sentry Error Tracking & Performance Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id
SENTRY_AUTH_TOKEN=your-sentry-auth-token
```

### How to Get These Values

1. **NEXT_PUBLIC_SENTRY_DSN**:
   - Go to Sentry dashboard
   - Navigate to Settings → Projects → javascript-nextjs
   - Go to Client Keys (DSN)
   - Copy the DSN URL

2. **SENTRY_AUTH_TOKEN**:
   - Go to Sentry dashboard
   - Navigate to Settings → Developer Settings → Auth Tokens
   - Create a new token with these permissions:
     - `project:read`
     - `project:releases`
     - `org:read`
   - Copy the token

## Features Enabled

### Error Tracking
- ✅ Automatic exception capturing
- ✅ Context tags (API route, error type, etc.)
- ✅ Stack traces with source maps
- ✅ Error grouping and deduplication

### Performance Monitoring
- ✅ API route performance tracking
- ✅ Custom span instrumentation
- ✅ Nested span support
- ✅ Automatic transaction tracking
- ✅ Database query tracking (when applicable)

### Structured Logging
- ✅ Multiple log levels (trace, debug, info, warn, error, fatal)
- ✅ Template literal support with `logger.fmt`
- ✅ Searchable structured data
- ✅ Automatic console.log integration
- ✅ Log aggregation in Sentry dashboard

### Session Replay (Client-side)
- ✅ Recording user sessions on errors
- ✅ Privacy features (mask text, block media)
- ✅ 100% error replay rate
- ✅ 10% normal session replay rate

### Additional Features
- ✅ Tunnel route to bypass ad-blockers (`/monitoring`)
- ✅ Source map hiding in production
- ✅ Automatic Vercel Cron Monitor integration
- ✅ Logger tree-shaking for smaller bundles

## Usage Examples

### 1. Capturing Exceptions

```typescript
import * as Sentry from '@sentry/nextjs';

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      operation: 'user_registration',
      user_id: userId,
    },
    extra: {
      requestData: sanitizedData,
    },
    level: 'error',
  });
  throw error;
}
```

### 2. Performance Tracking

```typescript
import * as Sentry from '@sentry/nextjs';

export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'GET /api/your-route',
    },
    async (span) => {
      span.setAttribute('param', value);
      // Your logic here
      return response;
    }
  );
}
```

### 3. Structured Logging

```typescript
import * as Sentry from '@sentry/nextjs';
const { logger } = Sentry;

logger.info('Operation completed', {
  operation: 'sync',
  duration_ms: 1000,
  success: true,
});

logger.error('Operation failed', {
  operation: 'sync',
  error: errorMessage,
  duration_ms: 1000,
});
```

## Documentation

- **`SENTRY_INTEGRATION.md`** - Comprehensive integration guide with examples
- **`SENTRY_SETUP_SUMMARY.md`** - This file

## Testing Checklist

Before deploying to production:

1. ✅ Add Sentry DSN to environment variables
2. ✅ Add Sentry auth token to environment variables
3. ✅ Test error capturing: Visit `/api/sentry-test?type=error`
4. ✅ Test performance tracking: Visit `/api/sentry-test?type=spans`
5. ✅ Test structured logging: Visit `/api/sentry-test?type=logging`
6. ✅ Verify in Sentry dashboard:
   - Issues are being captured
   - Performance data is being collected
   - Logs are being recorded
7. ✅ Run build: `npm run build` (should complete without errors)
8. ✅ Test in production environment

## Next Steps

1. **Add DSN to Environment**:
   ```bash
   # Add to .env.local
   NEXT_PUBLIC_SENTRY_DSN=your-actual-dsn
   SENTRY_AUTH_TOKEN=your-actual-token
   ```

2. **Test the Integration**:
   ```bash
   npm run dev
   # Visit http://localhost:3000/api/sentry-test
   ```

3. **Deploy to Production**:
   - Add environment variables to your hosting platform
   - Deploy the application
   - Monitor errors in Sentry dashboard

4. **Configure Alerts** (Optional):
   - Set up email/Slack notifications for errors
   - Configure issue assignment rules
   - Set up performance thresholds

5. **Review and Optimize**:
   - Adjust sample rates if needed
   - Configure ignored errors
   - Set up custom error grouping rules
   - Fine-tune performance monitoring

## Monitoring Your Application

After deployment, visit your Sentry dashboard to:

- **Issues**: View and triage errors
- **Performance**: Analyze API and page performance
- **Logs**: Search structured logs
- **Replays**: Watch user sessions that encountered errors
- **Releases**: Track errors by deployment version

## Support

- [Sentry Documentation](https://docs.sentry.io/)
- [Next.js Integration Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Structured Logging](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/custom-instrumentation/)

## Summary of Changes

### Files Created
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `instrumentation.ts`
- `.sentryclirc`
- `SENTRY_INTEGRATION.md`
- `SENTRY_SETUP_SUMMARY.md`
- `src/app/api/sentry-test/route.ts`
- `src/components/examples/sentry-example-component.tsx`

### Files Modified
- `next.config.ts` - Added Sentry webpack plugin
- `.env.example` - Added Sentry environment variables
- `src/app/api/middleware/error-handler.ts` - Added Sentry exception capturing
- `src/app/api/models/route.ts` - Added Sentry span instrumentation
- `package.json` - Added @sentry/nextjs dependency

### No Breaking Changes
All changes are additive and backward compatible. The application will work with or without Sentry DSN configured.

## Cost Considerations

Sentry offers different pricing tiers:

- **Developer Plan**: Free for small projects (5k errors/month)
- **Team Plan**: $26/month (50k errors/month)
- **Business Plan**: Custom pricing

Monitor your usage in the Sentry dashboard to ensure you stay within your plan limits. You can adjust sample rates to control costs:

- `tracesSampleRate`: Currently 1.0 (100% of transactions)
- `replaysOnErrorSampleRate`: Currently 1.0 (100% of error sessions)
- `replaysSessionSampleRate`: Currently 0.1 (10% of normal sessions)

## Troubleshooting

### Sentry Not Capturing Errors

1. Verify DSN is set: `echo $NEXT_PUBLIC_SENTRY_DSN`
2. Check browser console for Sentry errors
3. Visit `/api/sentry-test` to verify setup
4. Check Sentry project settings

### Source Maps Not Uploading

1. Verify `SENTRY_AUTH_TOKEN` is set
2. Check `.sentryclirc` configuration
3. Run `npm run build` and check for upload messages
4. Verify Sentry CLI has correct permissions

### Performance Not Showing

1. Verify `tracesSampleRate` is > 0
2. Check that transactions are being created
3. Visit Performance tab in Sentry dashboard
4. Wait a few minutes for data to appear

---

**Status**: ✅ Sentry integration complete and ready for testing
**Next Action**: Add DSN to environment variables and test the integration
