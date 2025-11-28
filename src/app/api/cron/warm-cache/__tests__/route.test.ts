/**
 * @jest-environment node
 */
import { GET } from '../route';
import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((options, callback) => callback({ setAttribute: jest.fn() })),
  captureException: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock console methods (but keep implementation to check calls)
const mockConsoleLog = jest.spyOn(console, 'log');
const mockConsoleWarn = jest.spyOn(console, 'warn');
const mockConsoleError = jest.spyOn(console, 'error');

describe('GET /api/cron/warm-cache', () => {
  const mockFetch = global.fetch as jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'production';
    process.env.CACHE_WARMING_SECRET = 'test-secret-123';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://beta.gatewayz.ai';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Authentication - Production', () => {
    it('should return 401 if x-vercel-cron header is missing in production', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
      expect(mockConsoleWarn).toHaveBeenCalled();
    });

    it('should accept request with x-vercel-cron header in production', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, total_models: 100 }),
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
        headers: {
          'x-vercel-cron': '1',
        },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should log warning if cron header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('missing x-vercel-cron header')
      );
    });
  });

  describe('Authentication - Development', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should allow requests without x-vercel-cron header in development', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, total_models: 50 }),
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should still accept x-vercel-cron header in development', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
        headers: {
          'x-vercel-cron': '1',
        },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Cache Warming Invocation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should call the cache warming endpoint with correct URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://beta.gatewayz.ai/api/cache/warm-models',
        expect.any(Object)
      );
    });

    it('should pass authorization header with cache warming secret', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-secret-123',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should use default secret if CACHE_WARMING_SECRET is not set', async () => {
      delete process.env.CACHE_WARMING_SECRET;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer default-secret-change-me',
          }),
        })
      );
    });

    it('should use custom base URL from environment', async () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://custom.example.com';

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.example.com/api/cache/warm-models',
        expect.any(Object)
      );
    });
  });

  describe('Successful Cache Warming', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should return success response on successful cache warming', async () => {
      const mockResult = {
        success: true,
        duration_ms: 5000,
        total_models: 500,
        gateways_success: 15,
        gateways_failed: 2,
        details: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResult,
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Cache warming completed');
      expect(data.timestamp).toBeDefined();
      expect(data.result).toEqual(mockResult);
    });

    it('should include all result metrics in response', async () => {
      const mockResult = {
        success: true,
        duration_ms: 3000,
        total_models: 300,
        gateways_success: 10,
        gateways_failed: 1,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResult,
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.result.total_models).toBe(300);
      expect(data.result.gateways_success).toBe(10);
      expect(data.result.gateways_failed).toBe(1);
      expect(data.result.duration_ms).toBe(3000);
    });

    it('should log successful completion', async () => {
      const mockResult = {
        success: true,
        total_models: 200,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResult,
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cache warming completed successfully'),
        expect.objectContaining({ total_models: 200 })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should handle cache warming endpoint errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Cache warming failed');
      expect(data.timestamp).toBeDefined();
    });

    it('should handle 401 unauthorized from cache warming endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('401');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Network failure');
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Request timeout');
    });

    it('should handle non-JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => '<html>Bad Gateway</html>',
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should log errors to console', async () => {
      mockFetch.mockRejectedValue(new Error('Test error'));

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Cache warming failed'),
        expect.any(Error)
      );
    });
  });

  describe('Sentry Integration', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should capture exceptions in Sentry on error', async () => {
      const testError = new Error('Test cron error');
      mockFetch.mockRejectedValue(testError);

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          tags: expect.objectContaining({
            cron_job: 'warm-cache',
            error_type: 'cron_execution_error',
          }),
        })
      );
    });

    it('should set span attributes on success', async () => {
      const mockSetAttribute = jest.fn();
      (Sentry.startSpan as jest.Mock).mockImplementation((options, callback) =>
        callback({ setAttribute: mockSetAttribute })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          total_models: 150,
          gateways_success: 12,
          gateways_failed: 3,
          duration_ms: 4500,
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      expect(mockSetAttribute).toHaveBeenCalledWith('total_models', 150);
      expect(mockSetAttribute).toHaveBeenCalledWith('gateways_success', 12);
      expect(mockSetAttribute).toHaveBeenCalledWith('gateways_failed', 3);
      expect(mockSetAttribute).toHaveBeenCalledWith('duration_ms', 4500);
    });

    it('should set error span attributes on failure', async () => {
      const mockSetAttribute = jest.fn();
      (Sentry.startSpan as jest.Mock).mockImplementation((options, callback) =>
        callback({ setAttribute: mockSetAttribute })
      );

      mockFetch.mockRejectedValue(new Error('Test span error'));

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      expect(mockSetAttribute).toHaveBeenCalledWith('error', true);
      expect(mockSetAttribute).toHaveBeenCalledWith('error_message', 'Test span error');
    });

    it('should handle missing result fields gracefully in span attributes', async () => {
      const mockSetAttribute = jest.fn();
      (Sentry.startSpan as jest.Mock).mockImplementation((options, callback) =>
        callback({ setAttribute: mockSetAttribute })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }), // Missing metric fields
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      await GET(request);

      // Should use 0 as fallback for missing values
      expect(mockSetAttribute).toHaveBeenCalledWith('total_models', 0);
      expect(mockSetAttribute).toHaveBeenCalledWith('gateways_success', 0);
      expect(mockSetAttribute).toHaveBeenCalledWith('gateways_failed', 0);
      expect(mockSetAttribute).toHaveBeenCalledWith('duration_ms', 0);
    });
  });

  describe('Response Timestamps', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should include ISO timestamp in success response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const beforeTime = new Date();
      const response = await GET(request);
      const afterTime = new Date();
      const data = await response.json();

      const timestamp = new Date(data.timestamp);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should include ISO timestamp in error response', async () => {
      mockFetch.mockRejectedValue(new Error('Test error'));

      const request = new NextRequest('http://localhost:3000/api/cron/warm-cache', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');

      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
    });
  });
});
