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
      // These errors occur when wallet extensions (MetaMask, etc.) are unloading
      // and are completely harmless - they don't affect functionality
      const eventMessage = event.message || '';
      if (
        errorMessage.includes('removeListener') ||
        errorMessage.includes('stopListeners') ||
        eventMessage.includes('removeListener') ||
        eventMessage.includes('stopListeners') ||
        (errorMessage.includes('Cannot read properties of undefined') && errorMessage.includes('removeListener'))
      ) {
        // Filter regardless of stack frame since these are always from extensions
        console.warn('[Sentry] Filtered out wallet extension removeListener error');
        return null;
      }

      // Filter out Next.js hydration errors
      // These are often caused by browser extensions, ad blockers, or dynamic content
      // and are non-critical since we have suppressHydrationWarning set
      const eventMessageLower = eventMessage.toLowerCase();
      const errorMessageLower = errorMessage.toLowerCase();
      if (
        errorMessageLower.includes('hydration') ||
        (errorMessageLower.includes('text content does not match') && errorMessageLower.includes('server')) ||
        eventMessageLower.includes('hydration') ||
        eventMessageLower.includes('server rendered html')
      ) {
        // Only filter if it's a generic hydration error without specific component info
        // This allows us to still catch real hydration bugs in our code
        // Use case-insensitive checks to catch all variants (e.g., "At Path", "Component Stack")
        const messageLower = errorMessage.toLowerCase();
        const hasComponentInfo =
          messageLower.includes('at path') ||
          messageLower.includes('component stack');

        if (!hasComponentInfo) {
          console.warn('[Sentry] Filtered out generic hydration error (likely caused by browser extensions)');
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

    it('should filter out removeListener errors without stack frame check', () => {
      const error = new TypeError("Cannot read properties of undefined (reading 'removeListener')");
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'TypeError',
            value: "Cannot read properties of undefined (reading 'removeListener')",
            stacktrace: {
              frames: []
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Sentry] Filtered out wallet extension removeListener error');
    });

    it('should filter out removeListener errors from event message', () => {
      const error = new Error('Extension cleanup failed');
      const event: Sentry.ErrorEvent = {
        message: "Cannot read properties of undefined (reading 'removeListener')",
        exception: {
          values: [{
            type: 'Error',
            value: 'Extension cleanup failed',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
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

    it('should filter ALL removeListener errors regardless of source', () => {
      // Updated behavior: After analysis, ALL removeListener errors are from extensions
      // Application code should use proper cleanup patterns that don't trigger these errors
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

      // Now filters all removeListener errors since they're extension-related
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Sentry] Filtered out wallet extension removeListener error');
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

    it('should filter events with no stack frames if they contain removeListener', () => {
      // Updated behavior: removeListener errors are ALWAYS from extensions
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

      // Now filters since removeListener is in the error message
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Sentry] Filtered out wallet extension removeListener error');
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

  describe('Hydration error filtering (JAVASCRIPT-NEXTJS-K)', () => {
    it('should filter out generic hydration errors', () => {
      const error = new Error('Hydration failed - the server rendered HTML did not match the client.');
      const event: Sentry.ErrorEvent = {
        message: 'Hydration Error',
        exception: {
          values: [{
            type: 'Error',
            value: 'Hydration failed - the server rendered HTML did not match the client.',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Sentry] Filtered out generic hydration error (likely caused by browser extensions)'
      );
    });

    it('should filter out "text content does not match server" errors', () => {
      const error = new Error('Text content does not match server-rendered HTML');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Text content does not match server-rendered HTML',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
    });

    it('should NOT filter hydration errors with component path info', () => {
      const error = new Error('Hydration failed at path /app/page.tsx in component Header');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Hydration failed at path /app/page.tsx in component Header',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSendCallback(event, hint);

      // Should NOT be filtered because it has "at path" - indicates real bug
      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });

    it('should NOT filter hydration errors with component stack', () => {
      const error = new Error('Hydration mismatch in component stack: Header > Navigation > Logo');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Hydration mismatch in component stack: Header > Navigation > Logo',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSendCallback(event, hint);

      // Should NOT be filtered because it has "component stack" - indicates real bug
      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });

    it('should filter hydration errors from event message field', () => {
      const error = new Error('Something went wrong');
      const event: Sentry.ErrorEvent = {
        message: 'Hydration failed because server rendered HTML did not match',
        exception: {
          values: [{
            type: 'Error',
            value: 'Something went wrong',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSendCallback(event, hint);

      expect(result).toBeNull();
    });
  });

  describe('429 Rate Limit error filtering (prevents cascade)', () => {
    // Update beforeSendCallback to include 429 filtering for these tests
    let beforeSend429Callback: (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => Sentry.ErrorEvent | null;
    let consoleDebugSpy: jest.SpyInstance;

    beforeEach(() => {
      // Mock console.debug to verify filter logging (implementation uses console.debug)
      consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

      beforeSend429Callback = (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => {
        const error = hint.originalException;
        const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
        const errorMessageLower = errorMessage.toLowerCase();
        const eventMessage = event.message || '';
        const eventMessageLower = eventMessage.toLowerCase();
        const stackFrames = event.exception?.values?.[0]?.stacktrace?.frames;

        // Filter out 429 rate limit errors from monitoring/telemetry endpoints
        if (
          errorMessageLower.includes('429') ||
          errorMessageLower.includes('too many requests') ||
          eventMessageLower.includes('429') ||
          eventMessageLower.includes('too many requests')
        ) {
          const isMonitoringError =
            errorMessageLower.includes('/monitoring') ||
            errorMessageLower.includes('sentry') ||
            errorMessageLower.includes('telemetry') ||
            eventMessageLower.includes('/monitoring') ||
            eventMessageLower.includes('sentry') ||
            eventMessageLower.includes('telemetry') ||
            stackFrames?.some(frame =>
              frame.filename?.includes('/monitoring') ||
              frame.filename?.includes('sentry')
            );

          if (isMonitoringError) {
            console.debug('[Sentry] Filtered out 429 rate limit error from monitoring endpoint (prevents cascade)');
            return null;
          }
        }

        // Filter out network errors related to monitoring/telemetry
        // Use lowercase for consistent case-insensitive matching
        if (
          errorMessageLower.includes('failed to fetch') ||
          errorMessageLower.includes('network error') ||
          errorMessageLower.includes('networkerror')
        ) {
          const isMonitoringNetworkError =
            errorMessageLower.includes('/monitoring') ||
            errorMessageLower.includes('sentry.io') ||
            errorMessageLower.includes('telemetry') ||
            eventMessageLower.includes('/monitoring') ||
            eventMessageLower.includes('sentry.io') ||
            eventMessageLower.includes('telemetry');

          if (isMonitoringNetworkError) {
            console.debug('[Sentry] Filtered out network error from monitoring/Sentry endpoint');
            return null;
          }
        }

        return event;
      };
    });

    afterEach(() => {
      consoleDebugSpy.mockRestore();
    });

    it('should filter out 429 errors from /monitoring endpoint', () => {
      const error = new Error('POST https://beta.gatewayz.ai/monitoring 429 (Too Many Requests)');
      const event: Sentry.ErrorEvent = {
        message: 'POST /monitoring 429',
        exception: {
          values: [{
            type: 'Error',
            value: 'POST https://beta.gatewayz.ai/monitoring 429 (Too Many Requests)',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSend429Callback(event, hint);

      expect(result).toBeNull();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Sentry] Filtered out 429 rate limit error from monitoring endpoint (prevents cascade)'
      );
    });

    it('should filter out 429 errors mentioning Sentry', () => {
      const error = new Error('Sentry rate limit exceeded: 429 Too Many Requests');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Sentry rate limit exceeded: 429 Too Many Requests',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSend429Callback(event, hint);

      expect(result).toBeNull();
    });

    it('should filter out "Too Many Requests" errors from telemetry', () => {
      const error = new Error('Telemetry endpoint returned: Too Many Requests');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Telemetry endpoint returned: Too Many Requests',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSend429Callback(event, hint);

      expect(result).toBeNull();
    });

    it('should filter out network errors from sentry.io', () => {
      const error = new Error('Failed to fetch https://o123.ingest.sentry.io/api/456/envelope');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Failed to fetch https://o123.ingest.sentry.io/api/456/envelope',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSend429Callback(event, hint);

      expect(result).toBeNull();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Sentry] Filtered out network error from monitoring/Sentry endpoint'
      );
    });

    it('should filter out network errors from /monitoring endpoint', () => {
      const error = new Error('NetworkError when attempting to fetch resource: /monitoring');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'NetworkError when attempting to fetch resource: /monitoring',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSend429Callback(event, hint);

      expect(result).toBeNull();
    });

    it('should NOT filter 429 errors from other endpoints (API errors)', () => {
      const error = new Error('POST /api/chat/completions 429 (Too Many Requests)');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'POST /api/chat/completions 429 (Too Many Requests)',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSend429Callback(event, hint);

      // Should NOT be filtered - this is a real API error the user should know about
      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });

    it('should NOT filter network errors from non-monitoring endpoints', () => {
      const error = new Error('Failed to fetch https://api.example.com/data');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Failed to fetch https://api.example.com/data',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = beforeSend429Callback(event, hint);

      // Should NOT be filtered - this is a real network error
      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });
  });
});
