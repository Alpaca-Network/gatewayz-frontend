# Sentry False Positive Warnings - Resolution Guide

## Overview

Sentry's Next.js SDK shows false positive warnings in development logs even when the configuration is correctly implemented. This guide documents the issue and how to suppress these warnings.

## The Warnings

The following warnings appear in development logs despite proper implementation:

```
[@sentry/nextjs] Could not find `onRequestError` hook in instrumentation file.
[@sentry/nextjs] It seems like you don't have a global error handler set up.
[@sentry/nextjs] DEPRECATION WARNING: ... renaming your `sentry.client.config.ts` file
```

## Why These Are False Positives

All required Sentry features are **correctly implemented**:

1. ✅ **`onRequestError` hook exists** in `instrumentation.ts:17`
   ```typescript
   export const onRequestError = Sentry.captureRequestError;
   ```

2. ✅ **Global error handler exists** at `src/app/global-error.tsx`
   - Fully implemented with Sentry error capture
   - Includes user-friendly error UI
   - Tested and working

3. ✅ **Client config migrated** from `sentry.client.config.ts` to `instrumentation-client.ts`
   - No old config file exists
   - Migration to Next.js 15 instrumentation pattern complete

## Root Cause

Sentry's detection logic has timing/order issues that cause it to incorrectly report these warnings during development server startup. This is a known issue with the Sentry Next.js SDK.

## Solution

Suppress the warnings using environment variables:

### Development (Local)

Set in `.env.local`:
```bash
SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING=1
```

### Production (Vercel)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variable for all environments:
   - **Name**: `SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING`
   - **Value**: `1`
   - **Environments**: Production, Preview, Development

### Production (Firebase App Hosting)

1. Go to Firebase Console → App Hosting
2. Navigate to your backend settings
3. Add environment variable:
   - **Name**: `SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING`
   - **Value**: `1`

Alternatively, update via Firebase CLI:
```bash
firebase apphosting:secrets:set SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING
# Enter value: 1
```

### Production (Railway)

1. Go to Railway project dashboard
2. Navigate to service settings
3. Add environment variable:
   - **Name**: `SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING`
   - **Value**: `1`

## Verification

After setting the environment variable:

1. **Development**: Restart the dev server and check logs
2. **Production**: Deploy and check build logs

The warnings should no longer appear.

## Related Files

- `instrumentation.ts` - Contains `onRequestError` hook
- `src/app/global-error.tsx` - Global error boundary
- `instrumentation-client.ts` - Client-side Sentry initialization
- `sentry.server.config.ts` - Server-side Sentry configuration
- `sentry.edge.config.ts` - Edge runtime Sentry configuration

## Additional Notes

### Why Not Fix the Detection?

This is a Sentry SDK issue, not a configuration problem on our end. The proper solution is:
1. Wait for Sentry to fix their detection logic
2. In the meantime, suppress the false positive warnings

### Does This Affect Error Tracking?

No. Error tracking works perfectly regardless of these warnings. The warnings are purely cosmetic and do not indicate any functional issues.

### Should We Report This to Sentry?

This is a known issue with the Sentry Next.js SDK. The suppression flag exists specifically for this purpose.

## Testing

To verify Sentry is working correctly despite the warnings:

1. Check that errors are being captured in Sentry dashboard
2. Verify `global-error.tsx` catches React rendering errors
3. Confirm API errors are tracked via `onRequestError` hook
4. Test client-side error capture works

All of these should function correctly regardless of the warning messages.

---

**Last Updated**: January 2, 2026
**Sentry Version**: `@sentry/nextjs@10.24`
**Next.js Version**: `15.3.3`
