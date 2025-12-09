/**
 * Unit tests for streaming.ts
 *
 * Tests the streaming response handler for chat completions
 */

import { streamChatResponse, StreamChunk } from '../streaming';
import { ReadableStream } from 'stream/web';

// Polyfill ReadableStream for Node.js test environment
if (typeof globalThis.ReadableStream === 'undefined') {
  (globalThis as any).ReadableStream = ReadableStream;
}

// Mock StreamCoordinator
jest.mock('../stream-coordinator', () => ({
  StreamCoordinator: {
    handleAuthError: jest.fn(),
    getApiKey: jest.fn(() => null),
  },
}));

// Mock api module for auth refresh
jest.mock('../api', () => ({
  requestAuthRefresh: jest.fn().mockRejectedValue(new Error('Auth refresh failed')),
  getApiKey: jest.fn(() => null),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('streamChatResponse', () => {
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
   * Helper to collect all chunks from the async generator
   */
  async function collectChunks(
    generator: AsyncGenerator<StreamChunk>
  ): Promise<StreamChunk[]> {
    const chunks: StreamChunk[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    return chunks;
  }

  describe('Basic Streaming', () => {
    test('should stream content chunks successfully', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-api-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      expect(chunks.length).toBeGreaterThan(0);

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(2);
      expect(contentChunks[0].content).toBe('Hello');
      expect(contentChunks[1].content).toBe(' world');

      // Verify exactly one done signal is emitted (not duplicated)
      const doneChunks = chunks.filter(c => c.done);
      expect(doneChunks.length).toBe(1);
    });

    test('should emit exactly one done signal regardless of stream end method', async () => {
      // Test case 1: Stream ends with [DONE] signal
      const mockChunksWithDone = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunksWithDone),
      });

      const chunksWithDone = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-api-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      // Count done signals - must be exactly 1
      const doneSignalsWithDone = chunksWithDone.filter(c => c.done === true);
      expect(doneSignalsWithDone.length).toBe(1);

      // Test case 2: Stream ends with finish_reason (no [DONE])
      const mockChunksWithFinish = [
        'data: {"choices":[{"delta":{"content":"World"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunksWithFinish),
      });

      const chunksWithFinish = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-api-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      // Count done signals - must be exactly 1
      const doneSignalsWithFinish = chunksWithFinish.filter(c => c.done === true);
      expect(doneSignalsWithFinish.length).toBe(1);
    });

    test('should handle reasoning content', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"reasoning":"Let me think..."}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Answer"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-api-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      const reasoningChunks = chunks.filter(c => c.reasoning);
      expect(reasoningChunks.length).toBe(1);
      expect(reasoningChunks[0].reasoning).toBe('Let me think...');

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Answer');
    });

    test('should mark first token with status', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"First"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" token"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-api-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      const firstTokenChunks = chunks.filter(c => c.status === 'first_token');
      expect(firstTokenChunks.length).toBe(1);
      expect(firstTokenChunks[0].content).toBe('First');
    });

    test('should handle timing metadata headers', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'text/event-stream'],
          ['X-Backend-Time', '150.5'],
          ['X-Network-Time', '25.3'],
          ['X-Response-Time', '175.8'],
        ]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-api-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      const timingChunks = chunks.filter(c => c.status === 'timing_info');
      expect(timingChunks.length).toBe(1);
      expect(timingChunks[0].timingMetadata?.backendTimeMs).toBe(150.5);
      expect(timingChunks[0].timingMetadata?.networkTimeMs).toBe(25.3);
      expect(timingChunks[0].timingMetadata?.totalTimeMs).toBe(175.8);
    });
  });

  describe('Error Handling', () => {
    test('should handle 401 authentication errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Map(),
        json: async () => ({ error: { message: 'Invalid API key' } }),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'invalid-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Invalid API key.*Your session has expired/);
    });

    test('should handle 400 bad request errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Map(),
        json: async () => ({ detail: 'Invalid request parameters' }),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Bad request/);
    });

    test('should handle trial expired errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Map(),
        json: async () => ({ detail: 'Your trial has expired. Please upgrade to continue.' }),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Trial credits have been used up/);
    });

    test('should handle 429 rate limit with retry', async () => {
      // First call returns 429
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['retry-after', '1']]),
        json: async () => ({ detail: 'Rate limit exceeded' }),
      });

      // Second call succeeds
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Success"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      // Should have received rate limit retry status
      const retryChunks = chunks.filter(c => c.status === 'rate_limit_retry');
      expect(retryChunks.length).toBe(1);

      // Should eventually get content
      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Success');
    });

    test('should handle 500 server errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Map(),
        json: async () => ({ detail: 'Internal server error' }),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Server error/);
    });

    test('should retry on 503 service unavailable', async () => {
      // First call returns 503
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Map(),
        json: async () => ({ detail: 'Service temporarily unavailable' }),
      });

      // Second call succeeds
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Success"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Success');
    });

    test('should handle network errors with retry', async () => {
      // First call fails with network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      // Second call succeeds
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Success"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
    });

    test('should extract error message from non-standard error object formats', async () => {
      // Simulate backend returning error with 'error' field instead of 'message'
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Start"}}]}\n\n',
        'data: {"error":{"error":"Some provider error","code":"provider_error"}}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Some provider error/);
    });

    test('should extract error message from unknown error object structure', async () => {
      // Simulate backend returning completely non-standard error structure
      // When no message/detail/error/text/reason/code/type fields exist,
      // but status is present, it should return "HTTP {status} error"
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Start"}}]}\n\n',
        'data: {"error":{"unknown_field":"data","status":500}}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      // With status field present, it should extract "HTTP 500 error"
      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/HTTP 500 error/);
    });

    test('should stringify unknown error object without status', async () => {
      // Simulate backend returning completely non-standard error structure without status
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Start"}}]}\n\n',
        'data: {"error":{"unknown_field":"data","other_field":123}}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      // Should stringify the error object since we can't extract a known field
      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/unknown_field.*data/);
    });

    test('should handle top-level error indicator in stream data', async () => {
      // Simulate backend returning top-level error/detail fields
      const mockChunks = [
        'data: {"detail":"Rate limit exceeded from provider"}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Rate limit exceeded from provider/);
    });

    test('should extract error from "text" field in error object', async () => {
      const mockChunks = [
        'data: {"error":{"text":"Model overloaded, please retry"}}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Model overloaded, please retry/);
    });

    test('should extract error from "reason" field in error object', async () => {
      const mockChunks = [
        'data: {"error":{"reason":"Context length exceeded"}}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Context length exceeded/);
    });

    test('should extract error from code/type combination', async () => {
      const mockChunks = [
        'data: {"error":{"type":"invalid_request","code":"context_too_long"}}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/invalid_request: context_too_long/);
    });

    test('should extract error from standalone code field', async () => {
      // Use a non-rate-limit error code to test the "Error code:" fallback
      // Rate limit errors are handled specially with user-friendly messages
      const mockChunks = [
        'data: {"error":{"code":"context_length_exceeded"}}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Error code: context_length_exceeded/);
    });

    test('should convert rate_limit_exceeded code to user-friendly message', async () => {
      const mockChunks = [
        'data: {"error":{"code":"rate_limit_exceeded"}}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      // rate_limit_exceeded errors now return a user-friendly message
      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Rate limit exceeded.*temporarily unavailable/);
    });

    test('should extract error from standalone type field', async () => {
      const mockChunks = [
        'data: {"error":{"type":"server_error"}}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Error type: server_error/);
    });

    test('should handle top-level string error field', async () => {
      const mockChunks = [
        'data: {"error":"Service temporarily unavailable"}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Service temporarily unavailable/);
    });

    test('should handle top-level message field', async () => {
      const mockChunks = [
        'data: {"message":"Invalid API key format"}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Invalid API key format/);
    });

    test('should handle top-level trial expired error with user-friendly message', async () => {
      const mockChunks = [
        'data: {"detail":"Your trial has expired. Please upgrade."}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Trial credits have been used up.*FREE models/);
    });

    test('should handle top-level upstream rejected error with retry suggestion', async () => {
      const mockChunks = [
        'data: {"message":"upstream rejected the request"}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/Backend error.*upstream rejected.*try again/i);
    });
  });

  describe('Alternative Response Formats', () => {
    test('should handle backend "output" format', async () => {
      const mockChunks = [
        'data: {"output":[{"content":"Hello","finish_reason":null}]}\n\n',
        'data: {"output":[{"content":" there","finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(2);
      expect(contentChunks[0].content).toBe('Hello');
      expect(contentChunks[1].content).toBe(' there');
    });

    test('should handle event-based streaming format', async () => {
      const mockChunks = [
        'data: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
        'data: {"type":"response.output_text.delta","delta":" world"}\n\n',
        'data: {"type":"response.output_text.done"}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(2);
      expect(contentChunks[0].content).toBe('Hello');
      expect(contentChunks[1].content).toBe(' world');
    });

    test('should handle reasoning in event-based format', async () => {
      const mockChunks = [
        'data: {"type":"response.reasoning.delta","delta":"Thinking..."}\n\n',
        'data: {"type":"response.output_text.delta","delta":"Answer"}\n\n',
        'data: {"type":"response.output_text.done"}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      const reasoningChunks = chunks.filter(c => c.reasoning);
      expect(reasoningChunks.length).toBe(1);
      expect(reasoningChunks[0].reasoning).toBe('Thinking...');

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Answer');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty content chunks', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Text"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      // Should skip empty chunks with only role
      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Text');
    });

    test('should throw error if no content received', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      await expect(
        collectChunks(
          streamChatResponse(
            '/api/chat/completions',
            'test-key',
            { model: 'openrouter/auto', messages: [], stream: true }
          )
        )
      ).rejects.toThrow(/No response received/);
    });

    test('should handle malformed JSON gracefully', async () => {
      const mockChunks = [
        'data: {invalid json}\n\n',
        'data: {"choices":[{"delta":{"content":"Valid"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      // Should skip malformed JSON and process valid chunks
      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Valid');
    });
  });

  describe('OpenRouter Auto Specific', () => {
    test('should work with openrouter/auto model', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Response"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Response');
    });
  });

  describe('Fireworks Format Handling', () => {
    test('should handle Fireworks response.chunk format with output array', async () => {
      // Fireworks uses a response.chunk format with output array
      const mockChunks = [
        'data: {"id":"abc123","object":"response.chunk","created":1234567890,"model":"accounts/fireworks/models/deepseek-r1","output":[{"index":0,"role":"assistant"}]}\n\n',
        'data: {"id":"abc123","object":"response.chunk","created":1234567890,"model":"accounts/fireworks/models/deepseek-r1","output":[{"index":0,"content":"The fastest"}]}\n\n',
        'data: {"id":"abc123","object":"response.chunk","created":1234567890,"model":"accounts/fireworks/models/deepseek-r1","output":[{"index":0,"content":" animal"}]}\n\n',
        'data: {"id":"abc123","object":"response.chunk","created":1234567890,"model":"accounts/fireworks/models/deepseek-r1","output":[{"index":0,"content":" is the cheetah.","finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'accounts/fireworks/models/deepseek-r1', messages: [], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(3);
      expect(contentChunks[0].content).toBe('The fastest');
      expect(contentChunks[1].content).toBe(' animal');
      expect(contentChunks[2].content).toBe(' is the cheetah.');

      // Last content chunk should also have done flag due to finish_reason
      expect(contentChunks[2].done).toBe(true);

      // Verify exactly one done signal (not duplicated)
      const doneChunks = chunks.filter(c => c.done === true);
      expect(doneChunks.length).toBe(1);
    });

    test('should handle Fireworks output with nested delta object', async () => {
      // Some Fireworks models may nest content in a delta object within output
      const mockChunks = [
        'data: {"output":[{"index":0,"delta":{"content":"Hello from Fireworks"}}]}\n\n',
        'data: {"output":[{"index":0,"delta":{"content":"!","finish_reason":"stop"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'fireworks/deepseek-r1', messages: [], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(2);
      expect(contentChunks[0].content).toBe('Hello from Fireworks');
      expect(contentChunks[1].content).toBe('!');
    });

    test('should handle Fireworks output with text field', async () => {
      const mockChunks = [
        'data: {"output":[{"index":0,"text":"Response text"}]}\n\n',
        'data: {"output":[{"index":0,"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'fireworks/model', messages: [], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Response text');
    });

    test('should handle Fireworks output with reasoning_content', async () => {
      // DeepSeek R1 on Fireworks may include reasoning_content
      const mockChunks = [
        'data: {"output":[{"index":0,"reasoning_content":"Let me think about this..."}]}\n\n',
        'data: {"output":[{"index":0,"content":"The answer is 42.","finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'accounts/fireworks/models/deepseek-r1-0528', messages: [], stream: true }
        )
      );

      const reasoningChunks = chunks.filter(c => c.reasoning);
      expect(reasoningChunks.length).toBe(1);
      expect(reasoningChunks[0].reasoning).toBe('Let me think about this...');

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('The answer is 42.');
    });

    test('should skip Fireworks chunks with only role (no content)', async () => {
      // Initial chunks often only contain role, these should be skipped
      const mockChunks = [
        'data: {"output":[{"index":0,"role":"assistant"}]}\n\n',
        'data: {"output":[{"index":0,"role":"assistant"}]}\n\n',
        'data: {"output":[{"index":0,"content":"Actual content"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: createMockStream(mockChunks),
      });

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'fireworks/model', messages: [], stream: true }
        )
      );

      // Should only have one content chunk, role-only chunks should be skipped
      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Actual content');
    });
  });
});
