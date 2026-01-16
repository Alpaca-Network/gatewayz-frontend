# Monitoring API Optional Authentication Implementation

## Overview

This document describes the implementation of optional authentication for monitoring API endpoints in the Gatewayz Beta frontend.

## Summary

We have enhanced the monitoring system to support **optional authentication** via Bearer tokens. This provides several benefits while maintaining backward compatibility:

✅ **Audit Trail** - Monitoring requests from authenticated users are logged with user context
✅ **Higher Rate Limits** - Authenticated users can have higher rate limits in the future
✅ **Analytics** - Track which users are using monitoring features
✅ **Future Access Control** - Ready for when certain metrics become admin-only
✅ **Backward Compatible** - Unauthenticated access still works perfectly

## Architecture

### 1. Monitoring Service Layer (`src/lib/monitoring-service.ts`)

A new centralized service module that:

- Provides a single point of contact for all monitoring API calls
- Handles optional authentication via Bearer tokens
- Automatically falls back to unauthenticated requests on 401 errors
- Provides consistent error handling across all endpoints

**Key Features:**

```typescript
// Fetch with optional authentication
async function fetchWithOptionalAuth<T>(url: string, options: FetchOptions): Promise<T>

// Automatic 401 retry without auth
if (response.status === 401 && apiKey && retryWithoutAuth) {
  console.warn('[monitoring-service] API key invalid, retrying without auth');
  return fetchWithOptionalAuth<T>(url, { apiKey: undefined, retryWithoutAuth: false });
}
```

**Exported Methods:**

- `getModelHealth(provider, model, apiKey?)` - Get health for specific model
- `getHealthStats(apiKey?)` - Get system-wide statistics
- `getModelHealthList(limit, offset, apiKey?)` - Get paginated model list
- `getUnhealthyModels(errorThreshold, apiKey?)` - Get models with high error rates
- `getProviderSummary(provider, apiKey?)` - Get provider summary
- `getProviderList(apiKey?)` - Get list of all providers

### 2. Enhanced Monitoring Hooks (`src/hooks/use-model-health.ts`)

All hooks now accept an optional `apiKey` parameter:

```typescript
// Before (no auth)
export function useModelHealthStats() { ... }

// After (optional auth)
export function useModelHealthStats(apiKey?: string) { ... }
```

**Updated Hooks:**

- `useModelHealth(provider, model, apiKey?)`
- `useModelHealthStats(apiKey?)`
- `useModelHealthList(limit, offset, apiKey?)`
- `useUnhealthyModels(errorThreshold, apiKey?)`
- `useProviderSummary(provider, apiKey?)`
- `useProviderList(apiKey?)`

Each hook now:
1. Accepts optional API key parameter
2. Uses `monitoringService` instead of direct fetch
3. Automatically benefits from 401 retry logic
4. Maintains backward compatibility (apiKey is optional)

### 3. Updated Dashboard Components

#### Model Health Dashboard (`src/app/model-health/page.tsx`)

Now retrieves and passes the API key if user is authenticated:

```typescript
// Get API key if user is authenticated (optional)
const apiKey = getApiKey() || undefined;

// Pass API key to hooks for optional authentication
const { stats, loading: statsLoading, refetch: refetchStats } = useModelHealthStats(apiKey);
const { data, loading: listLoading, refetch: refetchList } = useModelHealthList(pageSize, page * pageSize, apiKey);
```

#### Unhealthy Models Alert (`src/components/model-health/unhealthy-models-alert.tsx`)

Enhanced to support optional API key:

```typescript
interface UnhealthyModelsAlertProps {
  errorThreshold?: number;
  pollInterval?: number;
  className?: string;
  apiKey?: string; // Optional API key for authenticated requests
}

export function UnhealthyModelsAlert({ apiKey, ... }: UnhealthyModelsAlertProps) {
  // Use provided API key or get from localStorage
  const effectiveApiKey = apiKey || getApiKey() || undefined;
  
  const { data, loading, refetch } = useUnhealthyModels(errorThreshold, effectiveApiKey);
}
```

## Authentication Flow

### For Authenticated Users

```
1. User logs in → API key stored in localStorage
2. Dashboard loads → getApiKey() retrieves API key
3. Monitoring hooks called with API key
4. monitoringService adds Authorization header:
   Authorization: Bearer <api_key>
5. Backend receives authenticated request
6. Request logged with user context
7. Response returned to frontend
```

### For Unauthenticated Users

```
1. User visits dashboard without logging in
2. getApiKey() returns null
3. Monitoring hooks called without API key
4. monitoringService makes request without Authorization header
5. Backend allows public access
6. Response returned to frontend
```

### For Invalid/Expired Tokens (401 Handling)

```
1. Request made with API key
2. Backend returns 401 Unauthorized
3. monitoringService detects 401 with apiKey present
4. Logs warning: "API key invalid, retrying without auth"
5. Automatically retries same request without Authorization header
6. Backend allows public access
7. Response returned to frontend
```

## Error Handling

The implementation includes comprehensive error handling:

### Network Errors
```typescript
try {
  return await fetchWithOptionalAuth(url, { apiKey });
} catch (error) {
  if (error instanceof Error) {
    throw error;
  }
  throw new Error('Unknown error occurred');
}
```

### 404 Errors (No Data)
```typescript
if (response.status === 404) {
  throw new Error('No data available');
}

// In hooks
try {
  return await monitoringService.getModelHealth(provider, model, apiKey);
} catch (error) {
  if (error instanceof Error && error.message === 'No data available') {
    return null; // Gracefully handle missing data
  }
  throw error;
}
```

### 401 Errors (Invalid Token)
```typescript
if (response.status === 401 && apiKey && retryWithoutAuth) {
  console.warn('[monitoring-service] API key invalid, retrying without auth');
  return fetchWithOptionalAuth<T>(url, { 
    apiKey: undefined, 
    retryWithoutAuth: false // Prevent infinite retry loop
  });
}
```

### Other HTTP Errors
```typescript
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}
```

## Benefits

### 1. Audit Trail
When users are authenticated, backend can log:
- Which user accessed monitoring data
- What endpoints they accessed
- When they accessed them
- Usage patterns and analytics

### 2. Rate Limiting
Backend can implement different rate limits:
- **Authenticated users**: Higher rate limits (e.g., 1000 req/hour)
- **Unauthenticated users**: Basic rate limits (e.g., 100 req/hour)

### 3. Future Access Control
Ready for future features:
- Admin-only metrics
- User-specific monitoring views
- Premium monitoring features for paid tiers
- Organization-level monitoring dashboards

### 4. Analytics
Track monitoring feature usage:
- Which users use monitoring most
- Most popular metrics
- Peak usage times
- Feature adoption rates

## Backward Compatibility

### No Breaking Changes
- All authentication is **optional**
- Components work with or without API key
- Public access still fully functional
- No user-facing changes required

### Progressive Enhancement
- Unauthenticated: Basic monitoring access
- Authenticated: Enhanced features + audit logging
- Future: Premium features for paid tiers

### Graceful Degradation
- Invalid token → Automatic fallback to public access
- Missing token → Uses public access
- Backend error → Standard error handling

## Testing

### Test Scenarios

1. **Unauthenticated Access**
   - Visit dashboard without logging in
   - All monitoring data loads successfully
   - No errors in console

2. **Authenticated Access**
   - Log in to get API key
   - Visit dashboard
   - Monitoring data loads with authentication
   - API key sent in Authorization header

3. **Invalid Token Handling**
   - Log in with expired/invalid API key
   - Visit dashboard
   - Console shows warning about invalid token
   - Automatic retry without auth succeeds
   - Monitoring data still loads

4. **Token Refresh**
   - Log in and visit dashboard
   - Log out (clears API key)
   - Refresh page
   - Monitoring data still loads (unauthenticated)

## Implementation Files

### New Files
- `src/lib/monitoring-service.ts` - Centralized monitoring service with optional auth

### Modified Files
- `src/hooks/use-model-health.ts` - All hooks now support optional `apiKey` parameter
- `src/app/model-health/page.tsx` - Dashboard now retrieves and passes API key
- `src/components/model-health/unhealthy-models-alert.tsx` - Alert component supports optional API key

### Unchanged Files
- `src/lib/api.ts` - Used existing `getApiKey()` function
- `src/types/model-health.ts` - No type changes needed
- Backend API routes - No changes needed (already support optional auth)

## Security Considerations

### Token Handling
- API keys stored in localStorage (existing pattern)
- Bearer token transmitted in Authorization header
- Automatic cleanup on 401 errors (retry without token)
- No token exposure in URLs or query params

### Rate Limiting
- Backend can implement per-user rate limits
- Unauthenticated requests can have stricter limits
- Prevents abuse while maintaining public access

### Access Control
- Current: All monitoring data is public
- Future: Backend can restrict certain endpoints
- Frontend ready for access control implementation

## Future Enhancements

### Potential Improvements
1. **User-Specific Views**
   - Show monitoring data relevant to user's models
   - Filter by user's organizations
   - Personalized dashboards

2. **Premium Features**
   - Advanced analytics for paid tiers
   - Historical data access
   - Custom alerting rules

3. **Organization Support**
   - Team-level monitoring views
   - Shared dashboards
   - Role-based access control

4. **Real-Time Updates**
   - WebSocket connections for authenticated users
   - Instant alerts for critical issues
   - Live metrics streaming

## Migration Notes

### No Migration Required
This implementation is **fully backward compatible**. No migration steps needed.

### For New Features
When adding new monitoring features that require authentication:

1. Add method to `monitoringService`:
   ```typescript
   async getNewMetric(params, apiKey?: string): Promise<any> {
     const url = `${API_BASE_URL}/v1/monitoring/new-metric`;
     return fetchWithOptionalAuth(url, { apiKey });
   }
   ```

2. Create hook:
   ```typescript
   export function useNewMetric(params, apiKey?: string) {
     // Use monitoringService.getNewMetric(params, apiKey)
   }
   ```

3. Use in component:
   ```typescript
   const apiKey = getApiKey() || undefined;
   const { data } = useNewMetric(params, apiKey);
   ```

## Conclusion

This implementation provides a solid foundation for authenticated monitoring access while maintaining full backward compatibility. The architecture is flexible and ready for future enhancements like access control, premium features, and advanced analytics.

---

**Last Updated:** December 2, 2025  
**Implementation Status:** ✅ Complete  
**Type Check Status:** ✅ Passing  
**Backward Compatibility:** ✅ Full
