"use client";

import { useEffect } from 'react';

/**
 * Suppresses known third-party errors that don't affect functionality
 * - Statsig analytics blocked by ad blockers (ERR_BLOCKED_BY_CLIENT)
 * - Privy wallet extension communication errors
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

    // Cleanup on unmount
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  return null;
}
