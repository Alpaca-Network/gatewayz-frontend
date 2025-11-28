/**
 * Unit tests for streaming.ts
 *
 * Tests the streaming response handler for chat completions
 */

import { streamChatResponse, StreamChunk } from '../streaming';

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

      const doneChunks = chunks.filter(c => c.done);
      expect(doneChunks.length).toBeGreaterThan(0);
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
      ).rejects.toThrow(/Authentication failed/);
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
});
