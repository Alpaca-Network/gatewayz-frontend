/**
 * @jest-environment node
 */

import { GET } from '../route';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

// Mock the error handler
jest.mock('@/app/api/middleware/error-handler', () => ({
  handleApiError: jest.fn((error, context) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: error.message || 'Unknown error', context },
      { status: 500 }
    );
  }),
}));

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GET /api/ranking/models', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ranking models from backend API when successful', async () => {
    const mockData = {
      success: true,
      data: [
        { id: 1, model_name: 'GPT-4', author: 'OpenAI', tokens: '100', trend_direction: 'up' },
        { id: 2, model_name: 'Claude', author: 'Anthropic', tokens: '50', trend_direction: 'down' },
      ],
      count: 2,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(mockData),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].model_name).toBe('GPT-4');
  });

  it('returns error response when backend returns non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch ranking models');
    expect(data.data).toEqual([]);
  });

  it('handles HTML response (non-JSON content-type) gracefully', async () => {
    // Simulate backend returning HTML error page instead of JSON
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => '<!DOCTYPE html><html><body>404 Not Found</body></html>',
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Backend returned non-JSON response');
    expect(data.data).toEqual([]);
  });

  it('handles invalid JSON response gracefully', async () => {
    // Simulate backend returning malformed JSON
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => '{"invalid json...',
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid JSON response from backend');
    expect(data.data).toEqual([]);
  });

  it('handles missing content-type header gracefully', async () => {
    // Simulate response with no content-type header
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({}), // No content-type
      text: async () => '<!DOCTYPE html><html>Error</html>',
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Backend returned non-JSON response');
  });

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it('handles timeout errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Request timed out'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it('handles empty JSON response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ success: true, data: [], count: 0 }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
    expect(data.count).toBe(0);
  });

  it('preserves all fields from backend response', async () => {
    const mockData = {
      success: true,
      data: [{ id: 1, model_name: 'Test', author: 'Test Corp', extra_field: 'value' }],
      count: 1,
      limit: 10,
      offset: 0,
      has_logo_urls: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(mockData),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockData);
    expect(data.has_logo_urls).toBe(true);
  });

  it('handles content-type with charset correctly', async () => {
    const mockData = { success: true, data: [], count: 0 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
      text: async () => JSON.stringify(mockData),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
