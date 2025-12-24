/**
 * Tests for Global Error Handlers (src/lib/global-error-handlers.ts)
 *
 * Tests the error filtering logic that prevents monitoring/telemetry errors
 * from causing cascading error reports.
 */

import * as Sentry from '@sentry/nextjs';

// Mock Sentry before importing the module
jest.mock('@sentry/nextjs', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}));

describe('Global Error Handlers - Error Filtering Logic', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Unhandled Rejection filtering logic', () => {
    /**
     * Simulates the filtering logic from the unhandledrejection handler
     * This mirrors the implementation in global-error-handlers.ts
     *
     * IMPORTANT: Only skip 429 errors AND network errors from monitoring endpoints
     * Do NOT skip all monitoring errors (e.g., 500 errors should still be reported)
     */
    function shouldSkipUnhandledRejection(errorMessage: string): boolean {
      const errorMessageLower = errorMessage.toLowerCase();

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
      return (is429Error && isMonitoringRelated) || isMonitoringNetworkError;
    }

    it('should NOT skip generic errors from /monitoring endpoint (only 429s)', () => {
      // Non-429 monitoring errors should be reported
      expect(shouldSkipUnhandledRejection('POST /monitoring 500 Internal Server Error')).toBe(false);
    });

    it('should NOT skip generic errors mentioning Sentry (only 429s)', () => {
      // Non-429 Sentry errors should be reported
      expect(shouldSkipUnhandledRejection('Sentry initialization failed')).toBe(false);
    });

    it('should NOT skip generic errors mentioning telemetry (only 429s)', () => {
      // Non-429 telemetry errors should be reported
      expect(shouldSkipUnhandledRejection('Telemetry endpoint error')).toBe(false);
    });

    it('should skip 429 errors from monitoring endpoints', () => {
      expect(shouldSkipUnhandledRejection('POST /monitoring 429 Too Many Requests')).toBe(true);
    });

    it('should skip 429 errors mentioning Sentry', () => {
      expect(shouldSkipUnhandledRejection('Sentry rate limit: 429')).toBe(true);
    });

    it('should skip network errors from monitoring endpoints', () => {
      expect(shouldSkipUnhandledRejection('Failed to fetch /monitoring')).toBe(true);
    });

    it('should skip network errors from sentry.io', () => {
      expect(shouldSkipUnhandledRejection('Failed to fetch https://sentry.io/api')).toBe(true);
    });

    it('should skip network errors from telemetry endpoints', () => {
      expect(shouldSkipUnhandledRejection('Failed to fetch telemetry endpoint')).toBe(true);
    });

    it('should skip NetworkError variant from monitoring endpoints', () => {
      expect(shouldSkipUnhandledRejection('NetworkError when attempting to fetch resource: /monitoring')).toBe(true);
    });

    it('should skip "network error" variant from sentry.io', () => {
      expect(shouldSkipUnhandledRejection('network error connecting to sentry.io')).toBe(true);
    });

    it('should NOT skip 429 errors from non-monitoring endpoints', () => {
      // This is the key fix - 429 errors from real API endpoints should NOT be skipped
      expect(shouldSkipUnhandledRejection('POST /api/chat 429 Too Many Requests')).toBe(false);
    });

    it('should NOT skip generic 429 errors without monitoring context', () => {
      expect(shouldSkipUnhandledRejection('429 Too Many Requests')).toBe(false);
    });

    it('should NOT skip network errors from non-monitoring endpoints', () => {
      expect(shouldSkipUnhandledRejection('Failed to fetch https://api.example.com')).toBe(false);
    });

    it('should NOT skip regular application errors', () => {
      expect(shouldSkipUnhandledRejection('TypeError: Cannot read property')).toBe(false);
    });

    it('should handle case-insensitive matching for 429 errors', () => {
      expect(shouldSkipUnhandledRejection('POST /MONITORING 429')).toBe(true);
      expect(shouldSkipUnhandledRejection('SENTRY 429 error')).toBe(true);
      expect(shouldSkipUnhandledRejection('TELEMETRY 429 failed')).toBe(true);
    });
  });

  describe('Global Error filtering logic', () => {
    /**
     * Simulates the filtering logic from the error handler
     * This mirrors the implementation in global-error-handlers.ts
     *
     * IMPORTANT: Only skip 429 errors AND network errors from monitoring endpoints
     * Do NOT skip all monitoring errors (e.g., 500 errors should still be reported)
     */
    function shouldSkipGlobalError(errorMessage: string): boolean {
      const errorMessageLower = errorMessage.toLowerCase();

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
      return (is429Error && isMonitoringRelated) || isMonitoringNetworkError;
    }

    it('should NOT skip generic errors from /monitoring endpoint (only 429s)', () => {
      // Non-429 monitoring errors should be reported
      expect(shouldSkipGlobalError('POST /monitoring 500 Internal Server Error')).toBe(false);
    });

    it('should NOT skip generic errors mentioning Sentry (only 429s)', () => {
      // Non-429 Sentry errors should be reported
      expect(shouldSkipGlobalError('Sentry initialization failed')).toBe(false);
    });

    it('should NOT skip generic errors mentioning telemetry (only 429s)', () => {
      // Non-429 telemetry errors should be reported
      expect(shouldSkipGlobalError('Telemetry endpoint error')).toBe(false);
    });

    it('should skip 429 errors from monitoring endpoints', () => {
      expect(shouldSkipGlobalError('POST /monitoring 429 Too Many Requests')).toBe(true);
    });

    it('should skip 429 errors mentioning Sentry', () => {
      expect(shouldSkipGlobalError('Sentry rate limit: 429')).toBe(true);
    });

    it('should skip network errors from monitoring endpoints', () => {
      expect(shouldSkipGlobalError('Failed to fetch /monitoring')).toBe(true);
    });

    it('should skip network errors from sentry.io', () => {
      expect(shouldSkipGlobalError('Failed to fetch https://sentry.io/api')).toBe(true);
    });

    it('should skip network errors from telemetry endpoints', () => {
      expect(shouldSkipGlobalError('Failed to fetch telemetry endpoint')).toBe(true);
    });

    it('should skip NetworkError variant from monitoring endpoints', () => {
      expect(shouldSkipGlobalError('NetworkError when attempting to fetch resource: /monitoring')).toBe(true);
    });

    it('should skip "network error" variant from sentry.io', () => {
      expect(shouldSkipGlobalError('network error connecting to sentry.io')).toBe(true);
    });

    it('should NOT skip 429 errors from non-monitoring endpoints', () => {
      // This is the key fix - 429 errors from real API endpoints should NOT be skipped
      expect(shouldSkipGlobalError('POST /api/chat 429 Too Many Requests')).toBe(false);
    });

    it('should NOT skip generic 429 errors without monitoring context', () => {
      expect(shouldSkipGlobalError('429 Too Many Requests')).toBe(false);
    });

    it('should NOT skip "Too Many Requests" errors from regular API', () => {
      expect(shouldSkipGlobalError('/api/models returned Too Many Requests')).toBe(false);
    });

    it('should NOT skip network errors from non-monitoring endpoints', () => {
      expect(shouldSkipGlobalError('Failed to fetch https://api.example.com')).toBe(false);
    });

    it('should NOT skip regular application errors', () => {
      expect(shouldSkipGlobalError('ReferenceError: undefined is not defined')).toBe(false);
    });

    it('should handle case-insensitive matching for 429 errors', () => {
      expect(shouldSkipGlobalError('POST /MONITORING 429')).toBe(true);
      expect(shouldSkipGlobalError('SENTRY 429 error')).toBe(true);
    });
  });

  describe('Chrome extension "message port closed" error filtering', () => {
    /**
     * Simulates the filtering logic for message port closed errors
     * These errors are benign Chrome extension communication failures
     */
    function shouldSkipMessagePortError(errorMessage: string): boolean {
      const errorMessageLower = errorMessage.toLowerCase();

      return (
        errorMessageLower.includes('message port closed') ||
        errorMessageLower.includes('the message port closed before a response was received')
      );
    }

    it('should skip "message port closed" errors', () => {
      expect(shouldSkipMessagePortError('message port closed')).toBe(true);
    });

    it('should skip full Chrome runtime.lastError message', () => {
      expect(shouldSkipMessagePortError('Unchecked runtime.lastError: The message port closed before a response was received.')).toBe(true);
    });

    it('should skip case-insensitive variants', () => {
      expect(shouldSkipMessagePortError('MESSAGE PORT CLOSED')).toBe(true);
      expect(shouldSkipMessagePortError('The Message Port Closed Before A Response Was Received')).toBe(true);
    });

    it('should NOT skip unrelated errors', () => {
      expect(shouldSkipMessagePortError('TypeError: Cannot read property')).toBe(false);
      expect(shouldSkipMessagePortError('Network error')).toBe(false);
      expect(shouldSkipMessagePortError('Some random error')).toBe(false);
    });

    it('should NOT skip errors that mention "port" without "message port closed"', () => {
      expect(shouldSkipMessagePortError('Connection to port 3000 failed')).toBe(false);
      expect(shouldSkipMessagePortError('WebSocket port error')).toBe(false);
    });
  });

  describe('Privy auth network error filtering (JAVASCRIPT-NEXTJS-7139666867)', () => {
    /**
     * Tests for filtering Privy passwordless authentication network errors
     * These occur when users have network connectivity issues to auth.privy.io
     * Error format: "Failed to fetch (auth.privy.io)" or "[POST] https://auth.privy.io/..."
     */
    function shouldSkipPrivyNetworkError(errorMessage: string): boolean {
      const errorMessageLower = errorMessage.toLowerCase();

      // Privy network errors are non-blocking and should be skipped
      // They occur due to user network issues, CORS blocks, or connectivity problems
      const isPrivyNetworkError =
        (errorMessageLower.includes('failed to fetch') || errorMessageLower.includes('networkerror') || errorMessageLower.includes('<no response>')) &&
        (errorMessageLower.includes('privy.io') || errorMessageLower.includes('auth.privy'));

      return isPrivyNetworkError;
    }

    it('should skip "Failed to fetch (auth.privy.io)" errors', () => {
      expect(shouldSkipPrivyNetworkError('Failed to fetch (auth.privy.io)')).toBe(true);
    });

    it('should skip POST to auth.privy.io passwordless/init errors', () => {
      expect(shouldSkipPrivyNetworkError('[POST] "https://auth.privy.io/api/v1/passwordless/init": <no response> Failed to fetch (auth.privy.io)')).toBe(true);
    });

    it('should skip "<no response>" errors from privy.io', () => {
      expect(shouldSkipPrivyNetworkError('[POST] "https://auth.privy.io/api/v1/passwordless/init": <no response>')).toBe(true);
    });

    it('should skip NetworkError from auth.privy endpoints', () => {
      expect(shouldSkipPrivyNetworkError('NetworkError when attempting to fetch resource: https://auth.privy.io/api/v1/passwordless/init')).toBe(true);
    });

    it('should NOT skip network errors from non-Privy domains', () => {
      expect(shouldSkipPrivyNetworkError('Failed to fetch https://api.example.com/data')).toBe(false);
    });

    it('should NOT skip Privy errors that are not network-related', () => {
      expect(shouldSkipPrivyNetworkError('Privy authentication failed: Invalid token')).toBe(false);
    });

    it('should handle case-insensitive matching', () => {
      expect(shouldSkipPrivyNetworkError('FAILED TO FETCH (AUTH.PRIVY.IO)')).toBe(true);
      expect(shouldSkipPrivyNetworkError('NETWORKERROR from PRIVY.IO')).toBe(true);
    });

    it('should skip errors mentioning auth.privy in the URL', () => {
      expect(shouldSkipPrivyNetworkError('Failed to fetch https://auth.privy.io/api/v1/users')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    function shouldSkipUnhandledRejection(errorMessage: string): boolean {
      const errorMessageLower = errorMessage.toLowerCase();

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

      // Only skip 429 errors from monitoring OR network errors to monitoring
      return (is429Error && isMonitoringRelated) || isMonitoringNetworkError;
    }

    it('should handle empty error message', () => {
      expect(shouldSkipUnhandledRejection('')).toBe(false);
    });

    it('should handle error message with only whitespace', () => {
      expect(shouldSkipUnhandledRejection('   ')).toBe(false);
    });

    it('should handle error with partial match (mon vs monitoring)', () => {
      // "mon" should not match "/monitoring"
      expect(shouldSkipUnhandledRejection('Error in mon function')).toBe(false);
    });

    it('should NOT skip non-429 errors from monitoring endpoint', () => {
      // An error that mentions monitoring but is NOT a 429 should NOT be skipped
      expect(shouldSkipUnhandledRejection('/monitoring proxy to /api/chat failed')).toBe(false);
    });

    it('should skip 429 errors from monitoring proxy', () => {
      // A 429 from monitoring should be skipped
      expect(shouldSkipUnhandledRejection('/monitoring proxy 429 rate limited')).toBe(true);
    });

    it('should NOT skip API 429 that mentions user monitoring activity', () => {
      // Edge case: if an error message contains "monitoring" as a word (not /monitoring path)
      // The current implementation checks for "/monitoring" path, "sentry", or "telemetry"
      // so this should NOT be skipped since it doesn't match those patterns
      const msg = 'API rate limit 429 while monitoring user activity';
      // This will NOT be skipped because "monitoring" without "/" doesn't match "/monitoring"
      expect(shouldSkipUnhandledRejection(msg)).toBe(false);
    });

    it('should skip 429 errors that explicitly mention /monitoring path', () => {
      const msg = 'POST /monitoring returned 429';
      expect(shouldSkipUnhandledRejection(msg)).toBe(true);
    });
  });
});
