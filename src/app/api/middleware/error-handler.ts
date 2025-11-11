import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * Standardized API error handler
 * @param error - The error object
 * @param context - Context string for logging (e.g., "Checkout API", "Chat Sessions")
 * @returns NextResponse with error details and 500 status
 */
export function handleApiError(error: unknown, context: string = 'API'): NextResponse {
  console.error(`[${context}] Error:`, error);

  // Capture exception in Sentry with context
  Sentry.captureException(error, {
    tags: {
      context,
      error_type: 'api_error',
    },
    level: 'error',
  });

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  return NextResponse.json(
    {
      error: errorMessage,
      details: String(error)
    },
    { status: 500 }
  );
}

/**
 * Handles API errors with custom status code
 * @param error - The error object
 * @param context - Context string for logging
 * @param status - HTTP status code (default: 500)
 * @returns NextResponse with error details
 */
export function handleApiErrorWithStatus(
  error: unknown,
  context: string = 'API',
  status: number = 500
): NextResponse {
  console.error(`[${context}] Error:`, error);

  // Capture exception in Sentry with context and status code
  Sentry.captureException(error, {
    tags: {
      context,
      error_type: 'api_error',
      status_code: status,
    },
    level: status >= 500 ? 'error' : 'warning',
  });

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  return NextResponse.json(
    {
      error: errorMessage,
      details: String(error)
    },
    { status }
  );
}
