/**
 * Tests for Sentry error filtering
 */

import { shouldSuppressError, isTransientError, beforeSend } from '../sentry-error-filters';
import type { Event, EventHint } from '@sentry/types';

describe('Sentry Error Filters', () => {
  describe('shouldSuppressError', () => {
    it('should suppress wallet extension removeListener errors', () => {
      const event: Event = {
        message: 'Cannot read properties of undefined (reading "removeListener")',
      };
      const hint: EventHint = {
        originalException: new Error('Cannot read properties of undefined (reading "removeListener")'),
      };

      expect(shouldSuppressError(event, hint)).toBe(true);
    });

    it('should suppress inpage.js errors', () => {
      const event: Event = {
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
      const event: Event = {
        message: "Hydration failed because the server rendered HTML didn't match the client",
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress Java object is gone errors', () => {
      const event: Event = {
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
      const event: Event = {
        message: 'iframe not initialized',
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should suppress origin not allowed errors', () => {
      const event: Event = {
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
      const event: Event = {
        message: "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
      };

      expect(shouldSuppressError(event)).toBe(true);
    });

    it('should NOT suppress legitimate errors', () => {
      const event: Event = {
        message: 'Uncaught ReferenceError: myFunction is not defined',
      };

      expect(shouldSuppressError(event)).toBe(false);
    });

    it('should NOT suppress API errors', () => {
      const event: Event = {
        message: 'API request failed with status 500',
      };

      expect(shouldSuppressError(event)).toBe(false);
    });
  });

  describe('isTransientError', () => {
    it('should identify authentication timeout as transient', () => {
      const event: Event = {
        message: 'Authentication timeout - stuck in authenticating state',
      };

      expect(isTransientError(event)).toBe(true);
    });

    it('should identify 504 errors as transient', () => {
      const event: Event = {
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
      const event: Event = {
        message: 'signal is aborted without reason',
      };

      expect(isTransientError(event)).toBe(true);
    });

    it('should identify network failures as transient', () => {
      const event: Event = {
        message: 'Network request failed',
      };

      expect(isTransientError(event)).toBe(true);
    });

    it('should NOT identify non-transient errors', () => {
      const event: Event = {
        message: 'Uncaught TypeError: Cannot read property "foo" of undefined',
      };

      expect(isTransientError(event)).toBe(false);
    });
  });

  describe('beforeSend', () => {
    it('should return null for suppressed errors', () => {
      const event: Event = {
        message: 'Cannot read properties of undefined (reading "removeListener")',
      };
      const hint: EventHint = {
        originalException: new Error('Cannot read properties of undefined (reading "removeListener")'),
      };

      const result = beforeSend(event, hint);

      expect(result).toBeNull();
    });

    it('should downgrade transient errors to warning level', () => {
      const event: Event = {
        message: 'Authentication timeout - stuck in authenticating state',
        level: 'error',
      };
      const hint: EventHint = {
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
      const event: Event = {
        message: 'Uncaught ReferenceError: myFunction is not defined',
        level: 'error',
      };
      const hint: EventHint = {
        originalException: new Error('Uncaught ReferenceError: myFunction is not defined'),
      };

      const result = beforeSend(event, hint);

      expect(result).toEqual(event);
      expect(result?.level).toBe('error');
    });

    it('should handle events without hints', () => {
      const event: Event = {
        message: 'removeListener error',
      };
      const hint: EventHint = {};

      const result = beforeSend(event, hint);

      expect(result).toBeNull();
    });

    it('should handle string exceptions', () => {
      const event: Event = {
        message: 'Hydration failed',
      };
      const hint: EventHint = {
        originalException: 'Hydration failed - the server rendered HTML didnt match the client',
      };

      const result = beforeSend(event, hint);

      expect(result).toBeNull();
    });
  });
});
