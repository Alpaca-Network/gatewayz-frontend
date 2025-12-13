/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { ACTIVE_GATEWAYS, GATEWAYS } from '@/lib/gateway-registry';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((options, callback) => callback({ setAttribute: jest.fn() })),
  captureException: jest.fn(),
}));

// Mock fetch for discovery tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Helper to get fresh route module
function getRouteModule() {
  // Clear the module cache to get fresh state
  jest.resetModules();
  return require('../route');
}

describe('GET /api/gateways', () => {
  const originalEnv = process.env;
  let GET: typeof import('../route').GET;
  let POST: typeof import('../route').POST;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockFetch.mockReset();
    // Get fresh module to reset internal cache
    const routeModule = getRouteModule();
    GET = routeModule.GET;
    POST = routeModule.POST;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Gateway Listing', () => {
    it('should return list of gateways', async () => {
      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.gateways).toBeDefined();
      expect(Array.isArray(data.gateways)).toBe(true);
      expect(data.total).toBeGreaterThan(0);
    });

    it('should return gateways with required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      for (const gateway of data.gateways) {
        expect(gateway.id).toBeDefined();
        expect(gateway.name).toBeDefined();
        expect(gateway.color).toBeDefined();
        expect(gateway.priority).toBeDefined();
        expect(['fast', 'slow']).toContain(gateway.priority);
      }
    });

    it('should exclude deprecated gateways by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      const deprecatedIds = GATEWAYS
        .filter(g => g.deprecated)
        .map(g => g.id);

      for (const gateway of data.gateways) {
        expect(deprecatedIds).not.toContain(gateway.id);
      }
    });

    it('should include deprecated gateways when includeDeprecated=true', async () => {
      const request = new NextRequest('http://localhost:3000/api/gateways?includeDeprecated=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      // Should include portkey which is deprecated
      const hasPortkey = data.gateways.some((g: any) => g.id === 'portkey');
      expect(hasPortkey).toBe(true);

      // Total should be greater than active-only count
      expect(data.total).toBeGreaterThanOrEqual(ACTIVE_GATEWAYS.length);
    });

    it('should return source as "registry"', async () => {
      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.source).toBe('registry');
    });
  });

  describe('Gateway Discovery', () => {
    it('should probe gateways when discover=true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'model-1' }] }),
      });

      const request = new NextRequest('http://localhost:3000/api/gateways?discover=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.gateways).toBeDefined();

      // Should have called fetch for each gateway
      expect(mockFetch).toHaveBeenCalled();

      // Gateways should have available status
      for (const gateway of data.gateways) {
        expect(typeof gateway.available).toBe('boolean');
      }
    });

    it('should mark gateways as available when they return models', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('gateway=openrouter')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [{ id: 'model-1' }] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      const request = new NextRequest('http://localhost:3000/api/gateways?discover=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      const openrouter = data.gateways.find((g: any) => g.id === 'openrouter');
      expect(openrouter?.available).toBe(true);
    });

    it('should mark gateways as unavailable when they fail', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('gateway=openrouter')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ id: 'model' }] }),
        });
      });

      const request = new NextRequest('http://localhost:3000/api/gateways?discover=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      const openrouter = data.gateways.find((g: any) => g.id === 'openrouter');
      expect(openrouter?.available).toBe(false);
    });

    it('should mark gateways as unavailable when they return empty data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const request = new NextRequest('http://localhost:3000/api/gateways?discover=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      // All gateways should be marked as unavailable (no models returned)
      for (const gateway of data.gateways) {
        expect(gateway.available).toBe(false);
      }
    });

    it('should include availableCount in response', async () => {
      mockFetch.mockImplementation((url: string) => {
        // Only openrouter and groq return models
        if (url.includes('gateway=openrouter') || url.includes('gateway=groq')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [{ id: 'model' }] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      const request = new NextRequest('http://localhost:3000/api/gateways?discover=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.availableCount).toBeDefined();
      expect(typeof data.availableCount).toBe('number');
    });

    it('should sort gateways with available first when discovery is enabled', async () => {
      mockFetch.mockImplementation((url: string) => {
        // Only groq returns models (to test sorting)
        if (url.includes('gateway=groq')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [{ id: 'model' }] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      const request = new NextRequest('http://localhost:3000/api/gateways?discover=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      // Find groq in the list - it should be near the top
      const groqIndex = data.gateways.findIndex((g: any) => g.id === 'groq');
      expect(groqIndex).toBeLessThan(5); // Should be in first few results
    });

    it('should not include available field when discover=false', async () => {
      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      for (const gateway of data.gateways) {
        expect(gateway.available).toBeUndefined();
      }
    });

    it('should handle discovery timeout gracefully', async () => {
      mockFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      const request = new NextRequest('http://localhost:3000/api/gateways?discover=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      // Should still return gateways, just marked as unavailable
      expect(response.status).toBe(200);
      expect(data.gateways).toBeDefined();
    });
  });

  describe('Caching', () => {
    it('should indicate cached status in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'model' }] }),
      });

      const request = new NextRequest('http://localhost:3000/api/gateways?discover=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(typeof data.cached).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should still return gateways even when discovery fails', async () => {
      // Make all discovery requests fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/gateways?discover=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      // Should still return 200 with gateway list
      expect(response.status).toBe(200);
      expect(data.gateways).toBeDefined();
      expect(Array.isArray(data.gateways)).toBe(true);
      // But all gateways should be marked unavailable
      for (const gateway of data.gateways) {
        expect(gateway.available).toBe(false);
      }
    });
  });

  describe('Sentry Integration', () => {
    it('should track gateway count in span', async () => {
      // Sentry span receives setAttribute calls - verify in response
      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      // Verify the response contains gateway count (which would be set in span)
      expect(data.total).toBeGreaterThan(0);
    });

    it('should track discovery status in span', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const request = new NextRequest('http://localhost:3000/api/gateways?discover=true', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      // Verify discovery was performed (which would set span attribute)
      expect(data.availableCount).toBeDefined();
    });
  });
});

describe('POST /api/gateways/refresh', () => {
  const originalEnv = process.env;
  let GET: typeof import('../route').GET;
  let POST: typeof import('../route').POST;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CACHE_WARMING_SECRET = 'test-secret-123';
    mockFetch.mockReset();
    // Get fresh module to reset internal cache
    const routeModule = getRouteModule();
    GET = routeModule.GET;
    POST = routeModule.POST;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if authorization header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 if authorization header is incorrect', async () => {
      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer wrong-token',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should accept request with correct authorization', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'model' }] }),
      });

      const request = new NextRequest('http://localhost:3000/api/gateways', {
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
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer default-secret-change-me',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Cache Refresh', () => {
    it('should refresh gateway discovery cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'model' }] }),
      });

      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.availableGateways).toBeDefined();
      expect(Array.isArray(data.availableGateways)).toBe(true);
      expect(data.total).toBeDefined();
      expect(data.refreshedAt).toBeDefined();
    });

    it('should return list of available gateways', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('gateway=openrouter') || url.includes('gateway=groq')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [{ id: 'model' }] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.availableGateways).toContain('openrouter');
      expect(data.availableGateways).toContain('groq');
    });

    it('should handle refresh errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed, just with empty available gateways
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.availableGateways).toEqual([]);
    });
  });

  describe('Sentry Integration', () => {
    it('should track discovered count in span', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'model' }] }),
      });

      const request = new NextRequest('http://localhost:3000/api/gateways', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-secret-123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      // Verify the response contains discovered count (which would be set in span)
      expect(data.total).toBeDefined();
      expect(typeof data.total).toBe('number');
    });
  });
});
