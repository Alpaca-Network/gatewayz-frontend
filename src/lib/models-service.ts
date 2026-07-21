import { getErrorMessage, isAbortOrNetworkError } from '@/lib/network-error';
import {
  VALID_GATEWAYS,
  PRIORITY_GATEWAYS,
  buildGatewayHeaders,
  normalizeGatewayId,
  isValidGateway,
  autoRegisterGatewaysFromModels,
} from '@/lib/gateway-registry';
import { trackBadBackendResponse, trackBackendNetworkError, trackBackendProcessingError } from '@/lib/backend-error-tracking';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

// TypeScript interface for paginated API response
interface PaginatedResponse {
  data: any[];
  total?: number;        // Total models available
  returned?: number;     // Models in this page
  offset?: number;       // Current offset
  limit?: number;        // Current limit
  has_more?: boolean;    // More pages exist?
  next_offset?: number;  // Next offset to use for pagination
}

// In-memory cache for models to reduce backend API calls
// ISR (revalidate=300) handles page-level caching; this handles repeated calls within a single server lifecycle
let modelsCache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Helper to sleep/delay execution
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate retry delay for rate limit errors with exponential backoff
 */
function calculateRetryDelay(
  retryCount: number,
  retryAfterHeader: string | null
): number {
  // Base delay with exponential backoff
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  let waitTime = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

  // Parse Retry-After header if present
  if (retryAfterHeader) {
    const numericRetry = Number(retryAfterHeader);
    if (!Number.isNaN(numericRetry) && numericRetry > 0) {
      // Retry-After is in seconds
      waitTime = Math.max(waitTime, numericRetry * 1000);
    } else {
      // Try parsing as HTTP date
      const retryDate = Date.parse(retryAfterHeader);
      if (!Number.isNaN(retryDate)) {
        const headerWait = retryDate - Date.now();
        if (headerWait > 0) {
          waitTime = Math.max(waitTime, headerWait);
        }
      }
    }
  }

  // Add jitter to prevent thundering herd
  const jitter = Math.floor(Math.random() * 500);
  waitTime += jitter;

  return waitTime;
}

export async function getModelsForGateway(gateway: string, limit?: number, search?: string) {
  // Search queries bypass cache for fresh results
  if (search) {
    return await fetchModelsLogic(gateway, limit, search);
  }

  // Use in-memory cache for non-search requests
  // ISR (revalidate=300) handles page-level caching
  // This in-memory cache handles repeated calls within a single server lifecycle
  return await fetchModelsLogic(gateway, limit);
}

// Extracted fetch logic for reuse
async function fetchModelsLogic(gateway: string, limit?: number, search?: string) {
  // Check in-memory cache (only for gateway=all without search)
  if (modelsCache && gateway === 'all' && !search) {
    const now = Date.now();
    if (now - modelsCache.timestamp < CACHE_DURATION) {
      console.log(`[Models] Returning in-memory cached models (${modelsCache.data.length} models)`);
      return { data: modelsCache.data };
    }
  }

  // Validate gateway using centralized registry
  if (!isValidGateway(gateway)) {
    throw new Error('Invalid gateway');
  }

  // Use single backend call with gateway=all
  // The backend handles aggregation across all gateways
  if (gateway === 'all') {
    console.log('[Models] Fetching all models from backend with gateway=all');
    try {
      const models = await fetchModelsFromGateway('all', limit, search);

      if (models.length > 0) {
        // Auto-register any new gateways discovered from the API response
        autoRegisterGatewaysFromModels(models);

        console.log(`[Models] Fetched ${models.length} models from backend with gateway=all`);

        // Cache in memory (only if not searching)
        if (!search) {
          modelsCache = {
            data: models,
            timestamp: Date.now()
          };
        }

        return { data: models };
      }
      // If no models returned, fall through to static fallback
    } catch (error) {
      console.error('[Models] Error fetching from backend with gateway=all:', error);
      // Fall through to static fallback
    }
  }

  // For specific gateways, use the existing fetch logic
  const models = await fetchModelsFromGateway(gateway, limit, search);
  if (models.length > 0) {
    return { data: models };
  }

  // The DB-backed catalog is the source of truth (North Star) — there is no
  // hardcoded model table to fall back to. Return an empty result rather than
  // stale/deleted-provider data when the backend has nothing for this gateway.
  return { data: [] };
}

// Helper function to build request headers (uses centralized gateway registry)
function buildHeaders(gateway: string): Record<string, string> {
  return buildGatewayHeaders(gateway);
}

// Helper function to normalize model fields for consistent tag display
function normalizeModel(model: any, gateway: string): any {
  // If model already has providers array (from unique_models=true), it's already
  // in UniqueModel format — pass through without adding legacy fields
  if (Array.isArray(model.providers)) {
    return model;
  }

  // Legacy format normalization: ensure source_gateways and provider_slugs are arrays
  const normalizeGatewayValue = (gw: string) => normalizeGatewayId(gw);

  // Get normalized gateway from source_gateway or use the provided gateway parameter
  const primaryGateway = normalizeGatewayValue(model.source_gateway || gateway);

  return {
    ...model,
    // Ensure source_gateways is always an array with normalized values
    source_gateways: Array.isArray(model.source_gateways)
      ? model.source_gateways.map(normalizeGatewayValue)
      : (model.source_gateway ? [primaryGateway] : [normalizeGatewayValue(gateway)]),
    // Ensure provider_slugs is always an array
    provider_slugs: Array.isArray(model.provider_slugs)
      ? model.provider_slugs
      : (model.provider_slug ? [model.provider_slug] : []),
    // Keep singular fields for backwards compatibility
    source_gateway: primaryGateway,
    provider_slug: model.provider_slug || 'unknown'
  };
}

// Helper function to determine the base URL for API requests
// On client-side (browser), use Next.js API route to avoid CORS issues
// On server-side, use direct backend URL for better performance
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use Next.js API route to proxy requests (avoids CORS)
    return '';
  }
  // Server-side: use direct backend URL
  return API_BASE_URL;
}

// Helper function to fetch models from a specific gateway
async function fetchModelsFromGateway(gateway: string, limit?: number, search?: string): Promise<any[]> {
  const allModels: any[] = [];
  // Backend enforces max limit of 1000 per page (returns 422 for higher values)
  // Use 1000 as default page size for optimal throughput with pagination
  const requestLimit = limit ? Math.min(limit, 1000) : 1000;
  // Use centralized PRIORITY_GATEWAYS for fast gateway detection
  // Timeouts: 180s for 'all' (aggregated endpoint needs time to fetch from all gateways),
  // 5s for fast gateways, 30s for slow (HuggingFace)
  // Note: The 'all' endpoint aggregates from many providers and can take 60-120s under load
  const timeoutMs = gateway === 'all' ? 180000 : (PRIORITY_GATEWAYS.includes(gateway) ? 5000 : 30000);

  let offset = 0;
  let hasMore = true;
  let pageCount = 0;

  // Determine base URL based on runtime environment
  const baseUrl = getApiBaseUrl();
  const isClientSide = typeof window !== 'undefined';

  // On client-side, pagination is handled by the server (via /api/models route)
  // so we only make a single request without offset. The server-side getModelsForGateway
  // handles all pagination internally before returning results.
  // For 'all' gateway on server-side, fetch up to 100 pages to handle 6000+ models
  // Backend caps at 1000 models per page; 100 pages = 100,000 models capacity
  const maxPages = isClientSide ? 1 : (gateway === 'all' ? 100 : 10);

  while (hasMore && pageCount < maxPages) {
    pageCount++;
    // Only include offset for server-side requests (client requests don't paginate)
    const offsetParam = (!isClientSide && offset > 0) ? `&offset=${offset}` : '';
    const limitParam = `limit=${requestLimit}${offsetParam}`;

    // Build URLs based on environment
    // Client-side: use Next.js API route (/api/models) to avoid CORS - single request, no pagination
    // Server-side: try both v1/models and /models endpoints using Promise.race for fast fallback
    //
    // NOTE: GET /v1/models has no `search` query param — the backend silently ignores it
    // (src/routes/catalog.py get_all_models/get_models). Real full-text search lives at
    // GET /v1/models/search?q=<query> (catalog.py search_models, line ~2401), which has no
    // bare (non-v1) fallback, so search requests skip the /models fallback URL entirely.
    const urls = isClientSide
      ? [`/api/models?gateway=${gateway}&${limitParam}${search ? `&search=${encodeURIComponent(search)}` : ''}`]
      : search
        ? [`${baseUrl}/v1/models/search?q=${encodeURIComponent(search)}&gateway=${gateway}&${limitParam}`]
        : [
          `${baseUrl}/v1/models?gateway=${gateway}&${limitParam}`,
          `${baseUrl}/models?gateway=${gateway}&${limitParam}`
        ];

    const maxRetries = 3;
    let retryCount = 0;
    let lastError: { status: number; retryAfter: string | null } | null = null;

    while (retryCount <= maxRetries) {
      try {
        // Add delay for retries
        if (retryCount > 0 && lastError) {
          const waitTime = calculateRetryDelay(retryCount - 1, lastError.retryAfter);
          console.log(`[Models] Rate limited on ${gateway}, retry ${retryCount}/${maxRetries} after ${waitTime}ms`);
          await sleep(waitTime);
        }

        const headers = buildHeaders(gateway);

        const fetchOptions: RequestInit = {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(timeoutMs)
        };

        // Disable Next.js fetch cache — ISR + in-memory cache handle caching
        fetchOptions.cache = 'no-store';

        // Try endpoints: single request on client-side, first-success fallback on server-side.
        // Promise.any() is used instead of Promise.race() so that a fast error response
        // (e.g. v1/models returning 500 immediately) does not win over a slower successful
        // response from the fallback URL. Promise.any() resolves with the first fulfilled
        // (non-rejected) promise, ignoring rejections unless all fail.
        let response: Response;
        if (urls.length === 1) {
          response = await fetch(urls[0], fetchOptions);
        } else {
          // Each URL needs its own AbortSignal so cancelling one doesn't abort the other
          response = await Promise.any(
            urls.map((url) => fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(timeoutMs) })
              .then((res) => {
                // Treat non-OK responses as failures so Promise.any falls through to the next URL
                if (!res.ok && res.status !== 429) throw new Error(`HTTP ${res.status}`);
                return res;
              })
            )
          );
        }

        // Handle rate limit errors with retry
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');

          if (retryCount < maxRetries) {
            lastError = { status: 429, retryAfter };
            retryCount++;
            continue; // Retry
          } else {
            // Max retries exceeded, log and skip this page
            console.error(`[Models] Rate limit exceeded for ${gateway} after ${maxRetries} retries, skipping page`);
            hasMore = false;
            break;
          }
        }

        if (response.ok) {
          const data: PaginatedResponse = await response.json();

          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            // Normalize each model to ensure provider_slugs and source_gateways are arrays
            const normalizedModels = data.data.map((model: any) => normalizeModel(model, gateway));
            allModels.push(...normalizedModels);

            // Log pagination info with total count if available
            const totalInfo = data.total ? ` (${allModels.length}/${data.total} total)` : '';
            console.log(`[Models] Fetched ${data.data.length} models for gateway: ${gateway} (offset: ${offset})${totalInfo}`);

            // Use backend pagination metadata instead of guessing
            // Backend now provides has_more and next_offset fields for reliable pagination
            if (data.has_more !== undefined) {
              // Backend explicitly tells us if there are more pages
              hasMore = data.has_more;

              // Use backend-provided next_offset if available
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
          } else {
            hasMore = false;
          }
          break; // Success, exit retry loop
        } else {
          // Track non-OK responses from backend API
          await trackBadBackendResponse(response, {
            endpoint: urls[0], // Use first URL for logging
            method: 'GET',
            gateway,
            retryCount,
          });
          hasMore = false;
          break;
        }
      } catch (error: any) {
        const message = getErrorMessage(error);
        // AggregateError is thrown by Promise.any() when ALL endpoints fail.
        // Treat it as a network error so it's tracked correctly and can be retried.
        const isAggregateError = error instanceof AggregateError ||
          (error && error.name === 'AggregateError');

        if (isAbortOrNetworkError(error) || isAggregateError) {
          // Track network/timeout errors to backend API
          trackBackendNetworkError(isAggregateError ? (error.errors?.[0] ?? error) : error, {
            endpoint: urls[0],
            method: 'GET',
            gateway,
            timeoutMs,
          });
          // Only log timeouts in development mode to reduce console noise
          if (process.env.NODE_ENV === 'development') {
            if (isAggregateError) {
              console.warn(`[Models] All endpoints failed for ${gateway}: ${error.errors?.map((e: any) => e.message).join(', ')}`);
            } else {
              console.warn(`[Models] ${gateway} request timed out after ${timeoutMs}ms (will use cache/fallback)`);
            }
          }
        } else {
          // Track non-network errors (e.g., JSON parsing, validation, etc.)
          trackBackendProcessingError(error, {
            endpoint: urls[0],
            method: 'GET',
            gateway,
          });
          console.error(`[Models] Failed to fetch ${gateway}:`, message);
        }
        hasMore = false;
        break;
      }
    }
  }

  // Only log fetch results in development or when models were actually fetched
  if (process.env.NODE_ENV === 'development' || allModels.length > 0) {
    console.log(`[Models] Total fetched for gateway ${gateway}: ${allModels.length} models`);
  }
  return allModels;
}

/**
 * Invalidate models cache (clears in-memory cache)
 *
 * @param gateway - Gateway to invalidate (ignored — clears all models cache)
 * @returns 0 (no Redis entries to delete)
 */
export async function invalidateModelsCache(gateway?: string): Promise<number> {
  modelsCache = null;
  console.log(`[Models] In-memory cache cleared${gateway ? ` (requested for gateway: ${gateway})` : ''}`);
  return 0;
}
