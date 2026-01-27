# Frontend Pagination Update

**Date:** January 27, 2026
**Updated by:** Claude Code
**Related Backend Changes:** Backend pagination fix (has_more, next_offset, total fields)

## Summary

Updated the frontend to properly handle the new backend pagination metadata introduced in the backend fix. The backend now provides `has_more`, `next_offset`, and `total` fields for reliable pagination instead of requiring the frontend to guess when pagination is complete.

## Changes Made

### 1. Added TypeScript Interface for Paginated Response

**File:** `src/lib/models-service.ts`
**Lines:** 18-27

```typescript
interface PaginatedResponse {
  data: any[];
  total?: number;        // Total models available
  returned?: number;     // Models in this page
  offset?: number;       // Current offset
  limit?: number;        // Current limit
  has_more?: boolean;    // More pages exist?
  next_offset?: number;  // Next offset to use for pagination
}
```

### 2. Reduced Default Request Limit

**File:** `src/lib/models-service.ts`
**Line:** 258

**Before:**
```typescript
const requestLimit = limit || 50000; // Request up to 50k models per page
```

**After:**
```typescript
const requestLimit = limit || 500; // Updated to use reasonable page size: 500 models per page
```

**Rationale:**
- Backend now properly supports pagination
- Requesting 50k models at once was excessive
- 500 models per page is more reasonable and reduces memory usage

### 3. Updated Pagination Logic to Use Backend Metadata

**File:** `src/lib/models-service.ts`
**Lines:** 345-383

**Key Changes:**
- Now uses `data.has_more` field to determine if more pages exist (instead of guessing based on response size)
- Uses `data.next_offset` field for the next page offset (instead of manually calculating)
- Logs total model count when available: `(${allModels.length}/${data.total} total)`
- Includes fallback logic for backwards compatibility if backend doesn't provide metadata

**Before:**
```typescript
const gotFewerThanRequested = data.data.length < requestLimit;
if (gotFewerThanRequested || hasReachedLimit) {
  hasMore = false;
} else {
  offset += requestLimit;
}
```

**After:**
```typescript
// Use backend pagination metadata instead of guessing
if (data.has_more !== undefined) {
  hasMore = data.has_more;

  if (data.next_offset !== undefined) {
    offset = data.next_offset;
  } else {
    offset += requestLimit;
  }
} else {
  // Fallback to old logic if backend doesn't provide has_more
  const hasReachedLimit = limit && allModels.length >= limit;
  const gotFewerThanRequested = data.data.length < requestLimit;

  if (gotFewerThanRequested || hasReachedLimit) {
    hasMore = false;
  } else {
    offset += requestLimit;
  }
}
```

### 4. Increased Page Limit for 'all' Gateway

**File:** `src/lib/models-service.ts`
**Line:** 277

**Before:**
```typescript
const maxPages = isClientSide ? 1 : 10;
```

**After:**
```typescript
const maxPages = isClientSide ? 1 : (gateway === 'all' ? 100 : 10);
```

**Rationale:**
- With 12,543 total models in the backend, the old limit of 10 pages × 500 = 5,000 models was insufficient
- Now fetches up to 100 pages × 500 = 50,000 models for 'all' gateway (more than enough)
- Specific gateways still limited to 10 pages to avoid excessive fetching

## How It Works Now

### Server-Side (SSR - /models page)

1. Server calls `getModelsForGateway('all')`
2. Pagination loop fetches up to 100 pages:
   - Request: `GET /v1/models?gateway=all&limit=500&offset=0`
   - Response includes: `{ data: [...], total: 12543, has_more: true, next_offset: 500 }`
   - Loop continues using `next_offset` until `has_more: false`
3. Returns all models (up to 50,000) to the page
4. Page is cached with ISR (revalidate: 60 seconds)

### Client-Side (Browser requests)

1. Client makes single request: `GET /api/models?gateway=all&limit=500`
2. Gets first 500 models only (maxPages = 1 on client-side)
3. Additional models can be loaded via infinite scroll or "Load More" button

## Benefits

✅ **Reliable Pagination:** No more guessing when to stop based on response size
✅ **Backend-Driven:** Backend controls pagination flow with explicit metadata
✅ **Better Performance:** Smaller page sizes (500 vs 50,000) reduce memory usage
✅ **Total Count:** Frontend now knows total available models
✅ **Backwards Compatible:** Fallback logic for older backend responses
✅ **Scalable:** Can fetch all 12,543+ models with 100-page limit

## Testing Recommendations

1. **Test /models page load:**
   ```bash
   # Should fetch all models via pagination
   curl http://localhost:3000/models
   ```

2. **Check server logs:**
   ```
   [Models] Fetched 500 models for gateway: all (offset: 0) (500/12543 total)
   [Models] Fetched 500 models for gateway: all (offset: 500) (1000/12543 total)
   ...
   [Models] Total fetched for gateway all: 12543 models
   ```

3. **Verify API route:**
   ```bash
   curl "http://localhost:3000/api/models?gateway=all&limit=500"
   # Should return first 500 models
   ```

4. **Monitor performance:**
   - Check page load time for /models
   - Verify memory usage doesn't spike
   - Ensure pagination completes in reasonable time

## Future Improvements

1. **Expose pagination metadata in API route:**
   - Currently `/api/models` strips pagination metadata
   - Could return `{ data, total, has_more, next_offset }` for API consumers

2. **Client-side infinite scroll:**
   - Implement "Load More" button or infinite scroll on /models page
   - Fetch additional pages on demand instead of all at once

3. **Streaming pagination:**
   - Stream models as they're fetched instead of waiting for all pages
   - Improve perceived performance on initial load

## Related Files

- `src/lib/models-service.ts` - Main pagination logic
- `src/app/models/page.tsx` - Server component that fetches all models
- `src/app/api/models/route.ts` - API route for client-side requests
- `CLAUDE.md` - Project documentation (should be updated with new pagination details)

## Rollback Instructions

If issues arise, revert to previous pagination logic:

```bash
git diff HEAD src/lib/models-service.ts
git checkout HEAD -- src/lib/models-service.ts
```

Or adjust the `requestLimit` back to a higher value if 500 is too small:
```typescript
const requestLimit = limit || 1000; // Increase to 1000 per page
```
