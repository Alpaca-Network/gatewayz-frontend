/**
 * Error Types and Utilities
 *
 * Centralized error handling for the application:
 * - Typed error classes
 * - Error codes and messages
 * - User-friendly error formatting
 */

// =============================================================================
// ERROR CODES
// =============================================================================

export type ErrorCode =
  // Auth errors
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'AUTH_INVALID'
  | 'AUTH_RATE_LIMITED'
  // Network errors
  | 'NETWORK_ERROR'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_OFFLINE'
  // API errors
  | 'API_ERROR'
  | 'API_NOT_FOUND'
  | 'API_SERVER_ERROR'
  | 'API_VALIDATION_ERROR'
  | 'API_PAYMENT_REQUIRED'
  | 'API_RATE_LIMITED'
  // Chat errors
  | 'CHAT_SESSION_ERROR'
  | 'CHAT_MESSAGE_ERROR'
  | 'CHAT_STREAM_ERROR'
  | 'CHAT_MODEL_ERROR'
  // General
  | 'UNKNOWN_ERROR';

// =============================================================================
// ERROR MESSAGES
// =============================================================================

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Auth
  AUTH_REQUIRED: 'Please log in to continue',
  AUTH_EXPIRED: 'Your session has expired. Please log in again.',
  AUTH_INVALID: 'Invalid credentials. Please try logging in again.',
  AUTH_RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  // Network
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  NETWORK_TIMEOUT: 'Request timed out. Please try again.',
  NETWORK_OFFLINE: 'You appear to be offline. Please check your connection.',
  // API
  API_ERROR: 'Something went wrong. Please try again.',
  API_NOT_FOUND: 'The requested resource was not found.',
  API_SERVER_ERROR: 'Server error. Please try again later.',
  API_VALIDATION_ERROR: 'Invalid request. Please check your input.',
  API_PAYMENT_REQUIRED: "You don't have enough credits for this request. Add credits to continue.",
  API_RATE_LIMITED: "You're sending requests too quickly. Please wait a moment and try again.",
  // Chat
  CHAT_SESSION_ERROR: 'Failed to manage chat session.',
  CHAT_MESSAGE_ERROR: 'Failed to send message.',
  CHAT_STREAM_ERROR: 'Stream interrupted. Please try again.',
  CHAT_MODEL_ERROR: 'Model unavailable. Please try a different model.',
  // General
  UNKNOWN_ERROR: 'An unexpected error occurred.',
};

// =============================================================================
// BASE ERROR CLASS
// =============================================================================

export interface AppErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  timestamp: number;
  originalError?: Error;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;
  readonly timestamp: number;
  readonly originalError?: Error;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: {
      details?: Record<string, unknown>;
      retryable?: boolean;
      originalError?: Error;
    }
  ) {
    super(message || ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.details = options?.details;
    this.retryable = options?.retryable ?? false;
    this.timestamp = Date.now();
    this.originalError = options?.originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON(): AppErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      timestamp: this.timestamp,
    };
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    return this.message || ERROR_MESSAGES[this.code];
  }
}

// =============================================================================
// SPECIALIZED ERROR CLASSES
// =============================================================================

export class AuthError extends AppError {
  constructor(
    code: Extract<ErrorCode, 'AUTH_REQUIRED' | 'AUTH_EXPIRED' | 'AUTH_INVALID' | 'AUTH_RATE_LIMITED'>,
    message?: string,
    options?: { details?: Record<string, unknown>; originalError?: Error }
  ) {
    super(code, message, {
      ...options,
      retryable: code === 'AUTH_RATE_LIMITED',
    });
    this.name = 'AuthError';
  }
}

export class NetworkError extends AppError {
  constructor(
    code: Extract<ErrorCode, 'NETWORK_ERROR' | 'NETWORK_TIMEOUT' | 'NETWORK_OFFLINE'>,
    message?: string,
    options?: { details?: Record<string, unknown>; originalError?: Error }
  ) {
    super(code, message, {
      ...options,
      retryable: true,
    });
    this.name = 'NetworkError';
  }
}

export class ApiError extends AppError {
  readonly statusCode?: number;

  constructor(
    code: Extract<
      ErrorCode,
      'API_ERROR' | 'API_NOT_FOUND' | 'API_SERVER_ERROR' | 'API_VALIDATION_ERROR' | 'API_PAYMENT_REQUIRED' | 'API_RATE_LIMITED'
    >,
    message?: string,
    options?: {
      details?: Record<string, unknown>;
      statusCode?: number;
      originalError?: Error;
      retryable?: boolean;
    }
  ) {
    super(code, message, {
      ...options,
      retryable: options?.retryable ?? (code === 'API_SERVER_ERROR' || code === 'API_RATE_LIMITED'),
    });
    this.name = 'ApiError';
    this.statusCode = options?.statusCode;
  }
}

export class ChatError extends AppError {
  constructor(
    code: Extract<ErrorCode, 'CHAT_SESSION_ERROR' | 'CHAT_MESSAGE_ERROR' | 'CHAT_STREAM_ERROR' | 'CHAT_MODEL_ERROR'>,
    message?: string,
    options?: {
      details?: Record<string, unknown>;
      retryable?: boolean;
      originalError?: Error;
    }
  ) {
    super(code, message, {
      ...options,
      retryable: options?.retryable ?? code === 'CHAT_STREAM_ERROR',
    });
    this.name = 'ChatError';
  }
}

// =============================================================================
// ERROR FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an appropriate error from an HTTP response
 */
export function fromResponse(response: Response, context?: string): AppError {
  const status = response.status;
  const contextPrefix = context ? `${context}: ` : '';

  if (status === 401) {
    return new AuthError('AUTH_EXPIRED', `${contextPrefix}Session expired`);
  }

  if (status === 403) {
    return new AuthError('AUTH_INVALID', `${contextPrefix}Access denied`);
  }

  if (status === 404) {
    return new ApiError('API_NOT_FOUND', `${contextPrefix}Not found`, {
      statusCode: status,
    });
  }

  if (status === 429) {
    return new AuthError('AUTH_RATE_LIMITED', `${contextPrefix}Rate limited`);
  }

  if (status >= 500) {
    return new ApiError('API_SERVER_ERROR', `${contextPrefix}Server error (${status})`, {
      statusCode: status,
    });
  }

  return new ApiError('API_ERROR', `${contextPrefix}Request failed (${status})`, {
    statusCode: status,
  });
}

/**
 * Wrap any error in an AppError
 */
export function fromUnknown(error: unknown, context?: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isStreamingError(error)) {
    return fromStreamingError(error);
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.name === 'AbortError') {
      return new NetworkError('NETWORK_TIMEOUT', context, {
        originalError: error,
      });
    }

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return new NetworkError('NETWORK_ERROR', context, {
        originalError: error,
      });
    }

    // IMPORTANT: never fall back to `error.message` here — it's raw JS/backend
    // text (that's the whole bug this module exists to prevent). Only a
    // caller-supplied `context` string is safe to show; otherwise AppError's
    // constructor already falls back to ERROR_MESSAGES.UNKNOWN_ERROR.
    return new AppError('UNKNOWN_ERROR', context, {
      originalError: error,
    });
  }

  return new AppError('UNKNOWN_ERROR', context);
}

// =============================================================================
// BACKEND ERROR CLASSIFICATION
//
// The backend (gatewayz-backend) emits errors in several distinct shapes
// depending on where they originate (see docs/api/errors.md there):
//   1. Full envelope:      { error: { code, type, message, status, ... } }
//   2. Partial pass-through: { error: { message, type } } (no `code`)
//   3. String-error variant: { error: "...", message, retry_after } (some 429s)
//   4. Untouched FastAPI 422 default: { detail: [{ type, loc, msg }] }
//   5. Raw middleware JSON with no consistent shape at all
// classifyApiError() normalizes all of them into an AppError without ever
// surfacing the raw body text through getUserMessage().
// =============================================================================

/**
 * Friendly copy for the backend's documented UPPER_SNAKE_CASE error codes
 * (docs/api/errors.md, Error Code Quick Reference). Never includes values
 * from the backend's `context`/`message`/`detail` fields.
 */
const BACKEND_CODE_MESSAGES: Record<string, string> = {
  MODEL_NOT_FOUND: "That model isn't available. Please choose a different model.",
  MODEL_UNAVAILABLE: 'This model is temporarily unavailable. Please try again shortly or choose a different model.',
  MODEL_DEPRECATED: 'This model has been retired. Please choose a different model.',
  MISSING_REQUIRED_FIELD: 'Your request is missing required information. Please check your input and try again.',
  PARAMETER_OUT_OF_RANGE: "One of your request's values is out of the allowed range. Please check your input.",
  CONTEXT_LENGTH_EXCEEDED:
    'Your message is too long for this model. Please shorten it or choose a model with a larger context window.',
  INVALID_API_KEY: 'Your API key is invalid. Please check your key or generate a new one.',
  API_KEY_EXPIRED: 'Your API key has expired. Please generate a new one.',
  API_KEY_REVOKED: 'This API key has been revoked. Please generate a new one.',
  IP_RESTRICTED: 'This request was blocked because it came from an unrecognized location. Check your IP allowlist settings.',
  TRIAL_EXPIRED: 'Your free trial has ended. Please upgrade or add credits to continue.',
  PLAN_LIMIT_REACHED: "You've reached your plan's limit. Please upgrade your plan or wait for it to reset.",
  INSUFFICIENT_CREDITS: "You don't have enough credits for this request. Please add credits to continue.",
  RATE_LIMIT_EXCEEDED: "You're sending requests too quickly.",
  DAILY_QUOTA_EXCEEDED: "You've reached your daily usage limit. It resets at midnight UTC, or you can upgrade your plan.",
  TOKEN_RATE_LIMIT: "You're sending too much data too quickly. Please slow down or upgrade your plan.",
  PROVIDER_ERROR: "The AI provider had trouble handling this request. We'll automatically try another provider — please try again.",
  PROVIDER_TIMEOUT: 'The AI provider took too long to respond. Please try again.',
  ALL_PROVIDERS_FAILED: 'All available providers failed to handle this request. Please try again shortly.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again, and contact support if this continues.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again shortly.',
};

/** Which AppError subtype/code a backend error code maps to (for `retryable` + typing). */
const BACKEND_CODE_TO_BUCKET: Record<string, { ctor: 'auth' | 'network' | 'api' | 'chat'; code: ErrorCode }> = {
  MODEL_NOT_FOUND: { ctor: 'api', code: 'API_NOT_FOUND' },
  MODEL_UNAVAILABLE: { ctor: 'chat', code: 'CHAT_MODEL_ERROR' },
  MODEL_DEPRECATED: { ctor: 'chat', code: 'CHAT_MODEL_ERROR' },
  MISSING_REQUIRED_FIELD: { ctor: 'api', code: 'API_VALIDATION_ERROR' },
  PARAMETER_OUT_OF_RANGE: { ctor: 'api', code: 'API_VALIDATION_ERROR' },
  CONTEXT_LENGTH_EXCEEDED: { ctor: 'api', code: 'API_VALIDATION_ERROR' },
  INVALID_API_KEY: { ctor: 'auth', code: 'AUTH_INVALID' },
  API_KEY_EXPIRED: { ctor: 'auth', code: 'AUTH_EXPIRED' },
  API_KEY_REVOKED: { ctor: 'auth', code: 'AUTH_INVALID' },
  IP_RESTRICTED: { ctor: 'auth', code: 'AUTH_INVALID' },
  TRIAL_EXPIRED: { ctor: 'api', code: 'API_PAYMENT_REQUIRED' },
  PLAN_LIMIT_REACHED: { ctor: 'api', code: 'API_PAYMENT_REQUIRED' },
  INSUFFICIENT_CREDITS: { ctor: 'api', code: 'API_PAYMENT_REQUIRED' },
  RATE_LIMIT_EXCEEDED: { ctor: 'api', code: 'API_RATE_LIMITED' },
  DAILY_QUOTA_EXCEEDED: { ctor: 'api', code: 'API_RATE_LIMITED' },
  TOKEN_RATE_LIMIT: { ctor: 'api', code: 'API_RATE_LIMITED' },
  PROVIDER_ERROR: { ctor: 'api', code: 'API_SERVER_ERROR' },
  PROVIDER_TIMEOUT: { ctor: 'network', code: 'NETWORK_TIMEOUT' },
  ALL_PROVIDERS_FAILED: { ctor: 'api', code: 'API_SERVER_ERROR' },
  INTERNAL_ERROR: { ctor: 'api', code: 'API_SERVER_ERROR' },
  SERVICE_UNAVAILABLE: { ctor: 'api', code: 'API_SERVER_ERROR' },
};

function formatRetryAfter(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return ` Try again in ${Math.round(seconds)}s.`;
  return ` Try again in ${Math.round(seconds / 60)} min.`;
}

function statusToErrorCode(status: number): ErrorCode {
  if (status === 401) return 'AUTH_EXPIRED';
  if (status === 402) return 'API_PAYMENT_REQUIRED';
  if (status === 403) return 'AUTH_INVALID';
  if (status === 404) return 'API_NOT_FOUND';
  if (status === 422) return 'API_VALIDATION_ERROR';
  if (status === 429) return 'API_RATE_LIMITED';
  if (status >= 500) return 'API_SERVER_ERROR';
  return 'API_ERROR';
}

function buildFromCode(code: ErrorCode, message: string, statusCode?: number): AppError {
  if (code === 'AUTH_EXPIRED' || code === 'AUTH_INVALID' || code === 'AUTH_REQUIRED' || code === 'AUTH_RATE_LIMITED') {
    return new AuthError(code, message);
  }
  if (code === 'NETWORK_ERROR' || code === 'NETWORK_TIMEOUT' || code === 'NETWORK_OFFLINE') {
    return new NetworkError(code, message);
  }
  if (code === 'CHAT_SESSION_ERROR' || code === 'CHAT_MESSAGE_ERROR' || code === 'CHAT_STREAM_ERROR' || code === 'CHAT_MODEL_ERROR') {
    return new ChatError(code, message);
  }
  return new ApiError(
    code as Extract<
      ErrorCode,
      'API_ERROR' | 'API_NOT_FOUND' | 'API_SERVER_ERROR' | 'API_VALIDATION_ERROR' | 'API_PAYMENT_REQUIRED' | 'API_RATE_LIMITED'
    >,
    message,
    { statusCode }
  );
}

/**
 * Classify a parsed (or unparseable) backend error body + HTTP status into an
 * AppError with a specific, safe, user-facing message. Handles every shape
 * documented in the "Error response shape summary" audit finding.
 */
export function classifyApiError(
  status: number,
  body: unknown,
  opts?: { retryAfter?: number; context?: string }
): AppError {
  const b = (body ?? {}) as Record<string, unknown>;
  const errorField = b.error;
  const retryAfter = opts?.retryAfter ?? readRetryAfterFromBody(b);

  // Shapes 1 & 2: `error` is an object, possibly with a known `code`.
  if (errorField && typeof errorField === 'object') {
    const errorObj = errorField as Record<string, unknown>;
    const code = typeof errorObj.code === 'string' ? errorObj.code : undefined;
    if (code && BACKEND_CODE_MESSAGES[code]) {
      const bucket = BACKEND_CODE_TO_BUCKET[code];
      const suffix = code === 'RATE_LIMIT_EXCEEDED' || code === 'DAILY_QUOTA_EXCEEDED' || code === 'TOKEN_RATE_LIMIT'
        ? formatRetryAfter(retryAfter)
        : '';
      return buildFromCode(bucket?.code ?? statusToErrorCode(status), BACKEND_CODE_MESSAGES[code] + suffix, status);
    }
    // No recognized code — fall back to status-based classification.
    return buildFromCode(statusToErrorCode(status), ERROR_MESSAGES[statusToErrorCode(status)] + formatRetryAfter(retryAfter), status);
  }

  // Shape 3: `error` is a bare string (api_keys.py / auth.py 429 variant).
  if (typeof errorField === 'string') {
    const code = statusToErrorCode(status);
    return buildFromCode(code, ERROR_MESSAGES[code] + formatRetryAfter(retryAfter), status);
  }

  // Shape 4: untouched FastAPI 422 default — `detail` is an array of field errors.
  if (Array.isArray(b.detail)) {
    return buildFromCode('API_VALIDATION_ERROR', ERROR_MESSAGES.API_VALIDATION_ERROR, status);
  }

  // Shape 5 / unrecognized body / no body at all — classify by status only.
  const code = statusToErrorCode(status);
  return buildFromCode(code, ERROR_MESSAGES[code] + formatRetryAfter(retryAfter), status);
}

function readRetryAfterFromBody(b: Record<string, unknown>): number | undefined {
  const direct = b.retry_after;
  if (typeof direct === 'number') return direct;
  const errorField = b.error;
  if (errorField && typeof errorField === 'object') {
    const ctx = (errorField as Record<string, unknown>).context;
    if (ctx && typeof ctx === 'object') {
      const retryAfter = (ctx as Record<string, unknown>).retry_after;
      if (typeof retryAfter === 'number') return retryAfter;
    }
    const nested = (errorField as Record<string, unknown>).retry_after;
    if (typeof nested === 'number') return nested;
  }
  return undefined;
}

/**
 * Build an AppError from a real, non-ok fetch Response — reads the JSON body
 * (falling back gracefully if it isn't valid JSON) and the `Retry-After`
 * header, then classifies via classifyApiError. This is the primary entry
 * point for HTTP error responses; prefer it over `fromResponse`.
 */
export async function parseErrorResponse(response: Response, context?: string): Promise<AppError> {
  let body: unknown = undefined;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  const retryAfterHeader = response.headers?.get?.('Retry-After');
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;

  return classifyApiError(response.status, body, {
    retryAfter: Number.isFinite(retryAfter) ? retryAfter : undefined,
    context,
  });
}

/**
 * Map a streaming-layer error (src/lib/streaming/errors.ts) to an AppError so
 * chat/streaming failures get the same safe, specific messaging as HTTP errors.
 */
export function fromStreamingError(error: {
  name: string;
  message: string;
  code?: string;
  retryable?: boolean;
  retryAfterMs?: number;
}): AppError {
  switch (error.code) {
    case 'AUTH_ERROR':
      return new AuthError('AUTH_INVALID', ERROR_MESSAGES.AUTH_INVALID);
    case 'RATE_LIMIT': {
      const seconds = error.retryAfterMs ? error.retryAfterMs / 1000 : undefined;
      return new ApiError('API_RATE_LIMITED', ERROR_MESSAGES.API_RATE_LIMITED + formatRetryAfter(seconds));
    }
    case 'TIMEOUT':
      return new NetworkError('NETWORK_TIMEOUT', ERROR_MESSAGES.NETWORK_TIMEOUT);
    case 'EMPTY_RESPONSE':
      return new ChatError('CHAT_MODEL_ERROR', ERROR_MESSAGES.CHAT_MODEL_ERROR, { retryable: true });
    default:
      return new ChatError('CHAT_STREAM_ERROR', ERROR_MESSAGES.CHAT_STREAM_ERROR, {
        retryable: error.retryable ?? true,
      });
  }
}

function isStreamingError(error: unknown): error is {
  name: string;
  message: string;
  code?: string;
  retryable?: boolean;
  retryAfterMs?: number;
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    error instanceof Error &&
    error.name !== undefined &&
    ['StreamingError', 'AuthenticationError', 'RateLimitError', 'StreamTimeoutError', 'EmptyResponseError'].includes(
      (error as Error).name
    )
  );
}

// =============================================================================
// ERROR CHECKING UTILITIES
// =============================================================================

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isChatError(error: unknown): error is ChatError {
  return error instanceof ChatError;
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }
  return false;
}

// =============================================================================
// ERROR FORMATTING
// =============================================================================

/**
 * Get a user-friendly error message from any error
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.getUserMessage();
  }

  if (error instanceof Error) {
    // Don't expose internal error messages to users
    return ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  return ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Format error for logging (includes details)
 */
export function formatForLogging(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      details: error.details,
      retryable: error.retryable,
      timestamp: error.timestamp,
      stack: error.stack,
      originalError: error.originalError?.message,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { error: String(error) };
}
