"use client";

import { useEffect } from 'react';

/**
 * Suppresses known third-party errors that don't affect functionality
 * - Statsig analytics blocked by ad blockers (ERR_BLOCKED_BY_CLIENT)
 * - Privy wallet extension communication errors
 * - Browser wallet extension ethereum property conflicts
 */
export function ErrorSuppressor() {
  useEffect(() => {
    // Store original console methods
    const originalError = console.error;
    const originalWarn = console.warn;

    // List of error patterns to suppress
    const suppressPatterns = [
      /prodregistryv2\.org/i,
      /ERR_BLOCKED_BY_CLIENT/i,
      /Statsig.*networking error/i,
      /Failed to flush events/i,
      /runtime\.sendMessage.*Extension ID/i,
      /Cannot redefine property.*ethereum/i,
      /evmAsk.*ethereum/i,
      /inpage.*sendMessage/i,
      /\/monitoring.*429/i,            // Sentry tunnel rate limit errors
      /Too Many Requests.*monitoring/i, // Alternative format
      /Cannot read properties of undefined.*removeListener/i, // Wallet extension cleanup errors
      /inpage\.js.*removeListener/i,    // Wallet extension inpage.js errors
      /stopListeners/i,                 // Wallet extension stopListeners errors
    ];

    // Override console.error
    console.error = (...args: any[]) => {
      const errorMessage = args.join(' ');
      const shouldSuppress = suppressPatterns.some(pattern =>
        pattern.test(errorMessage)
      );

      if (!shouldSuppress) {
        originalError.apply(console, args);
      }
    };

    // Override console.warn for Statsig warnings
    console.warn = (...args: any[]) => {
      const warnMessage = args.join(' ');
      const shouldSuppress = suppressPatterns.some(pattern =>
        pattern.test(warnMessage)
      );

      if (!shouldSuppress) {
        originalWarn.apply(console, args);
      }
    };

    // Global error handler to catch uncaught errors from browser extensions
    const handleGlobalError = (event: ErrorEvent) => {
      const errorMessage = event.message || '';
      const errorFilename = event.filename || '';

      // Suppress errors from wallet extensions trying to redefine ethereum property
      if (
        errorMessage.includes('Cannot redefine property') &&
        errorMessage.includes('ethereum')
      ) {
        event.preventDefault();
        return true;
      }

      // Suppress errors originating from evmAsk.js (wallet extension script)
      if (errorFilename.includes('evmAsk')) {
        event.preventDefault();
        return true;
      }

      // For removeListener/stopListeners errors from wallet extensions:
      // Don't call preventDefault() to align with privy-provider.tsx design (line 191-192)
      // which explicitly avoids preventDefault for wallet errors to let Privy handle recovery.
      // Just log suppression via console.error override which is already handled above.
      if (
        errorFilename.includes('inpage.js') &&
        (errorMessage.includes('removeListener') || errorMessage.includes('stopListeners'))
      ) {
        // Don't preventDefault - just return to suppress console logging via override
        return false;
      }

      // Same for TypeError related to removeListener from extensions
      if (
        errorMessage.includes('Cannot read properties of undefined') &&
        errorMessage.includes('removeListener')
      ) {
        // Don't preventDefault - just return to suppress console logging via override
        return false;
      }

      return false;
    };

    // Global unhandled rejection handler for promise-based extension errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      let reason = '';
      try {
        reason = event.reason?.message || `${event.reason}` || '';
      } catch {
        // Handle cases like Symbol values that can't be converted
        return;
      }

      // Suppress message channel errors from extensions
      if (reason.includes('message channel closed')) {
        event.preventDefault();
        return;
      }

      // Suppress removeListener errors from wallet extensions
      if (reason.includes('removeListener') || reason.includes('stopListeners')) {
        event.preventDefault();
        return;
      }
    };

    // Register in bubble phase (not capture) to let Sentry handlers run first
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup on unmount
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
