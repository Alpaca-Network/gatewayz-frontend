/**
 * Streaming Errors
 *
 * Custom error classes for streaming operations.
 */

/**
 * Error thrown during stream processing that should be displayed to the user.
 * Distinguishes intentional errors (API errors, validation) from parsing errors.
 */
export class StreamingError extends Error {
  public readonly code?: string;
  public readonly type?: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    options?: {
      code?: string;
      type?: string;
      retryable?: boolean;
    }
  ) {
    super(message);
    this.name = 'StreamingError';
    this.code = options?.code;
    this.type = options?.type;
    this.retryable = options?.retryable ?? false;
  }
}

/**
 * Error thrown when authentication fails during streaming.
 */
export class AuthenticationError extends StreamingError {
  constructor(message: string) {
    super(message, { code: 'AUTH_ERROR', type: 'authentication', retryable: false });
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when rate limited.
 */
export class RateLimitError extends StreamingError {
  public readonly retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number) {
    super(message, { code: 'RATE_LIMIT', type: 'rate_limit', retryable: true });
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Error thrown when the stream times out.
 */
export class StreamTimeoutError extends StreamingError {
  constructor(message: string) {
    super(message, { code: 'TIMEOUT', type: 'timeout', retryable: true });
    this.name = 'StreamTimeoutError';
  }
}

/**
 * Error thrown when no content is received from the model.
 */
export class EmptyResponseError extends StreamingError {
  constructor(modelId: string) {
    super(
      `No response received from model "${modelId}". The model may be unavailable or not properly configured.`,
      { code: 'EMPTY_RESPONSE', type: 'empty_response', retryable: true }
    );
    this.name = 'EmptyResponseError';
  }
}
