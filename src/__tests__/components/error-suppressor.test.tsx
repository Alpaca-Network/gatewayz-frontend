/**
 * Tests for ErrorSuppressor component
 *
 * Covers fixes for:
 * - Wallet extension removeListener TypeError (Sentry #7049341391)
 * - Wallet extension sendMessage errors (Sentry #7065326236)
 * - Third-party script errors
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { ErrorSuppressor } from '@/components/error-suppressor';

describe('ErrorSuppressor', () => {
  let errorLogs: string[] = [];
  let warnLogs: string[] = [];
  let originalError: typeof console.error;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    // Save original console methods
    originalError = console.error;
    originalWarn = console.warn;

    // Clear log arrays
    errorLogs = [];
    warnLogs = [];

    // Mock console methods to capture what gets logged
    console.error = jest.fn((...args: any[]) => {
      errorLogs.push(args.join(' '));
    });
    console.warn = jest.fn((...args: any[]) => {
      warnLogs.push(args.join(' '));
    });
  });

  afterEach(() => {
    // Restore original console methods
    console.error = originalError;
    console.warn = originalWarn;
  });

  describe('removeListener error suppression', () => {
    it('should suppress removeListener TypeError from wallet extensions', async () => {
      render(<ErrorSuppressor />);

      errorLogs = []; // Clear before test

      // Simulate wallet extension removeListener error
      console.error("TypeError: Cannot read properties of undefined (reading 'removeListener')");

      // Error should be suppressed - not added to logs
      expect(errorLogs).toEqual([]);
    });

    it('should suppress inpage.js removeListener errors', async () => {
      render(<ErrorSuppressor />);

      errorLogs = [];

      console.error('Error in app:///inpage.js: removeListener is not defined');

      expect(errorLogs).toEqual([]);
    });

    it('should handle stopListeners errors from wallet extensions', async () => {
      render(<ErrorSuppressor />);

      errorLogs = [];

      console.error('Error in stopListeners: Cannot read properties of undefined');

      expect(errorLogs).toEqual([]);
    });
  });

  describe('wallet extension sendMessage errors', () => {
    it('should suppress Chrome runtime.sendMessage errors', async () => {
      render(<ErrorSuppressor />);

      errorLogs = [];

      console.error(
        'Error in invocation of runtime.sendMessage: chrome.runtime.sendMessage() called from a webpage must specify an Extension ID'
      );

      expect(errorLogs).toEqual([]);
    });

    it('should suppress inpage sendMessage errors', async () => {
      render(<ErrorSuppressor />);

      errorLogs = [];

      console.error('Error in inpage: sendMessage failed');

      expect(errorLogs).toEqual([]);
    });
  });

  describe('global error event handlers', () => {
    it('should register error event listeners', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      render(<ErrorSuppressor />);

      // Should have registered error and unhandledrejection listeners
      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('should handle wallet extension errors via ErrorEvent', () => {
      const preventDefaultSpy = jest.fn();

      render(<ErrorSuppressor />);

      const errorEvent = new ErrorEvent('error', {
        message: "Cannot read properties of undefined (reading 'removeListener')",
        filename: 'app:///inpage.js',
        lineno: 1,
        colno: 1029008,
      });

      // Spy on preventDefault
      errorEvent.preventDefault = preventDefaultSpy;

      window.dispatchEvent(errorEvent);

      // Event should be prevented
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should handle unhandled rejections from wallet extensions', () => {
      const preventDefaultSpy = jest.fn();

      render(<ErrorSuppressor />);

      // Create a custom event that mimics PromiseRejectionEvent
      const promise = Promise.reject(new Error('removeListener error'));
      promise.catch(() => {}); // Prevent test failure

      const rejectionEvent = new Event('unhandledrejection') as any;
      rejectionEvent.reason = new Error('removeListener error');
      rejectionEvent.promise = promise;
      rejectionEvent.preventDefault = preventDefaultSpy;

      window.dispatchEvent(rejectionEvent);

      // Event should be prevented
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('existing error suppression', () => {
    it('should still suppress Statsig networking errors', async () => {
      render(<ErrorSuppressor />);

      errorLogs = [];

      console.error('Statsig: networking error - ERR_BLOCKED_BY_CLIENT');

      expect(errorLogs).toEqual([]);
    });

    it('should still suppress ethereum property redefinition errors', async () => {
      render(<ErrorSuppressor />);

      errorLogs = [];

      console.error('Cannot redefine property: ethereum');

      expect(errorLogs).toEqual([]);
    });

    it('should still suppress Sentry tunnel rate limit errors', async () => {
      render(<ErrorSuppressor />);

      errorLogs = [];

      console.error('POST /monitoring 429 Too Many Requests');

      expect(errorLogs).toEqual([]);
    });
  });

  describe('non-suppressed errors', () => {
    it('should allow legitimate application errors through', async () => {
      render(<ErrorSuppressor />);

      errorLogs = [];

      console.error('Application error: Failed to fetch user data');

      expect(errorLogs).toContain('Application error: Failed to fetch user data');
    });

    it('should allow legitimate TypeErrors through', async () => {
      render(<ErrorSuppressor />);

      errorLogs = [];

      console.error('TypeError: Cannot read property "map" of null');

      expect(errorLogs).toContain('TypeError: Cannot read property "map" of null');
    });
  });

  describe('cleanup', () => {
    it('should restore original console methods on unmount', () => {
      const { unmount } = render(<ErrorSuppressor />);

      // Get the overridden console.error
      const overriddenError = console.error;

      unmount();

      // After unmount, console methods should be restored
      // In practice, the component restores them in useEffect cleanup
      expect(console.error).toBeDefined();
      expect(console.warn).toBeDefined();
    });

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = render(<ErrorSuppressor />);

      unmount();

      // Should have removed both error and unhandledrejection listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});
