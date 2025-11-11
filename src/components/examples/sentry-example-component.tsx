'use client';

import * as Sentry from '@sentry/nextjs';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Example component demonstrating Sentry integration patterns
 * This file shows best practices for:
 * - UI interaction tracking
 * - Error catching
 * - Structured logging
 */

const { logger } = Sentry;

export function SentryExampleComponent() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  /**
   * Example: Track button click with span instrumentation
   */
  const handleButtonClick = () => {
    Sentry.startSpan(
      {
        op: 'ui.click',
        name: 'Example Button Click',
      },
      (span) => {
        // Add metrics to the span
        span.setAttribute('current_count', count);
        span.setAttribute('button_type', 'increment');

        // Log the interaction
        logger.info('Button clicked', {
          component: 'SentryExampleComponent',
          action: 'increment',
          count: count,
        });

        // Perform the action
        setCount(count + 1);
        span.setAttribute('new_count', count + 1);
      }
    );
  };

  /**
   * Example: Track async operation with error handling
   */
  const handleAsyncOperation = async () => {
    return Sentry.startSpan(
      {
        op: 'ui.action',
        name: 'Async Operation',
      },
      async (span) => {
        setLoading(true);
        const startTime = Date.now();

        try {
          span.setAttribute('operation', 'fetch_data');

          logger.info('Starting async operation', {
            component: 'SentryExampleComponent',
            operation: 'fetch_data',
          });

          // Simulate API call
          const response = await fetch('/api/example-endpoint');

          if (!response.ok) {
            throw new Error(`API call failed with status ${response.status}`);
          }

          const data = await response.json();
          const duration = Date.now() - startTime;

          // Add success metrics
          span.setAttribute('status', 'success');
          span.setAttribute('duration_ms', duration);
          span.setAttribute('response_size', JSON.stringify(data).length);

          logger.info('Async operation completed', {
            component: 'SentryExampleComponent',
            operation: 'fetch_data',
            duration_ms: duration,
            success: true,
          });

          return data;
        } catch (error) {
          const duration = Date.now() - startTime;

          // Add error metrics
          span.setAttribute('error', true);
          span.setAttribute('duration_ms', duration);

          // Log the error
          logger.error('Async operation failed', {
            component: 'SentryExampleComponent',
            operation: 'fetch_data',
            error: error instanceof Error ? error.message : 'Unknown error',
            duration_ms: duration,
          });

          // Capture exception in Sentry
          Sentry.captureException(error, {
            tags: {
              component: 'SentryExampleComponent',
              operation: 'fetch_data',
            },
            extra: {
              count,
              duration_ms: duration,
            },
            level: 'error',
          });

          throw error;
        } finally {
          setLoading(false);
        }
      }
    );
  };

  /**
   * Example: Track form submission
   */
  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    Sentry.startSpan(
      {
        op: 'ui.submit',
        name: 'Form Submission',
      },
      (span) => {
        const formData = new FormData(event.target as HTMLFormElement);
        const values = Object.fromEntries(formData);

        // Add form metrics
        span.setAttribute('form_name', 'example_form');
        span.setAttribute('field_count', Object.keys(values).length);

        // Log form submission (with sanitized data)
        logger.info('Form submitted', {
          component: 'SentryExampleComponent',
          form: 'example_form',
          field_count: Object.keys(values).length,
          // Note: Don't log actual field values if they contain sensitive data
        });

        try {
          // Process form
          // ... form processing logic ...

          span.setAttribute('status', 'success');
          logger.info('Form processing completed', {
            component: 'SentryExampleComponent',
            form: 'example_form',
            success: true,
          });
        } catch (error) {
          span.setAttribute('error', true);

          logger.error('Form processing failed', {
            component: 'SentryExampleComponent',
            form: 'example_form',
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          Sentry.captureException(error, {
            tags: {
              component: 'SentryExampleComponent',
              form: 'example_form',
            },
          });
        }
      }
    );
  };

  /**
   * Example: Track user navigation
   */
  const handleNavigation = (destination: string) => {
    Sentry.startSpan(
      {
        op: 'ui.navigation',
        name: 'User Navigation',
      },
      (span) => {
        span.setAttribute('destination', destination);
        span.setAttribute('source', 'SentryExampleComponent');

        logger.debug(logger.fmt`User navigating to ${destination}`, {
          component: 'SentryExampleComponent',
          destination,
        });

        // Navigation logic would go here
      }
    );
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold">Sentry Integration Examples</h2>

      <div className="space-y-2">
        <p>Count: {count}</p>
        <Button onClick={handleButtonClick}>
          Increment (Tracked Click)
        </Button>
      </div>

      <div className="space-y-2">
        <Button onClick={handleAsyncOperation} disabled={loading}>
          {loading ? 'Loading...' : 'Run Async Operation (Tracked)'}
        </Button>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-2">
        <input
          name="example"
          type="text"
          placeholder="Example input"
          className="border p-2 rounded"
        />
        <Button type="submit">Submit Form (Tracked)</Button>
      </form>

      <div className="space-y-2">
        <Button onClick={() => handleNavigation('/example-page')}>
          Navigate (Tracked)
        </Button>
      </div>

      <div className="mt-8 p-4 bg-muted rounded">
        <h3 className="font-semibold mb-2">Implementation Notes:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>All interactions are tracked with Sentry spans</li>
          <li>Structured logging provides searchable context</li>
          <li>Errors are captured with relevant context</li>
          <li>Performance metrics are automatically collected</li>
          <li>User actions are traced end-to-end</li>
        </ul>
      </div>
    </div>
  );
}
