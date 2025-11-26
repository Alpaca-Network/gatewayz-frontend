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
    code: Extract<ErrorCode, 'API_ERROR' | 'API_NOT_FOUND' | 'API_SERVER_ERROR' | 'API_VALIDATION_ERROR'>,
    message?: string,
    options?: {
      details?: Record<string, unknown>;
      statusCode?: number;
      originalError?: Error;
    }
  ) {
    super(code, message, {
      ...options,
      retryable: code === 'API_SERVER_ERROR',
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

    return new AppError('UNKNOWN_ERROR', context || error.message, {
      originalError: error,
    });
  }

  return new AppError('UNKNOWN_ERROR', context || String(error));
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
