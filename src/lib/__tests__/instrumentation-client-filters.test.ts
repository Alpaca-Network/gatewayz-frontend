/**
 * Tests for client-side Sentry error filtering (instrumentation-client.ts)
 *
 * These tests verify that the client-side error filtering properly filters out:
 * - Hydration errors from Google Ads parameters
 * - DOM manipulation race conditions (removeChild, insertBefore)
 * - N+1 API call performance monitoring events
 * - Generic "Load failed" errors (but keeps API errors)
 * - Cross-origin script errors
 * - Third-party script errors via denyUrls and ignoreErrors
 */

import * as Sentry from '@sentry/nextjs';

// Mock the Sentry import
jest.mock('@sentry/nextjs', () => ({
  init: jest.fn(),
  replayIntegration: jest.fn(() => ({})),
  captureConsoleIntegration: jest.fn(() => ({})),
  captureRouterTransitionStart: jest.fn(),
}));

// Mock global error handlers
jest.mock('../global-error-handlers', () => ({
  initializeGlobalErrorHandlers: jest.fn(),
}));

describe('Client-side Sentry Error Filtering (instrumentation-client.ts)', () => {
  // Helper to extract shouldFilterEvent from the instrumentation file
  // We'll test this by examining the Sentry.init config
  let sentryConfig: any;
  let originalDateNow: () => number;
  let mockTime: number;

  beforeAll(() => {
    // Save original Date.now
    originalDateNow = Date.now;

    // Import instrumentation-client to trigger Sentry.init
    require('../../../instrumentation-client');

    // Get the config that was passed to Sentry.init
    sentryConfig = (Sentry.init as jest.Mock).mock.calls[0][0];
  });

  beforeEach(() => {
    // Mock Date.now to advance time by 2 minutes before each test
    // This ensures each test gets a fresh rate limit window
    mockTime = (mockTime || Date.now()) + (2 * 60 * 1000);
    Date.now = jest.fn(() => mockTime);
  });

  afterAll(() => {
    // Restore original Date.now
    Date.now = originalDateNow;
  });

  describe('Hydration Error Filtering', () => {
    it('should have hydration error filtering enabled (not disabled like before)', () => {
      // This test verifies that we removed the note saying hydration errors are NOT filtered
      // The actual filtering is tested in the behavioral tests below
      expect(sentryConfig.beforeSend).toBeDefined();
    });

    it('should filter hydration errors with "didn\'t match" message', () => {
      const event: Sentry.ErrorEvent = {
        message: "Hydration failed because the server rendered HTML didn't match the client",
        exception: {
          values: [{
            type: 'Error',
            value: "Text content does not match server-rendered HTML",
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new Error("Hydration failed because the server rendered HTML didn't match the client"),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull(); // Should be filtered
    });

    it('should filter hydration errors with "text content does not match" message', () => {
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Text content does not match server-rendered HTML',
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Text content does not match server-rendered HTML'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter hydration errors with "there was an error while hydrating" message', () => {
      const event: Sentry.ErrorEvent = {
        message: 'There was an error while hydrating this Suspense boundary',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('There was an error while hydrating'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter hydration errors with "hydration failed" message', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Hydration failed on initial render',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Hydration failed'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter hydration errors from event message (not just hint)', () => {
      const event: Sentry.ErrorEvent = {
        message: "Hydration error: Text content didn't match",
      };
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });
  });

  describe('DOM Manipulation Error Filtering', () => {
    it('should filter removeChild "not a child of this node" errors', () => {
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'NotFoundError',
            value: "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new Error("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter insertBefore "not a child of this node" errors', () => {
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'NotFoundError',
            value: "Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.",
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new Error("Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node."),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter DOM errors from event message (not just hint)', () => {
      const event: Sentry.ErrorEvent = {
        message: "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
      };
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter Statsig DOM manipulation errors', () => {
      const event: Sentry.ErrorEvent = {
        message: "[Statsig] Unexpected error in Statsig initialization: Failed to execute 'removeChild' on 'Node'",
      };
      const hint: Sentry.EventHint = {
        originalException: new Error("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });
  });

  describe('N+1 API Call Filtering', () => {
    it('should filter N+1 API call events with level "info"', () => {
      const event: Sentry.ErrorEvent = {
        message: 'N+1 API Call detected in parallel model prefetch',
        level: 'info',
      };
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter N+1 API call events with level "warning"', () => {
      const event: Sentry.ErrorEvent = {
        message: 'N+1 API Call',
        level: 'warning',
      };
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter N+1 API call events without explicit level', () => {
      const event: Sentry.ErrorEvent = {
        message: 'N+1 API Call',
      };
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter "N + 1" with spaces', () => {
      const event: Sentry.ErrorEvent = {
        message: 'N + 1 API Call detected',
      };
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter "N plus 1" spelled out', () => {
      const event: Sentry.ErrorEvent = {
        message: 'N plus 1 API Call',
      };
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should filter N+1 from exception value', () => {
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'PerformanceWarning',
            value: 'N+1 API Call',
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('N+1 API Call'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });
  });

  describe('Generic "Load failed" Error Filtering', () => {
    it('should filter generic "Load failed" TypeError', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Load failed',
        exception: {
          values: [{
            type: 'TypeError',
            value: 'Load failed',
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Load failed'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should NOT filter "Load failed" with API context', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Load failed',
        exception: {
          values: [{
            type: 'TypeError',
            value: 'API request failed',
            stacktrace: {
              frames: [{
                filename: '/api/models',
                function: 'fetchModels',
              }],
            },
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Load failed'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull(); // Should NOT be filtered
    });

    it('should NOT filter API-related load failures from message', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Backend API TypeError: /api/models?gateway=openrouter - Load failed',
        exception: {
          values: [{
            type: 'TypeError',
            value: 'Load failed',
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Backend API TypeError: Load failed'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull(); // Should NOT be filtered
    });

    it('should filter non-API "Load failed" from event message', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Load failed',
      };
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });
  });

  describe('Script Error Filtering', () => {
    it('should filter cross-origin "Script error." with no stack trace', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Script error.',
        exception: {
          values: [{
            type: 'Error',
            value: 'Script error.',
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Script error.'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });

    it('should NOT filter "Script error." if we have a stack trace', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Script error.',
        exception: {
          values: [{
            type: 'Error',
            value: 'Script error.',
            stacktrace: {
              frames: [{
                filename: '/app/page.tsx',
                function: 'MyComponent',
                lineno: 42,
              }],
            },
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Script error.'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull(); // Should NOT be filtered if we have stack
    });

    it('should filter "Script error" without period', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Script error',
      };
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull();
    });
  });

  describe('Sentry Configuration', () => {
    it('should have ignoreErrors configured', () => {
      expect(sentryConfig.ignoreErrors).toBeDefined();
      expect(Array.isArray(sentryConfig.ignoreErrors)).toBe(true);
      expect(sentryConfig.ignoreErrors.length).toBeGreaterThan(0);
    });

    it('should NOT have "Script error" in ignoreErrors (handled in beforeSend with nuance)', () => {
      const hasScriptError = sentryConfig.ignoreErrors.some((pattern: string | RegExp) => {
        if (typeof pattern === 'string') {
          return pattern === 'Script error.' || pattern === 'Script error';
        }
        return pattern.test('Script error.');
      });
      // Script error is NOT in ignoreErrors because we have nuanced logic in beforeSend
      // that preserves Script errors WITH stack traces (may be from our code)
      expect(hasScriptError).toBe(false);
    });

    it('should NOT have "Load failed" in ignoreErrors (handled in beforeSend with nuance)', () => {
      const hasLoadFailed = sentryConfig.ignoreErrors.some((pattern: string | RegExp) => {
        if (typeof pattern === 'string') {
          return pattern === 'Load failed';
        }
        return pattern.test('Load failed');
      });
      // Load failed is NOT in ignoreErrors because we have nuanced logic in beforeSend
      // that preserves API-related Load failed errors (backend issues we need to see)
      expect(hasLoadFailed).toBe(false);
    });

    it('should have denyUrls configured', () => {
      expect(sentryConfig.denyUrls).toBeDefined();
      expect(Array.isArray(sentryConfig.denyUrls)).toBe(true);
      expect(sentryConfig.denyUrls.length).toBeGreaterThan(0);
    });

    it('should deny chrome-extension URLs', () => {
      const hasChromeExtension = sentryConfig.denyUrls.some((pattern: RegExp) =>
        pattern.test('chrome-extension://abcdefg/script.js')
      );
      expect(hasChromeExtension).toBe(true);
    });

    it('should deny moz-extension URLs', () => {
      const hasMozExtension = sentryConfig.denyUrls.some((pattern: RegExp) =>
        pattern.test('moz-extension://abcdefg/script.js')
      );
      expect(hasMozExtension).toBe(true);
    });

    it('should deny Google Analytics URLs', () => {
      const hasGoogleAnalytics = sentryConfig.denyUrls.some((pattern: RegExp) =>
        pattern.test('https://www.google-analytics.com/analytics.js')
      );
      expect(hasGoogleAnalytics).toBe(true);
    });

    it('should deny DoubleClick ad URLs', () => {
      const hasDoubleClick = sentryConfig.denyUrls.some((pattern: RegExp) =>
        pattern.test('https://googleads.g.doubleclick.net/pagead/id')
      );
      expect(hasDoubleClick).toBe(true);
    });

    it('should deny WalletConnect URLs', () => {
      const hasWalletConnect = sentryConfig.denyUrls.some((pattern: RegExp) =>
        pattern.test('https://relay.walletconnect.com/socket')
      );
      expect(hasWalletConnect).toBe(true);
    });

    it('should deny inpage.js (wallet extension)', () => {
      const hasInpage = sentryConfig.denyUrls.some((pattern: RegExp) =>
        pattern.test('https://example.com/inpage.js')
      );
      expect(hasInpage).toBe(true);
    });
  });

  describe('Legitimate Errors Should Pass Through', () => {
    it('should NOT filter genuine application errors', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Uncaught TypeError: Cannot read property "foo" of undefined',
        exception: {
          values: [{
            type: 'TypeError',
            value: 'Cannot read property "foo" of undefined',
            stacktrace: {
              frames: [{
                filename: '/app/components/MyComponent.tsx',
                function: 'handleClick',
                lineno: 123,
              }],
            },
          }],
        },
      };
      const hint: Sentry.EventHint = {
        originalException: new TypeError('Cannot read property "foo" of undefined'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull();
    });

    it('should NOT filter API errors', () => {
      const event: Sentry.ErrorEvent = {
        message: 'API request failed with status 500',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('API request failed with status 500'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull();
    });

    it('should NOT filter user authentication errors', () => {
      const event: Sentry.ErrorEvent = {
        message: 'User authentication failed: Invalid credentials',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('User authentication failed'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull();
    });

    it('should NOT filter model API network failures (kept for investigation)', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Backend API network error: /api/models?gateway=openrouter&limit=50000',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Failed to fetch'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull();
    });

    it('should NOT filter streaming errors', () => {
      const event: Sentry.ErrorEvent = {
        message: '[ChatStream ERROR] Streaming failed',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Streaming failed'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull();
    });

    it('should NOT filter payment errors', () => {
      const event: Sentry.ErrorEvent = {
        message: 'StreamingError: Payment Required',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Payment Required'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with no message or exception', () => {
      const event: Sentry.ErrorEvent = {};
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull(); // Don't filter unknown events
    });

    it('should handle events with only exception type (no value)', () => {
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'TypeError',
          }],
        },
      };
      const hint: Sentry.EventHint = {};

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull();
    });

    it('should handle events with string originalException', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Some error',
      };
      const hint: Sentry.EventHint = {
        originalException: 'Hydration failed - this is a string error',
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull(); // Should filter based on hint string
    });

    it('should handle events with non-Error objects as originalException', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Custom error',
      };
      const hint: Sentry.EventHint = {
        originalException: { custom: 'object', message: 'not an Error instance' },
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).not.toBeNull(); // Don't filter unknown error types
    });

    it('should be case-insensitive for error matching', () => {
      const event: Sentry.ErrorEvent = {
        message: 'HYDRATION FAILED',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('HYDRATION FAILED'),
      };

      const result = sentryConfig.beforeSend(event, hint);
      expect(result).toBeNull(); // Should filter regardless of case
    });
  });
});
