/**
 * Tests for backend error tracking utilities
 */

import * as Sentry from '@sentry/nextjs';
import {
  trackBackendError,
  trackBadBackendResponse,
  trackBackendNetworkError,
  trackBackendProcessingError,
} from '@/lib/backend-error-tracking';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

// Mock network-error module
jest.mock('@/lib/network-error', () => ({
  getErrorMessage: jest.fn((error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error';
  }),
}));

describe('backend-error-tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('trackBackendError', () => {
    it('should track Error objects', () => {
      const error = new Error('Test error');
      const context = {
        endpoint: '/api/test',
        statusCode: 500,
        method: 'GET',
        gateway: 'test-gateway',
      };

      trackBackendError(error, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          level: 'error',
          tags: expect.objectContaining({
            error_category: 'backend_api',
            api_endpoint: '/api/test',
            http_status: '500',
            http_method: 'GET',
            gateway: 'test-gateway',
          }),
        })
      );
    });

    it('should convert string errors to Error objects', () => {
      const errorMessage = 'String error message';
      const context = {
        endpoint: '/api/test',
        statusCode: 400,
      };

      trackBackendError(errorMessage, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'warning',
          tags: expect.objectContaining({
            error_category: 'backend_api',
            api_endpoint: '/api/test',
            http_status: '400',
          }),
        })
      );
    });

    it('should set error level for 5xx errors', () => {
      const error = new Error('Server error');
      trackBackendError(error, { endpoint: '/api/test', statusCode: 503 });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ level: 'error' })
      );
    });

    it('should set warning level for 429 errors', () => {
      const error = new Error('Rate limit');
      trackBackendError(error, { endpoint: '/api/test', statusCode: 429 });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ level: 'warning' })
      );
    });

    it('should set warning level for 4xx errors', () => {
      const error = new Error('Client error');
      trackBackendError(error, { endpoint: '/api/test', statusCode: 404 });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ level: 'warning' })
      );
    });

    it('should include response body preview in context', () => {
      const error = new Error('Test error');
      const longBody = 'x'.repeat(600);

      trackBackendError(error, {
        endpoint: '/api/test',
        responseBody: longBody,
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          contexts: expect.objectContaining({
            backend_api: expect.objectContaining({
              response_preview: longBody.slice(0, 500),
            }),
          }),
        })
      );
    });

    it('should log to console', () => {
      const error = new Error('Test error');
      trackBackendError(error, { endpoint: '/api/test', statusCode: 500 });

      expect(console.error).toHaveBeenCalledWith(
        '[Backend API Error]',
        expect.objectContaining({
          endpoint: '/api/test',
          status: 500,
          error: 'Test error',
        })
      );
    });
  });

  describe('trackBadBackendResponse', () => {
    it('should track bad JSON response', async () => {
      const response = new Response(
        JSON.stringify({ error: 'Bad request' }),
        {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
        }
      );

      await trackBadBackendResponse(response, {
        endpoint: '/api/test',
        method: 'POST',
        gateway: 'test-gateway',
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            api_endpoint: '/api/test',
            http_status: '400',
            http_method: 'POST',
            gateway: 'test-gateway',
          }),
        })
      );
    });

    it('should track bad text response', async () => {
      const response = new Response('Error text', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'text/plain' },
      });

      await trackBadBackendResponse(response, {
        endpoint: '/api/test',
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            http_status: '500',
            api_endpoint: '/api/test',
          }),
          contexts: expect.objectContaining({
            backend_api: expect.objectContaining({
              endpoint: '/api/test',
              status_code: 500,
            }),
          }),
        })
      );
    });

    it('should handle response parsing errors gracefully', async () => {
      // Create a response with invalid JSON
      const response = new Response('invalid json {', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/json' },
      });

      await trackBadBackendResponse(response, {
        endpoint: '/api/test',
      });

      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('trackBackendNetworkError', () => {
    it('should track timeout errors with Error object', () => {
      const error = new Error('timeout');
      error.name = 'AbortError';

      trackBackendNetworkError(error, {
        endpoint: '/api/test',
        timeoutMs: 5000,
        gateway: 'test-gateway',
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            http_status: '408',
            gateway: 'test-gateway',
          }),
        })
      );
    });

    it('should track timeout errors by message content', () => {
      const error = new Error('Request timeout after 5000ms');

      trackBackendNetworkError(error, {
        endpoint: '/api/test',
        timeoutMs: 5000,
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Backend API timeout after 5000ms'),
        }),
        expect.objectContaining({
          tags: expect.objectContaining({
            http_status: '408',
          }),
        })
      );
    });

    it('should track network errors', () => {
      const error = new Error('Network request failed');

      trackBackendNetworkError(error, {
        endpoint: '/api/test',
        method: 'GET',
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Backend API network error'),
        }),
        expect.objectContaining({
          tags: expect.objectContaining({
            api_endpoint: '/api/test',
            http_method: 'GET',
          }),
        })
      );
    });

    it('should handle non-Error objects safely', () => {
      const error = { message: 'Something went wrong' };

      trackBackendNetworkError(error, {
        endpoint: '/api/test',
      });

      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should handle string errors', () => {
      const error = 'Network connection lost';

      trackBackendNetworkError(error, {
        endpoint: '/api/test',
      });

      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should handle null/undefined errors', () => {
      trackBackendNetworkError(null, {
        endpoint: '/api/test',
      });

      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('trackBackendProcessingError', () => {
    it('should track processing errors with Error object', () => {
      const error = new SyntaxError('Unexpected token in JSON');

      trackBackendProcessingError(error, {
        endpoint: '/api/test',
        method: 'GET',
        gateway: 'test-gateway',
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('SyntaxError'),
        }),
        expect.objectContaining({
          tags: expect.objectContaining({
            api_endpoint: '/api/test',
            http_method: 'GET',
            gateway: 'test-gateway',
          }),
        })
      );
    });

    it('should track processing errors with custom error type', () => {
      const error = new Error('Validation failed');

      trackBackendProcessingError(error, {
        endpoint: '/api/test',
        errorType: 'ValidationError',
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('ValidationError'),
        }),
        expect.any(Object)
      );
    });

    it('should handle non-Error objects', () => {
      const error = { foo: 'bar' };

      trackBackendProcessingError(error, {
        endpoint: '/api/test',
      });

      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should handle string errors', () => {
      const error = 'Processing failed';

      trackBackendProcessingError(error, {
        endpoint: '/api/test',
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('ProcessingError'),
        }),
        expect.any(Object)
      );
    });

    it('should not set HTTP status code', () => {
      const error = new Error('Processing error');

      trackBackendProcessingError(error, {
        endpoint: '/api/test',
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          contexts: expect.objectContaining({
            backend_api: expect.objectContaining({
              status_code: undefined,
            }),
          }),
        })
      );
    });
  });
});
