/**
 * Unit tests for AI SDK completions route
 * Tests reasoning detection, provider selection, and error handling
 *
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { clearAllRateLimitsForTesting } from '@/lib/guest-rate-limiter';

// Mock AI SDK - define MockAPICallError inside the factory to avoid hoisting issues
jest.mock('ai', () => {
  // Create a mock APICallError class for testing
  class MockAPICallError extends Error {
    statusCode?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    isRetryable: boolean;

    constructor(options: {
      message: string;
      statusCode?: number;
      responseHeaders?: Record<string, string>;
      responseBody?: string;
      isRetryable?: boolean;
    }) {
      super(options.message);
      this.name = 'APICallError';
      this.statusCode = options.statusCode;
      this.responseHeaders = options.responseHeaders;
      this.responseBody = options.responseBody;
      this.isRetryable = options.isRetryable ?? false;
    }
  }

  return {
    streamText: jest.fn(),
    convertToCoreMessages: jest.fn((messages: unknown[]) => messages),
    APICallError: MockAPICallError,
  };
});

// Import after mocks are set up
import { POST } from '../route';

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => {
    return (modelId: string) => ({
      modelId,
      provider: 'openai',
    });
  }),
}));

describe('AI SDK Completions Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear guest rate limits between tests
    clearAllRateLimitsForTesting();
  });

  describe('Request Validation', () => {
    it('should return 400 if messages array is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          // messages missing
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('messages array is required');
    });

    it('should return 400 if model is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          // model missing
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('model is required');
    });

    it('should return 401 when API key is missing and GUEST_API_KEY not configured', async () => {
      // Ensure GUEST_API_KEY is not set
      delete process.env.GUEST_API_KEY;

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          // apiKey missing, no Authorization header
        }),
      });

      const response = await POST(request);
      // Should return 401 with GUEST_NOT_CONFIGURED error
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.code).toBe('GUEST_NOT_CONFIGURED');
      expect(data.message).toContain('sign in');
    });

    it('should accept API key from Authorization header', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(streamText).toHaveBeenCalled();
    });

    it('should accept API key from request body', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: 'test-api-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(streamText).toHaveBeenCalled();
    });

    it('should use GUEST_API_KEY when explicit guest request and GUEST_API_KEY is configured', async () => {
      // Set GUEST_API_KEY for this test
      process.env.GUEST_API_KEY = 'test-guest-key';

      const { streamText, createOpenAI } = require('ai');
      const { createOpenAI: createOpenAIMock } = require('@ai-sdk/openai');

      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: 'guest', // Explicit guest request
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify the guest API key was used
      expect(createOpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-guest-key',
        })
      );

      // Clean up
      delete process.env.GUEST_API_KEY;
    });

    it('should return 401 for explicit guest request when GUEST_API_KEY not configured', async () => {
      // Ensure GUEST_API_KEY is not set
      delete process.env.GUEST_API_KEY;

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: 'guest', // Explicit guest request
        }),
      });

      const response = await POST(request);
      // Should return 401 with GUEST_NOT_CONFIGURED error
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.code).toBe('GUEST_NOT_CONFIGURED');
      expect(data.message).toContain('sign in');
    });

    it('should return 429 when guest rate limit is exceeded', async () => {
      // Set GUEST_API_KEY for this test
      process.env.GUEST_API_KEY = 'test-guest-key';

      const { streamText, createOpenAI } = require('ai');
      const { createOpenAI: createOpenAIMock } = require('@ai-sdk/openai');

      // Use mockImplementation to create a fresh generator per call
      // mockReturnValue with an immediately-invoked generator would create a single shared instance
      streamText.mockImplementation(() => ({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      }));

      // Make 3 requests (the limit)
      for (let i = 0; i < 3; i++) {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            apiKey: 'guest',
          }),
          headers: {
            'x-forwarded-for': '192.168.1.100',
          },
        });
        const response = await POST(request);
        expect(response.status).toBe(200);
      }

      // 4th request should be rate limited
      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: 'guest',
        }),
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(429);

      const data = await response.json();
      expect(data.code).toBe('GUEST_RATE_LIMIT_EXCEEDED');
      expect(data.message).toContain('free chat limit');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');

      // Clean up
      delete process.env.GUEST_API_KEY;
    });

    it('should not consume guest quota when streamText throws pre-stream error', async () => {
      // Set GUEST_API_KEY for this test
      process.env.GUEST_API_KEY = 'test-guest-key';

      const { streamText } = require('ai');
      const { APICallError } = require('ai');

      // First request: streamText throws an error (e.g., invalid model)
      streamText.mockImplementationOnce(() => {
        throw new APICallError({
          message: 'Model not found',
          statusCode: 404,
          isRetryable: false,
        });
      });

      const failedRequest = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'invalid-model',
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: 'guest',
        }),
        headers: {
          'x-forwarded-for': '192.168.1.200',
        },
      });

      const failedResponse = await POST(failedRequest);
      expect(failedResponse.status).toBe(404); // Should fail with model not found

      // Now make 3 successful requests - they should all succeed because the failed one didn't consume quota
      // Use mockImplementation to create a fresh generator per call
      streamText.mockImplementation(() => ({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      }));

      for (let i = 0; i < 3; i++) {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            apiKey: 'guest',
          }),
          headers: {
            'x-forwarded-for': '192.168.1.200',
          },
        });
        const response = await POST(request);
        expect(response.status).toBe(200);
      }

      // 4th successful request should be rate limited (quota was only consumed by the 3 successful ones)
      const rateLimitedRequest = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: 'guest',
        }),
        headers: {
          'x-forwarded-for': '192.168.1.200',
        },
      });

      const rateLimitedResponse = await POST(rateLimitedRequest);
      expect(rateLimitedResponse.status).toBe(429);

      // Clean up
      delete process.env.GUEST_API_KEY;
    });

    it('should consume guest quota for redirected non-standard model requests', async () => {
      // Set GUEST_API_KEY for this test
      process.env.GUEST_API_KEY = 'test-guest-key';

      // Mock global fetch for the redirect
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
            controller.close();
          },
        }),
        headers: new Map([['Content-Type', 'text/event-stream']]),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      // Make 3 requests to a non-standard gateway (deepseek) - should be redirected
      for (let i = 0; i < 3; i++) {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model: 'deepseek/deepseek-r1',
            messages: [{ role: 'user', content: 'Hello' }],
            apiKey: 'guest',
          }),
          headers: {
            'x-forwarded-for': '192.168.1.150',
          },
        });
        const response = await POST(request);
        expect(response.status).toBe(200);
        expect(response.headers.get('X-Redirected-From')).toBe('ai-sdk-completions');
      }

      // Verify fetch was called 3 times (for redirects)
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // 4th request should be rate limited even though it's redirected
      const rateLimitedRequest = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1',
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: 'guest',
        }),
        headers: {
          'x-forwarded-for': '192.168.1.150',
        },
      });

      const rateLimitedResponse = await POST(rateLimitedRequest);
      expect(rateLimitedResponse.status).toBe(429);

      const data = await rateLimitedResponse.json();
      expect(data.code).toBe('GUEST_RATE_LIMIT_EXCEEDED');

      // Clean up
      delete process.env.GUEST_API_KEY;
    });

    it('should not consume guest quota when redirected request fails', async () => {
      // Set GUEST_API_KEY for this test
      process.env.GUEST_API_KEY = 'test-guest-key';

      // Mock global fetch to return an error response
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        body: null,
        headers: new Map([['Content-Type', 'application/json']]),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      // Make a failed redirected request
      const failedRequest = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1',
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: 'guest',
        }),
        headers: {
          'x-forwarded-for': '192.168.1.160',
        },
      });

      const failedResponse = await POST(failedRequest);
      expect(failedResponse.status).toBe(500);

      // Now mock successful fetch
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
            controller.close();
          },
        }),
        headers: new Map([['Content-Type', 'text/event-stream']]),
      });

      // Make 3 successful redirected requests - they should all succeed because the failed one didn't consume quota
      for (let i = 0; i < 3; i++) {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model: 'deepseek/deepseek-r1',
            messages: [{ role: 'user', content: 'Hello' }],
            apiKey: 'guest',
          }),
          headers: {
            'x-forwarded-for': '192.168.1.160',
          },
        });
        const response = await POST(request);
        expect(response.status).toBe(200);
      }

      // 4th request should be rate limited
      const rateLimitedRequest = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1',
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: 'guest',
        }),
        headers: {
          'x-forwarded-for': '192.168.1.160',
        },
      });

      const rateLimitedResponse = await POST(rateLimitedRequest);
      expect(rateLimitedResponse.status).toBe(429);

      // Clean up
      delete process.env.GUEST_API_KEY;
    });
  });

  describe('Provider Detection', () => {
    it('should detect Claude models', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-3-7-sonnet-20250219',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.headers.get('X-Provider')).toBe('anthropic');
      expect(response.headers.get('X-Supports-Thinking')).toBe('true');
    });

    it('should detect OpenAI models', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.headers.get('X-Provider')).toBe('openai');
    });

    it('should detect Google models', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gemini-2.0-flash',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.headers.get('X-Provider')).toBe('google');
      expect(response.headers.get('X-Supports-Thinking')).toBe('true');
    });

    it('should detect DeepSeek models', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'deepseek-r1',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.headers.get('X-Provider')).toBe('deepseek');
      expect(response.headers.get('X-Supports-Thinking')).toBe('true');
    });

    it('should use gatewayz provider as fallback', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'some-unknown-model',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.headers.get('X-Provider')).toBe('gatewayz');
    });
  });

  describe('Reasoning Detection', () => {
    const reasoningModels = [
      { model: 'claude-3-7-sonnet-20250219', expectedThinking: true },
      { model: 'claude-opus-4', expectedThinking: true },
      { model: 'claude-sonnet-4', expectedThinking: true },
      { model: 'claude-3.5-sonnet', expectedThinking: false },
      { model: 'o1-preview', expectedThinking: true },
      { model: 'o1-mini', expectedThinking: true },
      { model: 'o3-mini', expectedThinking: true },
      { model: 'gpt-4', expectedThinking: false },
      { model: 'gemini-2.0-flash', expectedThinking: true },
      { model: 'gemini-1.5-pro', expectedThinking: false },
      { model: 'deepseek-r1', expectedThinking: true },
      { model: 'deepseek-coder', expectedThinking: false },
      { model: 'qwen-qwq', expectedThinking: true },
      { model: 'qwen-2.5', expectedThinking: false },
      { model: 'llama-3-thinking', expectedThinking: true },
      { model: 'llama-3', expectedThinking: false },
    ];

    reasoningModels.forEach(({ model, expectedThinking }) => {
      it(`should ${expectedThinking ? 'enable' : 'disable'} thinking for ${model}`, async () => {
        const { streamText } = require('ai');
        streamText.mockReturnValue({
          fullStream: (async function* () {
            yield { type: 'text-delta', text: 'Hello' };
            yield { type: 'finish', finishReason: 'stop' };
          })(),
        });

        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Test' }],
            apiKey: 'test-key',
          }),
        });

        const response = await POST(request);
        expect(response.headers.get('X-Supports-Thinking')).toBe(expectedThinking ? 'true' : 'false');
      });
    });
  });

  describe('SSE Stream Formatting', () => {
    it('should format text as SSE with OpenAI structure', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          // AI SDK fullStream uses 'text-delta' type
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'text-delta', text: ' World' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');

      const text = await response.text();
      expect(text).toContain('data: ');
      expect(text).toContain('"choices"');
      expect(text).toContain('"delta"');
      expect(text).toContain('"content":"Hello"');
      expect(text).toContain('data: [DONE]');
    });

    it('should format reasoning as SSE with reasoning_content field', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          // AI SDK fullStream uses 'reasoning-delta' and 'text-delta' types
          yield { type: 'reasoning-delta', text: 'Thinking...' };
          yield { type: 'text-delta', text: 'Answer' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-3-7-sonnet-20250219',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      const text = await response.text();
      expect(text).toContain('"reasoning_content":"Thinking..."');
      expect(text).toContain('"content":"Answer"');
    });

    it('should include finish_reason in completion message', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      const text = await response.text();
      expect(text).toContain('"finish_reason":"stop"');
    });
  });

  describe('Error Handling', () => {
    it('should handle streamText errors gracefully', async () => {
      const { streamText } = require('ai');
      streamText.mockImplementation(() => {
        throw new Error('AI SDK Error: Invalid model');
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'invalid-model',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toContain('Invalid model');
    });

    it('should return 401 for API key errors', async () => {
      const { streamText } = require('ai');
      streamText.mockImplementation(() => {
        throw new Error('Invalid API key provided');
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'invalid-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  describe('OpenAI Provider Usage', () => {
    it('should use OpenAI provider for all models', async () => {
      const { createOpenAI } = require('@ai-sdk/openai');
      const { streamText } = require('ai');

      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const models = ['claude-3-7-sonnet', 'gpt-4', 'gemini-2.0-flash', 'deepseek-r1'];

      for (const model of models) {
        createOpenAI.mockClear();

        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Test' }],
            apiKey: 'test-key',
          }),
        });

        await POST(request);

        // Verify OpenAI provider was created
        expect(createOpenAI).toHaveBeenCalled();

        // Verify baseURL points to Gatewayz
        const callArgs = createOpenAI.mock.calls[0][0];
        expect(callArgs.baseURL).toContain('/v1');
        expect(callArgs.apiKey).toBe('test-key');
      }
    });
  });

  describe('Message Format Conversion', () => {
    it('should convert OpenAI format messages with image_url to AI SDK format', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'I see the image' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } }
            ]
          }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify streamText was called with converted messages
      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();
      expect(callArgs.messages.length).toBe(1);
      expect(callArgs.messages[0].role).toBe('user');
      expect(Array.isArray(callArgs.messages[0].content)).toBe(true);

      const content = callArgs.messages[0].content;
      expect(content[0].type).toBe('text');
      expect(content[0].text).toBe('What is in this image?');
      expect(content[1].type).toBe('image');
      expect(content[1].image).toBeInstanceOf(URL);
      expect(content[1].image.toString()).toBe('https://example.com/image.jpg');
    });

    it('should handle string content without modification', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello!' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'How are you?' }
          ],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];
      expect(callArgs.messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ]);
    });

    it('should handle system messages with array content', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Response' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: [
              { type: 'text', text: 'You are a helpful assistant.' },
              { type: 'text', text: 'Be concise.' }
            ]
          }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[0].content).toBe('You are a helpful assistant.\nBe concise.');
    });

    it('should convert multiple text parts to single string for simpler format', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Response' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Single text part' }
            ]
          }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];
      // Single text part should be converted to string
      expect(callArgs.messages[0].content).toBe('Single text part');
    });

    it('should skip unsupported media types gracefully', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Response' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Check this video' },
              { type: 'video_url', video_url: { url: 'https://example.com/video.mp4' } },
              { type: 'audio_url', audio_url: { url: 'https://example.com/audio.mp3' } }
            ]
          }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];
      // Video and audio should be skipped, only text remains
      expect(callArgs.messages[0].content).toBe('Check this video');
    });

    it('should handle malformed JSON in tool call arguments gracefully', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Tool call processed' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      // Spy on console.warn to verify warning is logged
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'assistant',
            content: 'Using a tool',
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{invalid json}' // Malformed JSON
              }
            }]
          }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];

      // Tool call should still be included with empty object as fallback
      const assistantMessage = callArgs.messages[0];
      expect(assistantMessage.role).toBe('assistant');
      expect(Array.isArray(assistantMessage.content)).toBe(true);

      const toolCallPart = assistantMessage.content.find((p: { type: string }) => p.type === 'tool-call');
      expect(toolCallPart).toBeDefined();
      expect(toolCallPart.toolName).toBe('get_weather');
      expect(toolCallPart.input).toEqual({}); // Empty object fallback

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse tool call arguments for get_weather')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should log warning when all content parts are filtered out', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Response' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      // Spy on console.warn to verify warning is logged
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'user',
            content: [
              // Only unsupported media types
              { type: 'video_url', video_url: { url: 'https://example.com/video.mp4' } },
              { type: 'audio_url', audio_url: { url: 'https://example.com/audio.mp3' } }
            ]
          }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];

      // Message should have empty content since all parts were filtered
      expect(callArgs.messages[0].content).toBe('');

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('had all content parts filtered out')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should filter out image_url parts from assistant messages', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Response' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      // Spy on console.warn to verify warning is logged
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'assistant',
            content: [
              { type: 'text', text: 'Here is the image' },
              { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } }
            ]
          }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];

      // Assistant message should only have text content (image filtered out)
      const assistantMessage = callArgs.messages[0];
      expect(assistantMessage.role).toBe('assistant');
      // Since there's only one text part, it should be converted to string
      expect(assistantMessage.content).toBe('Here is the image');

      // Verify warning was logged for skipped image
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AI SDK Route] Skipping image_url in assistant message - not supported by AI SDK'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should filter out file_url parts from assistant messages', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Response' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      // Spy on console.warn to verify warning is logged
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'assistant',
            content: [
              { type: 'text', text: 'Here is the file' },
              { type: 'file_url', file_url: { url: 'https://example.com/doc.pdf', mime_type: 'application/pdf' } }
            ]
          }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];

      // Assistant message should only have text content (file filtered out)
      const assistantMessage = callArgs.messages[0];
      expect(assistantMessage.role).toBe('assistant');
      // Since there's only one text part, it should be converted to string
      expect(assistantMessage.content).toBe('Here is the file');

      // Verify warning was logged for skipped file
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AI SDK Route] Skipping file_url in assistant message - not supported by AI SDK'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should return empty content for assistant messages with only image/file parts', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Response' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      // Spy on console.warn to verify warning is logged
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'assistant',
            content: [
              { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } },
              { type: 'file_url', file_url: { url: 'https://example.com/doc.pdf' } }
            ]
          }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];

      // Assistant message should have empty content since all parts were filtered
      const assistantMessage = callArgs.messages[0];
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.content).toBe('');

      consoleWarnSpy.mockRestore();
    });

    it('should allow image_url parts in user messages', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'I see the image' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,ABC123' } }
            ]
          }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(streamText).toHaveBeenCalled();
      const callArgs = streamText.mock.calls[0][0];

      // User message should include both text and image parts
      const userMessage = callArgs.messages[0];
      expect(userMessage.role).toBe('user');
      expect(Array.isArray(userMessage.content)).toBe(true);
      expect(userMessage.content.length).toBe(2);
      expect(userMessage.content[0].type).toBe('text');
      expect(userMessage.content[1].type).toBe('image');
    });
  });
});
