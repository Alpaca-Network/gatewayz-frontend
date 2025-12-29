"use client";

import React, { Component, ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/nextjs';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Component name for better error tracking in Sentry
   */
  componentName?: string;
  /**
   * Optional callback when an error is caught
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * Optional custom fallback UI
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

/**
 * Enhanced Error Boundary Component
 *
 * Catches errors in child components and prevents full-page crashes.
 * Integrates with Sentry for error tracking.
 *
 * Improvements:
 * - Better Sentry integration with component context
 * - Reset functionality to recover from errors
 * - Custom fallback UI support
 * - Improved error suppression patterns
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Check if it's a hydration error from Privy or Next.js internal error
    const message = error.message || '';
    const shouldSuppress =
      message.includes('Hydration') ||
      message.includes('div cannot be a descendant of p') ||
      message.includes('HelpTextContainer') ||
      message.includes('layout router to be mounted') ||
      message.includes('invariant') ||
      // Add wallet extension errors
      message.includes('ethereum') && message.includes('redefine') ||
      message.includes('removeListener') ||
      message.includes('stopListeners');

    if (shouldSuppress) {
      // Suppress these errors - let Next.js/Privy handle them
      return { hasError: false };
    }

    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error info
    this.setState({
      errorInfo,
    });

    const message = error.message || '';

    // Suppress hydration and wallet errors in console
    const shouldSuppress =
      message.includes('Hydration') ||
      message.includes('div cannot be a descendant of p') ||
      message.includes('HelpTextContainer') ||
      message.includes('layout router to be mounted') ||
      message.includes('invariant') ||
      message.includes('ethereum') && message.includes('redefine') ||
      message.includes('removeListener') ||
      message.includes('stopListeners');

    if (shouldSuppress) {
      return; // Don't log suppressed errors
    }

    // Log error to Sentry with context
    Sentry.captureException(error, {
      level: 'error',
      tags: {
        error_type: 'component_error',
        component_name: this.props.componentName || 'unknown',
      },
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);

    // Log to console
    console.error('[ErrorBoundary] Component error caught:', {
      componentName: this.props.componentName,
      error,
      errorInfo,
    });
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      // Simple default fallback
      return (
        <div className="flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              {this.props.componentName ? `${this.props.componentName} Error` : 'Something went wrong'}
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={this.reset}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

