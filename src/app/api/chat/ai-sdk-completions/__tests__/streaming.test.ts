/**
 * Integration tests for AI SDK streaming
 * Tests the full streaming flow and SSE parsing

 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

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
    convertToCoreMessages: jest.fn((messages) => messages),
    convertToModelMessages: jest.fn((messages: unknown[]) => {
      if (!Array.isArray(messages)) return messages;
      return messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      }));
    }),
    APICallError: MockAPICallError,
  };
});

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => {
    return (modelId: string) => ({
      modelId,
      provider: 'openai',
    });
  }),
}));

describe('AI SDK Streaming Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Streaming Flow', () => {
    it('should stream complete response with text chunks', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          // AI SDK fullStream uses 'text-delta' type for text content
          yield { type: 'text-delta', text: 'Hello' };
          yield { type: 'text-delta', text: ' world' };
          yield { type: 'text-delta', text: '!' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const text = await response.text();
      const lines = text.split('\n').filter(line => line.startsWith('data: '));

      // Should have 3 text chunks + 1 finish + 1 [DONE]
      expect(lines.length).toBeGreaterThanOrEqual(4);

      // Parse SSE data
      const chunks = lines
        .filter(line => !line.includes('[DONE]'))
        .map(line => JSON.parse(line.replace('data: ', '')));

      // Check text chunks
      expect(chunks[0].choices[0].delta.content).toBe('Hello');
      expect(chunks[1].choices[0].delta.content).toBe(' world');
      expect(chunks[2].choices[0].delta.content).toBe('!');

      // Check finish chunk
      const finishChunk = chunks.find(c => c.choices[0].finish_reason);
      expect(finishChunk.choices[0].finish_reason).toBe('stop');

      // Check [DONE] signal
      expect(text).toContain('data: [DONE]');
    });

    it('should stream reasoning and text separately', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          // AI SDK fullStream uses 'reasoning-delta' for chain-of-thought
          yield { type: 'reasoning-delta', text: 'Let me think...' };
          yield { type: 'reasoning-delta', text: ' analyzing...' };
          yield { type: 'text-delta', text: 'The answer is' };
          yield { type: 'text-delta', text: ' 42' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-3-7-sonnet-20250219',
          messages: [{ role: 'user', content: 'What is the meaning of life?' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      const text = await response.text();
      const lines = text.split('\n').filter(line => line.startsWith('data: '));

      const chunks = lines
        .filter(line => !line.includes('[DONE]'))
        .map(line => JSON.parse(line.replace('data: ', '')));

      // Check reasoning chunks
      const reasoningChunks = chunks.filter(c => c.choices[0].delta.reasoning_content);
      expect(reasoningChunks.length).toBe(2);
      expect(reasoningChunks[0].choices[0].delta.reasoning_content).toBe('Let me think...');
      expect(reasoningChunks[1].choices[0].delta.reasoning_content).toBe(' analyzing...');

      // Check text chunks
      const textChunks = chunks.filter(c => c.choices[0].delta.content);
      expect(textChunks.length).toBe(2);
      expect(textChunks[0].choices[0].delta.content).toBe('The answer is');
      expect(textChunks[1].choices[0].delta.content).toBe(' 42');
    });

    it('should handle interleaved reasoning and text', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          // AI SDK fullStream uses 'reasoning-delta' and 'text-delta' types
          yield { type: 'reasoning-delta', text: 'Analyzing...' };
          yield { type: 'text-delta', text: 'First,' };
          yield { type: 'reasoning-delta', text: 'Considering...' };
          yield { type: 'text-delta', text: ' second' };
          yield { type: 'finish', finishReason: 'stop' };
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'o1-preview',
          messages: [{ role: 'user', content: 'Solve this problem' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      const text = await response.text();

      // Verify both reasoning and text are present
      expect(text).toContain('"reasoning_content":"Analyzing..."');
      expect(text).toContain('"content":"First,"');
      expect(text).toContain('"reasoning_content":"Considering..."');
      expect(text).toContain('"content":" second"');
    });
  });

  describe('SSE Format Compliance', () => {
    it('should produce valid SSE format', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Test' };
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

      // Check SSE format
      const lines = text.split('\n');

      // Each data line should start with "data: "
      const dataLines = lines.filter(line => line.startsWith('data: '));
      expect(dataLines.length).toBeGreaterThan(0);

      // Each data line should be followed by blank line
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].startsWith('data: ')) {
          expect(lines[i + 1]).toBe('');
        }
      }

      // Should end with [DONE]
      expect(text.trim().endsWith('data: [DONE]')).toBe(true);
    });

    it('should produce valid JSON in each SSE message', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Test "quoted" text' };
          yield { type: 'text-delta', text: 'Line\nbreak' };
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
      const lines = text.split('\n').filter(line => line.startsWith('data: '));

      // Each line should contain valid JSON
      lines.forEach(line => {
        if (!line.includes('[DONE]')) {
          const jsonStr = line.replace('data: ', '');
          expect(() => JSON.parse(jsonStr)).not.toThrow();

          const parsed = JSON.parse(jsonStr);
          expect(parsed).toHaveProperty('choices');
          expect(Array.isArray(parsed.choices)).toBe(true);
          expect(parsed.choices[0]).toHaveProperty('delta');
        }
      });
    });
  });

  describe('Error Streaming', () => {
    it('should handle stream errors gracefully', async () => {
      const { streamText } = require('ai');
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Starting...' };
          throw new Error('Stream error occurred');
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

      // Should still return 200 (streaming started)
      expect(response.status).toBe(200);

      // But the stream should handle the error
      // (Error handling is in the stream controller)
    });
  });

  describe('Performance', () => {
    it('should handle large number of chunks efficiently', async () => {
      const { streamText } = require('ai');

      // Generate 1000 chunks - AI SDK fullStream uses 'text-delta' type
      const chunks = Array.from({ length: 1000 }, (_, i) => ({
        type: 'text-delta' as const,
        text: `chunk${i} `,
      }));
      chunks.push({ type: 'finish' as const, finishReason: 'stop' });

      streamText.mockReturnValue({
        fullStream: (async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        })(),
      });

      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Generate long text' }],
          apiKey: 'test-key',
        }),
      });

      const startTime = Date.now();
      const response = await POST(request);
      await response.text();
      const endTime = Date.now();

      expect(response.status).toBe(200);

      // Should complete in reasonable time (< 5 seconds for 1000 chunks)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Multi-model Compatibility', () => {
    it('should handle all provider models with same format', async () => {
      const models = [
        'claude-3-7-sonnet-20250219',
        'gpt-4',
        'gemini-2.0-flash',
        'deepseek-r1',
        'qwen-qwq',
        'llama-3-thinking',
      ];

      for (const model of models) {
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
            model,
            messages: [{ role: 'user', content: 'Test' }],
            apiKey: 'test-key',
          }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);

        const text = await response.text();

        // All should produce same SSE format
        expect(text).toContain('data: ');
        expect(text).toContain('"choices"');
        expect(text).toContain('"delta"');
        expect(text).toContain('data: [DONE]');
      }
    });
  });
});
