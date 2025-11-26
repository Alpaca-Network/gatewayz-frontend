'use client';

/**
 * Chat Error Boundary
 *
 * Catches errors in the chat component tree and provides recovery options.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { formatForLogging, getUserMessage, isRetryable } from '@/lib/errors';

// =============================================================================
// TYPES
// =============================================================================

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ChatErrorBoundary] Caught error:', formatForLogging(error));
    console.error('[ChatErrorBoundary] Component stack:', errorInfo.componentStack);

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  handleRefresh = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error } = this.state;
      const { fallbackTitle = 'Something went wrong' } = this.props;

      const userMessage = error ? getUserMessage(error) : 'An unexpected error occurred';
      const canRetry = error ? isRetryable(error) : true;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {fallbackTitle}
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
            {userMessage}
          </p>

          <div className="flex gap-3">
            {canRetry && (
              <Button
                onClick={this.handleRetry}
                variant="default"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            )}

            <Button
              onClick={this.handleRefresh}
              variant="outline"
            >
              Refresh Page
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-8 text-left w-full max-w-2xl">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                Error Details (dev only)
              </summary>
              <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs overflow-auto">
                {error.stack || error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// FUNCTIONAL WRAPPER (for hooks compatibility)
// =============================================================================

interface ChatErrorBoundaryWrapperProps {
  children: ReactNode;
  onError?: (error: Error) => void;
  onReset?: () => void;
  fallbackTitle?: string;
}

export function ChatErrorBoundaryWrapper({
  children,
  onError,
  onReset,
  fallbackTitle,
}: ChatErrorBoundaryWrapperProps): JSX.Element {
  return (
    <ChatErrorBoundary
      onError={onError}
      onReset={onReset}
      fallbackTitle={fallbackTitle}
    >
      {children}
    </ChatErrorBoundary>
  );
}

export default ChatErrorBoundary;
