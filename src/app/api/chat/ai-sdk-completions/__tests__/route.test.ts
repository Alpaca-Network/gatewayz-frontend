/**
 * Integration tests for the AI SDK completions API route.
 *
 * Replaces a prior 1277-line test suite written against a `streamText`/
 * `createOpenAI` (Vercel AI SDK) implementation this route no longer has.
 * The route has been a plain fetch proxy to /v1/chat/completions since the
 * "remove AI SDK, sandbox, insights, and rankings" rewrite (36e78475) — see
 * the route's own docstring. This file tests that current behavior instead,
 * mirroring the pattern already used for the sibling proxy route's tests in
 * ../../completions/__tests__/route.test.ts (that route has additional
 * retry/timing-header/rate-limit-response-header behavior this simpler proxy
 * does not — assertions here match this route's actual response shape, not
 * the sibling's).
 *
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { ReadableStream } from 'stream/web';

// Polyfill ReadableStream for Node.js test environment
if (typeof globalThis.ReadableStream === 'undefined') {
  (globalThis as any).ReadableStream = ReadableStream;
}

import { clearAllRateLimitsForTesting } from '@/lib/guest-rate-limiter';

// Mock fetch globally
global.fetch = jest.fn();

describe('AI SDK Completions Route (plain fetch proxy)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllRateLimitsForTesting();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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
    }) as ReadableStream<Uint8Array>;
  }

  function createMockRequest(body: any, apiKey?: string): NextRequest {
    const headers = new Headers();
    headers.set('content-type', 'application/json');
    if (apiKey) {
      headers.set('authorization', `Bearer ${apiKey}`);
    }

    return new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  function createMockRequestWithIP(body: any, ip: string, apiKey?: string): NextRequest {
    const headers = new Headers();
    headers.set('content-type', 'application/json');
    headers.set('x-forwarded-for', ip);
    if (apiKey) {
      headers.set('authorization', `Bearer ${apiKey}`);
    }

    return new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  const streamChunks = [
    'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
    'data: [DONE]\n\n',
  ];

  describe('Streaming requests', () => {
    it('forwards a streaming request to /v1/chat/completions', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: createMockStream(streamChunks),
      });

      const request = createMockRequest({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain('/v1/chat/completions');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer test-api-key');
    });

    it('passes through a backend error with its status and classification headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'x-request-id': 'req-123' }),
        text: async () => JSON.stringify({ detail: 'Internal server error' }),
      });

      const request = createMockRequest({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      expect(response.headers.get('x-request-id')).toBe('req-123');
      const body = await response.json();
      expect(body.error).toBe('Backend API Error');
      expect(body.errorData).toEqual({ detail: 'Internal server error' });
    });

    it('returns 500 when the backend response has no body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: null,
      });

      const request = createMockRequest({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('No response body');
    });
  });

  describe('Non-streaming requests', () => {
    it('forwards a non-streaming request and returns the backend JSON as-is', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        }),
      });

      const request = createMockRequest({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        apiKey: 'test-api-key',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      const body = await response.json();
      expect(body.choices).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('forwards guest requests anonymously (no Authorization header, no shared key)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: createMockStream(streamChunks),
      });

      const request = createMockRequest({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        // no apiKey
      });
      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBeUndefined();
    });

    it('treats the explicit "guest" sentinel the same as a missing API key', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: createMockStream(streamChunks),
      });

      const request = createMockRequest({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'guest',
      });
      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBeUndefined();
    });

    it('accepts an API key from the request body over the Authorization header', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: createMockStream(streamChunks),
      });

      const request = createMockRequest(
        {
          model: 'openrouter/auto',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: true,
          apiKey: 'body-api-key',
        },
        'header-api-key'
      );
      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer body-api-key');
    });

    it('falls back to the Authorization header when no body apiKey is set', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: createMockStream(streamChunks),
      });

      const request = createMockRequest(
        {
          model: 'openrouter/auto',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: true,
        },
        'header-api-key'
      );
      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer header-api-key');
    });

    it('strips the internal apiKey field from the body forwarded to the backend', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: createMockStream(streamChunks),
      });

      const request = createMockRequest({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      });
      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const sentBody = JSON.parse(fetchCall[1].body);
      expect(sentBody.apiKey).toBeUndefined();
    });
  });

  describe('Model ID normalization', () => {
    it('normalizes @provider format to provider format before forwarding', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: createMockStream(streamChunks),
      });

      const request = createMockRequest({
        model: '@google/models/gemini-pro',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      });
      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const sentBody = JSON.parse(fetchCall[1].body);
      expect(sentBody.model).toBe('google/gemini-pro');
    });
  });

  describe('Network error handling', () => {
    it('returns 504 and classifies an aborted/timeout request', async () => {
      const abortError = new Error('This operation was aborted');
      abortError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

      const request = createMockRequest({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      });
      const response = await POST(request);

      // route.ts's isTimeout check matches on error.message.includes('aborted')
      expect(response.status).toBe(504);
      const body = await response.json();
      expect(body.error).toContain('timed out');
    });

    it('returns 502 and a friendly message for a network/fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const request = createMockRequest({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'test-api-key',
      });
      const response = await POST(request);

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body.error).toContain('Could not connect');
    });
  });

  describe('Guest rate limiting', () => {
    it('returns 429 with the raw checkGuestRateLimit fields once the daily limit is exceeded', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'guest',
      };

      for (let i = 0; i < 3; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: createMockStream(streamChunks),
        });
        const response = await POST(createMockRequestWithIP(requestBody, '192.168.1.50'));
        expect(response.status).toBe(200);
      }

      const response = await POST(createMockRequestWithIP(requestBody, '192.168.1.50'));

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toBe('Rate limit exceeded');
      expect(body.remaining).toBe(0);
      expect(typeof body.resetTime).toBe('number');
    });

    it('tracks different IPs separately', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'guest',
      };

      for (let i = 0; i < 3; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: createMockStream(streamChunks),
        });
        const response = await POST(createMockRequestWithIP(requestBody, '10.0.0.1'));
        expect(response.status).toBe(200);
      }

      // A different IP should still have its own full quota.
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: createMockStream(streamChunks),
      });
      const response = await POST(createMockRequestWithIP(requestBody, '10.0.0.2'));
      expect(response.status).toBe(200);
    });

    it('does not rate limit authenticated requests', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'real-user-api-key',
      };

      for (let i = 0; i < 5; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: createMockStream(streamChunks),
        });
        const response = await POST(createMockRequestWithIP(requestBody, '192.168.1.70'));
        expect(response.status).toBe(200);
      }
    });

    it('does not consume a guest\'s quota on a failed backend request', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'guest',
      };
      const ip = '192.168.1.100';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: async () => JSON.stringify({ detail: 'Internal server error' }),
      });
      const failedResponse = await POST(createMockRequestWithIP(requestBody, ip));
      expect(failedResponse.status).toBe(500);

      // All 3 successful slots should still be available.
      for (let i = 0; i < 3; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: createMockStream(streamChunks),
        });
        const response = await POST(createMockRequestWithIP(requestBody, ip));
        expect(response.status).toBe(200);
      }

      const rateLimitedResponse = await POST(createMockRequestWithIP(requestBody, ip));
      expect(rateLimitedResponse.status).toBe(429);
    });

    it('does consume a guest\'s quota when the backend responds ok but with no body', async () => {
      // Unlike a non-ok backend response, route.ts increments the guest quota
      // as soon as `response.ok` is true — BEFORE the streaming branch checks
      // `response.body` and 500s. A guest hitting this edge case still burns
      // a quota slot.
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'guest',
      };
      const ip = '192.168.1.102';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: null,
      });
      const failedResponse = await POST(createMockRequestWithIP(requestBody, ip));
      expect(failedResponse.status).toBe(500);

      // Only 2 successful slots remain after the "ok but no body" request.
      for (let i = 0; i < 2; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: createMockStream(streamChunks),
        });
        const response = await POST(createMockRequestWithIP(requestBody, ip));
        expect(response.status).toBe(200);
      }

      const rateLimitedResponse = await POST(createMockRequestWithIP(requestBody, ip));
      expect(rateLimitedResponse.status).toBe(429);
    });

    it('allows exactly 3 successful requests before rate limiting', async () => {
      const requestBody = {
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        apiKey: 'guest',
      };
      const ip = '192.168.1.104';

      for (let i = 0; i < 3; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: createMockStream(streamChunks),
        });
        const response = await POST(createMockRequestWithIP(requestBody, ip));
        expect(response.status).toBe(200);
      }

      const rateLimitedResponse = await POST(createMockRequestWithIP(requestBody, ip));
      expect(rateLimitedResponse.status).toBe(429);
    });
  });
});
