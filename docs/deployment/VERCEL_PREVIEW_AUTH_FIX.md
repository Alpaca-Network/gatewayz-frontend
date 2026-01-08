# Vercel Preview Deployment OAuth Fix

This document describes the client-side workaround implemented to fix Privy authentication on Vercel preview deployments.

## Problem

When users try to authenticate via OAuth providers (Google, GitHub, etc.) on Vercel preview deployments, they experience the following issue:

1. User initiates login on preview URL: `https://myapp-git-feature-team.vercel.app`
2. OAuth provider redirects user away for authentication
3. After authentication, OAuth provider redirects back to production URL: `https://beta.gatewayz.ai`
4. User loses their preview deployment session

This happens because Privy's OAuth redirect configuration might default to the production domain instead of preserving the preview deployment hostname.

## Solution

A **client-side workaround** that:
1. Detects when running on a Vercel preview deployment
2. Saves the preview hostname to localStorage **before** OAuth redirect
3. Detects when returning from OAuth callback (on production domain)
4. Automatically redirects back to the preview deployment with authentication state intact

## Implementation

### Files Created

1. **`src/lib/preview-hostname-handler.ts`** - Core utility functions
   - `isVercelPreviewDeployment()` - Detects preview deployments
   - `savePreviewHostname()` - Saves hostname to localStorage
   - `getSavedPreviewHostname()` - Retrieves saved hostname
   - `shouldRestorePreviewHostname()` - Determines if restoration needed
   - `restorePreviewHostname()` - Redirects to preview deployment
   - `initializePreviewHostnameHandler()` - Main initialization function

2. **`src/components/auth/preview-hostname-interceptor.tsx`** - Interceptor component
   - Monitors Privy authentication events
   - Saves preview hostname before OAuth redirect
   - Listens for login button clicks

3. **`src/components/auth/preview-hostname-restorer.tsx`** - Restorer component
   - Runs early in app lifecycle
   - Detects OAuth callback returns
   - Triggers hostname restoration

### Files Modified

1. **`src/components/providers/privy-provider.tsx`**
   - Added `PreviewHostnameInterceptor` component

2. **`src/app/layout.tsx`**
   - Added `PreviewHostnameRestorer` component at root level

## How It Works

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User on Preview Deployment                                  │
│    URL: https://myapp-git-feature-team.vercel.app               │
│    Action: User clicks "Sign in with Google"                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Interceptor Saves Hostname                                   │
│    Detects: Vercel preview deployment                          │
│    Saves: "myapp-git-feature-team.vercel.app" → localStorage   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. OAuth Redirect                                               │
│    User redirected to: https://accounts.google.com              │
│    User authenticates with Google                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. OAuth Callback (Wrong Domain)                                │
│    Google redirects to: https://beta.gatewayz.ai                │
│    Problem: User is on production, not preview!                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Restorer Detects & Fixes                                     │
│    Detects: On production with saved preview hostname           │
│    Reads: "myapp-git-feature-team.vercel.app" from localStorage│
│    Redirects to: https://myapp-git-feature-team.vercel.app      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. User Back on Preview Deployment                              │
│    URL: https://myapp-git-feature-team.vercel.app               │
│    Status: Authenticated ✅                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Detection Logic

Preview deployments are detected using:

```typescript
const hostname = window.location.hostname;
const isVercelDomain = hostname.includes('.vercel.app');
const isNotProduction = !hostname.includes('beta.gatewayz.ai') &&
                        !hostname.includes('gatewayz.ai') &&
                        hostname !== 'localhost';

return isVercelDomain && isNotProduction;
```

This matches Vercel preview deployment patterns like:
- `myapp-git-feature-team.vercel.app`
- `myapp-abc123def.vercel.app`
- `myapp-pr-42-team.vercel.app`

### Storage Mechanism

**Key**: `gatewayz_preview_hostname`
**Value**: Preview deployment hostname (e.g., `myapp-git-feature-team.vercel.app`)
**TTL**: 10 minutes (prevents stale redirects)

Additional timestamp key: `gatewayz_preview_hostname_timestamp`

### Safety Features

1. **Expiration**: Saved hostnames expire after 10 minutes
2. **No Loop Protection**: Hostname cleared before redirect to prevent infinite loops
3. **Domain Validation**: Only redirects if on production with valid saved hostname
4. **Automatic Cleanup**: Expired hostnames automatically removed

## Testing

### Manual Testing Steps

1. **Deploy to Vercel Preview**
   ```bash
   git push origin feature-branch
   # Wait for Vercel to create preview deployment
   ```

2. **Visit Preview Deployment**
   - Go to your preview URL (e.g., `https://myapp-git-feature.vercel.app`)

3. **Attempt OAuth Login**
   - Click "Sign in with Google" or "Sign in with GitHub"
   - Complete authentication flow

4. **Verify Fix**
   - Check console logs for:
     ```
     [Preview] Saved preview hostname: myapp-git-feature.vercel.app
     [Preview] Detected OAuth callback, restoring preview hostname...
     [Preview] Restoring preview hostname: { from: 'beta.gatewayz.ai', to: 'myapp-git-feature.vercel.app' }
     ```
   - Verify you're redirected back to preview deployment
   - Verify authentication is successful

### Console Logs

The implementation includes extensive logging for debugging:

- `[Preview] Saved preview hostname: <hostname>` - Hostname saved
- `[Preview] Privy login initiated, ensuring hostname is saved` - Login detected
- `[Preview] Login button clicked, saving hostname` - Button click detected
- `[Preview] Detected OAuth callback, restoring preview hostname...` - Callback detected
- `[Preview] Restoring preview hostname: {...}` - Redirect happening
- `[Preview] Saved hostname expired, clearing...` - Expired hostname cleaned up
- `[Preview] No saved hostname to restore` - No restoration needed

## Edge Cases Handled

1. **Multiple Tabs**: Each tab has its own localStorage, hostname saved per session
2. **Expired Sessions**: Hostnames older than 10 minutes are automatically discarded
3. **Manual Production Access**: Users can still access production directly without issues
4. **Localhost Development**: Localhost is excluded from preview detection
5. **Production Testing**: Works seamlessly on production (no interference)

## Limitations

1. **Client-Side Only**: This is a workaround, not a server-side fix
2. **localStorage Required**: Won't work if localStorage is disabled
3. **Redirect Delay**: Adds a brief redirect after OAuth callback (~100-200ms)
4. **Not Ideal**: A proper fix would configure Privy to use the correct redirect URL

## Future Improvements

1. **Server-Side Solution**: Configure Privy dashboard to handle preview deployments
2. **Environment Detection**: Use Vercel environment variables for more reliable detection
3. **Privy Configuration**: Explore Privy's `loginCallback` option for dynamic redirects

## Troubleshooting

### Issue: Redirect loop

**Cause**: Hostname not being cleared before redirect
**Solution**: Check that `clearSavedPreviewHostname()` is called before redirect

### Issue: Hostname not saved

**Cause**: Interceptor not detecting login event
**Solution**: Check console for `[Preview]` logs, verify click event listeners

### Issue: Not restoring on callback

**Cause**: Restorer component not initialized early enough
**Solution**: Verify `PreviewHostnameRestorer` is in root layout before PrivyProvider

### Issue: Works on some providers but not others

**Cause**: Some OAuth providers have different callback behaviors
**Solution**: Check that all OAuth providers redirect to the same domain

## References

- [Privy Documentation](https://docs.privy.io)
- [Vercel Preview Deployments](https://vercel.com/docs/concepts/deployments/preview-deployments)
- [Next.js App Router](https://nextjs.org/docs/app)

## Support

If you encounter issues:
1. Check browser console for `[Preview]` logs
2. Verify localStorage contains `gatewayz_preview_hostname`
3. Confirm you're on a `.vercel.app` preview deployment
4. Test with incognito/private window to rule out cache issues

## Commit Message

```
feat(auth): add Vercel preview deployment OAuth redirect fix

Implement client-side workaround for Privy OAuth authentication on
Vercel preview deployments. The solution detects preview deployments,
saves the hostname before OAuth redirect, and automatically restores
the correct preview URL after OAuth callback.

Files changed:
- src/lib/preview-hostname-handler.ts (new)
- src/components/auth/preview-hostname-interceptor.tsx (new)
- src/components/auth/preview-hostname-restorer.tsx (new)
- src/components/providers/privy-provider.tsx
- src/app/layout.tsx

Resolves issue where OAuth redirects users from preview deployments
to production domain, causing loss of preview session.
```
