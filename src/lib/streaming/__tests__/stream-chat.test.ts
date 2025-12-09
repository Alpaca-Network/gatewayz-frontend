/**
 * Tests for stream-chat.ts
 */

// Polyfill ReadableStream for Node.js environment
import { ReadableStream as NodeReadableStream } from 'stream/web';
if (typeof ReadableStream === 'undefined') {
  // @ts-ignore
  global.ReadableStream = NodeReadableStream;
}

import { streamChatResponse } from '../stream-chat';
import {
  StreamingError,
  AuthenticationError,
  RateLimitError,
  EmptyResponseError,
} from '../errors';

// Mock the dependencies
jest.mock('@/lib/api', () => ({
  requestAuthRefresh: jest.fn(),
  getApiKey: jest.fn(),
}));

jest.mock('@/lib/stream-coordinator', () => ({
  StreamCoordinator: jest.fn(),
}));

// Helper to create SSE response bodies
function createSSEResponse(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = chunks.map((c) => `data: ${c}\n`).join('\n');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  }) as ReadableStream<Uint8Array>;
}

// Helper to collect all chunks from async generator
async function collectChunks<T>(
  generator: AsyncGenerator<T>
): Promise<T[]> {
  const chunks: T[] = [];
  for await (const chunk of generator) {
    chunks.push(chunk);
  }
  return chunks;
}

// Mock fetch globally
const originalFetch = global.fetch;

describe('streamChatResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('successful streaming', () => {
    it('should stream content chunks from OpenAI format', async () => {
      const sseChunks = [
        JSON.stringify({ choices: [{ delta: { content: 'Hello' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: { content: ' World' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: createSSEResponse(sseChunks),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [{ role: 'user', content: 'Hi' }] }
      );

      const chunks = await collectChunks(generator);

      expect(chunks.length).toBeGreaterThan(0);
      const contentChunks = chunks.filter((c) => c.content);
      expect(contentChunks.map((c) => c.content).join('')).toBe('Hello World');
    });

    it('should mark first content chunk with first_token status', async () => {
      const sseChunks = [
        JSON.stringify({ choices: [{ delta: { content: 'First' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: { content: 'Second' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: createSSEResponse(sseChunks),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] }
      );

      const chunks = await collectChunks(generator);
      const firstContentChunk = chunks.find((c) => c.content);
      expect(firstContentChunk?.status).toBe('first_token');
    });

    it('should yield timing_info when timing headers are present', async () => {
      const sseChunks = [
        JSON.stringify({ choices: [{ delta: { content: 'Hi' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'X-Backend-Time': '150.5',
          'X-Network-Time': '50.2',
          'X-Response-Time': '200.7',
        }),
        body: createSSEResponse(sseChunks),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] }
      );

      const chunks = await collectChunks(generator);
      const timingChunk = chunks.find((c) => c.status === 'timing_info');
      expect(timingChunk?.timingMetadata).toEqual({
        backendTimeMs: 150.5,
        networkTimeMs: 50.2,
        totalTimeMs: 200.7,
      });
    });

    it('should yield done: true at end of stream', async () => {
      const sseChunks = [
        JSON.stringify({ choices: [{ delta: { content: 'Done' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: createSSEResponse(sseChunks),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] }
      );

      const chunks = await collectChunks(generator);
      const doneChunk = chunks.find((c) => c.done === true);
      expect(doneChunk).toBeDefined();
    });

    it('should parse reasoning content', async () => {
      const sseChunks = [
        JSON.stringify({
          choices: [{ delta: { reasoning_content: 'Thinking...' }, finish_reason: null }],
        }),
        JSON.stringify({ choices: [{ delta: { content: 'Answer' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: createSSEResponse(sseChunks),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'deepseek-reasoner', messages: [] }
      );

      const chunks = await collectChunks(generator);
      const reasoningChunk = chunks.find((c) => c.reasoning);
      expect(reasoningChunk?.reasoning).toBe('Thinking...');
    });
  });

  describe('HTTP error handling', () => {
    it('should throw StreamingError on 400 bad request', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: jest.fn().mockResolvedValue({ detail: 'Invalid request' }),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] }
      );

      await expect(collectChunks(generator)).rejects.toThrow(StreamingError);
    });

    it('should throw special message for trial expired on 400', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: jest.fn().mockResolvedValue({ detail: 'Trial has expired' }),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] }
      );

      await expect(collectChunks(generator)).rejects.toThrow(/FREE models/);
    });

    it('should throw AuthenticationError on 401', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: jest.fn().mockResolvedValue({ detail: 'Unauthorized' }),
      });

      // Mock window as undefined for server-side context
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] },
        1, // Skip auth refresh attempt
        7
      );

      await expect(collectChunks(generator)).rejects.toThrow(AuthenticationError);

      global.window = originalWindow;
    });

    it('should throw AuthenticationError on 403', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: jest.fn().mockResolvedValue({ detail: 'Forbidden' }),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] }
      );

      await expect(collectChunks(generator)).rejects.toThrow(AuthenticationError);
    });

    it('should throw StreamingError on 404 model not found', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: jest.fn().mockResolvedValue({ detail: 'Model not found' }),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'nonexistent-model', messages: [] }
      );

      await expect(collectChunks(generator)).rejects.toThrow(/Model not found/);
    });

    it('should throw StreamingError on 413 payload too large', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 413,
        headers: new Headers(),
        json: jest.fn().mockResolvedValue({}),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] }
      );

      await expect(collectChunks(generator)).rejects.toThrow(/too large/);
    });

    it('should handle 429 rate limit with retry', async () => {
      // First call returns 429
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers(),
          json: jest.fn().mockResolvedValue({ detail: 'Rate limited' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          body: createSSEResponse([
            JSON.stringify({ choices: [{ delta: { content: 'Success' }, finish_reason: null }] }),
            JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
          ]),
        });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] },
        0,
        2 // Allow 2 retries
      );

      const chunks = await collectChunks(generator);
      const rateLimitChunk = chunks.find((c) => c.status === 'rate_limit_retry');
      expect(rateLimitChunk).toBeDefined();

      const contentChunk = chunks.find((c) => c.content);
      expect(contentChunk?.content).toBe('Success');
    }, 10000);

    it('should throw RateLimitError after max retries on 429', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers(),
        json: jest.fn().mockResolvedValue({ detail: 'Rate limited' }),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] },
        7, // Already at max retries
        7
      );

      await expect(collectChunks(generator)).rejects.toThrow(RateLimitError);
    });

    it('should throw StreamingError on 500 server error', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: jest.fn().mockResolvedValue({ detail: 'Internal error' }),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] }
      );

      await expect(collectChunks(generator)).rejects.toThrow(StreamingError);
    });

    it('should retry on 503 service unavailable', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers(),
          json: jest.fn().mockResolvedValue({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          body: createSSEResponse([
            JSON.stringify({ choices: [{ delta: { content: 'OK' }, finish_reason: null }] }),
            JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
          ]),
        });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] },
        0,
        2
      );

      const chunks = await collectChunks(generator);
      expect(chunks.find((c) => c.content)).toBeDefined();
    }, 10000);
  });

  describe('network error handling', () => {
    it('should retry on network TypeError', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          body: createSSEResponse([
            JSON.stringify({ choices: [{ delta: { content: 'Recovered' }, finish_reason: null }] }),
            JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
          ]),
        });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] },
        0,
        2
      );

      const chunks = await collectChunks(generator);
      expect(chunks.find((c) => c.content)?.content).toBe('Recovered');
    }, 10000);

    it('should throw after max network retries', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Network failure'));

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] },
        7, // At max retries
        7
      );

      await expect(collectChunks(generator)).rejects.toThrow(/Network connection failed/);
    });
  });

  describe('empty response handling', () => {
    it('should throw EmptyResponseError when no content received', async () => {
      // Response with only role-only chunks (no content)
      const sseChunks = [
        JSON.stringify({ choices: [{ delta: { role: 'assistant' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: createSSEResponse(sseChunks),
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] }
      );

      await expect(collectChunks(generator)).rejects.toThrow(EmptyResponseError);
    });
  });

  describe('response body handling', () => {
    it('should throw when response body is not readable', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: null,
      });

      const generator = streamChatResponse(
        'https://api.test.com/v1/chat/completions',
        'test-api-key',
        { model: 'gpt-4', messages: [] }
      );

      await expect(collectChunks(generator)).rejects.toThrow(/not readable/);
    });
  });
});
