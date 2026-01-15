/**
 * Sentry error filtering configuration
 *
 * This module provides comprehensive error filtering for Sentry to reduce noise
 * from third-party errors, browser extension conflicts, and known non-blocking issues.
 *
 * Usage: Import and apply filters in instrumentation-client.ts and sentry.server.config.ts
 */

import type * as Sentry from '@sentry/nextjs';

/**
 * Error patterns that should NOT be sent to Sentry
 * These are categorized by source for maintainability
 */
const SUPPRESSED_ERROR_PATTERNS = {
  // Browser wallet extension errors (non-blocking)
  walletExtensions: [
    /Cannot read properties of undefined.*removeListener/i,
    /inpage\.js.*removeListener/i,
    /stopListeners/i,
    /runtime\.sendMessage.*Extension ID/i,
    /Chrome extension.*sendMessage/i,
    /Cannot redefine property.*ethereum/i,
    /evmAsk.*ethereum/i,
    /Java object is gone/i, // Android WebView timing issue
  ],

  // Hydration errors from ad parameters and dynamic content
  hydration: [
    /Hydration failed.*didn't match/i,
    /Text content does not match.*hydration/i,
    /There was an error while hydrating/i,
  ],

  // Privy authentication timing issues (non-blocking)
  privyNonBlocking: [
    /iframe not initialized/i,
    /Origin not allowed/i, // Privy origin configuration - handled by Privy internally
  ],

  // Third-party service errors (analytics, ad blockers)
  thirdParty: [
    /prodregistryv2\.org/i,
    /ERR_BLOCKED_BY_CLIENT/i,
    /Statsig.*networking error/i,
    /Failed to flush events/i,
    /WalletConnect.*relay/i,
    /explorer-api\.walletconnect\.com/i,
  ],

  // DOM manipulation errors from third-party scripts (Statsig Session Replay, etc.)
  domManipulation: [
    /Failed to execute 'removeChild' on 'Node'.*not a child/i,
    /Failed to execute 'insertBefore' on 'Node'.*not a child/i,
    /Statsig.*removeChild/i,
    /Statsig.*insertBefore/i,
    /Node.*not a child/i,
  ],

  // IndexedDB errors from browser privacy/deletion
  indexedDB: [
    /undefined is not an object.*evaluating.*createObjectStore/i,
    /createObjectStore.*undefined/i,
    /Failed to execute 'transaction' on 'IDBDatabase'.*closing/i,
    /Failed to execute 'transaction' on 'IDBDatabase'.*not found/i,
    /InvalidStateError.*IDBDatabase.*closing/i,
  ],

  // Rate limiting and monitoring errors
  rateLimiting: [
    /\/monitoring.*429/i,
    /Too Many Requests.*monitoring/i,
  ],

  // SecurityErrors from private browsing/sandboxed contexts
  storageAccess: [
    /Failed to read.*localStorage.*Access is denied/i,
    /QuotaExceededError/i,
  ],

  // Build/minification errors (transient, not reproducible)
  buildErrors: [
    /can't access lexical declaration.*before initialization/i,
    /ReferenceError.*tH.*before initialization/i,
  ],
};

/**
 * Error messages that indicate client-side temporary issues
 * These should be logged but with lower severity
 */
const TRANSIENT_ERROR_PATTERNS = [
  /Authentication timeout/i,
  /Authentication failed: 504/i,
  /signal is aborted without reason/i,
  /operation was aborted due to timeout/i,
  /Network request failed/i,
  /Failed to fetch/i,
];

/**
 * Check if an error should be suppressed from Sentry
 */
export function shouldSuppressError(event: Sentry.ErrorEvent, hint?: Sentry.EventHint): boolean {
  const errorMessage = getErrorMessage(event, hint);
  const errorStack = getErrorStack(event, hint);
  const combinedText = `${errorMessage} ${errorStack}`.toLowerCase();

  // If we have no error information, don't suppress
  if (!combinedText.trim()) {
    return false;
  }

  // Check all suppression patterns
  for (const category of Object.values(SUPPRESSED_ERROR_PATTERNS)) {
    for (const pattern of category) {
      if (pattern.test(combinedText)) {
        console.debug('[Sentry] Suppressing error:', errorMessage.substring(0, 100));
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if an error is transient and should be downgraded to warning level
 */
export function isTransientError(event: Sentry.ErrorEvent, hint?: Sentry.EventHint): boolean {
  const errorMessage = getErrorMessage(event, hint);

  for (const pattern of TRANSIENT_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract error message from Sentry event or hint
 */
function getErrorMessage(event: Sentry.ErrorEvent, hint?: Sentry.EventHint): string {
  if (hint?.originalException) {
    if (hint.originalException instanceof Error) {
      return hint.originalException.message;
    }
    if (typeof hint.originalException === 'string') {
      return hint.originalException;
    }
  }

  if (event.exception?.values?.[0]?.value) {
    return event.exception.values[0].value;
  }

  if (event.message) {
    return event.message;
  }

  return '';
}

/**
 * Extract error stack from Sentry event or hint
 */
function getErrorStack(event: Sentry.ErrorEvent, hint?: Sentry.EventHint): string {
  if (hint?.originalException instanceof Error && hint.originalException.stack) {
    return hint.originalException.stack;
  }

  if (event.exception?.values?.[0]?.stacktrace) {
    return JSON.stringify(event.exception.values[0].stacktrace);
  }

  return '';
}

/**
 * Apply error filtering to a Sentry event before sending
 * Returns null if the error should be suppressed
 */
export function beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint): Sentry.ErrorEvent | null {
  // Suppress filtered errors entirely
  if (shouldSuppressError(event, hint)) {
    return null;
  }

  // Downgrade transient errors to warning level
  if (isTransientError(event, hint)) {
    event.level = 'warning';

    // Add breadcrumb to indicate this was a transient error
    if (!event.breadcrumbs) {
      event.breadcrumbs = [];
    }
    event.breadcrumbs.push({
      message: 'Error classified as transient',
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  }

  return event;
}

/**
 * Get a list of URLs that should be ignored by Sentry
 * These are typically third-party scripts and browser extensions
 */
export function getDenyUrls(): RegExp[] {
  return [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,

    // Wallet extensions
    /inpage\.js/i,
    /contentscript\.js/i,
    /evmAsk\.js/i,

    // Third-party analytics
    /prodregistryv2\.org/i,
    /statsig/i,
    /walletconnect/i,
  ];
}

/**
 * Get a list of error messages that should be ignored
 * This is a fallback for errors that slip through beforeSend
 */
export function getIgnoreErrors(): RegExp[] {
  return [
    ...SUPPRESSED_ERROR_PATTERNS.walletExtensions,
    ...SUPPRESSED_ERROR_PATTERNS.hydration,
    ...SUPPRESSED_ERROR_PATTERNS.thirdParty,
    ...SUPPRESSED_ERROR_PATTERNS.rateLimiting,
    ...SUPPRESSED_ERROR_PATTERNS.storageAccess,
  ];
}
