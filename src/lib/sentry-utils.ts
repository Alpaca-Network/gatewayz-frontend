import * as Sentry from '@sentry/nextjs';

/**
 * Sentry error capture utility library
 * Provides wrappers, helpers, and patterns for consistent error tracking
 */

// ============================================================================
// ERROR TAGGING SCHEMA - Use these constants for consistent categorization
// ============================================================================

export const ERROR_TAGS = {
  // Error categories
  API_ERROR: 'api_error',
  HOOK_ERROR: 'hook_error',
  COMPONENT_ERROR: 'component_error',
  SERVICE_ERROR: 'service_error',
  AUTH_ERROR: 'auth_error',
  PAYMENT_ERROR: 'payment_error',
  NETWORK_ERROR: 'network_error',
  STORAGE_ERROR: 'storage_error',
  VALIDATION_ERROR: 'validation_error',
  INTEGRATION_ERROR: 'integration_error',

  // Severity levels (use with 'level' tag)
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

export const ERROR_OPERATIONS = {
  // Hook operations
  HOOK_INIT: 'hook_init',
  HOOK_STATE_UPDATE: 'hook_state_update',
  HOOK_FETCH: 'hook_fetch',

  // Component operations
  COMPONENT_MOUNT: 'component_mount',
  COMPONENT_RENDER: 'component_render',
  COMPONENT_UNMOUNT: 'component_unmount',
  COMPONENT_EVENT: 'component_event',

  // Service operations
  SERVICE_INIT: 'service_init',
  SERVICE_CALL: 'service_call',
  SERVICE_SYNC: 'service_sync',

  // API operations
  API_FETCH: 'api_fetch',
  API_PARSE: 'api_parse',
  API_TIMEOUT: 'api_timeout',

  // Payment operations
  PAYMENT_INIT: 'payment_init',
  PAYMENT_PROCESS: 'payment_process',
  PAYMENT_VERIFY: 'payment_verify',

  // Auth operations
  AUTH_LOGIN: 'auth_login',
  AUTH_LOGOUT: 'auth_logout',
  AUTH_SYNC: 'auth_sync',
};

// ============================================================================
// HOOK ERROR WRAPPER - Wraps React hooks with error capture
// ============================================================================

export interface HookErrorContext {
  hookName: string;
  operation?: string;
  [key: string]: any;
}

/**
 * Wraps a hook function with Sentry error capture.
 * Automatically logs errors with hook context.
 */
export function captureHookErrors<T extends (...args: any[]) => any>(
  hookFn: T,
  context: HookErrorContext
): T {
  return ((...args: any[]) => {
    try {
      return hookFn(...args);
    } catch (error) {
      captureHookError(error, context);
      throw error;
    }
  }) as T;
}

/**
 * Captures an error that occurred within a hook
 * Includes automatic context about the hook
 */
export function captureHookError(
  error: unknown,
  context: HookErrorContext
) {
  Sentry.captureException(error, {
    tags: {
      error_type: ERROR_TAGS.HOOK_ERROR,
      hook_name: context.hookName,
      operation: context.operation || ERROR_OPERATIONS.HOOK_INIT,
    },
    contexts: {
      hook: {
        name: context.hookName,
        operation: context.operation,
        ...context,
      },
    },
    level: 'error',
  });
}

// ============================================================================
// COMPONENT ERROR WRAPPER - Wraps component functions and event handlers
// ============================================================================

export interface ComponentErrorContext {
  componentName: string;
  operation?: string;
  [key: string]: any;
}

/**
 * Wraps a component event handler with error capture.
 * Useful for onClick, onChange, onSubmit handlers.
 */
export function wrapComponentError<T extends (...args: any[]) => any>(
  fn: T,
  context: ComponentErrorContext
): T {
  return ((...args: any[]) => {
    try {
      return fn(...args);
    } catch (error) {
      captureComponentError(error, context);
      throw error;
    }
  }) as T;
}

/**
 * Captures an error that occurred within a component
 */
export function captureComponentError(
  error: unknown,
  context: ComponentErrorContext
) {
  Sentry.captureException(error, {
    tags: {
      error_type: ERROR_TAGS.COMPONENT_ERROR,
      component_name: context.componentName,
      operation: context.operation || ERROR_OPERATIONS.COMPONENT_EVENT,
    },
    contexts: {
      component: {
        name: context.componentName,
        operation: context.operation,
        ...context,
      },
    },
    level: 'error',
  });
}

// ============================================================================
// SERVICE ERROR WRAPPER - Wraps service/utility functions
// ============================================================================

export interface ServiceErrorContext {
  serviceName: string;
  operation?: string;
  [key: string]: any;
}

/**
 * Wraps a service function with error capture.
 * Useful for API clients, data services, etc.
 */
export function wrapServiceError<T extends (...args: any[]) => any>(
  fn: T,
  context: ServiceErrorContext
): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);

      // Handle promise results
      if (result instanceof Promise) {
        return result.catch((error) => {
          captureServiceError(error, context);
          throw error;
        });
      }

      return result;
    } catch (error) {
      captureServiceError(error, context);
      throw error;
    }
  }) as T;
}

/**
 * Captures an error that occurred within a service
 */
export function captureServiceError(
  error: unknown,
  context: ServiceErrorContext
) {
  Sentry.captureException(error, {
    tags: {
      error_type: ERROR_TAGS.SERVICE_ERROR,
      service_name: context.serviceName,
      operation: context.operation || ERROR_OPERATIONS.SERVICE_CALL,
    },
    contexts: {
      service: {
        name: context.serviceName,
        operation: context.operation,
        ...context,
      },
    },
    level: 'error',
  });
}

// ============================================================================
// ASYNC ERROR WRAPPER - For async operations with timeout and retry tracking
// ============================================================================

export interface AsyncErrorContext {
  operationName: string;
  timeout?: number;
  retries?: number;
  [key: string]: any;
}

/**
 * Wraps async operations with timeout and error capture.
 */
export async function withAsyncErrorCapture<T>(
  fn: () => Promise<T>,
  context: AsyncErrorContext & { retries?: number }
): Promise<T> {
  const maxRetries = context.retries ?? 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Set up timeout if specified
      if (context.timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          context.timeout
        );

        try {
          const result = await fn();
          clearTimeout(timeoutId);
          return result;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }

      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        // Add breadcrumb for retry attempts
        Sentry.addBreadcrumb({
          category: 'retry',
          message: `${context.operationName} retry attempt ${attempt + 1}/${maxRetries}`,
          level: 'info',
          data: {
            attempt: attempt + 1,
            max_retries: maxRetries,
          },
        });
      } else {
        // All retries exhausted
        captureAsyncError(error, context, {
          attempt: attempt + 1,
          max_retries: maxRetries,
        });
      }
    }
  }

  throw lastError;
}

/**
 * Captures an error that occurred during async operations
 */
export function captureAsyncError(
  error: unknown,
  context: AsyncErrorContext,
  additionalData?: Record<string, any>
) {
  Sentry.captureException(error, {
    tags: {
      operation: context.operationName,
      timeout: String(context.timeout),
    },
    contexts: {
      async_operation: {
        name: context.operationName,
        timeout: context.timeout,
        retries: context.retries,
        ...additionalData,
        ...context,
      },
    },
    level: 'error',
  });
}

// ============================================================================
// SPAN WRAPPER - For tracking operation performance and errors
// ============================================================================

export interface SpanErrorContext {
  operationName: string;
  [key: string]: any;
}

/**
 * Wraps an operation in a Sentry span for performance tracking.
 */
export async function withSpanError<T>(
  fn: (span: Sentry.Span) => Promise<T>,
  context: SpanErrorContext
): Promise<T> {
  return Sentry.startSpan(
    {
      op: 'operation',
      name: context.operationName,
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: 'ok' });
        return result;
      } catch (error) {
        span.setStatus({ code: 'error' });
        span.setAttribute('error', true);

        if (error instanceof Error) {
          span.setAttribute('error_message', error.message);
        }

        captureSpanError(error, context);
        throw error;
      }
    }
  );
}

/**
 * Captures an error that occurred during a span operation
 */
export function captureSpanError(
  error: unknown,
  context: SpanErrorContext
) {
  Sentry.captureException(error, {
    tags: {
      operation: context.operationName,
    },
    contexts: {
      operation: context,
    },
    level: 'error',
  });
}

// ============================================================================
// BREADCRUMB HELPERS - For tracking user actions and state changes
// ============================================================================

/**
 * Adds a breadcrumb for an async operation start
 */
export function addAsyncBreadcrumb(
  message: string,
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    category: 'async-operation',
    message,
    level: 'info',
    data,
  });
}

/**
 * Adds a breadcrumb for a user action
 */
export function addUserActionBreadcrumb(
  action: string,
  details?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    category: 'user-action',
    message: action,
    level: 'info',
    data: details,
  });
}

/**
 * Adds a breadcrumb for state changes
 */
export function addStateChangeBreadcrumb(
  component: string,
  stateName: string,
  newValue: any
) {
  Sentry.addBreadcrumb({
    category: 'state-change',
    message: `${component}.${stateName} changed`,
    level: 'debug',
    data: {
      state_name: stateName,
      new_value: newValue,
    },
  });
}

// ============================================================================
// CONTEXT SETTERS - For adding persistent context to future errors
// ============================================================================

/**
 * Sets user context for error tracking
 */
export function setUserContext(userId?: string, email?: string) {
  Sentry.setUser({
    id: userId,
    email: email,
  });
}

/**
 * Clears user context (on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Sets custom context for error tracking
 */
export function setCustomContext(key: string, value: any) {
  Sentry.setContext(key, value);
}

/**
 * Sets tag for error categorization
 */
export function setErrorTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

// ============================================================================
// API ERROR HELPERS - For consistent API error handling
// ============================================================================

export interface ApiErrorContext {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  statusCode?: number;
  [key: string]: any;
}

/**
 * Captures an API request error with context
 */
export function captureApiError(
  error: unknown,
  context: ApiErrorContext
) {
  const level = (context.statusCode ?? 500) >= 500 ? 'error' : 'warning';

  Sentry.captureException(error, {
    tags: {
      error_type: ERROR_TAGS.API_ERROR,
      endpoint: context.endpoint,
      method: context.method,
      status_code: String(context.statusCode || 'unknown'),
    },
    contexts: {
      api: {
        endpoint: context.endpoint,
        method: context.method,
        status_code: context.statusCode,
        ...context,
      },
    },
    level,
  });
}

/**
 * Wraps a fetch request with error capture
 */
export async function withFetchErrorCapture<T>(
  fn: () => Promise<Response>,
  context: Omit<ApiErrorContext, 'statusCode'>
): Promise<T> {
  try {
    const response = await fn();

    if (!response.ok) {
      const errorContext: ApiErrorContext = {
        ...context,
        statusCode: response.status,
      };

      let errorData: any = null;
      try {
        errorData = await response.clone().json();
      } catch {
        // Response was not JSON
      }

      captureApiError(
        new Error(`API Error: ${response.status} ${response.statusText}`),
        errorContext
      );

      throw new Error(
        `API Error: ${response.status} ${errorData?.message || response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    captureApiError(error, context);
    throw error;
  }
}

// ============================================================================
// LAZY ERROR BOUNDARY - Deferred error capture for non-critical operations
// ============================================================================

/**
 * Silently captures an error without throwing
 * Useful for background operations that shouldn't crash the app
 */
export function captureErrorSilently(
  error: unknown,
  context: Record<string, any>
) {
  Sentry.captureException(error, {
    tags: {
      silent_error: 'true',
      ...context.tags,
    },
    level: 'warning',
  });
}

/**
 * Wraps a function that might fail but shouldn't block execution
 */
export function withSilentErrorCapture<T>(
  fn: () => T,
  context: Record<string, any>,
  fallback?: T
): T | undefined {
  try {
    return fn();
  } catch (error) {
    captureErrorSilently(error, context);
    return fallback;
  }
}
