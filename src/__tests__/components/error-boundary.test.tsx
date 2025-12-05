/**
 * Tests for Enhanced Error Boundary Component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as Sentry from '@sentry/nextjs';
import { ErrorBoundary } from '@/components/error-boundary';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Suppress console.error for tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should catch errors and display default fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should display component name in error message when provided', () => {
    render(
      <ErrorBoundary componentName="TestComponent">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('TestComponent Error')).toBeInTheDocument();
  });

  it('should report errors to Sentry with correct context', () => {
    render(
      <ErrorBoundary componentName="TestComponent">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        level: 'error',
        tags: {
          error_type: 'component_error',
          component_name: 'TestComponent',
        },
        contexts: {
          react: {
            componentStack: expect.any(String),
          },
        },
      })
    );
  });

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should reset error state when Try Again is clicked', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    // Error is displayed
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Fix the error condition
    shouldThrow = false;

    // Click Try Again
    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    await user.click(tryAgainButton);

    // Re-render with fixed component
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    // Should show content after reset
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should use custom fallback when provided', () => {
    const customFallback = (error: Error, reset: () => void) => (
      <div>
        <h1>Custom Error UI</h1>
        <p>{error.message}</p>
        <button onClick={reset}>Reset</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('should suppress hydration errors', () => {
    const HydrationError = () => {
      throw new Error('Hydration failed because the initial UI does not match');
    };

    render(
      <ErrorBoundary>
        <HydrationError />
      </ErrorBoundary>
    );

    // Should not display error UI for hydration errors
    // The error boundary should suppress these
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('should suppress wallet extension errors', () => {
    const WalletError = () => {
      throw new Error('Cannot redefine property: ethereum');
    };

    render(
      <ErrorBoundary>
        <WalletError />
      </ErrorBoundary>
    );

    // Should not display error UI for wallet errors
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('should suppress removeListener errors', () => {
    const RemoveListenerError = () => {
      throw new Error('Cannot read properties of undefined (reading "removeListener")');
    };

    render(
      <ErrorBoundary>
        <RemoveListenerError />
      </ErrorBoundary>
    );

    // Should not display error UI for removeListener errors
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('should handle multiple consecutive errors', () => {
    let errorCount = 0;
    const MultiError = () => {
      errorCount++;
      throw new Error(`Error ${errorCount}`);
    };

    const { rerender } = render(
      <ErrorBoundary>
        <MultiError />
      </ErrorBoundary>
    );

    // First error
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    // Reset and throw another error
    rerender(
      <ErrorBoundary>
        <MultiError />
      </ErrorBoundary>
    );

    // Should handle second error
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
  });

  it('should preserve child component state before error', () => {
    let hasError = false;
    const StatefulComponent = () => {
      const [count, setCount] = React.useState(0);

      if (hasError && count > 0) {
        throw new Error('State error');
      }

      return (
        <div>
          <p>Count: {count}</p>
          <button onClick={() => setCount(count + 1)}>Increment</button>
        </div>
      );
    };

    const { rerender } = render(
      <ErrorBoundary>
        <StatefulComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Count: 0')).toBeInTheDocument();

    // Increment will work normally
    const button = screen.getByRole('button', { name: /increment/i });
    userEvent.click(button);

    // Now trigger error on next render
    hasError = true;
    rerender(
      <ErrorBoundary>
        <StatefulComponent />
      </ErrorBoundary>
    );

    // Error boundary should catch it
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
