'use client';

/**
 * Global Error Boundary
 *
 * Root-level error boundary that catches any unhandled errors in the app.
 * Provides recovery options and reports errors to Sentry.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[GlobalErrorBoundary] Caught critical error:', error);
    console.error('[GlobalErrorBoundary] Component stack:', errorInfo.componentStack);

    // Capture error in Sentry with full context
    const eventId = Sentry.captureException(error, {
      tags: {
        error_type: 'uncaught_error',
        boundary: 'global',
        level: 'critical',
      },
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      level: 'fatal',
    });

    this.setState({
      errorInfo,
      eventId: eventId || null,
    });
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    });
  };

  handleRefresh = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  handleReportFeedback = (): void => {
    if (this.state.eventId) {
      Sentry.showReportDialog({
        eventId: this.state.eventId,
        title: 'It looks like we\'re having issues.',
        subtitle: 'Our team has been notified. If you\'d like to help, tell us what happened below.',
        subtitle2: '',
        labelName: 'Name',
        labelEmail: 'Email',
        labelComments: 'What happened?',
        labelClose: 'Close',
        labelSubmit: 'Submit',
        errorGeneric: 'An error occurred while submitting your report. Please try again.',
        errorFormEntry: 'Some fields were invalid. Please correct the errors and try again.',
        successMessage: 'Your feedback has been sent. Thank you!',
      });
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, eventId } = this.state;
      const {
        fallbackTitle = 'Something went wrong',
        fallbackMessage = 'We\'re sorry for the inconvenience. Our team has been notified and is working on a fix.',
      } = this.props;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
            {/* Error Icon */}
            <div className="flex items-center justify-center w-20 h-20 mx-auto rounded-full bg-red-100 dark:bg-red-900/20 mb-6">
              <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>

            {/* Error Title */}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {fallbackTitle}
            </h1>

            {/* Error Message */}
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              {fallbackMessage}
            </p>

            {/* Error ID (for support) */}
            {eventId && (
              <div className="mb-8 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Error ID (for support):
                </p>
                <code className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all">
                  {eventId}
                </code>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <Button
                onClick={this.handleRetry}
                variant="default"
                size="lg"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>

              <Button
                onClick={this.handleGoHome}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </Button>

              <Button
                onClick={this.handleRefresh}
                variant="ghost"
                size="lg"
              >
                Refresh Page
              </Button>
            </div>

            {/* Report Feedback Button */}
            {eventId && (
              <Button
                onClick={this.handleReportFeedback}
                variant="link"
                size="sm"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Send Feedback to Support
              </Button>
            )}

            {/* Development Error Details */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-8 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2">
                  Error Details (development only)
                </summary>
                <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                    {error.name}: {error.message}
                  </p>
                  <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-96">
                    {error.stack}
                  </pre>
                </div>
              </details>
            )}

            {/* Help Text */}
            <p className="mt-8 text-xs text-gray-500 dark:text-gray-500">
              If this problem persists, please contact support at{' '}
              <a
                href="mailto:support@gatewayz.ai"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                support@gatewayz.ai
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// FUNCTIONAL WRAPPER (for hooks compatibility)
// =============================================================================

interface GlobalErrorBoundaryWrapperProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

export function GlobalErrorBoundaryWrapper({
  children,
  fallbackTitle,
  fallbackMessage,
}: GlobalErrorBoundaryWrapperProps): JSX.Element {
  return (
    <GlobalErrorBoundary
      fallbackTitle={fallbackTitle}
      fallbackMessage={fallbackMessage}
    >
      {children}
    </GlobalErrorBoundary>
  );
}

export default GlobalErrorBoundary;
