# Authentication Timeout Fix - Context & Decisions

## Background

The beta.gatewayz.ai platform experiences authentication timeouts when the backend takes more than 30 seconds to respond. This occurs because:

1. The API proxy has a 15-second timeout per attempt
2. With 3 retries and exponential backoff, total time can reach ~60 seconds
3. The frontend's "authenticating" state guard timeout is only 30 seconds
4. Result: Auth fails with "Authentication timeout - stuck in authenticating state for 30s"

## Console Error Pattern

```
POST https://beta.gatewayz.ai/api/auth 504 (Gateway Timeout)
[retry] Retrying after 504 error (attempt 1/2, delay: 324ms)
[Auth] Authentication timeout - stuck in authenticating state for 30s
[Auth] State transition: authenticating -> error (timeout)
POST https://beta.gatewayz.ai/api/auth 504 (Gateway Timeout)
[retry] Retrying after 504 error (attempt 2/2, delay: 611ms)
```

This shows the retry logic IS working, but the 30-second timeout fires before retries complete.

## Key Architecture Points

### Three-Layer System

```
User Browser
    ↓
Frontend (Privy login)
    ↓
Next.js API Proxy (/api/auth)
  - 15s timeout per attempt
  - 3 retries on 502/503/504
    ↓
Backend API (gatewayz.ai/auth)
  - Validates Privy token
  - Creates/retrieves user
  - Returns API key
```

### Current Timeouts (Before Fix)

| Component | Timeout | Retries | Total Time |
|-----------|---------|---------|-----------|
| API Proxy | 15s | 3 | ~45s (without backoff) |
| Backoff delays | - | - | ~3.5s |
| Total at API layer | - | - | ~48.5s |
| Frontend guard | **30s** | - | ⚠️ FIRES FIRST! |

### Network-Adaptive Timeouts

The system has sophisticated network detection:

```typescript
// From src/lib/network-timeouts.ts
- Slow 2G networks: 2.5x-3.25x multiplier
- 3G networks: 2.5x multiplier
- Mobile devices: 1.75x-2.2x multiplier
- Background tabs: 1.4x multiplier
- Data saver mode: 1.25x multiplier
```

**Problem**: Even with adaptive timeouts (25s max for backend sync), the 30-second guard can still fire if timeout + backoff delays exceed 30s.

## Design Decisions Made

### Decision 1: Increase Authenticating Timeout to 60 Seconds

**Rationale**:
- Accounts for full retry chain (15s × 3 + 3.5s backoff = ~48.5s)
- Adds 10-second safety margin for network jitter
- Total: 60 seconds accommodates slow networks

**Alternative Considered**: Dynamic timeout based on network speed
- **Rejected**: Over-engineering. Static 60s is simpler and accommodates slow networks

### Decision 2: Keep 2 Retries at Both Layers

**Rationale**:
- 1 initial attempt + 2 retries = 3 total attempts (standard for transient errors)
- Reduces total retry time from ~60s to ~40s
- Provides faster failure feedback
- 3 attempts is sufficient to distinguish transient errors from persistent failures

**Alternative Considered**: Reduce to 1 retry total
- **Rejected**: Not enough attempts for transient 502/503/504 errors

### Decision 3: Standardize on 2 Retries at API and Context Layers

**Current state**:
- API proxy: 3 retries
- Context layer: 2 retries
- **Inconsistency**: Confusing behavior

**New state**:
- Both layers: 2 retries
- **Benefit**: Simpler to debug, consistent logging

**Trade-off**: Slightly fewer retries, but faster feedback

### Decision 4: Enhanced Logging for Debugging

**Approach**:
- Log retry attempts at API proxy layer
- Log timeout calculations
- Log guard timeout trigger with context
- Include retry count in error messages

**Benefit**: Clear audit trail for troubleshooting timeout issues

## Implementation Notes

### MIN_AUTH_SYNC_TIMEOUT_MS Calculation

**Current** (before fix):
```typescript
const MIN_AUTH_SYNC_TIMEOUT_MS =
  BACKEND_PROXY_TIMEOUT_MS * BACKEND_PROXY_MAX_RETRIES + BACKEND_PROXY_SAFETY_BUFFER_MS;
// = 15000 * 3 + 5000 = 50000ms
```

**After fix** (with 2 retries):
```typescript
const MIN_AUTH_SYNC_TIMEOUT_MS =
  BACKEND_PROXY_TIMEOUT_MS * (BACKEND_PROXY_MAX_RETRIES + 1) + BACKEND_PROXY_SAFETY_BUFFER_MS + BACKOFF_ESTIMATE_MS;
// = 15000 * 3 + 5000 + 1500 = 56500ms ≈ 55000ms
```

The "+1" is because retries counts attempts (initial + retries = total).

### Timeout Guard Logic

```typescript
// Before fix: Guard fires at 30s
const AUTHENTICATING_TIMEOUT_MS = 30000;

// After fix: Guard fires at 60s, allowing full retry chain + margin
const AUTHENTICATING_TIMEOUT_MS = 60000;
```

**Why 60s?**
- 3 total attempts × 15s = 45s minimum
- Backoff delays (500ms + 1000ms) = ~1.5s
- Safety margin = 10s
- Total = 56.5s, rounded up to 60s

## Validation Points

### Before Deployment

1. ✅ Verify timeout calculations make sense
2. ✅ Ensure retry counts are consistent
3. ✅ Check logging is comprehensive
4. ✅ Validate adaptive timeout multipliers

### After Deployment

1. Monitor Sentry for "Authentication timeout" errors
2. Check auth success rate remains >99%
3. Verify no regression on fast networks
4. Monitor auth latency distribution

## Files and Line Numbers

### Primary Files
- `src/context/gatewayz-auth-context.tsx`:
  - Line 47: AUTHENTICATING_TIMEOUT_MS constant
  - Line 46: MAX_AUTH_RETRIES constant
  - Lines 77-78: MIN_AUTH_SYNC_TIMEOUT_MS calculation
  - Lines 228-242: setAuthTimeout function (guard timeout)
  - Lines 710-738: Backend sync timeout logic
  - Lines 732-738: retryFetch call with retry config

- `src/app/api/auth/route.ts`:
  - Line 36: maxRetries configuration
  - Line 21: API proxy timeout

### Supporting Files
- `src/lib/retry-utils.ts`: Retry logic (no changes needed)
- `src/lib/network-timeouts.ts`: Adaptive timeout calculation
- `src/integrations/privy/auth-sync.ts`: Backend sync utilities

## Known Limitations

1. **Still May Timeout on Extremely Slow Networks**: 60 seconds may not be enough for connections slower than 2G (< 50 kbps)
   - Mitigation: Further increase timeout if monitoring shows need

2. **No Exponential Backoff on Frontend Retries**: Only at API layer
   - Reason: Frontend layer has minimal retries (1-2)

3. **Network Detection Not Perfect**: Adaptive timeout multipliers are estimates
   - Reason: Network speed can fluctuate during request

## Testing Checklist

- [ ] Unit tests verify timeout constants are sane
- [ ] Integration tests with simulated 504 errors
- [ ] Manual testing on slow network (DevTools throttling)
- [ ] Verify retry logs appear in expected sequence
- [ ] Check that fast networks are unaffected
