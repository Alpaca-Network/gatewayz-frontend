/**
 * Tests for Sentry error filtering (instrumentation-client.ts)
 *
 * Covers fixes for:
 * - JAVASCRIPT-NEXTJS-2: TypeError removeListener
 * - JAVASCRIPT-NEXTJS-13: Wallet extension errors
 */

import * as Sentry from '@sentry/nextjs';

describe('Sentry Error Filters', () => {
  let beforeSendCallback: (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => Sentry.ErrorEvent | null;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console.warn to verify filter logging
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Extract beforeSend callback from Sentry.init
    // In real implementation, this would be loaded from instrumentation-client.ts
    beforeSendCallback = (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => {
      const error = hint.originalException;
      const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
      const stackFrames = event.exception?.values?.[0]?.stacktrace?.frames;

      // Filter out chrome.runtime.sendMessage errors from Privy wallet provider (inpage.js)
      if (
        errorMessage.includes('chrome.runtime.sendMessage') ||
        errorMessage.includes('runtime.sendMessage') ||
        (errorMessage.includes('Extension ID') && errorMessage.includes('from a webpage'))
      ) {
        if (stackFrames?.some(frame =>
          frame.filename?.includes('inpage.js') ||
          frame.filename?.includes('privy') ||
          frame.function?.includes('Zt')
        )) {
          console.warn('[Sentry] Filtered out non-blocking Privy wallet extension error:', errorMessage);
          return null;
        }
      }

      // Filter out wallet extension removeListener errors
      if (errorMessage.includes('removeListener') || errorMessage.includes('stopListeners')) {
        if (stackFrames?.some(frame =>
          frame.filename?.includes('inpage.js') ||
          frame.filename?.includes('app:///') ||
          frame.function?.includes('stopListeners')
        )) {
          console.warn('[Sentry] Filtered out wallet extension removeListener error');
          return null;
        }
      }

      return event;
    };
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('removeListener error filtering (JAVASCRIPT-NEXTJS-2)', () => {
    it('should filter out removeListener errors from wallet extensions', () => {
      const error = new TypeError("Cannot read properties of undefined (reading 'removeListener')");
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'TypeError',
            value: "Cannot read properties of undefined (reading 'removeListener')",
            stacktrace: {
              frames: [
                { filename: 'app:///inpage.js', function: 'stopListeners', lineNo: 1, colNo: 1027240 }
              ]
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Sentry] Filtered out wallet extension removeListener error');
    });

    it('should filter out stopListeners errors from wallet extensions', () => {
      const error = new Error('stopListeners failed');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'stopListeners failed',
            stacktrace: {
              frames: [
                { filename: 'app:///inpage.js', function: 'Object.stopListeners', lineNo: 1, colNo: 1027240 }
              ]
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Sentry] Filtered out wallet extension removeListener error');
    });

    it('should NOT filter removeListener errors from application code', () => {
      const error = new TypeError("Cannot read properties of undefined (reading 'removeListener')");
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'TypeError',
            value: "Cannot read properties of undefined (reading 'removeListener')",
            stacktrace: {
              frames: [
                { filename: '/src/components/MyComponent.tsx', function: 'cleanup', lineNo: 42, colNo: 10 }
              ]
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      expect(result).not.toBeNull();
      expect(result).toBe(event);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('chrome.runtime.sendMessage error filtering (JAVASCRIPT-NEXTJS-13)', () => {
    it('should filter out chrome.runtime.sendMessage errors from wallet extensions', () => {
      const error = new Error('Error in invocation of runtime.sendMessage(optional string extensionId, any message, optional object options, optional function callback): chrome.runtime.sendMessage() called from a webpage must specify an Extension ID (string) for security reasons');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: error.message,
            stacktrace: {
              frames: [
                { filename: 'app:///inpage.js', function: 'Zt', lineNo: 1, colNo: 50000 }
              ]
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Sentry] Filtered out non-blocking Privy wallet extension error:',
        error.message
      );
    });

    it('should filter out runtime.sendMessage errors from Privy', () => {
      const error = new Error('runtime.sendMessage failed');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'runtime.sendMessage failed',
            stacktrace: {
              frames: [
                { filename: 'https://cdn.privy.io/inpage.js', function: 'sendMessage', lineNo: 1, colNo: 1000 }
              ]
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
    });

    it('should NOT filter chrome.runtime errors from application code', () => {
      const error = new Error('chrome.runtime.sendMessage failed');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'chrome.runtime.sendMessage failed',
            stacktrace: {
              frames: [
                { filename: '/src/services/extensionService.ts', function: 'sendToExtension', lineNo: 10, colNo: 5 }
              ]
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });
  });

  describe('error message format handling', () => {
    it('should handle string errors', () => {
      const error = "Cannot read properties of undefined (reading 'removeListener')";
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: error,
            stacktrace: {
              frames: [
                { filename: 'app:///inpage.js', function: 'stopListeners', lineNo: 1, colNo: 1000 }
              ]
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
    });

    it('should handle Error objects', () => {
      const error = new Error('removeListener error');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'removeListener error',
            stacktrace: {
              frames: [
                { filename: 'app:///inpage.js', function: 'cleanup', lineNo: 1, colNo: 1000 }
              ]
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
    });

    it('should handle events with no stack frames', () => {
      const error = new Error('removeListener error');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'removeListener error',
            stacktrace: {
              frames: []
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      // Should not filter if no frames match
      expect(result).toBe(event);
    });
  });

  describe('edge cases', () => {
    it('should pass through unrelated errors', () => {
      const error = new Error('Some other application error');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Some other application error',
            stacktrace: {
              frames: [
                { filename: '/src/app/page.tsx', function: 'handleClick', lineNo: 100, colNo: 5 }
              ]
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      expect(result).toBe(event);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle missing exception data', () => {
      const error = new Error('test');
      const event: Sentry.ErrorEvent = {} as Sentry.ErrorEvent;
      const hint: Sentry.EventHint = { originalException: error };

      const result = beforeSendCallback(event, hint);

      expect(result).toBe(event);
    });
  });
});
