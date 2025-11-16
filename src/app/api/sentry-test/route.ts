import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

const { logger } = Sentry;

/**
 * Test endpoint for Sentry integration
 * Visit /api/sentry-test to verify Sentry is working
 */
export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'GET /api/sentry-test',
    },
    async (span) => {
      const testType = request.nextUrl.searchParams.get('type') || 'all';

      span.setAttribute('test_type', testType);

      try {
        const results: Record<string, any> = {};

        // Test 1: Structured Logging
        if (testType === 'all' || testType === 'logging') {
          logger.trace('Test trace log', { test: true, level: 'trace' });
          logger.debug('Test debug log', { test: true, level: 'debug' });
          logger.info('Test info log', { test: true, level: 'info' });
          logger.warn('Test warning log', { test: true, level: 'warn' });

          results.logging = 'Logs sent (check Sentry dashboard)';
        }

        // Test 2: Span Attributes
        if (testType === 'all' || testType === 'spans') {
          span.setAttribute('test_metric', 123);
          span.setAttribute('test_string', 'hello');
          span.setAttribute('test_boolean', true);

          results.spans = 'Span attributes added (check Performance)';
        }

        // Test 3: Error Capturing
        if (testType === 'all' || testType === 'error') {
          try {
            throw new Error('Test error from Sentry integration');
          } catch (error) {
            Sentry.captureException(error, {
              tags: {
                test: true,
                test_type: 'intentional_error',
              },
              extra: {
                timestamp: Date.now(),
                endpoint: '/api/sentry-test',
              },
              level: 'info', // Using 'info' level since this is a test
            });

            results.error = 'Error captured (check Issues)';
          }
        }

        // Test 4: Nested Spans
        if (testType === 'all' || testType === 'nested') {
          await Sentry.startSpan(
            {
              op: 'test.operation',
              name: 'Nested Test Operation',
            },
            async (nestedSpan) => {
              nestedSpan.setAttribute('nested', true);
              await new Promise((resolve) => setTimeout(resolve, 100));
              nestedSpan.setAttribute('duration', 100);
            }
          );

          results.nested = 'Nested span created (check Performance)';
        }

        // Test 5: Template Literals
        if (testType === 'all' || testType === 'template') {
          const userId = 'test_user_123';
          const action = 'test_action';

          logger.info(logger.fmt`User ${userId} performed ${action}`, {
            test: true,
            user_id: userId,
            action: action,
          });

          results.template = 'Template literal logged (check Logs)';
        }

        span.setAttribute('status', 'success');
        span.setAttribute('tests_run', Object.keys(results).length);

        return NextResponse.json({
          success: true,
          message: 'Sentry test completed successfully',
          results,
          instructions: {
            check_issues: 'Visit Sentry Issues to see captured errors',
            check_performance: 'Visit Sentry Performance to see spans',
            check_logs: 'Visit Sentry Logs to see structured logs',
            test_types: [
              'all - Run all tests (default)',
              'logging - Test structured logging',
              'spans - Test span attributes',
              'error - Test error capturing',
              'nested - Test nested spans',
              'template - Test template literals',
            ],
            example: '/api/sentry-test?type=error',
          },
        });
      } catch (error) {
        logger.error('Sentry test failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        Sentry.captureException(error, {
          tags: {
            test: true,
            test_type: 'test_failure',
          },
        });

        span.setAttribute('error', true);

        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Test failed',
          },
          { status: 500 }
        );
      }
    }
  );
}
