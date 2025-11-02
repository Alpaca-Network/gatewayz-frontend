"use client";

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Check if it's a hydration error from Privy or Next.js internal error
    if (error.message.includes('Hydration') ||
        error.message.includes('div cannot be a descendant of p') ||
        error.message.includes('HelpTextContainer') ||
        error.message.includes('layout router to be mounted') ||
        error.message.includes('invariant')) {
      // Suppress these errors - let Next.js handle them
      return { hasError: false };
    }
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Suppress hydration errors from Privy and Next.js internal errors in console
    if (error.message.includes('Hydration') ||
        error.message.includes('div cannot be a descendant of p') ||
        error.message.includes('HelpTextContainer') ||
        error.message.includes('layout router to be mounted') ||
        error.message.includes('invariant')) {
      return; // Don't log these errors
    }
    console.log('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>;
    }

    return this.props.children;
  }
}

