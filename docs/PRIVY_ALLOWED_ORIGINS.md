# Privy Allowed Origins Configuration

## Error: "Must specify origin"

If users see the error "Must specify origin" when attempting to log in via OAuth (Google or GitHub), this means the application's domain is not configured in the Privy dashboard's allowed origins list.

## Quick Fix

1. Go to **[Privy Dashboard](https://dashboard.privy.io)**
2. Select your app (matching `NEXT_PUBLIC_PRIVY_APP_ID`)
3. Navigate to **Settings → Allowed Origins**
4. Add the domain: `https://beta.gatewayz.ai`
5. Click **Save**

## Symptoms

- Users click "Sign in with Google" or "Sign in with GitHub"
- A popup may appear briefly and then close
- Error message appears: "Must specify origin"
- In the browser console: `FetchError: [POST] "https://auth.privy.io/api/v1/oauth/init": 403`

## Root Cause

Privy's OAuth flow requires the requesting domain to be whitelisted in the Privy dashboard for security reasons. When a domain is not in the allowed origins list, Privy's API rejects the OAuth initialization request with a 403 Forbidden error.

## Required Origins

For Gatewayz, the following origins should be configured:

| Environment | Origin |
|-------------|--------|
| Production (Main) | `https://gatewayz.ai` |
| Production (Beta) | `https://beta.gatewayz.ai` |
| Development | `http://localhost:3000` |
| Vercel Previews | `https://*.vercel.app` (if supported, otherwise add specific preview URLs) |

## Adding a New Domain

When deploying to a new domain or environment:

1. **Before deployment**: Add the new domain to Privy's allowed origins
2. **Verify**: Test OAuth login (Google, GitHub) on the new domain
3. **Document**: Add the domain to the table above

## Troubleshooting

### Email login works, but OAuth doesn't
Email login (magic link/OTP) doesn't require origin validation. OAuth providers (Google, GitHub) require the origin to be whitelisted because they involve cross-domain redirects.

### Just deployed to a new Vercel preview URL
Preview URLs are dynamically generated. The codebase handles this by using `customOAuthRedirectUrl` to route OAuth through `beta.gatewayz.ai`. However, this only works if:
1. `beta.gatewayz.ai` is in the allowed origins
2. The preview deployment can redirect back to the correct preview URL after auth

### The domain is in allowed origins but still failing
1. Check for typos (trailing slashes, http vs https)
2. Ensure the protocol matches exactly (use `https://`)
3. Wait a few minutes for Privy's cache to update
4. Clear browser cache and cookies

## Technical Implementation

The codebase now includes error handling for this scenario:

- **File**: `src/components/auth/origin-error-handler.tsx`
  - Displays a user-friendly error message with fix instructions
  - Shows the current origin that needs to be added

- **File**: `src/components/providers/privy-provider.tsx`
  - Catches "Must specify origin" errors from Privy
  - Shows the `OriginErrorHandler` component
  - Logs the error to Sentry with the fix instructions

## Related Documentation

- [Privy Documentation - Allowed Origins](https://docs.privy.io/guide/dashboard/allowed-origins)
- [RAILWAY_DEPLOYMENT_GUIDE.md](../RAILWAY_DEPLOYMENT_GUIDE.md) - Railway deployment includes Privy setup
- [PRE_DEPLOYMENT_CHECKLIST.md](../PRE_DEPLOYMENT_CHECKLIST.md) - Deployment checklist includes Privy origins

## Contact

If you need access to the Privy dashboard, contact the team lead or DevOps administrator.
