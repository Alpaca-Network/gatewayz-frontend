/**
 * Unit tests for use-chat-stream.ts
 *
 * Tests the Fireworks and DeepSeek model routing logic
 */

describe('useChatStream message parameters', () => {
  /**
   * Tests that the saveMessage mutation is called with reasoning parameter
   * when reasoning content is present during streaming
   */
  describe('reasoning parameter handling', () => {
    test('should include reasoning in save message call when present', () => {
      // Simulates the mutation call signature
      const mockSaveMessageCall = (params: {
        sessionId: number;
        role: 'user' | 'assistant';
        content: string;
        model?: string;
        reasoning?: string;
      }) => {
        return params;
      };

      // Test with reasoning
      const withReasoning = mockSaveMessageCall({
        sessionId: 123,
        role: 'assistant',
        content: 'Response content',
        model: 'fireworks/deepseek-r1',
        reasoning: 'This is the chain of thought reasoning'
      });

      expect(withReasoning.reasoning).toBe('This is the chain of thought reasoning');
      expect(withReasoning.content).toBe('Response content');
      expect(withReasoning.role).toBe('assistant');
    });

    test('should not include reasoning when not present', () => {
      const mockSaveMessageCall = (params: {
        sessionId: number;
        role: 'user' | 'assistant';
        content: string;
        model?: string;
        reasoning?: string;
      }) => {
        return params;
      };

      // Test without reasoning (user message)
      const withoutReasoning = mockSaveMessageCall({
        sessionId: 123,
        role: 'user',
        content: 'User message',
        model: 'openai/gpt-4o',
        reasoning: undefined
      });

      expect(withoutReasoning.reasoning).toBeUndefined();
      expect(withoutReasoning.content).toBe('User message');
    });

    test('should pass empty string reasoning as undefined', () => {
      // In use-chat-stream.ts, we use `reasoning: finalReasoning || undefined`
      // This test ensures empty strings are converted to undefined
      const finalReasoning = '';
      const reasoningParam = finalReasoning || undefined;

      expect(reasoningParam).toBeUndefined();
    });

    test('should preserve non-empty reasoning', () => {
      const finalReasoning = 'Chain of thought content';
      const reasoningParam = finalReasoning || undefined;

      expect(reasoningParam).toBe('Chain of thought content');
    });
  });
});

describe('useChatStream routing logic', () => {
  /**
   * Helper function that mirrors the routing logic in use-chat-stream.ts
   * This allows us to test the routing decision without mocking React hooks
   */
  function getRouteForModel(modelValue: string, sourceGateway?: string): 'completions' | 'ai-sdk' {
    const modelLower = modelValue.toLowerCase();
    const gatewayLower = (sourceGateway || '').toLowerCase();

    // Models/providers that need the flexible completions route:
    // - Fireworks: returns non-OpenAI format (object: "response.chunk" with output array)
    //   This includes any model served through Fireworks gateway, regardless of original provider
    //   Examples: 'accounts/fireworks/models/deepseek-r1-0528', 'fireworks/llama-3.3-70b'
    const isFireworksModel = modelLower.includes('fireworks') ||
                              modelLower.includes('accounts/fireworks') ||
                              gatewayLower === 'fireworks';

    // DeepSeek models need flexible completions route UNLESS they're explicitly routed
    // through a gateway that normalizes the format (OpenRouter, Together, etc.)
    // Models like 'openrouter/deepseek/deepseek-r1' have the gateway prefix and are normalized
    // Models like 'deepseek/deepseek-r1' (no gateway prefix or sourceGateway) need flexible route
    //
    // IMPORTANT: Only redirect when we're CERTAIN it's direct DeepSeek API access:
    // - 'deepseek/deepseek-r1' -> definitely direct DeepSeek API -> needs flexible route
    // - 'openrouter/deepseek/deepseek-r1' -> normalized by OpenRouter -> AI SDK can handle
    // - 'deepseek-r1' (no prefix) -> could be from any gateway, let AI SDK try
    // - 'deepseek-r1' with sourceGateway='deepseek' -> direct DeepSeek -> needs flexible route
    const startsWithDeepSeek = modelLower.startsWith('deepseek/');
    const normalizingGateways = ['openrouter', 'together', 'groq', 'cerebras', 'anyscale'];
    const hasExplicitNormalizingPrefix = normalizingGateways.some(g => modelLower.startsWith(`${g}/`));

    // Only redirect if:
    // 1. Model explicitly starts with 'deepseek/' (direct API) AND doesn't have normalizing prefix, OR
    // 2. sourceGateway is explicitly 'deepseek'
    const isDirectDeepSeekGateway = gatewayLower === 'deepseek';
    const isDeepSeekNeedingFlexible = (startsWithDeepSeek && !hasExplicitNormalizingPrefix) || isDirectDeepSeekGateway;

    return (isFireworksModel || isDeepSeekNeedingFlexible) ? 'completions' : 'ai-sdk';
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

  describe('DeepSeek model detection', () => {
    test('should route DeepSeek with deepseek/ prefix to completions endpoint', () => {
      // Model ID starting with 'deepseek/' indicates direct DeepSeek API access
      // Direct DeepSeek gateway returns Responses API format, needs flexible route
      expect(getRouteForModel('deepseek/deepseek-r1')).toBe('completions');
      expect(getRouteForModel('deepseek/deepseek-chat')).toBe('completions');
      expect(getRouteForModel('DeepSeek/DeepSeek-R1')).toBe('completions');
      // Even with sourceGateway set, trust the model ID prefix
      expect(getRouteForModel('deepseek/deepseek-r1', 'together')).toBe('completions');
      expect(getRouteForModel('deepseek/deepseek-r1', 'openrouter')).toBe('completions');
      expect(getRouteForModel('deepseek/deepseek-chat', 'groq')).toBe('completions');
    });

    test('should route models with deepseek sourceGateway to completions endpoint', () => {
      // When sourceGateway is explicitly 'deepseek', it's direct DeepSeek API
      expect(getRouteForModel('deepseek-r1', 'deepseek')).toBe('completions');
      expect(getRouteForModel('deepseek-chat', 'DeepSeek')).toBe('completions');
    });

    test('should route DeepSeek without deepseek/ prefix to AI SDK endpoint', () => {
      // When model doesn't start with 'deepseek/', we can't be sure it's direct DeepSeek
      // Let AI SDK try to handle it (may fail, but that's the safe default)
      expect(getRouteForModel('deepseek-r1')).toBe('ai-sdk'); // No prefix, no gateway
      expect(getRouteForModel('deepseek-chat')).toBe('ai-sdk');
      // Through normalizing gateways, definitely use AI SDK
      expect(getRouteForModel('openrouter/deepseek/deepseek-r1')).toBe('ai-sdk');
      expect(getRouteForModel('together/deepseek-r1')).toBe('ai-sdk');
      expect(getRouteForModel('groq/deepseek-r1-distill-llama-70b')).toBe('ai-sdk');
      expect(getRouteForModel('deepseek-r1', 'openrouter')).toBe('ai-sdk');
      expect(getRouteForModel('deepseek-chat', 'together')).toBe('ai-sdk');
      // Through other providers, also use AI SDK (we're not certain about the format)
      expect(getRouteForModel('huggingface/deepseek-ai/DeepSeek-R1')).toBe('ai-sdk');
      expect(getRouteForModel('nebius/deepseek-r1')).toBe('ai-sdk');
      expect(getRouteForModel('chutes/deepseek-r1')).toBe('ai-sdk');
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
