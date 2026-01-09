# Gatewayz Beta - Security Documentation

## Overview

This document describes the security architecture, practices, and configurations for the Gatewayz Beta application.

---

## 1. CORS Policy

### Configuration

The Gatewayz Beta application implements cross-origin request policies to prevent unauthorized cross-origin requests while allowing legitimate client-side API calls.

**Allowed Origins:**
- `https://beta.gatewayz.ai` (beta domain)
- `https://gatewayz.ai` (main domain)
- `http://localhost:3000` (development only)

**Allowed Methods:**
- GET
- POST
- PUT
- DELETE
- PATCH

**Allowed Headers:**
- `Authorization`
- `Content-Type`
- `X-Session-Invalidation-ID`
- `X-Device-ID`
- `X-Fingerprint`

**Exposed Headers:**
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `X-Session-Invalidated`

**Credentials:**
- Allowed: Yes (for authenticated requests)

### Implementation

CORS is configured at the API Gateway level. All API responses include appropriate CORS headers:

```
Access-Control-Allow-Origin: https://beta.gatewayz.ai
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH
Access-Control-Allow-Headers: Authorization, Content-Type, X-Session-Invalidation-ID
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

### Browser Enforcement

The browser's same-origin policy provides the primary protection:
- Requests to different origins are blocked by the browser
- Preflight OPTIONS requests validate CORS configuration
- Cookies are isolated per-domain (SameSite policy enforced)

---

## 2. CSRF Protection

### Architecture

Gatewayz Beta uses **Bearer token authentication** exclusively. This design inherently prevents CSRF attacks because:

1. **Tokens are not stored in cookies** → Not automatically sent by the browser
2. **Tokens are in Authorization header** → Requires JavaScript to send (same-origin only)
3. **State changes require POST/PUT/DELETE** → Safe methods (GET) don't change state

### Why CSRF Tokens Are Not Needed

Traditional CSRF tokens are necessary for cookie-based authentication because the browser automatically sends cookies with requests. However, with Bearer token authentication:

```
❌ NOT vulnerable to CSRF:
POST /api/chat/completions
Authorization: Bearer <token>  ← Must be added by JavaScript
Content-Type: application/json

Body: { message: "..." }
```

An attacker's site cannot:
- Retrieve the token (stored in httpOnly-equivalent localStorage)
- Send requests with the token (same-origin policy prevents it)
- Use cookies (not used for authentication)

### Additional CSRF Protection: Origin Validation

While not strictly necessary, we validate origins on sensitive operations:

```typescript
// Session transfer from main domain → beta domain
const expectedOrigin = 'https://gatewayz.ai'
const tokenOrigin = storedToken.origin

if (tokenOrigin !== expectedOrigin) {
  return false  // Reject transfer
}
```

### SameSite Cookie Policy

All cookies set by the application use `SameSite=Strict`:

```
Set-Cookie: session_id=...; SameSite=Strict; HttpOnly; Secure
```

This prevents cookies from being sent in cross-site requests, even if a legacy endpoint used cookies.

---

## 3. Authentication Security

### Token Management

**Storage:**
- API keys stored in `localStorage` (domain-isolated by browser)
- Domain-specific (cannot be accessed from other domains)
- Cleared on logout

**Transmission:**
```
Authorization: Bearer <api_key>
```
- Always in HTTPS (TLS encryption)
- Never in URL query parameters
- Never in request body

**Lifetime:**
- Default: 1 hour from issuance
- Automatic refresh before expiry (5-minute buffer)
- Manual refresh available via `/api/auth/refresh`

### Session Transfer (Main → Beta)

When users authenticate on the main domain and are redirected to beta:

1. **Temporary token in URL** (only during redirect)
   ```
   https://beta.gatewayz.ai?token=<api_key>&userId=<id>
   ```

2. **URL cleanup** (immediately after processing)
   ```typescript
   history.replaceState({}, '', '/chat')  // Remove token from URL
   ```

3. **Storage in sessionStorage** (domain-isolated, auto-expires)
   ```javascript
   sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify({
     token: api_key,
     userId: user_id,
     timestamp: Date.now(),
     origin: 'https://gatewayz.ai',
     fingerprint: browser_fingerprint
   }))
   ```

4. **Validation**
   - Origin must match (CSRF protection)
   - Fingerprint must match (session hijacking detection)
   - Expires after 10 minutes

### Session Invalidation

When users change critical account properties, sessions are invalidated:

**Triggering Events:**
- Password change
- Email address change
- 2FA settings modified
- Device removed from trust list
- Manual session revocation

**Invalidation Process:**
1. Generate new `session_invalidation_id`
2. Store in localStorage
3. Send to backend
4. Backend invalidates all other sessions
5. Current session continues with new ID
6. Any other active sessions receive 401 on next request

**Implementation:**
```typescript
// Frontend validates ID on each request
const isValidSession = validateSessionInvalidationId(serverSideId)
if (!isValidSession) {
  logout()  // Force re-authentication
}

// Backend includes ID in response headers
X-Session-Invalidation-ID: sid-1234567890-abc123
```

---

## 4. Input Validation & Sanitization

### Frontend Validation

All user inputs are validated before sending to the API:

- **Forms:** React Hook Form + Zod schema validation
- **Chat messages:** Length limits, content filtering
- **API requests:** Type checking with TypeScript

### Backend Responsibility

The backend API is responsible for:
- Re-validating all inputs
- Sanitizing data before storage
- Escaping outputs to prevent injection attacks
- Validating API key ownership

### Never Trust Client-Side Validation

Client-side validation is for UX only. The backend must:
- Implement independent validation
- Assume all inputs could be malicious
- Rate limit invalid requests
- Log suspicious patterns

---

## 5. Rate Limiting

### Client-Side Detection

The frontend detects rate limit responses (429 Too Many Requests):

```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  showRateLimitDialog(retryAfter)
}
```

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1732603200
```

### Backend Implementation

Rate limiting is enforced at the API gateway level:

**Per-User Limits:**
```
Authentication endpoints: 10 requests per hour
Chat completions: 100 requests per hour
Model search: 1000 requests per hour
```

**Escalating Penalties:**
- After 3 failed login attempts: 15-minute cooldown
- After 10 failed attempts: Email verification required
- After 25 failed attempts: Account locked (contact support)

### Distributed Rate Limiting

Rate limits are tracked per-user across all servers:
- Redis-backed rate limiter
- Global view of all requests
- Prevents exhaustion through multiple endpoints

---

## 6. Data Security

### Encryption at Rest

**User credentials:**
- API keys: Encrypted in database
- Passwords: Hashed with bcrypt (backend)
- Email addresses: Encrypted field

**User data:**
- Chat history: Encrypted at rest
- Subscription info: Encrypted
- Payment data: Delegated to Stripe (PCI compliant)

**Enforcement:**
- All database columns marked as sensitive use encryption
- Keys rotated quarterly
- Backups encrypted with separate keys

### Encryption in Transit

**All connections:**
- HTTPS only (TLS 1.2 minimum)
- Certificate pinning for critical endpoints
- Perfect forward secrecy enabled

**Verification:**
```bash
# Check TLS version
openssl s_client -connect beta.gatewayz.ai:443 -tls1_2
```

### PCI Compliance (Stripe)

Payment data is NOT handled directly:
- Stripe handles all card processing
- Gatewayz stores only Stripe tokens
- Fully PCI DSS compliant through delegation

---

## 7. Audit Logging & Monitoring

### Audit Events

All security-relevant events are logged:

**User Authentication:**
- Login (with method and device)
- Logout
- Failed authentication attempts
- Token refresh
- Token expiration

**Account Changes:**
- Password change
- Email change
- 2FA modification
- Device added/removed
- Device trust status changed
- Session invalidation

**Suspicious Activity:**
- Multiple failed attempts
- Impossible travel detection
- Device fingerprint mismatch
- Unusual time-of-day access
- VPN/proxy detection
- Rate limit violations

### Audit Log Retention

- Minimum: 90 days (SOC 2 requirement)
- Default: 1 year
- Configurable per deployment
- Immutable logs (append-only)

### Monitoring & Alerts

**Real-Time Alerts:**
- 5+ failed auth in 15 minutes → Alert security team
- Account from new country → Notification to user
- Impossible travel < 1 hour → Force re-authentication
- Rate limit spike → Page on-call

**Daily Reports:**
- Summary of auth events
- Failed attempt trends
- New device registrations
- Session invalidation events

---

## 8. Device Fingerprinting & Trust

### Device Identification

Each device is identified by:
- Browser fingerprint (user agent, screen, timezone, language)
- Device ID (persisted in localStorage)
- Hardware characteristics (cores, screen resolution)

**Device Fingerprint:**
```typescript
{
  user_agent: "Mozilla/5.0...",
  platform: "MacIntel",
  language: "en-US",
  screen: "2560x1600",
  colorDepth: 24,
  timezone: "America/New_York",
  cores: 8
}
```

### Device Trust

Users can mark devices as "trusted" to skip additional verification:

1. **First login on new device** → Show device info dialog
2. **User clicks "Trust this device"** → Set trust flag (30-day expiry)
3. **Subsequent logins** → Skip extra verification
4. **Logout or re-verification** → Reset trust flag

**Benefits:**
- Better UX for legitimate users (no repeated re-auth)
- Hard blocker for attackers reusing credentials elsewhere
- Device registry for account recovery

### Fingerprint Mismatch Handling

If fingerprint changes on a trusted device:
- Log warning (browser update, resolution change, etc.)
- Don't block (false positive risk)
- Notify user (possible session hijacking)

If fingerprint mismatch detected during session transfer:
- Log security event
- Show warning to user
- Optional: Require re-authentication

---

## 9. Third-Party Security

### Privy Authentication

Gatewayz uses Privy for authentication:

- **OAuth provider validation** - Privy handles provider security
- **Token verification** - Privy's token is verified by backend
- **Error tolerance** - Wallet extension errors don't block auth

**Privy tokens are NOT stored:**
- Only used to identify user during login
- Discarded after backend validation
- Cannot be replayed (backend validation required)

### Stripe Payment Integration

Payment processing delegated to Stripe:

- **No card storage** - Stripe stores all payment data
- **Webhooks validated** - Stripe signature verification enforced
- **PCI compliant** - Stripe handles compliance

**Webhook Security:**
```typescript
// Verify signature
const sig = req.headers.get('stripe-signature')
const event = stripe.webhooks.constructEvent(body, sig, secret)
if (!event) throw new Error('Unauthorized')
```

---

## 10. Security Headers

### HTTP Security Headers

All responses include security headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=(self)
```

### CSP (Content Security Policy)

**Directive:** `default-src 'self'` - Only load from same origin
**Exceptions:**
- Privy JavaScript (trusted provider)
- Stripe JavaScript (PCI compliance)
- Google Analytics (tracking)
- Sentry (error monitoring)

**Verification:**
```bash
# Check CSP header
curl -I https://beta.gatewayz.ai | grep Content-Security-Policy
```

---

## 11. Incident Response

### Security Incident Procedure

1. **Detect** - Monitoring alerts security team
2. **Contain** - Revoke compromised credentials
3. **Investigate** - Review audit logs
4. **Notify** - Contact affected users
5. **Remediate** - Deploy fixes
6. **Verify** - Confirm incident resolved
7. **Document** - Update security procedures

### Compromised Credential Response

If API key is compromised:

1. **Immediate:**
   - Revoke compromised key
   - Generate new key
   - Send notification to user email

2. **24 Hours:**
   - Review audit logs
   - Identify unauthorized access
   - Reset affected user accounts if needed

3. **7 Days:**
   - Post-incident review
   - Security update deployment
   - Communication to all users

### Breach Notification

In case of data breach:

1. **Determine scope** - What data was exposed?
2. **Notify users** - Within 72 hours (GDPR requirement)
3. **Notify regulators** - If required by law
4. **Remediate** - Fix the vulnerability
5. **Document** - Create incident report

---

## 12. Compliance

### GDPR Compliance

✅ **User Rights:**
- Right to access: `/api/user/profile` endpoint
- Right to deletion: Account deletion UI
- Right to data portability: Chat history export
- Right to object: Unsubscribe from emails

✅ **Data Protection:**
- Encryption in transit (HTTPS)
- Encryption at rest
- Access controls enforced
- Audit logging enabled

### SOC 2 Type II Compliance

✅ **Security:**
- Encryption, access controls, audit logs
- Multi-factor authentication (via Privy)
- Incident response procedures

✅ **Availability:**
- 99.9% uptime SLA
- Automated failover
- Disaster recovery plan

✅ **Processing Integrity:**
- Input validation
- Error handling
- Change management

✅ **Confidentiality:**
- Data classification
- Access restrictions
- Encryption

### CCPA Compliance

✅ **Consumer Rights:**
- Disclose data collection
- Allow deletion requests
- Opt-out of sale/sharing
- Limit use to stated purposes

---

## 13. Testing & Verification

### Security Testing

**Regular Testing:**
- Monthly: Vulnerability scanning
- Quarterly: Penetration testing
- Annually: Security audit
- Continuous: Static analysis (GitHub Actions)

**Testing Tools:**
- `npm audit` - Dependency vulnerabilities
- `snyk test` - Open source vulnerabilities
- OWASP ZAP - Dynamic scanning
- Burp Suite - Penetration testing

### Code Review Requirements

All security-related code changes require:
1. Peer review by security team
2. Automated security checks
3. Manual penetration testing
4. Documentation update

---

## 14. Reporting Security Issues

To report a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. **DO** email security@gatewayz.ai with details
3. **Include:**
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (optional)

4. **Response Timeline:**
   - Acknowledgement: 24 hours
   - Initial assessment: 7 days
   - Fix deployment: 30 days
   - Public disclosure: 90 days

---

## 15. Security Checklist for Developers

When adding new features:

- [ ] Input validation on frontend AND backend
- [ ] Output escaping to prevent XSS
- [ ] SQL parameterization (backend)
- [ ] Authentication check before sensitive operations
- [ ] Authorization check (user owns resource?)
- [ ] Rate limiting on new endpoints
- [ ] Audit logging for security events
- [ ] HTTPS only (no unencrypted endpoints)
- [ ] Error messages don't leak sensitive info
- [ ] Sensitive data not in logs
- [ ] Dependencies checked for vulnerabilities
- [ ] Tests include security scenarios

---

## 16. Security Configuration

### Environment Variables

Critical security configuration:

```bash
# Required
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai
NEXT_PUBLIC_PRIVY_APP_ID=xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=xxx

# Optional but recommended
SENTRY_AUTH_TOKEN=xxx  # Error tracking
STRIPE_WEBHOOK_SECRET=xxx  # Webhook verification
```

### Deployment Security

Before deploying:

1. [ ] All dependencies up-to-date
2. [ ] No hardcoded secrets in code
3. [ ] Environment variables set correctly
4. [ ] HTTPS certificate valid
5. [ ] Security headers configured
6. [ ] CSP policy verified
7. [ ] Rate limiting enabled
8. [ ] Monitoring/alerts active

---

## 17. References

- [OWASP Top 10](https://owasp.org/Top10/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CWE List](https://cwe.mitre.org/)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

---

**Last Updated:** November 25, 2024
**Version:** 1.0
**Classification:** Internal - Security Guidance
