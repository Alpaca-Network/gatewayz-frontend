/**
 * Tests for EarlyErrorSuppressor component
 *
 * Covers the early error suppression that runs before React mounts
 * to handle wallet extension errors (like evmAsk.js)
 */

import React from 'react';
import { render } from '@testing-library/react';
import { EarlyErrorSuppressor } from '@/components/early-error-suppressor';

describe('EarlyErrorSuppressor', () => {
  it('should render a script tag with the correct id', () => {
    const { container } = render(<EarlyErrorSuppressor />);
    const script = container.querySelector('#gatewayz-early-error-suppressor');
    expect(script).toBeTruthy();
  });

  it('should render as a native script tag (not Next.js Script)', () => {
    const { container } = render(<EarlyErrorSuppressor />);
    const script = container.querySelector('script');
    // Native script should not have data-strategy attribute
    expect(script?.getAttribute('data-strategy')).toBeNull();
  });

  it('should include ethereum error suppression patterns', () => {
    const { container } = render(<EarlyErrorSuppressor />);
    const script = container.querySelector('script');
    const scriptContent = script?.innerHTML || '';

    // Check for key patterns
    expect(scriptContent).toContain('Cannot redefine property.*ethereum');
    expect(scriptContent).toContain('evmAsk');
  });

  it('should set up error event listener in capture phase', () => {
    const { container } = render(<EarlyErrorSuppressor />);
    const script = container.querySelector('script');
    const scriptContent = script?.innerHTML || '';

    // Check for capture phase listener (the 'true' argument)
    expect(scriptContent).toContain("addEventListener('error'");
    expect(scriptContent).toContain('true'); // capture phase
  });
});

describe('ETHEREUM_ERROR_SUPPRESSOR_SCRIPT execution', () => {
  let errorLogs: string[] = [];
  let originalError: typeof console.error;
  let errorHandler: ((event: ErrorEvent) => boolean | void) | null = null;

  beforeEach(() => {
    originalError = console.error;
    errorLogs = [];

    // Mock console.error to capture logs
    console.error = jest.fn((...args: any[]) => {
      errorLogs.push(args.join(' '));
    });

    // Store the error handler when addEventListener is called
    const originalAddEventListener = window.addEventListener;
    jest.spyOn(window, 'addEventListener').mockImplementation(
      (type: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        if (type === 'error') {
          errorHandler = handler as (event: ErrorEvent) => boolean | void;
        }
        return originalAddEventListener.call(window, type, handler, options);
      }
    );
  });

  afterEach(() => {
    console.error = originalError;
    errorHandler = null;
    jest.restoreAllMocks();
  });

  it('should suppress ethereum property redefinition errors via console.error', () => {
    // Simulate script execution by evaluating the script content
    const { ETHEREUM_ERROR_SUPPRESSOR_SCRIPT } = require('@/lib/ethereum-error-suppressor-script');
    eval(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT);

    errorLogs = [];

    // Simulate the error from evmAsk.js
    console.error('Uncaught TypeError: Cannot redefine property: ethereum');

    expect(errorLogs).toEqual([]);
  });

  it('should suppress evmAsk ethereum errors via console.error', () => {
    const { ETHEREUM_ERROR_SUPPRESSOR_SCRIPT } = require('@/lib/ethereum-error-suppressor-script');
    eval(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT);

    errorLogs = [];

    console.error('evmAsk.js:15 Cannot redefine property: ethereum');

    expect(errorLogs).toEqual([]);
  });

  it('should allow non-ethereum errors through', () => {
    const { ETHEREUM_ERROR_SUPPRESSOR_SCRIPT } = require('@/lib/ethereum-error-suppressor-script');
    eval(ETHEREUM_ERROR_SUPPRESSOR_SCRIPT);

    errorLogs = [];

    console.error('Application error: Network request failed');

    expect(errorLogs).toContain('Application error: Network request failed');
  });
});
