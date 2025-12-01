/**
 * Global Error Handlers
 *
 * Catches unhandled promise rejections and global errors.
 * Reports them to Sentry for monitoring.
 *
 * IMPORTANT: This should be initialized early in the app lifecycle,
 * ideally in instrumentation-client.ts or root layout.tsx
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Initialize global error handlers
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

  console.log('[GlobalErrorHandlers] Initializing global error handlers');

  // =============================================================================
  // UNHANDLED PROMISE REJECTIONS
  // =============================================================================

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    console.error('[UnhandledRejection]', event.reason);

    // Extract error information
    const error = event.reason;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Report to Sentry
    Sentry.captureException(error, {
      tags: {
        error_type: 'unhandled_rejection',
        handler: 'global',
      },
      contexts: {
        promise: {
          reason: errorMessage,
          stack: errorStack,
        },
      },
      level: 'error',
    });

    // Add breadcrumb for context
    Sentry.addBreadcrumb({
      category: 'unhandled-rejection',
      message: errorMessage,
      level: 'error',
      data: {
        stack: errorStack,
      },
    });

    // Prevent default error handling (avoid duplicate console errors)
    // event.preventDefault();
  });

  // =============================================================================
  // GLOBAL ERRORS (window.onerror)
  // =============================================================================

  window.addEventListener('error', (event: ErrorEvent) => {
    console.error('[GlobalError]', event.error || event.message);

    // Skip errors from external scripts (ads, analytics, etc.)
    if (event.filename && !event.filename.includes(window.location.origin)) {
      console.warn('[GlobalError] Skipping external script error:', event.filename);
      return;
    }

    // Report to Sentry
    Sentry.captureException(event.error || new Error(event.message), {
      tags: {
        error_type: 'global_error',
        handler: 'window.onerror',
        filename: event.filename || 'unknown',
        lineno: String(event.lineno || 0),
        colno: String(event.colno || 0),
      },
      contexts: {
        error_event: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      },
      level: 'error',
    });

    // Prevent default error handling
    // event.preventDefault();
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

        // Only report critical resource failures (not images, which are common)
        if (resourceType !== 'img') {
          Sentry.captureMessage(`Failed to load ${resourceType}: ${resourceUrl}`, {
            level: 'warning',
            tags: {
              error_type: 'resource_error',
              resource_type: resourceType,
            },
            contexts: {
              resource: {
                type: resourceType,
                url: resourceUrl,
              },
            },
          });
        }
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
