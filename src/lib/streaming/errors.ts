/**
 * Streaming Errors
 *
 * Custom error classes for streaming operations.
 *
 * IMPORTANT: `message` on these errors is displayed to users. It must always
 * be safe, friendly copy — never raw backend text, provider payloads, stack
 * traces, or JSON. Raw error details belong in telemetry (Sentry) and may be
 * attached via the structured fields below for logging only.
 */

import type { AppError, RateLimitScope } from '@/lib/errors';

/**
 * Error thrown during stream processing that should be displayed to the user.
 * Distinguishes intentional errors (API errors, validation) from parsing errors.
 */
export class StreamingError extends Error {
  public readonly code?: string;
  public readonly type?: string;
  public readonly retryable: boolean;
  /** Backend request ID for support tracing (safe to display as "Error ID"). */
  public readonly requestId?: string;
  /** Seconds the client should wait before retrying (from Retry-After). */
  public readonly retryAfterSeconds?: number;
  public readonly rateLimitScope?: RateLimitScope;
  /** Raw provider/backend error text — telemetry only, never render. */
  public readonly rawDetail?: string;
  /**
   * The classified AppError this streaming error was derived from, when the
   * HTTP/SSE layer already ran classification. `fromStreamingError` returns
   * this directly so no copy/metadata is lost on the way to the UI.
   */
  public readonly appError?: AppError;

  constructor(
    message: string,
    options?: {
      code?: string;
      type?: string;
      retryable?: boolean;
      requestId?: string;
      retryAfterSeconds?: number;
      rateLimitScope?: RateLimitScope;
      rawDetail?: string;
      appError?: AppError;
    }
  ) {
    super(message);
    this.name = 'StreamingError';
    this.code = options?.code;
    this.type = options?.type;
    this.retryable = options?.retryable ?? false;
    this.requestId = options?.requestId;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.rateLimitScope = options?.rateLimitScope;
    this.rawDetail = options?.rawDetail;
    this.appError = options?.appError;
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

  constructor(
    message: string,
    retryAfterMs?: number,
    options?: { rateLimitScope?: RateLimitScope; requestId?: string; appError?: AppError }
  ) {
    super(message, {
      code: 'RATE_LIMIT',
      type: 'rate_limit',
      retryable: true,
      requestId: options?.requestId,
      retryAfterSeconds: retryAfterMs !== undefined ? retryAfterMs / 1000 : undefined,
      rateLimitScope: options?.rateLimitScope,
      appError: options?.appError,
    });
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
