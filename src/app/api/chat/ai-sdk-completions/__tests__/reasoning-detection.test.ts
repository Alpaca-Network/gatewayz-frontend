/**
 * Unit tests for reasoning detection
 * Ensures all reasoning-capable models are correctly identified

 * @jest-environment node
 */

// We need to extract the supportsReasoning function for testing
// Since it's not exported, we'll test it through the API route behavior

import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('ai', () => ({
  streamText: jest.fn(),
  convertToCoreMessages: jest.fn((messages) => messages),
}));

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => {
    return (modelId: string) => ({
      modelId,
      provider: 'openai',
    });
  }),
}));

describe('Reasoning Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const { streamText } = require('ai');
    streamText.mockReturnValue({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'Test', id: '1' };
        yield { type: 'finish', finishReason: 'stop' };
      })(),
    });
  });

  describe('Claude Models', () => {
    const testCases = [
      // Reasoning-capable Claude models
      { model: 'claude-3-7-sonnet-20250219', expectsReasoning: true, description: 'Claude 3.7 Sonnet' },
      { model: 'claude-3.7-sonnet', expectsReasoning: true, description: 'Claude 3.7 Sonnet (alt format)' },
      { model: 'claude-opus-4', expectsReasoning: true, description: 'Claude Opus 4' },
      { model: 'claude-sonnet-4', expectsReasoning: true, description: 'Claude Sonnet 4' },
      { model: 'claude-opus-4-20250514', expectsReasoning: true, description: 'Claude Opus 4 with date' },

      // Non-reasoning Claude models
      { model: 'claude-3.5-sonnet', expectsReasoning: false, description: 'Claude 3.5 Sonnet' },
      { model: 'claude-3-sonnet', expectsReasoning: false, description: 'Claude 3 Sonnet' },
      { model: 'claude-3-opus', expectsReasoning: false, description: 'Claude 3 Opus' },
      { model: 'claude-2.1', expectsReasoning: false, description: 'Claude 2.1' },
      { model: 'claude-instant', expectsReasoning: false, description: 'Claude Instant' },
    ];

    testCases.forEach(({ model, expectsReasoning, description }) => {
      test(`${description} should ${expectsReasoning ? 'support' : 'not support'} reasoning`, async () => {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Test' }],
            apiKey: 'test-key',
          }),
        });

        const response = await POST(request);
        expect(response.headers.get('X-Supports-Thinking')).toBe(expectsReasoning ? 'true' : 'false');
      });
    });
  });

  describe('OpenAI Models', () => {
    const testCases = [
      // Reasoning-capable OpenAI models
      { model: 'o1', expectsReasoning: true, description: 'O1' },
      { model: 'o1-preview', expectsReasoning: true, description: 'O1 Preview' },
      { model: 'o1-mini', expectsReasoning: true, description: 'O1 Mini' },
      { model: 'o3', expectsReasoning: true, description: 'O3' },
      { model: 'o3-mini', expectsReasoning: true, description: 'O3 Mini' },

      // Non-reasoning OpenAI models
      { model: 'gpt-4', expectsReasoning: false, description: 'GPT-4' },
      { model: 'gpt-4-turbo', expectsReasoning: false, description: 'GPT-4 Turbo' },
      { model: 'gpt-3.5-turbo', expectsReasoning: false, description: 'GPT-3.5 Turbo' },
      { model: 'gpt-4o', expectsReasoning: false, description: 'GPT-4o' },
    ];

    testCases.forEach(({ model, expectsReasoning, description }) => {
      test(`${description} should ${expectsReasoning ? 'support' : 'not support'} reasoning`, async () => {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Test' }],
            apiKey: 'test-key',
          }),
        });

        const response = await POST(request);
        expect(response.headers.get('X-Supports-Thinking')).toBe(expectsReasoning ? 'true' : 'false');
      });
    });
  });

  describe('Google Models', () => {
    const testCases = [
      // Reasoning-capable Gemini models
      { model: 'gemini-2.0-flash', expectsReasoning: true, description: 'Gemini 2.0 Flash' },
      { model: 'gemini-2-0-flash', expectsReasoning: true, description: 'Gemini 2-0 Flash (alt format)' },
      { model: 'gemini-pro-exp-thinking', expectsReasoning: true, description: 'Gemini Pro Experimental Thinking' },
      { model: 'gemini-thinking', expectsReasoning: true, description: 'Gemini Thinking' },

      // Non-reasoning Gemini models
      { model: 'gemini-1.5-pro', expectsReasoning: false, description: 'Gemini 1.5 Pro' },
      { model: 'gemini-1.5-flash', expectsReasoning: false, description: 'Gemini 1.5 Flash' },
      { model: 'gemini-pro', expectsReasoning: false, description: 'Gemini Pro' },
    ];

    testCases.forEach(({ model, expectsReasoning, description }) => {
      test(`${description} should ${expectsReasoning ? 'support' : 'not support'} reasoning`, async () => {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Test' }],
            apiKey: 'test-key',
          }),
        });

        const response = await POST(request);
        expect(response.headers.get('X-Supports-Thinking')).toBe(expectsReasoning ? 'true' : 'false');
      });
    });
  });

  describe('DeepSeek Models', () => {
    const testCases = [
      // Reasoning-capable DeepSeek models
      { model: 'deepseek-r1', expectsReasoning: true, description: 'DeepSeek R1' },
      { model: 'deepseek-reasoner', expectsReasoning: true, description: 'DeepSeek Reasoner' },
      { model: 'deepseek-r1-distill', expectsReasoning: true, description: 'DeepSeek R1 Distill' },

      // Non-reasoning DeepSeek models
      { model: 'deepseek-coder', expectsReasoning: false, description: 'DeepSeek Coder' },
      { model: 'deepseek-chat', expectsReasoning: false, description: 'DeepSeek Chat' },
    ];

    testCases.forEach(({ model, expectsReasoning, description }) => {
      test(`${description} should ${expectsReasoning ? 'support' : 'not support'} reasoning`, async () => {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Test' }],
            apiKey: 'test-key',
          }),
        });

        const response = await POST(request);
        expect(response.headers.get('X-Supports-Thinking')).toBe(expectsReasoning ? 'true' : 'false');
      });
    });
  });

  describe('Qwen Models', () => {
    const testCases = [
      // Reasoning-capable Qwen models
      { model: 'qwen-qwq', expectsReasoning: true, description: 'QwQ' },
      { model: 'qwen-32b-thinking', expectsReasoning: true, description: 'Qwen 32B Thinking' },
      { model: 'qwen-thinking-preview', expectsReasoning: true, description: 'Qwen Thinking Preview' },

      // Non-reasoning Qwen models
      { model: 'qwen-2.5-72b', expectsReasoning: false, description: 'Qwen 2.5 72B' },
      { model: 'qwen-turbo', expectsReasoning: false, description: 'Qwen Turbo' },
    ];

    testCases.forEach(({ model, expectsReasoning, description }) => {
      test(`${description} should ${expectsReasoning ? 'support' : 'not support'} reasoning`, async () => {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Test' }],
            apiKey: 'test-key',
          }),
        });

        const response = await POST(request);
        expect(response.headers.get('X-Supports-Thinking')).toBe(expectsReasoning ? 'true' : 'false');
      });
    });
  });

  describe('Generic Pattern Matching', () => {
    const testCases = [
      // Should support reasoning based on keywords
      { model: 'llama-3-thinking', expectsReasoning: true, description: 'LLaMA with "thinking"' },
      { model: 'mistral-reasoning-v1', expectsReasoning: true, description: 'Mistral with "reasoning"' },
      { model: 'phi-reflection', expectsReasoning: true, description: 'Phi with "reflection"' },
      { model: 'custom-chain-of-thought', expectsReasoning: true, description: 'Custom with "chain-of-thought"' },
      { model: 'model-cot', expectsReasoning: true, description: 'Model with "COT"' },

      // Should not support reasoning
      { model: 'llama-3', expectsReasoning: false, description: 'LLaMA without reasoning' },
      { model: 'mistral-7b', expectsReasoning: false, description: 'Mistral without reasoning' },
      { model: 'phi-3', expectsReasoning: false, description: 'Phi without reasoning' },
    ];

    testCases.forEach(({ model, expectsReasoning, description }) => {
      test(`${description} should ${expectsReasoning ? 'support' : 'not support'} reasoning`, async () => {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Test' }],
            apiKey: 'test-key',
          }),
        });

        const response = await POST(request);
        expect(response.headers.get('X-Supports-Thinking')).toBe(expectsReasoning ? 'true' : 'false');
      });
    });
  });

  describe('Case Insensitivity', () => {
    const testCases = [
      'CLAUDE-3-7-SONNET',
      'Claude-3-7-Sonnet',
      'claude-3-7-SONNET',
      'O1-PREVIEW',
      'o1-Preview',
      'GEMINI-2.0-FLASH',
      'Gemini-2.0-Flash',
      'DEEPSEEK-R1',
      'DeepSeek-R1',
    ];

    testCases.forEach(model => {
      test(`should detect reasoning for ${model} (case variations)`, async () => {
        const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
          method: 'POST',
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Test' }],
            apiKey: 'test-key',
          }),
        });

        const response = await POST(request);
        expect(response.headers.get('X-Supports-Thinking')).toBe('true');
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty model name', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: '',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      // Should not crash, should default to false
      expect(response.headers.get('X-Supports-Thinking')).toBe('false');
    });

    test('should handle model names with special characters', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-3-7-sonnet@20250219',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.headers.get('X-Supports-Thinking')).toBe('true');
    });

    test('should handle model names with version suffixes', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/ai-sdk-completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'deepseek-r1-v1.5-beta',
          messages: [{ role: 'user', content: 'Test' }],
          apiKey: 'test-key',
        }),
      });

      const response = await POST(request);
      expect(response.headers.get('X-Supports-Thinking')).toBe('true');
    });
  });
});
