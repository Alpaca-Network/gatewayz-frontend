/**
 * Tests for ETHEREUM_ERROR_SUPPRESSOR_SCRIPT
 *
 * Tests the raw script that runs before React mounts
 * to suppress ethereum property conflicts from wallet extensions
 */

import { ETHEREUM_ERROR_SUPPRESSOR_SCRIPT } from '@/lib/ethereum-error-suppressor-script';

describe('ETHEREUM_ERROR_SUPPRESSOR_SCRIPT', () => {
  let errorLogs: string[] = [];
  let originalError: typeof console.error;
  let errorEventHandler: ((event: ErrorEvent) => boolean | void) | null = null;
  let addEventListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    originalError = console.error;
    errorLogs = [];

    // Mock console.error
    console.error = jest.fn((...args: any[]) => {
      errorLogs.push(args.join(' '));
    });

    // Capture the error event handler
    addEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation(
      (type: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        if (type === 'error') {
          errorEventHandler = handler as (event: ErrorEvent) => boolean | void;
        }
        return undefined as any;
      }
    );
  });

  afterEach(() => {
    console.error = originalError;
    errorEventHandler = null;
    addEventListenerSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('script content', () => {
    it('should be a valid JavaScript IIFE', () => {
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain('(function()');
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain('})();');
    });

    it('should include suppress patterns for ethereum errors', () => {
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain('Cannot redefine property.*ethereum');
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain('evmAsk.*ethereum');
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain('Cannot redefine property: ethereum');
    });

    it('should include suppress patterns for React Portal cleanup errors', () => {
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain("Failed to execute 'removeChild' on 'Node'");
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain('The node to be removed is not a child of this node');
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain('NotFoundError.*removeChild');
    });

    it('should use strict mode', () => {
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain("'use strict'");
    });
  });

  describe('console.error override', () => {
    beforeEach(() => {
      // Execute the script
      eval(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT);
      errorLogs = [];
    });

    it('should suppress "Cannot redefine property: ethereum" errors', () => {
      console.error('Uncaught TypeError: Cannot redefine property: ethereum');
      expect(errorLogs).toEqual([]);
    });

    it('should suppress evmAsk ethereum errors', () => {
      console.error('evmAsk.js:15 Uncaught TypeError: Cannot redefine property: ethereum');
      expect(errorLogs).toEqual([]);
    });

    it('should suppress various ethereum property error formats', () => {
      console.error('Cannot redefine property ethereum');
      expect(errorLogs).toEqual([]);
    });

    it('should allow non-ethereum errors through', () => {
      console.error('Application error: Something went wrong');
      expect(errorLogs).toContain('Application error: Something went wrong');
    });

    it('should allow generic TypeError errors through', () => {
      console.error('TypeError: Cannot read property "foo" of undefined');
      expect(errorLogs).toContain('TypeError: Cannot read property "foo" of undefined');
    });

    it('should suppress React Portal removeChild errors', () => {
      console.error("NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.");
      expect(errorLogs).toEqual([]);
    });

    it('should suppress various removeChild error formats', () => {
      console.error("Failed to execute 'removeChild' on 'Node'");
      expect(errorLogs).toEqual([]);
    });

    it('should suppress node not a child errors', () => {
      console.error('The node to be removed is not a child of this node');
      expect(errorLogs).toEqual([]);
    });
  });

  describe('error event handler registration', () => {
    it('should register error handler in capture phase', () => {
      eval(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
        true // capture phase
      );
    });
  });

  describe('error event handler behavior', () => {
    beforeEach(() => {
      // Use real addEventListener to capture the handler
      addEventListenerSpy.mockRestore();
      addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      eval(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT);
    });

    it('should suppress ErrorEvent with ethereum property message', () => {
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      const errorEvent = new ErrorEvent('error', {
        message: 'Cannot redefine property: ethereum',
        filename: 'evmAsk.js',
      });
      errorEvent.preventDefault = preventDefaultSpy;
      errorEvent.stopPropagation = stopPropagationSpy;

      window.dispatchEvent(errorEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should suppress ErrorEvent from evmAsk.js filename', () => {
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      const errorEvent = new ErrorEvent('error', {
        message: 'Some error',
        filename: 'chrome-extension://xyz/evmAsk.js',
      });
      errorEvent.preventDefault = preventDefaultSpy;
      errorEvent.stopPropagation = stopPropagationSpy;

      window.dispatchEvent(errorEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should not suppress unrelated ErrorEvents', () => {
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      const errorEvent = new ErrorEvent('error', {
        message: 'Application error',
        filename: 'main.js',
      });
      errorEvent.preventDefault = preventDefaultSpy;
      errorEvent.stopPropagation = stopPropagationSpy;

      window.dispatchEvent(errorEvent);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(stopPropagationSpy).not.toHaveBeenCalled();
    });

    it('should suppress removeChild ErrorEvents', () => {
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      const errorEvent = new ErrorEvent('error', {
        message: "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
        filename: 'react-dom-client.production.js',
      });
      errorEvent.preventDefault = preventDefaultSpy;
      errorEvent.stopPropagation = stopPropagationSpy;

      window.dispatchEvent(errorEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should suppress NotFoundError with error.name check', () => {
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      // Create an error event with a NotFoundError
      const notFoundError = new DOMException('The node to be removed is not a child of this node', 'NotFoundError');
      const errorEvent = new ErrorEvent('error', {
        message: notFoundError.message,
        error: notFoundError,
        filename: 'react-dom.production.js',
      });
      errorEvent.preventDefault = preventDefaultSpy;
      errorEvent.stopPropagation = stopPropagationSpy;

      window.dispatchEvent(errorEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });
});
