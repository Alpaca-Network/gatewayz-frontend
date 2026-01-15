/**
 * Monitoring Service
 *
 * Centralized service for making monitoring API calls with optional authentication.
 *
 * Features:
 * - Optional authentication via Bearer token
 * - Automatic fallback to unauthenticated requests on 401 errors
 * - Rate limit handling with exponential backoff (429 errors)
 * - Gateway/server error handling with retry (502/503/504 errors)
 * - Type-safe request/response handling
 * - Consistent error handling
 * - Sentry metrics integration for monitoring API performance
 *
 * Usage:
 *   // Without authentication (public access)
 *   const health = await monitoringService.getProviderHealth();
 *
 *   // With authentication (for logged-in users)
 *   const apiKey = getApiKey();
 *   const health = await monitoringService.getProviderHealth(apiKey);
 */

import { sentryMetrics } from './sentry-metrics';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

// Retry configuration for rate limits (429) and server errors (502/503/504)
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

// Helper function for delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate retry delay with exponential backoff and jitter
 */
function calculateRetryDelay(
  retryCount: number,
  retryAfterHeader: string | null
): number {
  // Start with exponential backoff: 1s, 2s, 4s
  let waitTime = Math.min(
    BASE_RETRY_DELAY_MS * Math.pow(2, retryCount),
    MAX_RETRY_DELAY_MS
  );

  // Honor Retry-After header if present, but cap at MAX_RETRY_DELAY_MS
  // to prevent unexpectedly long waits from large server-provided values
  // Supports both numeric seconds and HTTP-date format per RFC 7231
  if (retryAfterHeader) {
    const numericRetry = Number(retryAfterHeader);
    if (!Number.isNaN(numericRetry) && numericRetry > 0) {
      // Retry-After is in seconds, convert to milliseconds and cap
      const retryDelayMs = Math.min(numericRetry * 1000, MAX_RETRY_DELAY_MS);
      waitTime = Math.max(waitTime, retryDelayMs);
    } else {
      // Try parsing as HTTP-date format (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")
      const retryDate = Date.parse(retryAfterHeader);
      if (!Number.isNaN(retryDate)) {
        const headerWait = retryDate - Date.now();
        if (headerWait > 0) {
          // Cap at MAX_RETRY_DELAY_MS to prevent unexpectedly long waits
          const cappedWait = Math.min(headerWait, MAX_RETRY_DELAY_MS);
          waitTime = Math.max(waitTime, cappedWait);
        }
      }
    }
  }

  // Add jitter to prevent thundering herd (0-500ms)
  const jitter = Math.floor(Math.random() * 500);
  return waitTime + jitter;
}

interface FetchOptions {
  apiKey?: string;
  retryWithoutAuth?: boolean;
  retryCount?: number;
}

/**
 * Makes an authenticated or unauthenticated fetch request to monitoring endpoints
 *
 * @param url - The endpoint URL to fetch
 * @param options - Optional configuration including API key
 * @returns Response data
 * @throws Error if request fails
 */
async function fetchWithOptionalAuth<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { apiKey, retryWithoutAuth = true, retryCount = 0 } = options;
  const startTime = Date.now();

  const headers: HeadersInit = {};

  // Add authentication if API key is provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(url, { headers });
    const durationMs = Date.now() - startTime;

    // Track API request metrics for all responses (success and HTTP errors)
    // This is the single point of tracking for completed HTTP requests
    sentryMetrics.trackApiRequest(url, 'GET', durationMs, response.status);

    // Handle 429 - Rate limit with retry
    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        const retryAfter = response.headers.get('retry-after');
        const delayMs = calculateRetryDelay(retryCount, retryAfter);

        console.warn(
          `[monitoring-service] Rate limited (429), retrying in ${delayMs}ms ` +
          `(attempt ${retryCount + 1}/${MAX_RETRIES})`
        );

        await sleep(delayMs);

        // Retry with incremented retry count
        return fetchWithOptionalAuth<T>(url, {
          apiKey,
          retryWithoutAuth,
          retryCount: retryCount + 1
        });
      }

      // Max retries exceeded
      console.error('[monitoring-service] Rate limit exceeded after max retries');
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Handle 502/503/504 - Gateway/Server errors with retry
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      const statusName = response.status === 504 ? 'Gateway Timeout' :
                         response.status === 503 ? 'Service Unavailable' : 'Bad Gateway';

      if (retryCount < MAX_RETRIES) {
        // Use longer delays for server errors (they often indicate overload)
        const baseDelay = BASE_RETRY_DELAY_MS * 2; // Start with 2 seconds for server errors
        const waitTime = Math.min(
          baseDelay * Math.pow(2, retryCount),
          MAX_RETRY_DELAY_MS
        );
        const jitter = Math.floor(Math.random() * 500);
        const delayMs = waitTime + jitter;

        console.warn(
          `[monitoring-service] ${statusName} (${response.status}), retrying in ${delayMs}ms ` +
          `(attempt ${retryCount + 1}/${MAX_RETRIES})`
        );

        await sleep(delayMs);

        // Retry with incremented retry count
        return fetchWithOptionalAuth<T>(url, {
          apiKey,
          retryWithoutAuth,
          retryCount: retryCount + 1
        });
      }

      // Max retries exceeded
      console.error(`[monitoring-service] ${statusName} error after max retries`);
      throw new Error(`${statusName}. The service is temporarily unavailable. Please try again later.`);
    }

    // Handle 401 - Invalid or expired API key
    if (response.status === 401 && apiKey && retryWithoutAuth) {
      console.warn('[monitoring-service] API key invalid, retrying without auth');

      // Retry without authentication
      return fetchWithOptionalAuth<T>(url, {
        apiKey: undefined,
        retryWithoutAuth: false, // Prevent infinite retry loop
        retryCount: 0 // Reset retry counter for new auth state
      });
    }

    // Handle 404 - No data available
    if (response.status === 404) {
      throw new Error('No data available');
    }

    // Handle other errors
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // Only track errors here for actual network/fetch failures (not HTTP error responses)
    // HTTP error responses (4xx, 5xx) are already tracked at line 110 with the real status code
    // This catch block handles: network failures, DNS errors, connection timeouts, JSON parse errors, etc.
    const isNetworkError = error instanceof TypeError;
    const isJsonParseError = error instanceof SyntaxError;

    // Only track if this is a true network/parsing failure (not an error thrown from HTTP status handling)
    if (isNetworkError || isJsonParseError) {
      const durationMs = Date.now() - startTime;
      const errorType = isNetworkError ? 'network' : 'json_parse';
      sentryMetrics.trackApiError(url, errorType);
      sentryMetrics.trackApiRequest(url, 'GET', durationMs, 0, { error_type: errorType });
    }

    // Network errors, JSON parse errors, etc.
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

/**
 * Monitoring Service
 * Provides methods for all monitoring-related API calls
 */
export const monitoringService = {
  /**
   * Get health data for a specific model
   * 
   * @param provider - Provider name (e.g., "openai")
   * @param model - Model name (e.g., "gpt-4")
   * @param apiKey - Optional API key for authenticated requests
   * @returns Model health data or null if not available
   */
  async getModelHealth(
    provider: string,
    model: string,
    apiKey?: string
  ): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health/${provider}/${model}`;
    
    try {
      return await fetchWithOptionalAuth(url, { apiKey });
    } catch (error) {
      if (error instanceof Error && error.message === 'No data available') {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get overall system health statistics
   * 
   * @param apiKey - Optional API key for authenticated requests
   * @returns System-wide health statistics
   */
  async getHealthStats(apiKey?: string): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health/stats`;
    return fetchWithOptionalAuth(url, { apiKey });
  },

  /**
   * Get list of all models with health data
   * 
   * @param limit - Number of results to return (default: 50)
   * @param offset - Offset for pagination (default: 0)
   * @param apiKey - Optional API key for authenticated requests
   * @returns Paginated list of model health data
   */
  async getModelHealthList(
    limit: number = 50,
    offset: number = 0,
    apiKey?: string
  ): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health?limit=${limit}&offset=${offset}`;
    return fetchWithOptionalAuth(url, { apiKey });
  },

  /**
   * Get list of unhealthy models
   * 
   * @param errorThreshold - Error rate threshold (0-1, default: 0.2 = 20%)
   * @param apiKey - Optional API key for authenticated requests
   * @returns List of models exceeding error threshold
   */
  async getUnhealthyModels(
    errorThreshold: number = 0.2,
    apiKey?: string
  ): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health/unhealthy?error_threshold=${errorThreshold}`;
    return fetchWithOptionalAuth(url, { apiKey });
  },

  /**
   * Get summary for a specific provider
   * 
   * @param provider - Provider name (e.g., "openai")
   * @param apiKey - Optional API key for authenticated requests
   * @returns Provider summary with aggregated health metrics
   */
  async getProviderSummary(
    provider: string,
    apiKey?: string
  ): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health/provider/${provider}/summary`;
    return fetchWithOptionalAuth(url, { apiKey });
  },

  /**
   * Get list of all providers with health data
   * 
   * @param apiKey - Optional API key for authenticated requests
   * @returns List of provider names
   */
  async getProviderList(apiKey?: string): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health/providers`;
    return fetchWithOptionalAuth(url, { apiKey });
  }
};

export default monitoringService;
