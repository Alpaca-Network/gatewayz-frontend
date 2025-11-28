/**
 * Integration tests for chat completions API route
 *
 * Tests the POST handler for streaming and non-streaming requests
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock the performance profiler
jest.mock('@/lib/performance-profiler', () => ({
  profiler: {
    startRequest: jest.fn(),
    markStage: jest.fn(),
    endRequest: jest.fn(),
  },
  generateRequestId: jest.fn(() => 'test-request-id'),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('Chat Completions API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Helper to create a mock ReadableStream
   */
  function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;

    return new ReadableStream({
      async pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });
  }

  /**
   * Helper to create a mock NextRequest
   */
  function createMockRequest(body: any, apiKey?: string): NextRequest {
    const headers = new Headers();
    headers.set('content-type', 'application/json');

    if (apiKey) {
      headers.set('authorization', `Bearer ${apiKey}`);
    }

    const request = new NextRequest('http://localhost:3000/api/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    return request;
  }

  describe('Streaming Requests', () => {
    test('should handle streaming request with openrouter/auto', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      };

      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/event-stream',
        }),
        body: createMockStream(mockChunks),
      });

      const request = createMockRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');

      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/chat/completions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          }),
        })
      );
    });

    test('should retry on 429 rate limit for streaming', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      };

      // First call returns 429
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'retry-after': '1',
        }),
        text: async () => JSON.stringify({ detail: 'Rate limit exceeded' }),
      });

      // Second call succeeds
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Success"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/event-stream',
        }),
        body: createMockStream(mockChunks),
      });

      const request = createMockRequest(requestBody);
      const response = await POST(request);

      // Should eventually succeed after retry
      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('should return error after max retries on 429', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      };

      // All calls return 429
      for (let i = 0; i <= 3; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({
            'retry-after': '1',
          }),
          text: async () => JSON.stringify({ detail: 'Rate limit exceeded' }),
        });
      }

      const request = createMockRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toBe('Rate Limit Exceeded');
      expect(body.retriesExhausted).toBe(true);
    });

    test('should handle backend error in streaming', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: async () => JSON.stringify({ detail: 'Internal server error' }),
      });

      const request = createMockRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Backend API Error');
      expect(body.message).toContain('Internal server error');
    });

    test('should handle no response body error', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/event-stream',
        }),
        body: null,
      });

      const request = createMockRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('No response body');
    });

    test('should add session_id to request if provided', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      };

      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/event-stream',
        }),
        body: createMockStream(mockChunks),
      });

      const url = new URL('http://localhost:3000/api/chat/completions?session_id=123');
      const request = new NextRequest(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      await POST(request);

      // Verify fetch was called with session_id in URL
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('session_id=123'),
        expect.any(Object)
      );
    });

    test('should include timing headers in response', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      };

      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/event-stream',
        }),
        body: createMockStream(mockChunks),
      });

      const request = createMockRequest(requestBody);
      const response = await POST(request);

      expect(response.headers.get('X-Request-ID')).toBeTruthy();
      expect(response.headers.get('X-Response-Time')).toBeTruthy();
      expect(response.headers.get('X-Backend-Time')).toBeTruthy();
      expect(response.headers.get('X-Network-Time')).toBeTruthy();
    });
  });

  describe('Non-Streaming Requests', () => {
    test('should handle non-streaming request', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        apiKey: 'test-api-key',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
        }),
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        }),
      });

      const request = createMockRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      const body = await response.json();
      expect(body.choices).toBeDefined();
    });
  });

  describe('Authentication', () => {
    test('should return 401 if no API key provided', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      const request = createMockRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('API key required');
    });

    test('should accept API key from Authorization header', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/event-stream',
        }),
        body: createMockStream(mockChunks),
      });

      const request = createMockRequest(requestBody, 'header-api-key');
      await POST(request);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer header-api-key',
          }),
        })
      );
    });
  });

  describe('Model ID Normalization', () => {
    test('should normalize @provider format to provider format', async () => {
      const requestBody = {
        model: '@google/models/gemini-pro',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      };

      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/event-stream',
        }),
        body: createMockStream(mockChunks),
      });

      const request = createMockRequest(requestBody);
      await POST(request);

      // Verify the normalized model ID is sent to backend
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const sentBody = JSON.parse(fetchCall[1].body);
      expect(sentBody.model).toBe('google/gemini-pro');
    });
  });

  describe('Error Handling', () => {
    test('should handle network timeout', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      };

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

      const request = createMockRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(504);
      const body = await response.json();
      expect(body.details).toContain('aborted');
    });

    test('should handle fetch errors', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      };

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      const request = createMockRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body.details).toContain('Could not connect');
    });
  });
});
