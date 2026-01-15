/**
 * Tests for Sentry error filtering
 */

import { shouldSuppressError, isTransientError, beforeSend, getDenyUrls, getIgnoreErrors } from '../sentry-error-filters';
import type * as Sentry from '@sentry/nextjs';

type ErrorEvent = Sentry.ErrorEvent;
type EventHint = Sentry.EventHint;

describe('Sentry Error Filters', () => {
  describe('shouldSuppressError', () => {
    it('should suppress wallet extension removeListener errors', () => {
      const event: Sentry.ErrorEvent = {
        message: 'Cannot read properties of undefined (reading "removeListener")',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Cannot read properties of undefined (reading "removeListener")'),
      };

      expect(shouldSuppressError(event, hint)).toBe(true);
    });

    it('should suppress inpage.js errors', () => {
      const event: ErrorEvent = {
        message: 'TypeError from inpage.js',
        exception: {
          values: [{
            value: 'stopListeners is not defined',
            type: 'TypeError',
          }],
        },
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress hydration errors', () => {
      const event: ErrorEvent = {
        message: "Hydration failed because the server rendered HTML didn't match the client",
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress Java object is gone errors', () => {
      const event: ErrorEvent = {
        exception: {
          values: [{
            value: 'Java object is gone',
            type: 'Error',
          }],
        },
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress Privy iframe errors', () => {
      const event: ErrorEvent = {
        message: 'iframe not initialized',
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress origin not allowed errors', () => {
      const event: ErrorEvent = {
        exception: {
          values: [{
            value: 'Origin not allowed',
            type: 'Error',
          }],
        },
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress localStorage access denied errors', () => {
      const event: ErrorEvent = {
        message: "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should NOT suppress legitimate errors', () => {
      const event: ErrorEvent = {
        message: 'Uncaught ReferenceError: myFunction is not defined',
      };

      expect(shouldSuppressError(event)).toBe(false);
    });

    it('should NOT suppress API errors', () => {
      const event: ErrorEvent = {
        message: 'API request failed with status 500',
      };

      expect(shouldSuppressError(event)).toBe(false);
    });

    it('should suppress third-party service errors', () => {
      const event: ErrorEvent = {
        message: 'Statsig networking error: Failed to flush events',
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress rate limiting errors', () => {
      const event: ErrorEvent = {
        message: '/monitoring returned 429 Too Many Requests',
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress QuotaExceededError', () => {
      const event: ErrorEvent = {
        exception: {
          values: [{
            value: 'QuotaExceededError',
            type: 'QuotaExceededError',
          }],
        },
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress DOM manipulation removeChild errors', () => {
      const event: ErrorEvent = {
        message: "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress DOM manipulation insertBefore errors', () => {
      const event: ErrorEvent = {
        message: "Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.",
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress Statsig DOM manipulation errors', () => {
      const event: ErrorEvent = {
        message: 'Statsig initialization error: removeChild failed',
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress IndexedDB createObjectStore errors', () => {
      const event: ErrorEvent = {
        message: "undefined is not an object (evaluating 'i.result.createObjectStore')",
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress IndexedDB transaction closing errors', () => {
      const event: ErrorEvent = {
        exception: {
          values: [{
            value: "Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.",
            type: 'InvalidStateError',
          }],
        },
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress IndexedDB transaction not found errors', () => {
      const event: ErrorEvent = {
        message: "Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.",
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress build/minification lexical declaration errors', () => {
      const event: ErrorEvent = {
        message: "ReferenceError: can't access lexical declaration 'tH' before initialization",
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should handle events with only exception values', () => {
      const event: ErrorEvent = {
        exception: {
          values: [{
            value: 'Cannot read properties of undefined (reading "removeListener")',
            type: 'TypeError',
          }],
        },
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should handle events with stack trace in exception', () => {
      const event: ErrorEvent = {
        message: 'Some error',
        exception: {
          values: [{
            value: 'Error occurred',
            type: 'Error',
            stacktrace: {
              frames: [{
                filename: 'inpage.js',
                function: 'removeListener',
              }],
            },
          }],
        },
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should return false for empty events', () => {
      const event: ErrorEvent = {};
      const hint: Sentry.EventHint = {};

      expect(shouldSuppressError(event, hint)).toBe(false);
    });
  });

  describe('isTransientError', () => {
    it('should identify authentication timeout as transient', () => {
      const event: ErrorEvent = {
        message: 'Authentication timeout - stuck in authenticating state',
      };

      expect(isTransientError(event)).toBe(true);
    });

    it('should identify 504 errors as transient', () => {
      const event: ErrorEvent = {
        exception: {
          values: [{
            value: 'Authentication failed: 504',
            type: 'Error',
          }],
        },
      };

      expect(isTransientError(event)).toBe(true);
    });

    it('should identify abort errors as transient', () => {
      const event: ErrorEvent = {
        message: 'signal is aborted without reason',
      };

      expect(isTransientError(event)).toBe(true);
    });

    it('should identify network failures as transient', () => {
      const event: ErrorEvent = {
        message: 'Network request failed',
      };

      expect(isTransientError(event)).toBe(true);
    });

    it('should NOT identify non-transient errors', () => {
      const event: ErrorEvent = {
        message: 'Uncaught TypeError: Cannot read property "foo" of undefined',
      };

      expect(isTransientError(event)).toBe(false);
    });
  });

  describe('beforeSend', () => {
    it('should return null for suppressed errors', () => {
      const event: ErrorEvent = {
        message: 'Cannot read properties of undefined (reading "removeListener")',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Cannot read properties of undefined (reading "removeListener")'),
      };

      const result = beforeSend(event, hint);

      expect(result).toBeNull();
    });

    it('should downgrade transient errors to warning level', () => {
      const event: ErrorEvent = {
        message: 'Authentication timeout - stuck in authenticating state',
        level: 'error',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Authentication timeout'),
      };

      const result = beforeSend(event, hint);

      expect(result).not.toBeNull();
      expect(result?.level).toBe('warning');
      expect(result?.breadcrumbs).toContainEqual(
        expect.objectContaining({
          message: 'Error classified as transient',
          level: 'info',
        })
      );
    });

    it('should pass through legitimate errors unchanged', () => {
      const event: ErrorEvent = {
        message: 'Uncaught ReferenceError: myFunction is not defined',
        level: 'error',
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Uncaught ReferenceError: myFunction is not defined'),
      };

      const result = beforeSend(event, hint);

      expect(result).toEqual(event);
      expect(result?.level).toBe('error');
    });

    it('should handle events without hints', () => {
      const event: ErrorEvent = {
        message: 'Cannot read properties of undefined (reading "removeListener")',
      };
      const hint: Sentry.EventHint = {};

      const result = beforeSend(event, hint);

      // Should suppress because the message itself contains the suppression pattern
      expect(result).toBeNull();
    });

    it('should handle string exceptions', () => {
      const event: ErrorEvent = {
        message: 'Hydration failed',
      };
      const hint: Sentry.EventHint = {
        originalException: "Hydration failed - the server rendered HTML didn't match the client",
      };

      const result = beforeSend(event, hint);

      // Should suppress because the hint contains hydration error pattern
      expect(result).toBeNull();
    });

    it('should add breadcrumbs to transient errors even when breadcrumbs exist', () => {
      const event: ErrorEvent = {
        message: 'Authentication timeout - stuck in authenticating state',
        level: 'error',
        breadcrumbs: [
          {
            message: 'Previous breadcrumb',
            level: 'info',
          },
        ],
      };
      const hint: Sentry.EventHint = {
        originalException: new Error('Authentication timeout'),
      };

      const result = beforeSend(event, hint);

      expect(result).not.toBeNull();
      expect(result?.level).toBe('warning');
      expect(result?.breadcrumbs).toHaveLength(2);
      expect(result?.breadcrumbs?.[1]).toMatchObject({
        message: 'Error classified as transient',
        level: 'info',
      });
    });

    it('should handle events with exception value but no hint', () => {
      const event: ErrorEvent = {
        exception: {
          values: [{
            value: 'Failed to fetch',
            type: 'TypeError',
          }],
        },
        level: 'error',
      };
      const hint: Sentry.EventHint = {};

      const result = beforeSend(event, hint);

      expect(result).not.toBeNull();
      expect(result?.level).toBe('warning');
    });

    it('should handle non-Error originalException objects', () => {
      const event: ErrorEvent = {
        message: 'Some error',
      };
      const hint: Sentry.EventHint = {
        originalException: { custom: 'object' },
      };

      const result = beforeSend(event, hint);

      // Should not suppress since it's not a recognized pattern
      expect(result).toEqual(event);
    });
  });

  describe('getDenyUrls', () => {
    it('should return an array of RegExp patterns', () => {
      const denyUrls = getDenyUrls();

      expect(Array.isArray(denyUrls)).toBe(true);
      expect(denyUrls.length).toBeGreaterThan(0);
      expect(denyUrls[0]).toBeInstanceOf(RegExp);
    });

    it('should include browser extension patterns', () => {
      const denyUrls = getDenyUrls();
      const patterns = denyUrls.map(r => r.source).join(' ');

      expect(patterns).toContain('chrome-extension');
      expect(patterns).toContain('moz-extension');
      expect(patterns).toContain('extensions');
    });

    it('should include wallet extension script patterns', () => {
      const denyUrls = getDenyUrls();
      const patterns = denyUrls.map(r => r.source).join(' ');

      expect(patterns).toContain('inpage');
      expect(patterns).toContain('contentscript');
      expect(patterns).toContain('evmAsk');
    });

    it('should include third-party service patterns', () => {
      const denyUrls = getDenyUrls();
      const patterns = denyUrls.map(r => r.source).join(' ');

      expect(patterns).toContain('statsig');
      expect(patterns).toContain('walletconnect');
    });
  });

  describe('getIgnoreErrors', () => {
    it('should return an array of RegExp patterns', () => {
      const ignoreErrors = getIgnoreErrors();

      expect(Array.isArray(ignoreErrors)).toBe(true);
      expect(ignoreErrors.length).toBeGreaterThan(0);
      expect(ignoreErrors[0]).toBeInstanceOf(RegExp);
    });

    it('should include wallet extension error patterns', () => {
      const ignoreErrors = getIgnoreErrors();

      const hasRemoveListener = ignoreErrors.some(pattern =>
        pattern.test('Cannot read properties of undefined (reading "removeListener")')
      );
      expect(hasRemoveListener).toBe(true);
    });

    it('should include hydration error patterns', () => {
      const ignoreErrors = getIgnoreErrors();

      const hasHydration = ignoreErrors.some(pattern =>
        pattern.test("Hydration failed because the server rendered HTML didn't match the client")
      );
      expect(hasHydration).toBe(true);
    });

    it('should include third-party error patterns', () => {
      const ignoreErrors = getIgnoreErrors();

      const hasStatsig = ignoreErrors.some(pattern =>
        pattern.test('Statsig networking error')
      );
      expect(hasStatsig).toBe(true);
    });

    it('should include storage access error patterns', () => {
      const ignoreErrors = getIgnoreErrors();

      const hasLocalStorage = ignoreErrors.some(pattern =>
        pattern.test("Failed to read the 'localStorage' property from 'Window': Access is denied")
      );
      expect(hasLocalStorage).toBe(true);
    });

    it('should include DOM manipulation error patterns', () => {
      const ignoreErrors = getIgnoreErrors();

      const hasRemoveChild = ignoreErrors.some(pattern =>
        pattern.test("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.")
      );
      expect(hasRemoveChild).toBe(true);
    });

    it('should include IndexedDB error patterns', () => {
      const ignoreErrors = getIgnoreErrors();

      const hasIndexedDB = ignoreErrors.some(pattern =>
        pattern.test("undefined is not an object (evaluating 'i.result.createObjectStore')")
      );
      expect(hasIndexedDB).toBe(true);
    });

    it('should include build error patterns', () => {
      const ignoreErrors = getIgnoreErrors();

      const hasBuildError = ignoreErrors.some(pattern =>
        pattern.test("ReferenceError: can't access lexical declaration 'tH' before initialization")
      );
      expect(hasBuildError).toBe(true);
    });
  });
});
