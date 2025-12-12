/**
 * @jest-environment node
 */

import { GET } from '../route';
import { NextRequest } from 'next/server';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((_, callback) => callback({
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
  })),
  captureException: jest.fn(),
}));

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GET /api/models/popular', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns popular models from fallback when API is unavailable', async () => {
    // Mock API failure
    mockFetch.mockRejectedValueOnce(new Error('API unavailable'));

    const request = new NextRequest('http://localhost/api/models/popular');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    // Should be either 'curated' or 'fallback_error' when API fails
    expect(['curated', 'fallback_error']).toContain(data.source);
  });

  it('returns limited results based on limit parameter', async () => {
    // Mock API failure to use fallback
    mockFetch.mockRejectedValueOnce(new Error('API unavailable'));

    const request = new NextRequest('http://localhost/api/models/popular?limit=5');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.length).toBeLessThanOrEqual(5);
  });

  it('returns expected model structure', async () => {
    // Mock API failure to use fallback
    mockFetch.mockRejectedValueOnce(new Error('API unavailable'));

    const request = new NextRequest('http://localhost/api/models/popular?limit=1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.length).toBeGreaterThan(0);

    const model = data.data[0];
    expect(model).toHaveProperty('id');
    expect(model).toHaveProperty('name');
    expect(model).toHaveProperty('developer');
    expect(typeof model.id).toBe('string');
    expect(typeof model.name).toBe('string');
    expect(typeof model.developer).toBe('string');
  });

  it('uses cached results on subsequent requests', async () => {
    // First call - will fail API and use fallback
    mockFetch.mockRejectedValueOnce(new Error('API unavailable'));

    const request1 = new NextRequest('http://localhost/api/models/popular');
    const response1 = await GET(request1);
    const data1 = await response1.json();

    // Clear mock for second call
    mockFetch.mockClear();

    // Second call - should use cache (no fetch call)
    const request2 = new NextRequest('http://localhost/api/models/popular');
    const response2 = await GET(request2);
    const data2 = await response2.json();

    expect(data2.source).toBe('cache');
    expect(data2.data).toEqual(data1.data);
    // Fetch should not have been called again due to caching
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('includes known popular models in fallback', async () => {
    // Mock API failure to use fallback
    mockFetch.mockRejectedValueOnce(new Error('API unavailable'));

    const request = new NextRequest('http://localhost/api/models/popular?limit=10');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);

    // Check that some expected popular models are included
    const modelIds = data.data.map((m: any) => m.id);
    const expectedModels = [
      'anthropic/claude-sonnet-4',
      'openai/gpt-4o',
      'deepseek/deepseek-r1',
    ];

    // At least some expected popular models should be in the list
    const hasExpectedModels = expectedModels.some(id => modelIds.includes(id));
    expect(hasExpectedModels).toBe(true);
  });
});
