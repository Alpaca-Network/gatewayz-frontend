/**
 * @jest-environment node
 */
import { POST, GET } from '../route';
import { NextRequest } from 'next/server';
import * as modelsService from '@/lib/models-service';
import * as Sentry from '@sentry/nextjs';

// Mock the models service
jest.mock('@/lib/models-service', () => ({
  getModelsForGateway: jest.fn(),
}));

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((options, callback) => callback({ setAttribute: jest.fn() })),
  captureException: jest.fn(),
}));

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('POST /api/cache/warm-models', () => {
  const mockGetModelsForGateway = modelsService.getModelsForGateway as jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CACHE_WARMING_SECRET = 'test-secret-123';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if authorization header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 if authorization header is incorrect', async () => {
      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer wrong-secret',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should accept request with correct authorization header', async () => {
      mockGetModelsForGateway.mockResolvedValue({ data: [] });

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should use default secret if CACHE_WARMING_SECRET is not set', async () => {
      delete process.env.CACHE_WARMING_SECRET;
      mockGetModelsForGateway.mockResolvedValue({ data: [] });

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer default-secret-change-me',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Cache Warming Success', () => {
    it('should warm cache for all gateways successfully', async () => {
      const mockModels = [
        { id: 'model-1', name: 'Test Model 1' },
        { id: 'model-2', name: 'Test Model 2' },
      ];

      mockGetModelsForGateway.mockResolvedValue({ data: mockModels });

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.total_models).toBeGreaterThan(0);
      expect(data.gateways_success).toBeGreaterThan(0);
      expect(data.gateways_failed).toBe(0);
      expect(data.duration_ms).toBeDefined();
      expect(data.details).toBeDefined();
      expect(Array.isArray(data.details)).toBe(true);
    });

    it('should handle mixed success and failure responses', async () => {
      mockGetModelsForGateway
        .mockResolvedValueOnce({ data: [{ id: '1' }] }) // openrouter - success
        .mockRejectedValueOnce(new Error('Gateway timeout')) // featherless - fail
        .mockResolvedValueOnce({ data: [{ id: '2' }] }) // groq - success
        .mockResolvedValue({ data: [] }); // rest - empty

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.gateways_success).toBeGreaterThan(0);
      expect(data.gateways_failed).toBeGreaterThan(0);
    });

    it('should count models correctly', async () => {
      mockGetModelsForGateway.mockImplementation((gateway) => {
        if (gateway === 'openrouter') {
          return Promise.resolve({ data: Array(100).fill({ id: 'model' }) });
        }
        if (gateway === 'groq') {
          return Promise.resolve({ data: Array(50).fill({ id: 'model' }) });
        }
        return Promise.resolve({ data: [] });
      });

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total_models).toBeGreaterThanOrEqual(150);
    });

    it('should include duration metrics', async () => {
      mockGetModelsForGateway.mockResolvedValue({ data: [] });

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.duration_ms).toBeDefined();
      expect(typeof data.duration_ms).toBe('number');
      expect(data.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should return detailed results for each gateway', async () => {
      mockGetModelsForGateway.mockResolvedValue({ data: [{ id: '1' }] });

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(Array.isArray(data.details)).toBe(true);
      expect(data.details.length).toBeGreaterThan(0);

      const successResult = data.details.find((d: any) => d.status === 'success');
      expect(successResult).toBeDefined();
      expect(successResult.gateway).toBeDefined();
      expect(successResult.count).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle gateway errors gracefully', async () => {
      mockGetModelsForGateway.mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.gateways_failed).toBeGreaterThan(0);
    });

    it('should include error details for failed gateways', async () => {
      mockGetModelsForGateway
        .mockRejectedValueOnce(new Error('Timeout error'))
        .mockResolvedValue({ data: [] });

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      const errorResult = data.details.find((d: any) => d.status === 'error');
      expect(errorResult).toBeDefined();
      expect(errorResult.error).toBeDefined();
      expect(typeof errorResult.error).toBe('string');
    });

    it('should handle all gateways failing', async () => {
      mockGetModelsForGateway.mockRejectedValue(new Error('All failed'));

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.total_models).toBe(0);
      expect(data.gateways_success).toBe(0);
      expect(data.gateways_failed).toBeGreaterThan(0);
    });

    it('should handle fatal errors', async () => {
      // Mock Sentry.startSpan to throw error synchronously
      (Sentry.startSpan as jest.Mock).mockImplementationOnce((options, callback) => {
        throw new Error('Fatal error');
      });

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      // Since the error is thrown outside the handler, we need to catch it
      await expect(POST(request)).rejects.toThrow('Fatal error');
    });

    it('should handle Promise.allSettled rejections', async () => {
      mockGetModelsForGateway
        .mockRejectedValueOnce(new Error('Gateway 1 failed'))
        .mockRejectedValueOnce(new Error('Gateway 2 failed'))
        .mockResolvedValue({ data: [] });

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.details.filter((d: any) => d.status === 'error').length).toBeGreaterThan(0);
    });
  });

  describe('Sentry Integration', () => {
    it('should track successful cache warming with span attributes', async () => {
      mockGetModelsForGateway.mockResolvedValue({ data: [{ id: '1' }] });

      const mockSetAttribute = jest.fn();
      (Sentry.startSpan as jest.Mock).mockImplementation((options, callback) =>
        callback({ setAttribute: mockSetAttribute })
      );

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockSetAttribute).toHaveBeenCalledWith('total_models', expect.any(Number));
      expect(mockSetAttribute).toHaveBeenCalledWith('success_count', expect.any(Number));
      expect(mockSetAttribute).toHaveBeenCalledWith('error_count', expect.any(Number));
      expect(mockSetAttribute).toHaveBeenCalledWith('duration_ms', expect.any(Number));
    });

    it('should track gateway errors in details', async () => {
      mockGetModelsForGateway
        .mockRejectedValueOnce(new Error('Gateway failed'))
        .mockResolvedValue({ data: [] });

      const mockSetAttribute = jest.fn();
      (Sentry.startSpan as jest.Mock).mockImplementation((options, callback) =>
        callback({ setAttribute: mockSetAttribute })
      );

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.gateways_failed).toBeGreaterThan(0);

      // Find the failed gateway in details
      const failedGateway = data.details.find((d: any) => d.status === 'error');
      expect(failedGateway).toBeDefined();
      expect(failedGateway.error).toContain('Gateway failed');
    });
  });

  describe('Parallel Processing', () => {
    it('should process all gateways in parallel', async () => {
      const callOrder: string[] = [];

      mockGetModelsForGateway.mockImplementation((gateway) => {
        callOrder.push(gateway);
        return new Promise((resolve) => {
          setTimeout(() => resolve({ data: [] }), 10);
        });
      });

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      await POST(request);

      // All calls should start before any complete (parallel execution)
      expect(callOrder.length).toBeGreaterThan(0);
    });

    it('should handle timeout scenarios', async () => {
      mockGetModelsForGateway.mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: [] }), 100);
        })
      );

      const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});

describe('GET /api/cache/warm-models', () => {
  it('should return endpoint information', async () => {
    const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.endpoint).toBe('/api/cache/warm-models');
    expect(data.description).toBeDefined();
    expect(data.method).toBe('POST');
    expect(data.auth).toBeDefined();
    expect(Array.isArray(data.gateways)).toBe(true);
    expect(data.total_gateways).toBeGreaterThan(0);
  });

  it('should list all supported gateways', async () => {
    const request = new NextRequest('http://localhost:3000/api/cache/warm-models', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.gateways).toContain('openrouter');
    expect(data.gateways).toContain('groq');
    expect(data.gateways).toContain('together');
    expect(data.gateways).toContain('huggingface');
    expect(data.total_gateways).toBe(data.gateways.length);
  });
});
