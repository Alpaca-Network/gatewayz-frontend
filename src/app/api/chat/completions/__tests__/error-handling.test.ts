/**
 * Error Handling Tests for Chat Completions API
 *
 * Tests comprehensive error handling for various HTTP status codes
 * including 404, 400, 401, 403, 429, and 5xx errors.
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// Mock performance profiler
jest.mock('@/lib/performance-profiler', () => ({
  profiler: {
    startRequest: jest.fn(),
    markStage: jest.fn(),
    endRequest: jest.fn(),
  },
  generateRequestId: jest.fn(() => 'test-request-id'),
}));

// Mock guest rate limiter
jest.mock('@/lib/guest-rate-limiter', () => ({
  getClientIP: jest.fn(() => '127.0.0.1'),
  checkGuestRateLimit: jest.fn(() => ({ allowed: true, remaining: 3, limit: 3, resetInMs: 86400000 })),
  incrementGuestRateLimit: jest.fn(() => ({ remaining: 2, limit: 3, resetInMs: 86400000 })),
  formatResetTime: jest.fn(() => '24 hours'),
  getGuestDailyLimit: jest.fn(() => 3),
}));

describe('Chat Completions API - Error Handling', () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.spyOn(global, 'fetch');
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.gatewayz.ai';
    process.env.GUEST_API_KEY = 'test-guest-key';
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe('404 Not Found Errors', () => {
    it('should handle 404 error with proper Sentry logging', async () => {
      const Sentry = require('@sentry/nextjs');

      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: mockHeaders,
        text: async () => JSON.stringify({ detail: 'Not Found' }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'openai/gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: false,
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-key',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Backend API Error');
      expect(data.type).toBe('not_found_error');
      expect(data.message).toContain('not found');

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            error_type: 'chat_not_found_error',
            http_status: 404,
            model: 'openai/gpt-4',
          }),
          level: 'warning',
        })
      );
    });

    it('should include request context in 404 error', async () => {
      const Sentry = require('@sentry/nextjs');

      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: mockHeaders,
        text: async () => JSON.stringify({ detail: 'Model not found' }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'invalid/model',
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
          gateway: 'openrouter',
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-key',
        },
      });

      await POST(request);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          extra: expect.objectContaining({
            model: 'invalid/model',
            gateway: 'openrouter',
            targetUrl: expect.stringContaining('api.gatewayz.ai'),
            apiBaseUrl: 'https://api.gatewayz.ai',
          }),
        })
      );
    });
  });

  describe('400 Bad Request Errors', () => {
    it('should handle 400 validation errors with Sentry logging', async () => {
      const Sentry = require('@sentry/nextjs');

      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: mockHeaders,
        text: async () => JSON.stringify({ detail: 'Invalid message format' }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'openai/gpt-4',
          messages: [{ role: 'invalid', content: 'Test' }],
          stream: false,
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-key',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.type).toBe('validation_error');
      expect(data.message).toContain('Invalid');

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            error_type: 'chat_validation_error',
            http_status: 400,
          }),
          level: 'warning',
        })
      );
    });
  });

  describe('401/403 Authentication Errors', () => {
    it('should handle 401 authentication errors', async () => {
      const Sentry = require('@sentry/nextjs');

      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: mockHeaders,
        text: async () => JSON.stringify({ detail: 'Invalid API key' }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'openai/gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer invalid-key',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.type).toBe('auth_error');
      expect(data.message).toContain('session has expired');

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            error_type: 'chat_auth_error',
            http_status: 401,
          }),
          level: 'warning',
        })
      );
    });
  });

  describe('5xx Server Errors', () => {
    it('should handle 500 server errors with proper logging', async () => {
      const Sentry = require('@sentry/nextjs');

      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: mockHeaders,
        text: async () => JSON.stringify({ detail: 'Server error occurred' }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'openai/gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-key',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            error_type: 'chat_server_error',
            http_status: 500,
          }),
          level: 'error',
        })
      );
    });

    it('should handle 502 Bad Gateway errors', async () => {
      const Sentry = require('@sentry/nextjs');

      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        headers: mockHeaders,
        text: async () => JSON.stringify({ detail: 'Gateway error' }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'openai/gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-key',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(502);
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('Error Context and Metadata', () => {
    it('should include targetUrl in all error contexts', async () => {
      const Sentry = require('@sentry/nextjs');

      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: mockHeaders,
        text: async () => JSON.stringify({ detail: 'Not Found' }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'test/model',
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-key',
        },
      });

      await POST(request);

      const sentryCall = Sentry.captureException.mock.calls[0];
      expect(sentryCall[1].extra.targetUrl).toContain('api.gatewayz.ai/v1/chat/completions');
    });

    it('should include model and gateway in error tags', async () => {
      const Sentry = require('@sentry/nextjs');

      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: mockHeaders,
        text: async () => JSON.stringify({ detail: 'Not Found' }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'anthropic/claude-3',
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
          gateway: 'anthropic',
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-key',
        },
      });

      await POST(request);

      const sentryCall = Sentry.captureException.mock.calls[0];
      expect(sentryCall[1].tags.model).toBe('anthropic/claude-3');
      expect(sentryCall[1].tags.gateway).toBe('anthropic');
    });
  });

  describe('User-Facing Error Messages', () => {
    it('should provide helpful 404 error message', async () => {
      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: mockHeaders,
        text: async () => JSON.stringify({ detail: 'Model not found' }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'test/model',
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-key',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toContain('not found');
      expect(data.message).toContain('temporarily unavailable');
    });

    it('should provide helpful validation error message', async () => {
      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: mockHeaders,
        text: async () => JSON.stringify({ detail: 'Invalid format' }),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'test/model',
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-key',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toContain('Invalid');
      expect(data.type).toBe('validation_error');
    });
  });
});
