/**
 * Retry utilities for handling transient server errors
 * Implements exponential backoff with jitter for robust error recovery
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitterFactor?: number;
  retryableStatuses?: number[];
}

/**
 * Default retry configuration for 429/502/503/504 errors
 * - 429: Too Many Requests (rate limiting)
 * - 502: Bad Gateway
 * - 503: Service Unavailable
 * - 504: Gateway Timeout
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableStatuses: [429, 502, 503, 504],
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoffDelay(
  attempt: number,
  options: Required<RetryOptions>,
  retryAfterHeader?: string | null
): number {
  let baseDelay = Math.min(
    options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt),
    options.maxDelayMs
  );

  // Honor Retry-After header if present (for 429 responses)
  // Cap at maxDelayMs to prevent unexpectedly long waits from large Retry-After values
  if (retryAfterHeader) {
    const numericRetry = Number(retryAfterHeader);
    if (!Number.isNaN(numericRetry) && numericRetry > 0) {
      // Retry-After is in seconds, convert to milliseconds and cap at maxDelayMs
      const retryDelayMs = Math.min(numericRetry * 1000, options.maxDelayMs);
      baseDelay = Math.max(baseDelay, retryDelayMs);
    } else {
      // Try parsing as HTTP date
      const retryDate = Date.parse(retryAfterHeader);
      if (!Number.isNaN(retryDate)) {
        const headerWait = retryDate - Date.now();
        if (headerWait > 0) {
          // Cap at maxDelayMs to prevent unexpectedly long waits
          const cappedWait = Math.min(headerWait, options.maxDelayMs);
          baseDelay = Math.max(baseDelay, cappedWait);
        }
      }
    }
  }

  // Add jitter: ±10% of base delay (prevents thundering herd)
  const jitter = baseDelay * options.jitterFactor * (Math.random() * 2 - 1);
  const delayMs = Math.max(0, baseDelay + jitter);

  return Math.round(delayMs);
}

/**
 * Check if status code is retryable
 */
function isRetryableStatus(status: number, retryableStatuses: number[]): boolean {
  return retryableStatuses.includes(status);
}

/**
 * Retry a fetch request with exponential backoff
 * Automatically retries on 502/503/504 errors
 *
 * @param fn - Async function that returns a Response
 * @param options - Retry configuration
 * @returns Response from successful attempt or final failed attempt
 *
 * @example
 * const response = await retryFetch(
 *   () => fetch(url, options),
 *   { maxRetries: 3 }
 * );
 */
export async function retryFetch(
  fn: () => Promise<Response>,
  options: RetryOptions = {}
): Promise<Response> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fn();
      lastResponse = response;

      // Don't retry on success
      if (response.ok) {
        return response;
      }

      // Check if status is retryable (handles 429, 502, 503, 504)
      if (!isRetryableStatus(response.status, config.retryableStatuses)) {
        return response;
      }

      // If this is the last attempt, return the error response
      if (attempt === config.maxRetries) {
        console.warn(
          `[retry] Exhausted retries for status ${response.status} after ${config.maxRetries} attempts`
        );
        return response;
      }

      // Get Retry-After header for 429 responses
      const retryAfterHeader = response.status === 429
        ? response.headers.get('retry-after')
        : null;

      // Calculate delay and retry (respects Retry-After header for 429)
      const delayMs = calculateBackoffDelay(attempt, config, retryAfterHeader);
      console.warn(
        `[retry] Retrying after ${response.status} error (attempt ${attempt + 1}/${config.maxRetries}, delay: ${delayMs}ms)`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on network errors or other exceptions - just fail
      if (attempt === config.maxRetries) {
        console.error(`[retry] Network error after ${config.maxRetries} attempts:`, lastError.message);
        throw lastError;
      }

      // For network errors, still apply backoff
      const delayMs = calculateBackoffDelay(attempt, config);
      console.warn(
        `[retry] Network error, retrying (attempt ${attempt + 1}/${config.maxRetries}, delay: ${delayMs}ms)`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should not reach here, but return last response if it exists
  if (lastResponse) {
    return lastResponse;
  }

  throw new Error("Retry logic error: No response received");
}

/**
 * Async function retry with exponential backoff
 * More generic version for retrying any async operation
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Result from successful attempt
 *
 * @example
 * const result = await retryAsync(
 *   () => someAsyncOperation(),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: Omit<RetryOptions, "retryableStatuses"> & {
    shouldRetry?: (error: Error, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 500, maxDelayMs = 10000, backoffMultiplier = 2, jitterFactor = 0.1, shouldRetry } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const canRetry = !shouldRetry || shouldRetry(lastError, attempt);

      if (!canRetry || attempt === maxRetries) {
        throw lastError;
      }

      const baseDelay = Math.min(initialDelayMs * Math.pow(backoffMultiplier, attempt), maxDelayMs);
      const jitter = baseDelay * jitterFactor * (Math.random() * 2 - 1);
      const delayMs = Math.round(Math.max(0, baseDelay + jitter));

      console.warn(
        `[retry] Retrying after error (attempt ${attempt + 1}/${maxRetries}, delay: ${delayMs}ms):`,
        lastError.message
      );

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("Retry exhausted");
}
