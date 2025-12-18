import { models } from '@/lib/models-data';
import { getErrorMessage, isAbortOrNetworkError } from '@/lib/network-error';
import { cacheAside, cacheStaleWhileRevalidate, cacheKey, CACHE_PREFIX, TTL, cacheInvalidate } from '@/lib/cache-strategies';
import {
  VALID_GATEWAYS,
  PRIORITY_GATEWAYS,
  buildGatewayHeaders,
  normalizeGatewayId,
  isValidGateway,
  autoRegisterGatewaysFromModels,
  getAllActiveGatewayIds,
} from '@/lib/gateway-registry';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

// In-memory cache for models to reduce API calls (fallback if Redis unavailable)
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

// Transform static models data to backend format
function transformModel(model: any, gateway: string) {
  const resolvedGateway = gateway === 'all' ? 'openrouter' : gateway;

  // Normalize model name for URL-safe ID
  // Extract actual model name by removing provider prefix (e.g., "Anthropic: " from "Anthropic: Claude 3.5 Sonnet")
  const nameParts = model.name.split(':');
  const modelNamePart = nameParts.length > 1 ? nameParts[1].trim() : model.name;
  const normalizedName = modelNamePart.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return {
    id: `${model.developer}/${normalizedName}`,
    name: model.name,
    description: model.description,
    context_length: model.context * 1000, // Convert K to actual number
    pricing: {
      prompt: model.inputCost.toString(),
      completion: model.outputCost.toString()
    },
    architecture: {
      input_modalities: model.modalities.map((m: string) => m.toLowerCase()),
      output_modalities: ['text'] // Default output modality
    },
    supported_parameters: model.supportedParameters,
    provider_slug: model.developer,
    provider_slugs: [model.developer], // NEW: Track provider as array for consistent display
    source_gateway: resolvedGateway, // Keep for backwards compatibility
    source_gateways: [resolvedGateway], // NEW: Track gateway as array for consistent display
    is_private: model.is_private // Preserve is_private field if present
  };
}

export async function getModelsForGateway(gateway: string, limit?: number) {
  // Use Redis cache with stale-while-revalidate pattern for instant page loads
  const cacheKeyStr = cacheKey(
    CACHE_PREFIX.MODELS,
    gateway,
    limit ? `limit:${limit}` : 'all'
  );

  // Stale-while-revalidate:
  // - Fresh for 4 hours (TTL.MODELS_ALL)
  // - Serve stale for up to 12 additional hours (3x TTL)
  // - Revalidate in background when stale
  return await cacheStaleWhileRevalidate(
    cacheKeyStr,
    async () => {
      // Fetch logic (extracted below)
      return await fetchModelsLogic(gateway, limit);
    },
    TTL.MODELS_ALL, // Fresh TTL: 4 hours
    TTL.MODELS_ALL * 3, // Stale TTL: 12 hours (total cache lifetime: 16 hours)
    'models' // Metrics category
  );
}

// Extracted fetch logic for reuse
async function fetchModelsLogic(gateway: string, limit?: number) {
  // Check in-memory cache as fallback
  if (modelsCache && gateway === 'all') {
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

  // FIX: Use single backend call with gateway=all instead of N+1 individual gateway calls
  // The backend already handles aggregation and deduplication across all gateways efficiently
  // This eliminates ~20+ individual API calls and improves root load performance significantly
  if (gateway === 'all') {
    console.log('[Models] Fetching all models from backend with gateway=all (single request)');
    try {
      // Make a single API call to the backend with gateway=all
      // The backend handles fetching from all gateways and deduplication internally
      const models = await fetchModelsFromGateway('all', limit);

      if (models.length > 0) {
        // Auto-register any new gateways discovered from the API response
        // This allows new gateways to appear in the UI without code changes
        autoRegisterGatewaysFromModels(models);

        console.log(`[Models] Fetched ${models.length} models from backend with gateway=all`);

        // Cache the result for 'all' gateway
        modelsCache = {
          data: models,
          timestamp: Date.now()
        };

        return { data: models };
      }
      // If no models returned, fall through to static fallback
    } catch (error) {
      console.error('[Models] Error fetching from backend with gateway=all:', error);
      // Fall through to static fallback
    }
  }

  // For specific gateways, use the existing fetch logic
  const models = await fetchModelsFromGateway(gateway, limit);
  if (models.length > 0) {
    return { data: models };
  }

  // Fallback to static data (only used if API fails)
  return { data: getStaticFallbackModels(gateway) };
}

// Helper function to build request headers (uses centralized gateway registry)
function buildHeaders(gateway: string): Record<string, string> {
  return buildGatewayHeaders(gateway);
}

// Helper function to normalize model fields for consistent tag display
function normalizeModel(model: any, gateway: string): any {
  // Normalize gateway values using centralized registry
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
async function fetchModelsFromGateway(gateway: string, limit?: number): Promise<any[]> {
  const allModels: any[] = [];
  const requestLimit = limit || 50000; // Request up to 50k models per page (backend limit)
  // Use centralized PRIORITY_GATEWAYS for fast gateway detection
  // Increased timeouts to handle slow gateways: 5000ms for fast, 30000ms for slow (HuggingFace needs more time)
  const timeoutMs = PRIORITY_GATEWAYS.includes(gateway) ? 5000 : 30000;

  let offset = 0;
  let hasMore = true;
  let pageCount = 0;

  // Determine base URL based on runtime environment
  const baseUrl = getApiBaseUrl();
  const isClientSide = typeof window !== 'undefined';

  // On client-side, pagination is handled by the server (via /api/models route)
  // so we only make a single request without offset. The server-side getModelsForGateway
  // handles all pagination internally before returning results.
  const maxPages = isClientSide ? 1 : 10;

  while (hasMore && pageCount < maxPages) {
    pageCount++;
    // Only include offset for server-side requests (client requests don't paginate)
    const offsetParam = (!isClientSide && offset > 0) ? `&offset=${offset}` : '';
    const limitParam = `limit=${requestLimit}${offsetParam}`;

    // Build URLs based on environment
    // Client-side: use Next.js API route (/api/models) to avoid CORS - single request, no pagination
    // Server-side: try both v1/models and /models endpoints using Promise.race for fast fallback
    const urls = isClientSide
      ? [`/api/models?gateway=${gateway}&${limitParam}`]
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

        // Build fetch options - include Next.js caching only on server-side
        const fetchOptions: RequestInit = {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(timeoutMs)
        };

        // Add Next.js specific caching options only on server-side
        if (!isClientSide) {
          (fetchOptions as any).next = {
            revalidate: 300,
            tags: [`models:gateway:${gateway}`, 'models:all']
          };
        }

        // Try endpoints in parallel (server-side) or single endpoint (client-side)
        const response = await Promise.race(
          urls.map((url) => fetch(url, fetchOptions))
        );

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
          const data = await response.json();

          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            // Normalize each model to ensure provider_slugs and source_gateways are arrays
            const normalizedModels = data.data.map((model: any) => normalizeModel(model, gateway));
            allModels.push(...normalizedModels);
            console.log(`[Models] Fetched ${data.data.length} models for gateway: ${gateway} (offset: ${offset})`);

            const isFiveHundred = data.data.length === 500 && (gateway === 'huggingface' || gateway === 'featherless');
            const hasReachedLimit = limit && allModels.length >= limit;
            const gotFewerThanRequested = data.data.length < requestLimit && !isFiveHundred;

            if (gotFewerThanRequested || hasReachedLimit) {
              hasMore = false;
            } else {
              offset += requestLimit;
            }
          } else {
            hasMore = false;
          }
          break; // Success, exit retry loop
        } else {
          hasMore = false;
          break;
        }
      } catch (error: any) {
        const message = getErrorMessage(error);
        if (isAbortOrNetworkError(error)) {
          // Only log timeouts in development mode to reduce console noise
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Models] ${gateway} request timed out after ${timeoutMs}ms (will use cache/fallback)`);
          }
        } else {
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

// Helper function to get static fallback models
function getStaticFallbackModels(gateway: string): any[] {
  // Only log fallback usage in development to reduce console noise in production
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[Models] No models fetched from API for ${gateway}, using static fallback (${models.length} models)`);
  }
  let transformedModels;

  // Normalize gateway to canonical ID (e.g., 'hug' -> 'huggingface')
  // This ensures aliases are resolved before any lookups
  const normalizedGateway = normalizeGatewayId(gateway);

  // Map developers to their preferred gateways
  const developerToGateway: Record<string, string> = {
    'alpaca-network': 'alpaca',
    'near': 'near',
    'alibaba': 'alibaba',
    'google': 'google',
    'clarifai': 'clarifai',
    'onerouter': 'onerouter',
    // Add more mappings as needed
  };

  if (normalizedGateway === 'all') {
    // Assign models to gateways based on their developer field if possible
    transformedModels = models.map((model) => {
      // Check if this developer has a specific gateway mapping
      const assignedGateway = developerToGateway[model.developer] || 'openrouter';
      return transformModel(model, assignedGateway);
    });
  } else {
    // Get models for specific gateway by filtering by developer field
    // This maps gateway names to their corresponding developer identifiers
    const gatewayToDeveloper: Record<string, string> = {
      'alpaca': 'alpaca-network',
      'near': 'near',
      'alibaba': 'alibaba',
      'google': 'google',
      'clarifai': 'clarifai',
      'onerouter': 'onerouter',
      // Add more mappings as needed for other gateways
    };

    let gatewayModels;

    // If we have a specific developer mapping, filter by developer field
    if (gatewayToDeveloper[normalizedGateway]) {
      const developerName = gatewayToDeveloper[normalizedGateway];
      gatewayModels = models.filter(m => m.developer === developerName);
    } else {
      // For gateways without specific mappings, distribute models evenly as before
      // Uses dynamic function to include runtime-registered gateways
      const allGateways = getAllActiveGatewayIds();
      const modelsPerGateway = Math.ceil(models.length / allGateways.length);

      // Use normalized gateway for lookup to handle aliases correctly
      const gatewayIndex = allGateways.indexOf(normalizedGateway);
      if (gatewayIndex !== -1) {
        const startIndex = gatewayIndex * modelsPerGateway;
        const endIndex = gatewayIndex === allGateways.length - 1 ? models.length : (gatewayIndex + 1) * modelsPerGateway;
        gatewayModels = models.slice(startIndex, endIndex);
      } else {
        gatewayModels = models; // Default to all models for unknown gateways
      }
    }

    transformedModels = gatewayModels.map(m => transformModel(m, normalizedGateway));
  }

  return transformedModels;
}

/**
 * Invalidate models cache for a specific gateway or all gateways
 *
 * @param gateway - Gateway to invalidate, or 'all' for all caches
 * @returns Number of cache keys invalidated
 */
export async function invalidateModelsCache(gateway?: string): Promise<number> {
  try {
    if (gateway) {
      // Invalidate specific gateway cache
      const pattern = cacheKey(CACHE_PREFIX.MODELS, gateway, '*');
      const deleted = await cacheInvalidate(pattern);
      console.log(`[Models] Invalidated ${deleted} cache entries for gateway: ${gateway}`);
      return deleted;
    } else {
      // Invalidate all models caches
      const pattern = cacheKey(CACHE_PREFIX.MODELS, '*');
      const deleted = await cacheInvalidate(pattern);
      console.log(`[Models] Invalidated ${deleted} cache entries for all gateways`);

      // Also clear in-memory cache
      modelsCache = null;

      return deleted;
    }
  } catch (error) {
    console.error('[Models] Error invalidating cache:', error);
    // Clear in-memory cache as fallback
    modelsCache = null;
    return 0;
  }
}
