/**
 * Global Error Handlers
 *
 * IMPORTANT: Sentry's @sentry/nextjs SDK already captures unhandled errors and
 * promise rejections via its built-in globalHandlersIntegration.
 *
 * This module provides ADDITIONAL context and logging WITHOUT duplicating
 * Sentry's error capture. It adds breadcrumbs and custom logging only.
 *
 * If you want to disable Sentry's built-in handlers and use custom ones instead,
 * add this to instrumentation-client.ts:
 *
 *   integrations: [
 *     ...existingIntegrations,
 *     Sentry.globalHandlersIntegration({ onerror: false, onunhandledrejection: false })
 *   ]
 */

import * as Sentry from '@sentry/nextjs';

// =============================================================================
// RATE LIMITING FOR captureMessage CALLS
// Prevents 429 errors from Sentry by limiting message frequency
// NOTE: beforeSend hook doesn't apply to captureMessage, so we need manual limiting
// =============================================================================

const messageRateLimitState = {
  messageCount: 0,
  windowStart: Date.now(),
  recentMessages: new Map<string, number>(),
};

const MESSAGE_RATE_LIMIT_CONFIG = {
  maxMessagesPerMinute: 3,    // Very aggressive limit for messages
  windowMs: 60000,            // 1 minute window
  dedupeWindowMs: 300000,     // Don't send same message within 5 minutes
};

/**
 * Check if a message should be rate limited
 * Returns true if the message should NOT be sent
 */
function shouldRateLimitMessage(messageKey: string): boolean {
  const now = Date.now();

  // Reset window if expired
  if (now - messageRateLimitState.windowStart > MESSAGE_RATE_LIMIT_CONFIG.windowMs) {
    messageRateLimitState.messageCount = 0;
    messageRateLimitState.windowStart = now;
  }

  // Check rate limit
  if (messageRateLimitState.messageCount >= MESSAGE_RATE_LIMIT_CONFIG.maxMessagesPerMinute) {
    console.debug('[GlobalErrorHandlers] Rate limit exceeded for captureMessage, dropping');
    return true;
  }

  // Deduplication check
  const lastSent = messageRateLimitState.recentMessages.get(messageKey);
  if (lastSent && now - lastSent < MESSAGE_RATE_LIMIT_CONFIG.dedupeWindowMs) {
    console.debug('[GlobalErrorHandlers] Duplicate message within deduplication window, dropping');
    return true;
  }

  // Update state
  messageRateLimitState.messageCount++;
  messageRateLimitState.recentMessages.set(messageKey, now);

  // Cleanup old entries to prevent memory growth
  if (messageRateLimitState.recentMessages.size > 50) {
    const entries = Array.from(messageRateLimitState.recentMessages.entries())
      .sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, entries.length - 50);
    for (const [key] of toRemove) {
      messageRateLimitState.recentMessages.delete(key);
    }
  }

  return false;
}

/**
 * Rate-limited version of Sentry.captureMessage
 * Use this instead of direct Sentry.captureMessage calls
 */
export function rateLimitedCaptureMessage(
  message: string,
  options?: Parameters<typeof Sentry.captureMessage>[1]
): void {
  const messageKey = message.slice(0, 100);

  if (shouldRateLimitMessage(messageKey)) {
    return;
  }

  Sentry.captureMessage(message, options);
}

/**
 * Reset the message rate limit state (for testing only)
 */
export function resetMessageRateLimitForTesting(): void {
  messageRateLimitState.messageCount = 0;
  messageRateLimitState.windowStart = Date.now();
  messageRateLimitState.recentMessages.clear();
}

/**
 * Initialize global error handlers
 *
 * NOTE: This only adds breadcrumbs and logging.
 * Sentry's built-in globalHandlersIntegration captures the actual errors.
 *
 * Call this once at app startup
 */
export function initializeGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') {
    // Server-side - skip
    return;
  }

  // Already initialized check
  if ((window as any).__globalErrorHandlersInitialized) {
    return;
  }

  console.log('[GlobalErrorHandlers] Initializing enhanced error logging and breadcrumbs');
  console.log('[GlobalErrorHandlers] Note: Sentry globalHandlersIntegration already captures errors');

  // =============================================================================
  // UNHANDLED PROMISE REJECTIONS
  //
  // NOTE: Sentry's globalHandlersIntegration already captures these.
  // We only add breadcrumbs and custom logging here.
  // =============================================================================

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    // Extract error information
    const error = event.reason;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorMessageLower = errorMessage.toLowerCase();

    // Skip "message port closed" errors from Chrome extensions
    // These are benign browser extension communication errors (password managers, ad blockers, etc.)
    if (
      errorMessageLower.includes('message port closed') ||
      errorMessageLower.includes('the message port closed before a response was received')
    ) {
      console.debug('[UnhandledRejection] Skipping Chrome extension "message port closed" error (benign)');
      return;
    }

    // Skip ONLY 429 rate limit errors and network errors from monitoring/telemetry endpoints
    // These cause cascades: Sentry tries to report 429 errors, which causes more 429s
    // IMPORTANT: Do NOT skip all monitoring errors - only 429s and network failures
    const isMonitoringRelated =
      errorMessageLower.includes('/monitoring') ||
      errorMessageLower.includes('sentry') ||
      errorMessageLower.includes('telemetry');

    const is429Error =
      errorMessageLower.includes('429') ||
      errorMessageLower.includes('too many requests');

    const isNetworkError =
      errorMessageLower.includes('failed to fetch') ||
      errorMessageLower.includes('network error') ||
      errorMessageLower.includes('networkerror');

    const isMonitoringNetworkError =
      isNetworkError &&
      (errorMessageLower.includes('/monitoring') || errorMessageLower.includes('sentry.io') || errorMessageLower.includes('telemetry'));

    // Only skip 429 errors from monitoring endpoints OR network errors to monitoring endpoints
    // Do NOT skip other monitoring errors (e.g., 500 errors should still be reported)
    if ((is429Error && isMonitoringRelated) || isMonitoringNetworkError) {
      console.debug('[UnhandledRejection] Skipping monitoring 429/network error to prevent cascade');
      return;
    }

    console.error('[UnhandledRejection]', event.reason);

    // Add breadcrumb for additional context (Sentry will capture the error itself)
    Sentry.addBreadcrumb({
      category: 'unhandled-rejection',
      message: errorMessage,
      level: 'error',
      data: {
        stack: errorStack,
        captured_by: 'custom_handler',
      },
    });

    // DO NOT call Sentry.captureException here - it would duplicate the error
    // Sentry's globalHandlersIntegration already handles this
  });

  // =============================================================================
  // GLOBAL ERRORS (window.onerror)
  //
  // NOTE: Sentry's globalHandlersIntegration already captures these.
  // We only add breadcrumbs and custom logging here.
  // =============================================================================

  window.addEventListener('error', (event: ErrorEvent) => {
    const errorMessage = event.message || '';
    const errorMessageLower = errorMessage.toLowerCase();

    // Skip generic "Script error." from cross-origin scripts
    // This occurs when external scripts (analytics, ads, etc.) throw errors but the browser
    // suppresses details due to CORS security policies. These are typically:
    // - Third-party analytics scripts (GTM, PostHog, Statsig)
    // - Ad network scripts
    // - Social media widgets
    // These errors provide no actionable debugging information and pollute error logs.
    // The `crossorigin="anonymous"` attribute on script tags can help get details,
    // but many third-party services don't support CORS headers for their scripts.
    if (
      errorMessage === 'Script error.' ||
      errorMessageLower === 'script error' ||
      (errorMessageLower.includes('script error') && !event.filename && !event.lineno)
    ) {
      console.debug('[GlobalError] Skipping generic cross-origin "Script error." (no actionable details available)');
      return;
    }

    // Skip "message port closed" errors from Chrome extensions
    // These are benign browser extension communication errors (password managers, ad blockers, etc.)
    if (
      errorMessageLower.includes('message port closed') ||
      errorMessageLower.includes('the message port closed before a response was received')
    ) {
      console.debug('[GlobalError] Skipping Chrome extension "message port closed" error (benign)');
      return;
    }

    // Skip ONLY 429 rate limit errors and network errors from monitoring/telemetry endpoints
    // These cause cascades: Sentry tries to report 429 errors, which causes more 429s
    // IMPORTANT: Do NOT skip all monitoring errors - only 429s and network failures
    const isMonitoringRelated =
      errorMessageLower.includes('/monitoring') ||
      errorMessageLower.includes('sentry') ||
      errorMessageLower.includes('telemetry');

    const is429Error =
      errorMessageLower.includes('429') ||
      errorMessageLower.includes('too many requests');

    const isNetworkError =
      errorMessageLower.includes('failed to fetch') ||
      errorMessageLower.includes('network error') ||
      errorMessageLower.includes('networkerror');

    const isMonitoringNetworkError =
      isNetworkError &&
      (errorMessageLower.includes('/monitoring') || errorMessageLower.includes('sentry.io') || errorMessageLower.includes('telemetry'));

    // Only skip 429 errors from monitoring endpoints OR network errors to monitoring endpoints
    // Do NOT skip other monitoring errors (e.g., 500 errors should still be reported)
    if ((is429Error && isMonitoringRelated) || isMonitoringNetworkError) {
      console.debug('[GlobalError] Skipping monitoring 429/network error to prevent cascade');
      return;
    }

    console.error('[GlobalError]', event.error || event.message);

    // Skip errors from external scripts (ads, analytics, etc.)
    if (event.filename && !event.filename.includes(window.location.origin)) {
      console.warn('[GlobalError] Skipping external script error:', event.filename);
      return;
    }

    // Add breadcrumb for additional context (Sentry will capture the error itself)
    Sentry.addBreadcrumb({
      category: 'global-error',
      message: event.message,
      level: 'error',
      data: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        captured_by: 'custom_handler',
      },
    });

    // DO NOT call Sentry.captureException here - it would duplicate the error
    // Sentry's globalHandlersIntegration already handles this
  });

  // =============================================================================
  // RESOURCE LOADING ERRORS (images, scripts, stylesheets)
  // =============================================================================

  window.addEventListener(
    'error',
    (event: Event) => {
      const target = event.target as HTMLElement;

      // Check if it's a resource loading error
      if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
        const resourceType = target.tagName.toLowerCase();
        const resourceUrl =
          (target as HTMLImageElement).src ||
          (target as HTMLScriptElement).src ||
          (target as HTMLLinkElement).href ||
          'unknown';

        console.warn(`[ResourceError] Failed to load ${resourceType}:`, resourceUrl);

        // DISABLED: Resource error reporting was contributing to 429 rate limit errors
        // Only add a breadcrumb for debugging, don't send separate events
        Sentry.addBreadcrumb({
          category: 'resource-error',
          message: `Failed to load ${resourceType}: ${resourceUrl}`,
          level: 'warning',
          data: {
            resource_type: resourceType,
            url: resourceUrl,
          },
        });

        // NOTE: Removed captureMessage call to prevent 429 errors
        // Resource errors will still be visible in breadcrumbs when other errors occur
      }
    },
    true // Use capture phase to catch resource errors
  );

  // =============================================================================
  // CONSOLE ERROR INTERCEPTION (optional)
  // =============================================================================

  // Optionally capture console.error calls for additional context
  // Disabled by default to avoid noise
  if (process.env.NEXT_PUBLIC_CAPTURE_CONSOLE_ERRORS === 'true') {
    const originalConsoleError = console.error;

    console.error = function (...args: any[]) {
      // Call original console.error
      originalConsoleError.apply(console, args);

      // Skip Sentry-related errors to avoid loops
      const message = args.join(' ');
      if (message.includes('[Sentry]') || message.includes('Sentry')) {
        return;
      }

      // Capture in Sentry as breadcrumb (not full error)
      Sentry.addBreadcrumb({
        category: 'console',
        message: message,
        level: 'error',
        data: {
          arguments: args,
        },
      });
    };
  }

  // Mark as initialized
  (window as any).__globalErrorHandlersInitialized = true;

  console.log('[GlobalErrorHandlers] ✅ Global error handlers initialized');
}

/**
 * Cleanup global error handlers (for testing or cleanup)
 */
export function cleanupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  // Note: Removing event listeners is tricky since we need references
  // to the original functions. For now, just mark as not initialized.
  delete (window as any).__globalErrorHandlersInitialized;

  console.log('[GlobalErrorHandlers] Cleaned up global error handlers');
}

/**
 * Check if global error handlers are initialized
 */
export function areGlobalErrorHandlersInitialized(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).__globalErrorHandlersInitialized;
}
