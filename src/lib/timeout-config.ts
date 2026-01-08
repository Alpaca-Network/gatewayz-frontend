/**
 * Unified timeout configuration for the application
 * All timeout values are in milliseconds
 */

export const TIMEOUT_CONFIG = {
  // Authentication timeouts
  auth: {
    tokenFetch: 3000,        // 3 seconds for getting Privy token
    backendSync: 10000,      // 10 seconds for backend authentication
    apiKeyUpgrade: 5000,     // 5 seconds for API key upgrade
    userDataFetch: 3000,     // 3 seconds for fetching user data
  },

  // Chat session timeouts
  chat: {
    sessionCreate: 30000,    // 30 seconds to create a session (increased from 15s for backend performance under load)
    sessionUpdate: 15000,    // 15 seconds to update a session
    sessionDelete: 30000,    // 30 seconds to delete a session
    messagesSave: 10000,     // 10 seconds to save a message (was 5s, too aggressive)
    messagesLoad: 15000,     // 15 seconds to load messages
    sessionsList: 10000,     // 10 seconds to list sessions
  },

  // Streaming timeouts
  streaming: {
    initial: 60000,          // 1 minute max for initial streaming response
    chunk: 30000,            // 30 seconds between chunks
  },

  // API request timeouts
  api: {
    default: 30000,          // 30 seconds default
    quick: 5000,             // 5 seconds for quick operations
    long: 60000,             // 60 seconds for long operations
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,      // 1 second initial retry delay
    maxDelay: 10000,         // 10 seconds max retry delay
    backoffMultiplier: 2,    // Exponential backoff multiplier
  }
} as const;

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(attempt: number): number {
  const { initialDelay, maxDelay, backoffMultiplier } = TIMEOUT_CONFIG.retry;
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Create an AbortController with timeout
 */
export function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

/**
 * Execute a function with timeout and retry logic
 */
export async function withTimeoutAndRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: {
    timeout?: number;
    maxRetries?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const {
    timeout = TIMEOUT_CONFIG.api.default,
    maxRetries = TIMEOUT_CONFIG.retry.maxAttempts,
    shouldRetry = (error) => {
      // Default: retry on network errors and timeouts
      if (error instanceof Error) {
        return error.name === 'AbortError' ||
               error.message.includes('network') ||
               error.message.includes('timeout');
      }
      return false;
    },
    onRetry
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { controller, timeoutId } = createTimeoutController(timeout);

    try {
      const result = await fn(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      // Don't retry if it's the last attempt or if we shouldn't retry this error
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate backoff delay
      const delay = calculateBackoffDelay(attempt);

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, error);
      }

      console.log(`[Retry] Attempt ${attempt} failed, retrying after ${delay}ms...`, error);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Circuit breaker implementation to prevent cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold = 3,
    private readonly timeout = 60000,
    private readonly halfOpenAttempts = 1
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should be opened
    if (this.state === 'open') {
      const timeSinceLastFail = Date.now() - this.lastFailTime;
      if (timeSinceLastFail > this.timeout) {
        this.state = 'half-open';
        this.failures = 0;
      } else {
        throw new Error('Circuit breaker is open - service unavailable');
      }
    }

    try {
      const result = await fn();

      // Success - reset circuit
      if (this.state === 'half-open') {
        this.state = 'closed';
      }
      this.failures = 0;

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailTime = Date.now();

      // Open circuit if threshold reached
      if (this.failures >= this.threshold) {
        this.state = 'open';
        console.error(`[CircuitBreaker] Opening circuit after ${this.failures} failures`);
      }

      throw error;
    }
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailTime = 0;
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}