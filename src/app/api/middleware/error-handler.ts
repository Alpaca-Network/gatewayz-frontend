import { NextResponse } from 'next/server';
import { createLogger, UserImpact, LogLevel } from '@/lib/logger';

/**
 * Standardized API error handler with structured logging
 * @param error - The error object
 * @param context - Context string for logging (e.g., "Checkout API", "Chat Sessions")
 * @param options - Additional options for error handling
 * @returns NextResponse with error details and 500 status
 */
export function handleApiError(
  error: unknown,
  context: string = 'API',
  options: {
    userImpact?: UserImpact;
    metadata?: Record<string, any>;
    tags?: string[];
  } = {}
): NextResponse {
  const logger = createLogger(context);
  const err = error instanceof Error ? error : new Error(String(error));

  // Determine user impact based on error type
  const userImpact = options.userImpact || determineUserImpact(err, context);

  // Log with structured logging and fingerprinting
  logger.error('API error occurred', err, {
    userImpact,
    context: options.metadata,
    tags: options.tags,
  });

  const errorMessage = err.message || 'Unknown error';

  return NextResponse.json(
    {
      error: errorMessage,
      details: String(error),
      // Include release info for debugging
      release: process.env.NEXT_PUBLIC_RELEASE_SHA || 'dev',
    },
    { status: 500 }
  );
}

/**
 * Handles API errors with custom status code
 * @param error - The error object
 * @param context - Context string for logging
 * @param status - HTTP status code (default: 500)
 * @param options - Additional options for error handling
 * @returns NextResponse with error details
 */
export function handleApiErrorWithStatus(
  error: unknown,
  context: string = 'API',
  status: number = 500,
  options: {
    userImpact?: UserImpact;
    metadata?: Record<string, any>;
    tags?: string[];
  } = {}
): NextResponse {
  const logger = createLogger(context);
  const err = error instanceof Error ? error : new Error(String(error));

  // Determine user impact based on error type and status code
  const userImpact = options.userImpact || determineUserImpactFromStatus(status, err, context);

  // Log with structured logging and fingerprinting
  logger.error('API error occurred', err, {
    userImpact,
    context: {
      ...options.metadata,
      statusCode: status,
    },
    tags: options.tags,
  });

  const errorMessage = err.message || 'Unknown error';

  return NextResponse.json(
    {
      error: errorMessage,
      details: String(error),
      // Include release info for debugging
      release: process.env.NEXT_PUBLIC_RELEASE_SHA || 'dev',
    },
    { status }
  );
}

/**
 * Determine user impact based on error characteristics
 */
function determineUserImpact(error: Error, context: string): UserImpact {
  // Authentication errors are high impact
  if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
    return UserImpact.HIGH;
  }

  // Payment/billing errors are critical
  if (context.includes('Payment') || context.includes('Stripe') || context.includes('Checkout')) {
    return UserImpact.CRITICAL;
  }

  // Chat/model errors are medium-high impact
  if (context.includes('Chat') || context.includes('Model') || context.includes('Completion')) {
    return UserImpact.HIGH;
  }

  // Analytics errors are low impact
  if (context.includes('Analytics') || context.includes('Activity')) {
    return UserImpact.LOW;
  }

  // Default to medium
  return UserImpact.MEDIUM;
}

/**
 * Determine user impact based on HTTP status code
 */
function determineUserImpactFromStatus(status: number, error: Error, context: string): UserImpact {
  // 4xx errors - client issues, generally medium impact
  if (status >= 400 && status < 500) {
    if (status === 401 || status === 403) {
      return UserImpact.HIGH; // Auth issues block users
    }
    if (status === 429) {
      return UserImpact.MEDIUM; // Rate limiting degrades experience
    }
    return UserImpact.MEDIUM;
  }

  // 5xx errors - server issues, use context-based logic
  if (status >= 500) {
    return determineUserImpact(error, context);
  }

  // Other status codes
  return UserImpact.LOW;
}
