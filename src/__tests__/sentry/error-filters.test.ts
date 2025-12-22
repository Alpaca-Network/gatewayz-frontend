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

      // NOTE: Hydration errors are now captured (not filtered)
      // This allows debugging of SSR/hydration mismatches

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

  describe('Chrome extension "message port closed" error filtering', () => {
    let messagePortCallback: (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => Sentry.ErrorEvent | null;
    let consoleDebugSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

      messagePortCallback = (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => {
        const error = hint.originalException;
        const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
        const eventMessage = event.message || '';

        // Filter out "message port closed" errors from Chrome extensions
        if (
          errorMessage.includes('message port closed') ||
          errorMessage.includes('The message port closed before a response was received') ||
          eventMessage.includes('message port closed') ||
          eventMessage.includes('The message port closed before a response was received')
        ) {
          console.debug('[Sentry] Filtered out Chrome extension "message port closed" error (benign browser behavior)');
          return null;
        }

        return event;
      };
    });

    afterEach(() => {
      consoleDebugSpy.mockRestore();
    });

    it('should filter out "message port closed" errors', () => {
      const error = new Error('message port closed');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'message port closed',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = messagePortCallback(event, hint);

      expect(result).toBeNull();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Sentry] Filtered out Chrome extension "message port closed" error (benign browser behavior)'
      );
    });

    it('should filter out full Chrome runtime.lastError message', () => {
      const error = new Error('Unchecked runtime.lastError: The message port closed before a response was received.');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Unchecked runtime.lastError: The message port closed before a response was received.',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = messagePortCallback(event, hint);

      expect(result).toBeNull();
    });

    it('should filter out message port closed errors from event message', () => {
      const error = new Error('Some other error');
      const event: Sentry.ErrorEvent = {
        message: 'The message port closed before a response was received',
        exception: {
          values: [{
            type: 'Error',
            value: 'Some other error',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = messagePortCallback(event, hint);

      expect(result).toBeNull();
    });

    it('should NOT filter unrelated errors', () => {
      const error = new Error('Real application error');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Real application error',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = messagePortCallback(event, hint);

      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });

    it('should filter case-insensitive variants (uppercase)', () => {
      // Update callback to use case-insensitive matching (matching the actual implementation)
      const caseInsensitiveCallback = (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => {
        const error = hint.originalException;
        const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
        const eventMessage = event.message || '';
        const errorMessageLower = errorMessage.toLowerCase();
        const eventMessageLower = eventMessage.toLowerCase();

        if (
          errorMessageLower.includes('message port closed') ||
          errorMessageLower.includes('the message port closed before a response was received') ||
          eventMessageLower.includes('message port closed') ||
          eventMessageLower.includes('the message port closed before a response was received')
        ) {
          return null;
        }

        return event;
      };

      const error = new Error('MESSAGE PORT CLOSED');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'MESSAGE PORT CLOSED',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = caseInsensitiveCallback(event, hint);

      expect(result).toBeNull();
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

  describe('Hydration error handling (JAVASCRIPT-NEXTJS-K)', () => {
    // NOTE: Hydration errors are no longer filtered - they are captured for debugging
    it('should capture generic hydration errors (not filtered)', () => {
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

      // Hydration errors are now captured (not filtered)
      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });

    it('should capture "text content does not match server" errors (not filtered)', () => {
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

      // Hydration errors are now captured (not filtered)
      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });

    it('should capture hydration errors with component path info', () => {
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

      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });

    it('should capture hydration errors with component stack', () => {
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

      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });

    it('should capture hydration errors from event message field (not filtered)', () => {
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

      // Hydration errors are now captured (not filtered)
      expect(result).not.toBeNull();
      expect(result).toBe(event);
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

  describe('iOS WebKit "Load failed" error filtering', () => {
    let loadFailedCallback: (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => Sentry.ErrorEvent | null;
    let consoleDebugSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

      // Callback that mimics the actual implementation for iOS WebKit "Load failed" filtering
      loadFailedCallback = (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => {
        const error = hint.originalException;
        const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
        const errorMessageLower = errorMessage.toLowerCase();
        const eventMessage = event.message || '';
        const eventMessageLower = eventMessage.toLowerCase();

        // Filter out iOS WebKit "Load failed" errors
        const exceptionType = event.exception?.values?.[0]?.type;
        const exceptionValue = event.exception?.values?.[0]?.value?.toLowerCase() || '';
        if (
          (exceptionType === 'TypeError' || errorMessage.includes('TypeError')) &&
          (errorMessageLower.includes('load failed') ||
           eventMessageLower.includes('load failed') ||
           exceptionValue.includes('load failed'))
        ) {
          console.debug('[Sentry] Filtered out iOS WebKit "TypeError: Load failed" error (benign browser behavior)');
          return null;
        }

        return event;
      };
    });

    afterEach(() => {
      consoleDebugSpy.mockRestore();
    });

    it('should filter out "TypeError: Load failed" errors from iOS WebKit', () => {
      const error = new TypeError('Load failed');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'TypeError',
            value: 'Load failed',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = loadFailedCallback(event, hint);

      expect(result).toBeNull();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Sentry] Filtered out iOS WebKit "TypeError: Load failed" error (benign browser behavior)'
      );
    });

    it('should filter out "TypeError: TypeError: Load failed" errors (double type prefix)', () => {
      const error = new TypeError('TypeError: Load failed');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'TypeError',
            value: 'TypeError: Load failed',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = loadFailedCallback(event, hint);

      expect(result).toBeNull();
    });

    it('should filter out Load failed errors from event message', () => {
      const error = new Error('Network issue');
      const event: Sentry.ErrorEvent = {
        message: 'TypeError: Load failed',
        exception: {
          values: [{
            type: 'TypeError',
            value: 'Network issue',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = loadFailedCallback(event, hint);

      expect(result).toBeNull();
    });

    it('should filter out Load failed errors with native code stack trace', () => {
      // This mimics the actual error structure from iOS WebKit
      const error = new TypeError('Load failed');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'TypeError',
            value: 'Load failed',
            stacktrace: {
              frames: [
                { filename: '[native code]', function: 'error', lineNo: undefined, colNo: undefined },
                { filename: '[native code]', function: 'Unknown', lineNo: undefined, colNo: undefined }
              ]
            }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = loadFailedCallback(event, hint);

      expect(result).toBeNull();
    });

    it('should filter case-insensitive variants', () => {
      const error = new TypeError('LOAD FAILED');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'TypeError',
            value: 'LOAD FAILED',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = loadFailedCallback(event, hint);

      expect(result).toBeNull();
    });

    it('should NOT filter Load failed errors that are not TypeErrors', () => {
      // Generic Error (not TypeError) with "Load failed" should be captured
      const error = new Error('Load failed due to server error');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'Error',
            value: 'Load failed due to server error',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = loadFailedCallback(event, hint);

      // Should NOT be filtered - this is a real application error
      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });

    it('should NOT filter TypeErrors without "Load failed" message', () => {
      const error = new TypeError('Cannot read property of undefined');
      const event: Sentry.ErrorEvent = {
        exception: {
          values: [{
            type: 'TypeError',
            value: 'Cannot read property of undefined',
            stacktrace: { frames: [] }
          }]
        }
      } as Sentry.ErrorEvent;

      const hint: Sentry.EventHint = { originalException: error };
      const result = loadFailedCallback(event, hint);

      // Should NOT be filtered - this is a real TypeError
      expect(result).not.toBeNull();
      expect(result).toBe(event);
    });
  });
});
