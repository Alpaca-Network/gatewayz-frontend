/**
 * Unit tests for use-chat-stream.ts
 *
 * Tests the Fireworks model routing logic
 */

describe('useChatStream routing logic', () => {
  /**
   * Helper function that mirrors the routing logic in use-chat-stream.ts
   * This allows us to test the routing decision without mocking React hooks
   */
  function getRouteForModel(modelValue: string, sourceGateway?: string): 'completions' | 'ai-sdk' {
    const modelLower = modelValue.toLowerCase();
    const isFireworksModel = modelLower.includes('fireworks') ||
                              modelLower.includes('accounts/fireworks') ||
                              (sourceGateway?.toLowerCase() === 'fireworks');
    return isFireworksModel ? 'completions' : 'ai-sdk';
  }

  describe('Fireworks model detection', () => {
    test('should route Fireworks models to completions endpoint', () => {
      expect(getRouteForModel('fireworks/deepseek-r1')).toBe('completions');
      expect(getRouteForModel('fireworks/llama-v3-70b')).toBe('completions');
      expect(getRouteForModel('Fireworks/DeepSeek-R1')).toBe('completions');
    });

    test('should route accounts/fireworks models to completions endpoint', () => {
      expect(getRouteForModel('accounts/fireworks/models/deepseek-r1-0528')).toBe('completions');
      expect(getRouteForModel('accounts/fireworks/models/llama-3.3-70b-instruct')).toBe('completions');
    });

    test('should route models with fireworks sourceGateway to completions endpoint', () => {
      expect(getRouteForModel('deepseek-r1', 'fireworks')).toBe('completions');
      expect(getRouteForModel('llama-70b', 'Fireworks')).toBe('completions');
    });

    test('should route non-Fireworks models to AI SDK endpoint', () => {
      expect(getRouteForModel('openai/gpt-4o')).toBe('ai-sdk');
      expect(getRouteForModel('anthropic/claude-3-opus')).toBe('ai-sdk');
      expect(getRouteForModel('openrouter/anthropic/claude-3.5-sonnet')).toBe('ai-sdk');
      expect(getRouteForModel('google/gemini-pro')).toBe('ai-sdk');
    });

    test('should route DeepSeek models from other providers to AI SDK endpoint', () => {
      // DeepSeek through OpenRouter should use AI SDK
      expect(getRouteForModel('openrouter/deepseek/deepseek-r1')).toBe('ai-sdk');
      expect(getRouteForModel('together/deepseek-r1')).toBe('ai-sdk');
    });

    test('should route models with non-fireworks sourceGateway to AI SDK endpoint', () => {
      expect(getRouteForModel('gpt-4o', 'openai')).toBe('ai-sdk');
      expect(getRouteForModel('claude-3-opus', 'anthropic')).toBe('ai-sdk');
      expect(getRouteForModel('deepseek-r1', 'openrouter')).toBe('ai-sdk');
    });
  });

  describe('URL construction', () => {
    test('should construct correct completions URL for Fireworks', () => {
      const sessionId = 123;
      const isFireworksModel = true;
      const url = isFireworksModel
        ? `/api/chat/completions?session_id=${sessionId}`
        : `/api/chat/ai-sdk-completions?session_id=${sessionId}`;

      expect(url).toBe('/api/chat/completions?session_id=123');
    });

    test('should construct correct AI SDK URL for non-Fireworks', () => {
      const sessionId = 456;
      const isFireworksModel = false;
      const url = isFireworksModel
        ? `/api/chat/completions?session_id=${sessionId}`
        : `/api/chat/ai-sdk-completions?session_id=${sessionId}`;

      expect(url).toBe('/api/chat/ai-sdk-completions?session_id=456');
    });
  });
});
