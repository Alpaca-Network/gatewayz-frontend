"use client";

import React from 'react';
import { createLogger, UserImpact } from '@/lib/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  errorFingerprint?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  context?: string;
}

const logger = createLogger('ErrorBoundary', ['react', 'ui']);

/**
 * Check if error should be suppressed (framework-level issues)
 */
function shouldSuppressError(error: Error): boolean {
  const suppressPatterns = [
    'Hydration',
    'div cannot be a descendant of p',
    'HelpTextContainer',
    'layout router to be mounted',
    'invariant',
  ];

  return suppressPatterns.some(pattern => error.message.includes(pattern));
}

/**
 * Enhanced Error Boundary with structured logging
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Check if it's a framework error that should be suppressed
    if (shouldSuppressError(error)) {
      return { hasError: false };
    }
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Suppress framework-level errors
    if (shouldSuppressError(error)) {
      return;
    }

    // Determine user impact based on error location
    let userImpact = UserImpact.MEDIUM;
    const componentStack = errorInfo.componentStack || '';

    // Critical components
    if (componentStack.includes('AuthProvider') ||
        componentStack.includes('PrivyProvider')) {
      userImpact = UserImpact.CRITICAL;
    }
    // High impact components
    else if (componentStack.includes('ChatInterface') ||
             componentStack.includes('ModelCard') ||
             componentStack.includes('Settings')) {
      userImpact = UserImpact.HIGH;
    }
    // Low impact components
    else if (componentStack.includes('Analytics') ||
             componentStack.includes('Footer')) {
      userImpact = UserImpact.LOW;
    }

    // Log with structured logging and fingerprinting
    logger.error('React component error', error, {
      userImpact,
      context: {
        component: this.props.context || 'Unknown',
        componentStack,
        errorBoundary: true,
      },
      tags: ['react-error-boundary', 'component-error'],
    });
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[200px] p-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              We've logged this error and will investigate.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

