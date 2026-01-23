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
  let originalEthereum: any;
  let ethereumDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalError = console.error;
    errorLogs = [];

    // Save original ethereum state
    ethereumDescriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
    originalEthereum = (window as any).ethereum;

    // Clean up ethereum property for tests
    try {
      delete (window as any).ethereum;
    } catch (e) {
      // May fail if non-configurable, that's fine for tests
    }

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

    // Restore original ethereum state
    try {
      delete (window as any).ethereum;
      if (ethereumDescriptor) {
        Object.defineProperty(window, 'ethereum', ethereumDescriptor);
      } else if (originalEthereum !== undefined) {
        (window as any).ethereum = originalEthereum;
      }
    } catch (e) {
      // Ignore cleanup errors
    }
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

    it('should use strict mode', () => {
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain("'use strict'");
    });

    it('should include ethereum property pre-configuration', () => {
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain('Object.defineProperty(window, \'ethereum\'');
      expect(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT).toContain('configurable: true');
    });
  });

  describe('ethereum property pre-configuration', () => {
    beforeEach(() => {
      // Ensure ethereum is undefined before script runs
      try {
        delete (window as any).ethereum;
      } catch (e) {
        // Ignore if already non-configurable
      }
    });

    it('should pre-define window.ethereum as configurable when undefined', () => {
      // Mock addEventListener to prevent side effects
      addEventListenerSpy.mockImplementation(() => undefined as any);

      eval(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT);

      const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
      expect(descriptor).toBeDefined();
      expect(descriptor?.configurable).toBe(true);
    });

    it('should allow subsequent redefinition of window.ethereum', () => {
      // Mock addEventListener to prevent side effects
      addEventListenerSpy.mockImplementation(() => undefined as any);

      eval(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT);

      // This should not throw because ethereum is now configurable
      expect(() => {
        Object.defineProperty(window, 'ethereum', {
          value: { isMetaMask: true },
          configurable: true,
          writable: true,
        });
      }).not.toThrow();

      expect((window as any).ethereum.isMetaMask).toBe(true);
    });

    it('should allow setting window.ethereum via setter', () => {
      // Mock addEventListener to prevent side effects
      addEventListenerSpy.mockImplementation(() => undefined as any);

      eval(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT);

      const mockProvider = { isOKExWallet: true };
      (window as any).ethereum = mockProvider;

      expect((window as any).ethereum).toBe(mockProvider);
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
  });
});
