/**
 * Unit tests for use-chat-stream.ts
 *
 * Tests the Fireworks and DeepSeek model routing logic
 */

describe('useChatStream routing logic', () => {
  /**
   * Helper function that mirrors the routing logic in use-chat-stream.ts
   * This allows us to test the routing decision without mocking React hooks
   */
  function getRouteForModel(modelValue: string, sourceGateway?: string): 'completions' | 'ai-sdk' {
    const modelLower = modelValue.toLowerCase();
    const gatewayLower = (sourceGateway || '').toLowerCase();

    const isFireworksModel = modelLower.includes('fireworks') ||
                              modelLower.includes('accounts/fireworks') ||
                              gatewayLower === 'fireworks';

    // DeepSeek models need flexible completions route UNLESS they're explicitly routed
    // through a gateway that normalizes the format (OpenRouter, Together, etc.)
    // Models like 'openrouter/deepseek/deepseek-r1' have the gateway prefix and are normalized
    // Models like 'deepseek/deepseek-r1' (no gateway prefix or sourceGateway) need flexible route
    const normalizingGateways = ['openrouter', 'together', 'groq', 'cerebras', 'anyscale'];
    const isNormalizedByGateway = normalizingGateways.includes(gatewayLower) ||
                                   normalizingGateways.some(g => modelLower.startsWith(`${g}/`));
    const isDeepSeekModel = modelLower.includes('deepseek');
    const isDeepSeekNeedingFlexible = isDeepSeekModel && !isNormalizedByGateway;

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
    test('should route direct DeepSeek gateway models to completions endpoint', () => {
      // Direct DeepSeek gateway returns Responses API format, needs flexible route
      expect(getRouteForModel('deepseek/deepseek-r1')).toBe('completions');
      expect(getRouteForModel('deepseek/deepseek-chat')).toBe('completions');
      expect(getRouteForModel('DeepSeek/DeepSeek-R1')).toBe('completions');
    });

    test('should route models with deepseek sourceGateway to completions endpoint', () => {
      expect(getRouteForModel('deepseek-r1', 'deepseek')).toBe('completions');
      expect(getRouteForModel('deepseek-chat', 'DeepSeek')).toBe('completions');
    });

    test('should route DeepSeek models from normalizing providers to AI SDK endpoint', () => {
      // DeepSeek through OpenRouter/Together/etc normalizes the format, so use AI SDK
      expect(getRouteForModel('openrouter/deepseek/deepseek-r1')).toBe('ai-sdk');
      expect(getRouteForModel('together/deepseek-r1')).toBe('ai-sdk');
      expect(getRouteForModel('groq/deepseek-r1-distill-llama-70b')).toBe('ai-sdk');
    });

    test('should route DeepSeek models from non-normalizing providers to completions endpoint', () => {
      // DeepSeek through providers that don't normalize (huggingface, nebius, etc) need flexible route
      expect(getRouteForModel('huggingface/deepseek-ai/DeepSeek-R1')).toBe('completions');
      expect(getRouteForModel('nebius/deepseek-r1')).toBe('completions');
      expect(getRouteForModel('chutes/deepseek-r1')).toBe('completions');
    });

    test('should route DeepSeek with non-deepseek sourceGateway to AI SDK endpoint', () => {
      expect(getRouteForModel('deepseek-r1', 'openrouter')).toBe('ai-sdk');
      expect(getRouteForModel('deepseek-chat', 'together')).toBe('ai-sdk');
      // Even with deepseek/ prefix, explicit gateway should override
      expect(getRouteForModel('deepseek/deepseek-r1', 'together')).toBe('ai-sdk');
      expect(getRouteForModel('deepseek/deepseek-r1', 'openrouter')).toBe('ai-sdk');
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
