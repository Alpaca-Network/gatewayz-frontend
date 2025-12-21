/**
 * Backend Error Tracking
 *
 * Utilities for tracking errors from backend API calls (gatewayz.ai)
 * This helps monitor backend health and correlate frontend issues with backend failures
 */

import * as Sentry from '@sentry/nextjs';

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
 * @param error - The network error
 * @param context - Additional context
 */
export function trackBackendNetworkError(
  error: Error,
  context: {
    endpoint: string;
    method?: string;
    gateway?: string;
    timeoutMs?: number;
  }
): void {
  // Check if it's a timeout
  const isTimeout = error.name === 'AbortError' || error.message.includes('timeout');

  const errorMessage = isTimeout
    ? `Backend API timeout after ${context.timeoutMs}ms: ${context.endpoint}`
    : `Backend API network error: ${context.endpoint}`;

  trackBackendError(
    new Error(errorMessage),
    {
      ...context,
      statusCode: isTimeout ? 408 : undefined, // Request Timeout
    }
  );
}
