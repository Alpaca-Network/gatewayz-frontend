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

      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

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
});
