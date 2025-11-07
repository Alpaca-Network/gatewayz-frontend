'use client';

import * as Sentry from '@sentry/react';
import { ReactNode } from 'react';

// Initialize Sentry on the client side
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Capture Replay for 10% of all sessions plus for 100% of sessions with an error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Attach stack traces to all messages
    attachStacktrace: true,
    // Automatically capture unhandled promise rejections
    enableTracing: true,
  });
}

interface SentryProviderProps {
  children: ReactNode;
}

export function SentryProvider({ children }: SentryProviderProps) {
  return <>{children}</>;
}
