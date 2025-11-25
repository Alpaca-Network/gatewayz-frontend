# Security Implementation Guide

This guide explains how to integrate the new security modules into your application and codebase.

---

## Overview of New Security Modules

Five new security modules have been implemented based on audit recommendations:

| Module | Purpose | Location |
|--------|---------|----------|
| **Token Refresh** | Automatic token expiry and refresh | `src/lib/token-refresh.ts` |
| **Audit Logging** | Security event tracking | `src/lib/audit-logging.ts` |
| **Device Fingerprint** | Device identification and trust | `src/lib/device-fingerprint.ts` |
| **Session Invalidation** | Invalidate sessions on account changes | `src/lib/session-invalidation.ts` |
| **Security Docs** | CORS, CSRF, authentication best practices | `SECURITY.md` |

---

## 1. Token Refresh & Expiry (Priority 1)

### What It Does

- **Tracks token lifetime** - Stores token creation time and expiry
- **Auto-refreshes before expiry** - 5-minute buffer before expiration
- **Prevents unauthorized access** - Limits compromise window to 1 hour max
- **Transparent to users** - Refreshes in background without interrupting UX

### Integration Steps

#### Step 1: Add to Auth Context

In `src/context/gatewayz-auth-context.tsx`, add to `handleAuthSuccess`:

```typescript
import { saveTokenMetadata } from '@/lib/token-refresh';

const handleAuthSuccess = useCallback((authData: AuthResponse) => {
  // ... existing code ...

  // NEW: Save token metadata with 1-hour expiry
  const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour
  saveTokenMetadata(authData.api_key, expiryTime);
}, []);
```

#### Step 2: Add Token Refresh Hook to Layout

In `src/app/layout.tsx` or a new `ProtectedLayout` component:

```typescript
'use client';

import { useTokenRefresh } from '@/hooks/use-token-refresh';
import { logout } from '@/lib/api';

export function RootLayout({ children }: { children: ReactNode }) {
  useTokenRefresh({
    enabled: true,
    onRefreshSuccess: (newApiKey) => {
      console.log('Token refreshed successfully');
      // Update API key in storage (context handles this)
      saveApiKey(newApiKey);
    },
    onRefreshError: (error) => {
      console.error('Token refresh failed:', error);
      // Attempt one more time, then logout
      logout();
    },
    onTokenExpired: () => {
      console.warn('Token has expired');
      logout();
    },
    checkInterval: 60000, // Check every 1 minute
  });

  return (
    <html>
      {/* ... */}
    </html>
  );
}
```

#### Step 3: Handle Backend Response

Update your auth endpoint to return token expiry:

**Backend Response Format:**
```json
{
  "success": true,
  "api_key": "gw_live_...",
  "expires_at": 1732689600000,
  "user_data": { ... }
}
```

#### Step 4: Clear Metadata on Logout

In `src/context/gatewayz-auth-context.tsx`:

```typescript
import { clearTokenMetadata } from '@/lib/token-refresh';

const logout = useCallback(async () => {
  clearStoredCredentials();
  clearTokenMetadata();  // NEW
  // ... rest of logout logic
}, []);
```

### Testing

```bash
# Test token refresh
1. Login
2. Check localStorage: gatewayz_token_expiry should exist
3. Inspect its contents - should have expires_at ~1 hour from now
4. Wait 55 minutes, check network tab
5. Should see POST /api/auth/refresh request
6. Token should be updated in localStorage
```

### Verification

```typescript
// Check if token refresh is working
import { getTokenTimeRemaining, shouldRefreshToken } from '@/lib/token-refresh';

console.log('Time remaining:', getTokenTimeRemaining(), 'ms');
console.log('Should refresh?', shouldRefreshToken());
```

---

## 2. Audit Logging (Priority 2)

### What It Does

- **Logs security events** - Login, logout, failed auth, token refresh
- **Tracks suspicious activity** - Rate limits, device changes, impossible travel
- **Enables compliance** - 90+ day retention for SOC 2, GDPR
- **Facilitates investigation** - Rich data for security incident response

### Integration Steps

#### Step 1: Log Login Events

In `src/context/gatewayz-auth-context.tsx`:

```typescript
import { logLogin, logFailedAuth } from '@/lib/audit-logging';

const handleAuthSuccess = useCallback((authData: AuthResponse) => {
  // Log successful login
  logLogin(authData.user_id, authData.auth_method, deviceId);
}, []);

// On auth failure
const onAuthError = useCallback((error: Error) => {
  logFailedAuth('email', error.message);
}, []);
```

#### Step 2: Log Token Refresh Events

In `src/hooks/use-token-refresh.ts`:

```typescript
import { logTokenRefresh } from '@/lib/audit-logging';

const refreshToken = useCallback(async () => {
  const userId = userData?.user_id;

  try {
    // ... refresh logic ...
    if (userId) {
      await logTokenRefresh(userId, true);
    }
  } catch (error) {
    if (userId) {
      await logTokenRefresh(userId, false);
    }
  }
}, []);
```

#### Step 3: Log Account Changes

In settings/account pages:

```typescript
// After password change
import { logPasswordChanged } from '@/lib/audit-logging';

const handlePasswordChange = async (newPassword: string) => {
  await updatePassword(newPassword);
  await logPasswordChanged(userId);
};

// After email change
import { logEmailChanged } from '@/lib/audit-logging';

const handleEmailChange = async (newEmail: string) => {
  const oldEmail = userData.email;
  await updateEmail(newEmail);
  await logEmailChanged(userId, oldEmail, newEmail);
};
```

#### Step 4: Log Rate Limit Events

In API error handling:

```typescript
import { logRateLimitExceeded } from '@/lib/audit-logging';

const handleApiResponse = async (response: Response) => {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    await logRateLimitExceeded(endpoint, userId, parseInt(retryAfter || '60'));
  }
};
```

### Testing

```bash
# Test audit logging
1. Login to app
2. Check browser console - should see [audit] logs
3. Monitor POST /api/audit/log requests in network tab
4. Verify backend receives events

# Check audit logs (backend admin)
GET /v1/admin/audit/logs?user_id=123&limit=100
```

### Monitoring Dashboard

Create a monitoring dashboard to track:
- Login attempts (success vs failure)
- Rate limit violations
- Device trust changes
- Session invalidations
- Suspicious activity patterns

---

## 3. Device Fingerprinting & Trust (Priority 3)

### What It Does

- **Identifies devices** - Persistent device ID across sessions
- **Creates fingerprints** - Browser/OS/screen characteristics
- **Enables trust** - Remember devices for 30 days
- **Detects hijacking** - Warns if fingerprint mismatches

### Integration Steps

#### Step 1: Initialize Device ID on Login

In `src/context/gatewayz-auth-context.tsx`:

```typescript
import { getOrCreateDeviceId, generateDeviceName } from '@/lib/device-fingerprint';

const handleAuthSuccess = useCallback((authData: AuthResponse) => {
  // Get or create device ID
  const deviceId = getOrCreateDeviceId();
  console.log('[Auth] Device ID:', deviceId);

  // Optionally save device trust
  // saveDeviceTrust({ device_id: deviceId, ... });
}, []);
```

#### Step 2: Validate Fingerprint on Session Transfer

In `src/components/SessionInitializer.tsx`:

```typescript
import { validateDeviceFingerprint } from '@/lib/device-fingerprint';

const validateTransferredSession = async () => {
  const storedTrust = getDeviceTrust();

  if (storedTrust) {
    const matches = validateDeviceFingerprint(storedTrust.fingerprint);

    if (!matches) {
      // Show warning to user
      console.warn('Device fingerprint mismatch - possible session hijacking');
      showWarning('This device looks different than before');
    }
  }
};
```

#### Step 3: Add Device Trust UI

Create a new component `src/components/dialogs/device-trust-dialog.tsx`:

```typescript
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatDeviceDisplay } from '@/lib/device-fingerprint';

interface DeviceTrustDialogProps {
  open: boolean;
  onTrust: () => void;
  onNotMe: () => void;
}

export function DeviceTrustDialog({ open, onTrust, onNotMe }: DeviceTrustDialogProps) {
  const deviceName = formatDeviceDisplay();

  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Do you recognize this device?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          We detected a new login from:
          <p className="font-semibold mt-2">{deviceName}</p>
          <p className="mt-4 text-sm">
            If this is you, you can trust this device for 30 days to skip re-verification.
          </p>
        </DialogDescription>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onNotMe}>
            This isn't me
          </Button>
          <Button onClick={onTrust}>
            Trust this device
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### Step 4: Log Device Changes

```typescript
import { logDeviceTrust } from '@/lib/audit-logging';
import { getOrCreateDeviceId } from '@/lib/device-fingerprint';

const handleTrustDevice = async () => {
  const deviceId = getOrCreateDeviceId();
  await logDeviceTrust(userId, 'trusted', deviceId);
  saveTrustDecision(true);
};

const handleRemoveDevice = async (deviceId: string) => {
  await logDeviceTrust(userId, 'removed', deviceId);
  callBackendToRemoveDevice(deviceId);
};
```

### Testing

```bash
# Test device fingerprinting
1. Login
2. Check localStorage: gatewayz_device_id should exist
3. Open DevTools Console:
   localStorage.getItem('gatewayz_device_id')  # Should return device ID
4. Navigate to /settings/devices
5. Should show current device
6. Try logging in from different device
7. Should show device trust dialog
```

---

## 4. Session Invalidation (Priority 7)

### What It Does

- **Invalidates all sessions** when password/email changes
- **Prevents attacker persistence** after credential compromise
- **Maintains current session** user doesn't get logged out
- **Tracks invalidations** for audit trail

### Integration Steps

#### Step 1: Add to Password Change

In your password reset/change page:

```typescript
import {
  onPasswordChanged,
  formatInvalidationReason,
} from '@/lib/session-invalidation';
import { invalidateSession } from '@/lib/audit-logging';

const handlePasswordChange = async (newPassword: string) => {
  // Update password
  await updatePassword(newPassword);

  // Invalidate all other sessions
  const context = onPasswordChanged();

  // Send to backend
  const response = await fetch('/api/auth/invalidate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: 'password_changed',
      logout_other_sessions: true,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Sessions invalidated:', data.session_invalidation_id);

    // Show user feedback
    showToast({
      title: 'Password changed',
      description: 'All other sessions have been logged out for security.',
    });
  }
};
```

#### Step 2: Add to Email Change

In your email settings page:

```typescript
import { onEmailChanged } from '@/lib/session-invalidation';

const handleEmailChange = async (newEmail: string) => {
  // Update email
  await updateEmail(newEmail);

  // Invalidate other sessions
  const context = onEmailChanged(newEmail);

  // Same backend call as above
  const response = await fetch('/api/auth/invalidate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: 'email_changed',
      logout_other_sessions: true,
    }),
  });

  if (response.ok) {
    showToast({
      title: 'Email changed',
      description: 'Verification email sent. All other sessions logged out.',
    });
  }
};
```

#### Step 3: Validate Session ID on API Calls

Create a middleware to add session invalidation header:

```typescript
// src/lib/api.ts - Add to authenticated requests

import { getSessionInvalidationHeaders } from '@/lib/session-invalidation';

export const makeAuthenticatedRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const apiKey = getApiKey();
  const invalidationHeaders = getSessionInvalidationHeaders();

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...invalidationHeaders,  // NEW
    ...options.headers,
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  // Check for session invalidation
  if (response.status === 401) {
    const wasInvalidated = response.headers.get('X-Session-Invalidated') === 'true';
    if (wasInvalidated) {
      clearStoredCredentials();
      window.location.href = '/login';
    }
  }

  return response;
};
```

#### Step 4: Handle Session Invalidation Response

In your API response handler:

```typescript
import {
  handleSessionInvalidationResponse,
  formatInvalidationReason,
} from '@/lib/session-invalidation';

const handleApiResponse = (response: Response) => {
  const isValid = handleSessionInvalidationResponse(response);

  if (!isValid) {
    const reason = response.headers.get('X-Invalidation-Reason');
    showToast({
      title: 'Session expired',
      description: formatInvalidationReason(reason || 'manual'),
      variant: 'destructive',
    });

    // Force re-login
    logout();
  }
};
```

### Testing

```bash
# Test session invalidation
1. Login to account on Device A
2. Open separate browser tab on Device B and login (same account)
3. On Device A: Change password
4. On Device B: Try to make an API request
5. Should get 401 with X-Session-Invalidated header
6. Should be logged out with message about password change
```

---

## 5. Security Documentation (Priority 5)

### What It Does

- **Documents CORS policy** - Which origins are allowed
- **Explains CSRF protection** - Why CSRF tokens aren't needed with Bearer tokens
- **Details authentication flow** - How tokens work end-to-end
- **Provides security checklist** - For developers implementing features

### Integration Steps

#### Step 1: Review Security.md

Read through `SECURITY.md` to understand:
- CORS configuration
- CSRF protection strategy
- Authentication security
- Session management
- Rate limiting
- Audit logging
- Device fingerprinting

#### Step 2: Update Your Backend Configuration

Based on `SECURITY.md` section 1 (CORS Policy):

```typescript
// Backend middleware configuration
app.use(cors({
  origin: [
    'https://beta.gatewayz.ai',
    'https://gatewayz.ai',
    'http://localhost:3000' // dev only
  ],
  credentials: true,
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-Session-Invalidation-ID',
    'X-Device-ID',
    'X-Fingerprint'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Session-Invalidated'
  ],
  maxAge: 86400 // 24 hours
}));
```

#### Step 3: Add Security Headers

Configure Next.js to send security headers:

Create `next.config.js`:

```typescript
const config = {
  headers: () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block'
        },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' *.privy.io *.stripe.com *.gstatic.com"
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        }
      ]
    }
  ]
};

export default config;
```

#### Step 4: Link to Documentation

In your public documentation or settings page:

```typescript
// src/app/settings/security/page.tsx
export default function SecuritySettings() {
  return (
    <div>
      <h1>Security & Privacy</h1>
      <p>
        Our authentication and security practices follow industry best practices.
        <a href="/docs/security">Read our security documentation</a>
      </p>
      {/* ... security controls ... */}
    </div>
  );
}
```

---

## Integration Checklist

Use this checklist to ensure all modules are properly integrated:

### Token Refresh (Priority 1)
- [ ] Added `saveTokenMetadata` to `handleAuthSuccess` in auth context
- [ ] Added `useTokenRefresh` hook to root layout
- [ ] Backend returns `expires_at` in auth response
- [ ] Added `clearTokenMetadata` to logout
- [ ] Tested token refresh endpoint
- [ ] Verified token metadata in localStorage

### Audit Logging (Priority 2)
- [ ] Added `logLogin` to successful authentication
- [ ] Added `logFailedAuth` to auth failures
- [ ] Added `logTokenRefresh` to token refresh hook
- [ ] Added `logPasswordChanged` to password change flow
- [ ] Added `logEmailChanged` to email change flow
- [ ] Added `logRateLimitExceeded` to API error handlers
- [ ] Tested audit logging endpoint
- [ ] Backend storing audit logs with retention policy

### Device Fingerprinting (Priority 3)
- [ ] Added `getOrCreateDeviceId` to auth success
- [ ] Added `validateDeviceFingerprint` to session transfer
- [ ] Created `DeviceTrustDialog` component
- [ ] Added device trust UI to settings
- [ ] Added `logDeviceTrust` for device changes
- [ ] Tested device ID persistence across tabs
- [ ] Tested fingerprint validation on new devices

### Session Invalidation (Priority 7)
- [ ] Added `onPasswordChanged` to password change
- [ ] Added `onEmailChanged` to email change
- [ ] Created `/api/auth/invalidate` endpoint
- [ ] Added session invalidation header to all API requests
- [ ] Added response validation for invalidation
- [ ] Tested password change invalidates other sessions
- [ ] Tested email change invalidates other sessions
- [ ] Verified current session continues after invalidation

### Security Documentation (Priority 5)
- [ ] Reviewed SECURITY.md
- [ ] Updated backend CORS configuration
- [ ] Added security headers to Next.js
- [ ] Linked to security docs in UI
- [ ] Trained team on security practices
- [ ] Updated incident response procedures

---

## Backend Requirements

These modules assume your backend implements the following endpoints:

### `/v1/auth/refresh` (POST)
Refresh an expiring token
```
Authorization: Bearer <api_key>
→ { success: true, api_key, expires_at }
```

### `/v1/auth/invalidate` (POST)
Invalidate sessions after account changes
```
Authorization: Bearer <api_key>
{ reason, logout_other_sessions }
→ { success: true, session_invalidation_id }
```

### `/v1/audit/log` (POST)
Store audit log entries
```
Authorization: Bearer <api_key> (optional)
{ event_type, user_id, status, severity, details }
→ { success: true }
```

---

## Monitoring & Maintenance

### Weekly
- [ ] Check audit logs for suspicious patterns
- [ ] Monitor token refresh success rate
- [ ] Review device fingerprint mismatches

### Monthly
- [ ] Analyze failed auth attempts
- [ ] Review rate limit patterns
- [ ] Update security documentation

### Quarterly
- [ ] Full security audit
- [ ] Penetration testing
- [ ] Update threat model

---

## Support & Questions

For questions about the security implementations:

1. **Review** the module's source code
2. **Check** the audit report (AUTH_AUDIT_REPORT.md)
3. **Read** SECURITY.md for policy details
4. **Email** security@gatewayz.ai for help

---

**Last Updated:** November 25, 2024
**Version:** 1.0
