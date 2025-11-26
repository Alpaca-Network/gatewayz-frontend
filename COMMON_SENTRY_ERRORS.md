# Common Sentry Errors - Expected Issues

Based on the codebase analysis, here are the most likely common errors you'll find in Sentry and how to address them.

## Authentication Errors (Most Likely)

### 1. "Authentication timeout - stuck in authenticating state"
**Location:** `src/context/gatewayz-auth-context.tsx:236`

**When it happens:**
- User authentication takes longer than expected (>30 seconds)
- Usually during Privy authentication flow

**Tags to filter:**
```
error_type: auth_error
operation: auth_timeout
```

**Possible causes:**
- Network latency
- Privy API slowness
- Browser blocking third-party requests

**Fix priority:** HIGH - Users cannot log in

---

### 2. "Temporary API key could not be upgraded after authentication"
**Location:** `src/context/gatewayz-auth-context.tsx:521`

**When it happens:**
- User successfully authenticates with Privy
- Backend fails to upgrade temporary API key to permanent one

**Tags to filter:**
```
error_type: auth_error
operation: api_key_upgrade_failure
```

**Possible causes:**
- Backend API down or slow
- Race condition between auth and API key upgrade
- Session/timing issues

**Fix priority:** CRITICAL - Authentication succeeds but user cannot use the app

---

### 3. "Authentication max retry limit reached"
**Location:** `src/context/gatewayz-auth-context.tsx:642`

**When it happens:**
- After 3 failed authentication attempts
- Progressive retry with exponential backoff

**Tags to filter:**
```
error_type: auth_error
operation: max_retries_exceeded
auth_retry_count: 3
```

**Possible causes:**
- Backend authentication endpoint down
- Invalid credentials persisting
- Network issues

**Fix priority:** HIGH - Prevents user login after retries

---

### 4. "Invalid Privy state during token retrieval attempt"
**Location:** `src/context/gatewayz-auth-context.tsx:710`

**When it happens:**
- Privy reports ready/authenticated but missing user object
- Edge case in Privy initialization

**Tags to filter:**
```
error_type: auth_error
operation: invalid_privy_state
level: warning
```

**Possible causes:**
- Race condition in Privy initialization
- Privy SDK bug
- Browser extension interference

**Fix priority:** MEDIUM - Warning level, may self-resolve

---

### 5. "Token retrieval timeout during authentication"
**Location:** `src/context/gatewayz-auth-context.tsx:759`

**When it happens:**
- Getting auth token from Privy takes too long

**Tags to filter:**
```
error_type: auth_error
operation: token_retrieval_timeout
level: warning
```

**Possible causes:**
- Privy API latency
- Network slowness

**Fix priority:** MEDIUM - App continues with null token

---

### 6. "Authentication sync aborted by client timeout"
**Location:** `src/context/gatewayz-auth-context.tsx:956`

**When it happens:**
- Auth sync request takes longer than 30 seconds

**Tags to filter:**
```
error_type: auth_error
operation: auth_sync_timeout
level: warning
```

**Possible causes:**
- Backend API slow response
- Network issues
- High server load

**Fix priority:** HIGH - User cannot complete authentication

---

### 7. "Wallet extension error during auth"
**Location:** `src/context/gatewayz-auth-context.tsx:980`

**When it happens:**
- Wallet authentication (MetaMask, etc.) fails

**Tags to filter:**
```
error_type: auth_error
operation: wallet_auth
level: warning
auth_method: wallet
```

**Possible causes:**
- User rejects wallet connection
- Wallet extension not installed
- Network mismatch

**Fix priority:** LOW - User-initiated rejection is normal

---

### 8. "Authentication rate limit exceeded (429)"
**Location:** `src/components/providers/privy-provider.tsx:57`

**When it happens:**
- Too many authentication attempts in short time

**Tags to filter:**
```
error_type: auth_error
operation: rate_limit_exceeded
status_code: 429
```

**Possible causes:**
- User repeatedly trying to log in
- Bot/automation attempts
- Privy rate limits hit

**Fix priority:** MEDIUM - Implement better rate limit handling

---

## API Errors (Likely)

### 9. API Route Errors (Generic)
**Location:** All API routes via `src/app/api/middleware/error-handler.ts`

**When it happens:**
- Any uncaught error in API routes

**Tags to filter:**
```
error_type: api_error
context: API /api/[route-name]
```

**Common API routes with errors:**
- `/api/auth` - Authentication failures
- `/api/chat/completions` - Chat/streaming errors
- `/api/models` - Model fetching errors
- `/api/stripe/webhook` - Payment webhook failures
- `/api/user/api-keys` - API key management

**Fix priority:** Varies by route and frequency

---

### 10. Model Sync Service Errors
**Location:** `src/lib/model-sync-service.ts:100`, `src/lib/model-sync-service.ts:214`

**When it happens:**
- Fetching models from 60+ providers fails
- Gateway API errors

**Tags to filter:**
```
service_name: model-sync-service
operation: sync_models
```

**Possible causes:**
- Provider API down
- Rate limiting from providers
- Network issues
- Data parsing errors

**Fix priority:** MEDIUM - Affects model discovery but has fallbacks

---

### 11. Token Refresh Errors
**Location:** `src/hooks/use-token-refresh.ts:118`

**When it happens:**
- Automatic token refresh fails

**Tags to filter:**
```
hook_name: use-token-refresh
operation: token_refresh_failure
```

**Possible causes:**
- Token already expired
- Backend refresh endpoint issues
- Invalid refresh token

**Fix priority:** HIGH - Affects logged-in user experience

---

### 12. "Token expired"
**Location:** `src/hooks/use-token-refresh.ts:144`

**When it happens:**
- User's authentication token expires

**Tags to filter:**
```
hook_name: use-token-refresh
operation: token_expired
level: warning
```

**Possible causes:**
- Normal expiration after inactivity
- Clock skew
- Token lifetime too short

**Fix priority:** LOW - Expected behavior, should auto-refresh

---

## Payment Errors (Less Common but High Impact)

### 13. Stripe Webhook Failures
**Location:** `src/app/api/stripe/webhook/route.ts`

**When it happens:**
- Stripe webhook signature verification fails
- Payment processing errors

**Tags to filter:**
```
error_type: payment_error
api_route: /api/stripe/webhook
```

**Possible causes:**
- Webhook secret mismatch
- Stripe API changes
- Request replay attacks

**Fix priority:** CRITICAL - Affects billing

---

## Storage/Client Errors (Moderate)

### 14. Device Fingerprint Mismatch
**Location:** `src/lib/device-fingerprint.ts:119`

**When it happens:**
- Detected device fingerprint changes

**Tags to filter:**
```
service_name: device-fingerprint
operation: fingerprint_mismatch
level: warning
```

**Possible causes:**
- User switched browsers
- Incognito mode
- Browser extension changes

**Fix priority:** LOW - Security feature, false positives expected

---

## Performance/Timeout Issues

### 15. Chat/Streaming Timeouts
**Location:** Various files in `src/lib/streaming.ts`, `src/lib/stream-coordinator.ts`

**When it happens:**
- Chat completion takes too long
- Streaming connection drops

**Tags to filter:**
```
operation: chat_completion
error_type: timeout
```

**Possible causes:**
- Model provider slow/down
- Network issues
- Large context/response

**Fix priority:** MEDIUM - Affects user experience

---

## How to Use This List

### 1. Quick Sentry Dashboard Filters

Copy these into Sentry's search:

**All auth errors:**
```
error_type:auth_error is:unresolved
```

**Critical auth errors only:**
```
error_type:auth_error level:error is:unresolved
```

**API failures:**
```
error_type:api_error status_code:>499
```

**Payment issues:**
```
error_type:payment_error OR api_route:"/api/stripe/*"
```

### 2. Priority Matrix

| Priority | Error Types | Action |
|----------|-------------|--------|
| CRITICAL | Payment failures, API key upgrade failures | Fix immediately |
| HIGH | Auth timeouts, max retries, sync timeouts | Fix within 24-48h |
| MEDIUM | Token refresh, model sync, wallet errors | Fix within 1 week |
| LOW | Token expired, device fingerprint, user rejections | Monitor, fix if frequent |

### 3. Investigation Steps

For any error:

1. **Check frequency**: How many times has it occurred?
2. **Check user impact**: How many unique users affected?
3. **Check timing**: When did it start? After a deployment?
4. **Check environment**: Production only or also staging?
5. **Check related errors**: Are other errors happening at the same time?
6. **Check breadcrumbs**: What was the user doing before the error?

### 4. Quick Fixes

**If you see high auth errors:**
```bash
# Check backend API health
curl https://api.gatewayz.ai/health

# Check Privy status
# Visit: https://status.privy.io/
```

**If you see API timeout errors:**
```bash
# Increase timeout config in:
# src/lib/timeout-config.ts
```

**If you see rate limit errors:**
```bash
# Implement rate limit handling in:
# src/components/providers/privy-provider.tsx
# Or increase limits on backend
```

---

## Next Steps

1. **Run the analysis script** to get actual error counts:
   ```bash
   bash scripts/fetch-sentry-errors.sh
   ```

2. **Compare actual errors** with this expected list

3. **Prioritize fixes** based on:
   - User impact (userCount)
   - Frequency (event count)
   - Severity (level)
   - Business criticality

4. **Create issues** for top errors in your issue tracker

5. **Share findings** with the team for context and planning

---

## Monitoring Recommendations

### Set up Sentry Alerts for:

1. **Auth errors > 100 events/hour**
   - Indicates auth system issue

2. **Payment errors > 5 events/hour**
   - Critical for revenue

3. **New error types**
   - Catch issues from new deployments

4. **Error rate > 5% of requests**
   - Indicates systemic issue

### Weekly Review Checklist:

- [ ] Review top 10 errors by frequency
- [ ] Check if any errors are increasing week-over-week
- [ ] Review errors affecting multiple users
- [ ] Identify and fix errors with clear solutions
- [ ] Add monitoring for new error patterns
- [ ] Update error handling based on patterns

---

## Questions to Answer

When reviewing Sentry:

1. ✅ What are the top 5 errors by event count?
2. ✅ What are the top 5 errors by user count?
3. ✅ Are authentication errors the most common? (Expected: YES)
4. ✅ What percentage of errors are auth-related?
5. ✅ Are there any unexpected error patterns?
6. ✅ Are errors concentrated in specific browser/OS?
7. ✅ Do errors spike at certain times of day?
8. ✅ Are staging errors different from production?

Answer these questions after running the analysis scripts!
