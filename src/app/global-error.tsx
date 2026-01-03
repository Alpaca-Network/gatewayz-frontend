'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { navigateTo } from '@/lib/utils';

/**
 * Global Error Handler for Next.js App Router
 *
 * This component catches React rendering errors that occur at the root level
 * and reports them to Sentry. It's required by Next.js 15+ App Router for
 * comprehensive error tracking.
 *
 * See: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#react-render-errors-in-app-router
 *
 * @param error - The error that was thrown
 * @param reset - Function to attempt recovery by re-rendering the error boundary
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Capture the error in Sentry with relevant context
    Sentry.captureException(error, {
      tags: {
        error_type: 'global_error',
        error_boundary: 'root',
      },
      contexts: {
        react: {
          componentStack: 'Global Error Boundary (Root Layout)',
        },
      },
      // Root-level errors are always critical
      level: 'error',
    });
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Application Error - Gatewayz</title>
      </head>
      <body className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          {/* Error Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Error Message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Something went wrong
            </h1>
            <p className="text-muted-foreground">
              We apologize for the inconvenience. The error has been automatically reported to our team.
            </p>
          </div>

          {/* Error Details (for development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="p-4 bg-muted rounded-lg text-left">
              <p className="text-xs font-mono text-destructive break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-muted-foreground mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={reset}
              variant="default"
              className="min-w-[140px]"
            >
              Try again
            </Button>
            <Button
              onClick={() => navigateTo('/')}
              variant="outline"
              className="min-w-[140px]"
            >
              Go to homepage
            </Button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-muted-foreground">
            If this problem persists, please contact{' '}
            <a
              href="mailto:support@gatewayz.ai"
              className="text-primary hover:underline"
            >
              support@gatewayz.ai
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
