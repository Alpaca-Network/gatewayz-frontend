/**
 * Comprehensive Streaming Tests
 *
 * CRITICAL: These tests ensure streaming never breaks for any user type.
 *
 * Coverage includes:
 * - Authenticated user streaming
 * - Guest user streaming
 * - 429 rate limit handling with retry logic
 * - Multiple retry attempts with exponential backoff
 * - Various response formats (OpenAI, Fireworks, DeepSeek, event-based)
 * - Error handling and recovery
 * - Edge cases and malformed responses
 * - Performance and timeout handling
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

/**
 * Helper to create a Headers-like object that supports .get()
 */
function createMockHeaders(headersMap: [string, string][]): Headers {
  const headers = new Headers();
  for (const [key, value] of headersMap) {
    headers.set(key, value);
  }
  return headers;
}

/**
 * Helper to create a successful mock response
 */
function createSuccessResponse(chunks: string[], additionalHeaders?: [string, string][]) {
  const headersArray: [string, string][] = [['content-type', 'text/event-stream']];
  if (additionalHeaders) {
    headersArray.push(...additionalHeaders);
  }
  return {
    ok: true,
    status: 200,
    headers: createMockHeaders(headersArray),
    body: createMockStream(chunks),
  };
}

describe('Streaming - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();  // Reset mock implementations in addition to call history
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // ============================================================================
  // AUTHENTICATED USER STREAMING TESTS
  // ============================================================================
  describe('Authenticated User Streaming', () => {
    const validApiKey = 'sk-valid-user-api-key-12345';

    test('should stream successfully with valid API key', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" authenticated"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" user!"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          validApiKey,
          { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(3);
      expect(contentChunks.map(c => c.content).join('')).toBe('Hello authenticated user!');

      // Verify API key was sent in Authorization header
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${validApiKey}`,
          }),
        })
      );
    });

    test('should handle long streaming sessions without timeout', async () => {
      // Simulate 100 chunks being streamed
      const mockChunks: string[] = [];
      for (let i = 0; i < 100; i++) {
        mockChunks.push(`data: {"choices":[{"delta":{"content":"chunk${i} "}}]}\n\n`);
      }
      mockChunks.push('data: [DONE]\n\n');

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          validApiKey,
          { model: 'gpt-4', messages: [], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(100);
    });

    test('should maintain first_token status for TTFT tracking', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"First"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" token"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', validApiKey, { model: 'gpt-4', messages: [], stream: true })
      );

      // First content chunk should have first_token status
      const firstTokenChunks = chunks.filter(c => c.status === 'first_token');
      expect(firstTokenChunks.length).toBe(1);
      expect(firstTokenChunks[0].content).toBe('First');

      // Second content chunk should NOT have first_token status
      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks[1].status).toBeUndefined();
    });

    test('should handle session expiration with 401 and attempt refresh', async () => {
      // First call returns 401
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Session expired' }),
      });

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', validApiKey, { model: 'gpt-4', messages: [], stream: true })
        )
      ).rejects.toThrow(/Session expired.*session has expired/);
    });
  });

  // ============================================================================
  // GUEST USER STREAMING TESTS
  // ============================================================================
  describe('Guest User Streaming', () => {
    const guestApiKey = 'guest';
    const sharedGuestKey = 'gatewayz-guest-demo-key';

    test('should stream successfully with guest placeholder key', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" guest!"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          guestApiKey,
          { model: 'openrouter/auto', messages: [{ role: 'user', content: 'Hello' }], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(2);
      expect(contentChunks.map(c => c.content).join('')).toBe('Hello guest!');
    });

    test('should stream successfully with shared guest demo key', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Guest response"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          sharedGuestKey,
          { model: 'openrouter/auto', messages: [], stream: true }
        )
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Guest response');
    });

    test('should handle guest session without authentication errors', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Works!"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', guestApiKey, { model: 'openrouter/auto', messages: [], stream: true })
      );

      expect(chunks.filter(c => c.content).length).toBe(1);
    });

    test('should provide helpful error when guest needs to sign up', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: createMockHeaders([]),
        json: async () => ({ code: 'GUEST_NOT_CONFIGURED', detail: 'Guest not configured' }),
      });

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', guestApiKey, { model: 'openrouter/auto', messages: [], stream: true })
        )
      ).rejects.toThrow(/sign in.*create a free account/i);
    });
  });

  // ============================================================================
  // 429 RATE LIMIT RETRY LOGIC TESTS
  // ============================================================================
  describe('429 Rate Limit Handling', () => {
    test('should retry on 429 and succeed on second attempt', async () => {
      jest.useRealTimers(); // Need real timers for retry delays

      // First call returns 429
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: createMockHeaders([['retry-after', '1']]),
        json: async () => ({ detail: 'Rate limit exceeded' }),
      });

      // Second call succeeds
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Success after retry"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse(
          '/api/chat/completions',
          'test-key',
          { model: 'gpt-4', messages: [], stream: true }
        )
      );

      // Should have received rate_limit_retry status
      const retryChunks = chunks.filter(c => c.status === 'rate_limit_retry');
      expect(retryChunks.length).toBe(1);
      expect(retryChunks[0].retryAfterMs).toBeGreaterThan(0);

      // Should eventually get content
      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Success after retry');

      // Should have made 2 fetch calls
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('should handle multiple consecutive 429s with exponential backoff', async () => {
      jest.useRealTimers();

      // First three calls return 429
      for (let i = 0; i < 3; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: createMockHeaders([['retry-after', '1']]),
          json: async () => ({ detail: 'Rate limit exceeded' }),
        });
      }

      // Fourth call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createSuccessResponse([
          'data: {"choices":[{"delta":{"content":"Finally!"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      // Should have 3 retry signals
      const retryChunks = chunks.filter(c => c.status === 'rate_limit_retry');
      expect(retryChunks.length).toBe(3);

      // Should eventually get content
      expect(chunks.filter(c => c.content).length).toBe(1);

      // Should have made 4 fetch calls
      expect(global.fetch).toHaveBeenCalledTimes(4);
    }, 30000); // Extended timeout for retry tests with exponential backoff

    test('should handle burst limit with longer backoff', async () => {
      jest.useRealTimers();

      // First call returns 429 with burst limit message
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Burst limit exceeded' }),
      });

      // Second call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createSuccessResponse([
          'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      const retryChunk = chunks.find(c => c.status === 'rate_limit_retry');
      expect(retryChunk).toBeDefined();
      // Burst limit should have longer delay (3s base instead of 1.5s)
      expect(retryChunk!.retryAfterMs).toBeGreaterThanOrEqual(3000);
    }, 15000); // Extended timeout for burst limit retry test

    test('should handle concurrency limit with longer backoff', async () => {
      jest.useRealTimers();

      // First call returns 429 with concurrency limit message
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Concurrency limit reached' }),
      });

      // Second call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createSuccessResponse([
          'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      const retryChunk = chunks.find(c => c.status === 'rate_limit_retry');
      expect(retryChunk).toBeDefined();
      // Concurrency limit should have longer delay (3s base)
      expect(retryChunk!.retryAfterMs).toBeGreaterThanOrEqual(3000);
    }, 15000); // Extended timeout for concurrency limit retry test

    test('should respect retry-after header value', async () => {
      jest.useRealTimers();

      // Return 429 with specific retry-after value
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: createMockHeaders([['retry-after', '5']]), // 5 seconds
        json: async () => ({ detail: 'Rate limit exceeded' }),
      });

      // Second call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createSuccessResponse([
          'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      const retryChunk = chunks.find(c => c.status === 'rate_limit_retry');
      expect(retryChunk).toBeDefined();
      // Should respect the 5 second retry-after (5000ms)
      expect(retryChunk!.retryAfterMs).toBeGreaterThanOrEqual(5000);
    }, 15000); // Extended timeout for retry-after test

    test('should fail after max retries exceeded', async () => {
      jest.useRealTimers();

      // All 8 calls return 429 (initial + 7 retries = 8 calls with maxRetries=7)
      // Using minimal retry delays to speed up the test
      for (let i = 0; i < 8; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: createMockHeaders([['retry-after', '0.01']]), // Very short retry
          json: async () => ({ detail: 'Rate limit exceeded' }),
        });
      }

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
        )
      ).rejects.toThrow(/Rate limit exceeded/);
    }, 120000); // Extended timeout for retry tests

    test('should ensure minimum 1.5s delay between retries', async () => {
      jest.useRealTimers();

      // Return 429 with very small retry-after
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: createMockHeaders([['retry-after', '0.1']]), // Very small value
        json: async () => ({ detail: 'Rate limit exceeded' }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createSuccessResponse([
          'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      const retryChunk = chunks.find(c => c.status === 'rate_limit_retry');
      expect(retryChunk).toBeDefined();
      // Should enforce minimum 1.5s delay
      expect(retryChunk!.retryAfterMs).toBeGreaterThanOrEqual(1500);
    }, 10000); // Extended timeout for minimum delay test
  });

  // ============================================================================
  // 503/504 SERVICE UNAVAILABLE RETRY TESTS
  // ============================================================================
  describe('503/504 Service Unavailable Handling', () => {
    test('should retry on 503 and succeed on second attempt', async () => {
      jest.useRealTimers();

      // First call returns 503
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Service temporarily unavailable' }),
      });

      // Second call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createSuccessResponse([
          'data: {"choices":[{"delta":{"content":"Back online"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      expect(chunks.filter(c => c.content).length).toBe(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, 15000); // Extended timeout for 503 retry test

    test('should retry on 504 gateway timeout', async () => {
      jest.useRealTimers();

      // First call returns 504
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 504,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Gateway timeout' }),
      });

      // Second call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createSuccessResponse([
          'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
          'data: [DONE]\n\n',
        ])
      );

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      expect(chunks.filter(c => c.content).length).toBe(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, 15000); // Extended timeout for 504 retry test
  });

  // ============================================================================
  // NETWORK ERROR RETRY TESTS
  // ============================================================================
  describe('Network Error Handling', () => {
    test('should retry on network failure', async () => {
      jest.useRealTimers();

      // First call fails with network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      // Second call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders([['content-type', 'text/event-stream']]),
        body: createMockStream([
          'data: {"choices":[{"delta":{"content":"Recovered"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      });

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      expect(chunks.filter(c => c.content).length).toBe(1);
    });

    test('should handle ECONNREFUSED errors', async () => {
      jest.useRealTimers();

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders([['content-type', 'text/event-stream']]),
        body: createMockStream([
          'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      });

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      expect(chunks.filter(c => c.content).length).toBe(1);
    });

    test('should handle ETIMEDOUT errors', async () => {
      jest.useRealTimers();

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ETIMEDOUT'));
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders([['content-type', 'text/event-stream']]),
        body: createMockStream([
          'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      });

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      expect(chunks.filter(c => c.content).length).toBe(1);
    });
  });

  // ============================================================================
  // MULTIPLE PROVIDER FORMAT TESTS
  // ============================================================================
  describe('Multiple Provider Formats', () => {
    test('should handle OpenAI choices format', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"OpenAI format"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      expect(chunks.filter(c => c.content)[0].content).toBe('OpenAI format');
    });

    test('should handle Fireworks output array format', async () => {
      const mockChunks = [
        'data: {"output":[{"content":"Fireworks format"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'fireworks/model', messages: [], stream: true })
      );

      expect(chunks.filter(c => c.content)[0].content).toBe('Fireworks format');
    });

    test('should handle event-based streaming format', async () => {
      const mockChunks = [
        'data: {"type":"response.output_text.delta","delta":"Event format"}\n\n',
        'data: {"type":"response.output_text.done"}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'some-model', messages: [], stream: true })
      );

      expect(chunks.filter(c => c.content)[0].content).toBe('Event format');
    });

    test('should handle reasoning content from thinking models', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"reasoning_content":"Let me think..."}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"The answer is 42"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'deepseek-r1', messages: [], stream: true })
      );

      const reasoningChunks = chunks.filter(c => c.reasoning);
      expect(reasoningChunks.length).toBe(1);
      expect(reasoningChunks[0].reasoning).toBe('Let me think...');

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('The answer is 42');
    });

    test('should handle DeepSeek R1 via Fireworks with reasoning', async () => {
      const mockChunks = [
        'data: {"output":[{"reasoning_content":"Analyzing..."}]}\n\n',
        'data: {"output":[{"content":"Final answer"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'accounts/fireworks/models/deepseek-r1', messages: [], stream: true })
      );

      expect(chunks.filter(c => c.reasoning).length).toBe(1);
      expect(chunks.filter(c => c.content).length).toBe(1);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================
  describe('Error Handling', () => {
    test('should handle 400 bad request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Invalid parameters' }),
      });

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
        )
      ).rejects.toThrow(/Bad request.*Invalid parameters/);
    });

    test('should handle trial expired error with helpful message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Your trial has expired. Please upgrade.' }),
      });

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
        )
      ).rejects.toThrow(/Trial credits have been used up.*FREE models/);
    });

    test('should handle 403 forbidden with helpful message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Access forbidden' }),
      });

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
        )
      ).rejects.toThrow(/Access forbidden.*API key may be invalid/);
    });

    test('should handle 404 model not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Model gpt-5 not found' }),
      });

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-5', messages: [], stream: true })
        )
      ).rejects.toThrow(/Model not found/);
    });

    test('should handle 500 server error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Internal server error' }),
      });

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
        )
      ).rejects.toThrow(/Server error/);
    });

    test('should handle upstream rejected errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: createMockHeaders([]),
        json: async () => ({ detail: 'Upstream rejected: model unavailable' }),
      });

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
        )
      ).rejects.toThrow(/Backend error.*upstream rejected/i);
    });

    test('should throw error if no content received', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
        )
      ).rejects.toThrow(/No response received/);
    });

    test('should handle inline stream errors', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Starting..."}}]}\n\n',
        'data: {"error":{"message":"Stream interrupted"}}\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      await expect(
        collectChunks(
          streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
        )
      ).rejects.toThrow(/Stream interrupted/);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  describe('Edge Cases', () => {
    test('should handle empty content chunks gracefully', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":""}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Actual content"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Actual content');
    });

    test('should handle malformed JSON gracefully', async () => {
      const mockChunks = [
        'data: {invalid json}\n\n',
        'data: {"choices":[{"delta":{"content":"Valid"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      // Should skip malformed JSON and process valid chunks
      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Valid');
    });

    test('should handle chunks split across reads', async () => {
      // Simulate a chunk being split across two reads
      const mockChunks = [
        'data: {"choices":[{"delta":{"con',
        'tent":"Split chunk"}}]}\n\ndata: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1);
      expect(contentChunks[0].content).toBe('Split chunk');
    });

    test('should handle special characters in content', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Special: \\"quotes\\" & <brackets>"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks[0].content).toBe('Special: "quotes" & <brackets>');
    });

    test('should handle unicode content', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hello \\u4e16\\u754c \\ud83d\\ude00"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks[0].content).toContain('世界');
    });

    test('should handle very long responses', async () => {
      // Generate a response with 1000 chunks
      const mockChunks: string[] = [];
      for (let i = 0; i < 1000; i++) {
        mockChunks.push(`data: {"choices":[{"delta":{"content":"word${i} "}}]}\n\n`);
      }
      mockChunks.push('data: [DONE]\n\n');

      (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse(mockChunks));

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      const contentChunks = chunks.filter(c => c.content);
      expect(contentChunks.length).toBe(1000);
    });
  });

  // ============================================================================
  // TIMING METADATA TESTS
  // ============================================================================
  describe('Timing Metadata', () => {
    test('should extract and yield timing headers', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createSuccessResponse(mockChunks, [
          ['X-Backend-Time', '150.5'],
          ['X-Network-Time', '25.3'],
          ['X-Response-Time', '175.8'],
        ])
      );

      const chunks = await collectChunks(
        streamChatResponse('/api/chat/completions', 'test-key', { model: 'gpt-4', messages: [], stream: true })
      );

      const timingChunks = chunks.filter(c => c.status === 'timing_info');
      expect(timingChunks.length).toBe(1);
      expect(timingChunks[0].timingMetadata?.backendTimeMs).toBe(150.5);
      expect(timingChunks[0].timingMetadata?.networkTimeMs).toBe(25.3);
      expect(timingChunks[0].timingMetadata?.totalTimeMs).toBe(175.8);
    });
  });
});
