/**
 * Backend Error Tracking
 *
 * Utilities for tracking errors from backend API calls (gatewayz.ai)
 * This helps monitor backend health and correlate frontend issues with backend failures
 */

import * as Sentry from '@sentry/nextjs';
import { getErrorMessage } from './network-error';

/**
 * Track a backend API error in Sentry
 *
 * @param error - The error object or message
 * @param context - Additional context about the API call
 */
export function trackBackendError(
  error: Error | string,
  context: {
    endpoint: string;
    statusCode?: number;
    method?: string;
    gateway?: string;
    retryCount?: number;
    responseBody?: string;
  }
): void {
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  // Determine severity based on status code
  const level: Sentry.SeverityLevel =
    context.statusCode && context.statusCode >= 500 ? 'error' :
    context.statusCode && context.statusCode === 429 ? 'warning' :
    context.statusCode && context.statusCode >= 400 ? 'warning' : 'error';

  Sentry.captureException(errorObj, {
    level,
    tags: {
      error_category: 'backend_api',
      api_endpoint: context.endpoint,
      http_status: context.statusCode?.toString() || 'unknown',
      http_method: context.method || 'GET',
      gateway: context.gateway || 'none',
    },
    contexts: {
      backend_api: {
        endpoint: context.endpoint,
        status_code: context.statusCode,
        method: context.method,
        gateway: context.gateway,
        retry_count: context.retryCount,
        response_preview: context.responseBody?.slice(0, 500), // First 500 chars
      }
    },
    fingerprint: [
      'backend-api-error',
      context.endpoint,
      context.statusCode?.toString() || 'unknown',
    ],
  });

  // Also log to console for debugging
  console.error('[Backend API Error]', {
    endpoint: context.endpoint,
    status: context.statusCode,
    gateway: context.gateway,
    error: errorObj.message,
  });
}

/**
 * Track a backend API response that isn't OK
 *
 * @param response - The fetch Response object
 * @param context - Additional context
 */
export async function trackBadBackendResponse(
  response: Response,
  context: {
    endpoint: string;
    method?: string;
    gateway?: string;
    retryCount?: number;
  }
): Promise<void> {
  const statusCode = response.status;
  const statusText = response.statusText;

  // Try to get response body for more context
  let responseBody: string | undefined;
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.clone().json();
      responseBody = JSON.stringify(data);
    } else {
      responseBody = await response.clone().text();
    }
  } catch (e) {
    // Couldn't parse response, that's ok
    responseBody = undefined;
  }

  const errorMessage = `Backend API ${context.method || 'GET'} ${context.endpoint} failed: ${statusCode} ${statusText}`;

  trackBackendError(
    new Error(errorMessage),
    {
      ...context,
      statusCode,
      responseBody,
    }
  );
}

/**
 * Track a network error when calling backend API
 *
 * @param error - The network error (can be Error, string, or any thrown value)
 * @param context - Additional context
 */
export function trackBackendNetworkError(
  error: unknown,
  context: {
    endpoint: string;
    method?: string;
    gateway?: string;
    timeoutMs?: number;
  }
): void {
  // Safely extract error details - handles Error objects, strings, and other thrown values
  const errorName = error instanceof Error ? error.name : 'Error';
  const errorMessage = getErrorMessage(error);

  // Check if it's a timeout
  const isTimeout = errorName === 'AbortError' || errorMessage.toLowerCase().includes('timeout');

  const contextualMessage = isTimeout
    ? `Backend API timeout after ${context.timeoutMs}ms: ${context.endpoint}`
    : `Backend API network error: ${context.endpoint}`;

  trackBackendError(
    new Error(contextualMessage),
    {
      ...context,
      statusCode: isTimeout ? 408 : undefined, // Request Timeout
    }
  );
}

/**
 * Track a general processing error when calling backend API
 * Use this for errors that are NOT network-related (e.g., JSON parsing, validation, etc.)
 *
 * @param error - The error (can be Error, string, or any thrown value)
 * @param context - Additional context
 */
export function trackBackendProcessingError(
  error: unknown,
  context: {
    endpoint: string;
    method?: string;
    gateway?: string;
    errorType?: string;
  }
): void {
  const errorMessage = getErrorMessage(error);
  const errorType = context.errorType || (error instanceof Error ? error.name : 'ProcessingError');

  const contextualMessage = `Backend API ${errorType}: ${context.endpoint} - ${errorMessage}`;

  trackBackendError(
    new Error(contextualMessage),
    {
      ...context,
      statusCode: undefined, // No HTTP status for processing errors
    }
  );
}
