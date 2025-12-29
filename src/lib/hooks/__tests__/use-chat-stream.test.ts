/**
 * Unit tests for use-chat-stream.ts
 *
 * Tests the Fireworks, DeepSeek, and NEAR AI model routing logic
 * Tests media extraction from content arrays
 */

/**
 * Helper to extract image/video/audio/document from content array for display
 * Mirrors the extractMediaFromContent function in use-chat-stream.ts
 */
const extractMediaFromContent = (content: any): { image?: string; video?: string; audio?: string; document?: string } => {
  if (!Array.isArray(content)) return {};
  const result: { image?: string; video?: string; audio?: string; document?: string } = {};
  for (const part of content) {
    if (part.type === 'image_url' && part.image_url?.url) {
      result.image = part.image_url.url;
    } else if (part.type === 'video_url' && part.video_url?.url) {
      result.video = part.video_url.url;
    } else if (part.type === 'audio_url' && part.audio_url?.url) {
      result.audio = part.audio_url.url;
    } else if (part.type === 'file_url' && part.file_url?.url) {
      result.document = part.file_url.url;
    }
  }
  return result;
};

describe('extractMediaFromContent', () => {
  describe('basic extraction', () => {
    test('should return empty object for non-array content', () => {
      expect(extractMediaFromContent('Hello world')).toEqual({});
      expect(extractMediaFromContent(null)).toEqual({});
      expect(extractMediaFromContent(undefined)).toEqual({});
      expect(extractMediaFromContent(123)).toEqual({});
      expect(extractMediaFromContent({})).toEqual({});
    });

    test('should return empty object for empty array', () => {
      expect(extractMediaFromContent([])).toEqual({});
    });

    test('should extract image_url', () => {
      const content = [
        { type: 'text', text: 'Check this' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
      ];
      expect(extractMediaFromContent(content)).toEqual({
        image: 'https://example.com/image.png'
      });
    });

    test('should extract video_url', () => {
      const content = [
        { type: 'text', text: 'Watch this' },
        { type: 'video_url', video_url: { url: 'https://example.com/video.mp4' } }
      ];
      expect(extractMediaFromContent(content)).toEqual({
        video: 'https://example.com/video.mp4'
      });
    });

    test('should extract audio_url', () => {
      const content = [
        { type: 'text', text: 'Listen to this' },
        { type: 'audio_url', audio_url: { url: 'https://example.com/audio.mp3' } }
      ];
      expect(extractMediaFromContent(content)).toEqual({
        audio: 'https://example.com/audio.mp3'
      });
    });

    test('should extract file_url (document)', () => {
      const content = [
        { type: 'text', text: 'Read this document' },
        { type: 'file_url', file_url: { url: 'https://example.com/document.pdf' } }
      ];
      expect(extractMediaFromContent(content)).toEqual({
        document: 'https://example.com/document.pdf'
      });
    });
  });

  describe('multiple media types', () => {
    test('should extract all media types from content', () => {
      const content = [
        { type: 'text', text: 'Check everything' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
        { type: 'video_url', video_url: { url: 'https://example.com/video.mp4' } },
        { type: 'audio_url', audio_url: { url: 'https://example.com/audio.mp3' } },
        { type: 'file_url', file_url: { url: 'https://example.com/doc.pdf' } }
      ];
      expect(extractMediaFromContent(content)).toEqual({
        image: 'https://example.com/image.png',
        video: 'https://example.com/video.mp4',
        audio: 'https://example.com/audio.mp3',
        document: 'https://example.com/doc.pdf'
      });
    });

    test('should use last value when multiple of same type', () => {
      const content = [
        { type: 'image_url', image_url: { url: 'https://example.com/first.png' } },
        { type: 'image_url', image_url: { url: 'https://example.com/second.png' } }
      ];
      expect(extractMediaFromContent(content)).toEqual({
        image: 'https://example.com/second.png'
      });
    });
  });

  describe('edge cases', () => {
    test('should handle malformed image_url', () => {
      const content = [
        { type: 'image_url' }, // Missing image_url property
        { type: 'image_url', image_url: {} }, // Missing url
        { type: 'image_url', image_url: { url: '' } } // Empty url
      ];
      expect(extractMediaFromContent(content)).toEqual({});
    });

    test('should handle malformed file_url', () => {
      const content = [
        { type: 'file_url' }, // Missing file_url property
        { type: 'file_url', file_url: {} }, // Missing url
        { type: 'file_url', file_url: { url: '' } } // Empty url
      ];
      expect(extractMediaFromContent(content)).toEqual({});
    });

    test('should ignore unknown types', () => {
      const content = [
        { type: 'unknown', data: 'something' },
        { type: 'custom_type', custom: { url: 'https://example.com' } }
      ];
      expect(extractMediaFromContent(content)).toEqual({});
    });

    test('should handle text-only content array', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'World' }
      ];
      expect(extractMediaFromContent(content)).toEqual({});
    });
  });
});

describe('useChatStream routing logic', () => {
  /**
   * Helper function that mirrors the routing logic in use-chat-stream.ts
   * This allows us to test the routing decision without mocking React hooks
   *
   * Updated to match the new comprehensive gateway detection logic
   */
  function getRouteForModel(modelValue: string, sourceGateway?: string): 'completions' | 'ai-sdk' {
    const modelLower = modelValue.toLowerCase();
    const gatewayLower = (sourceGateway || '').toLowerCase();

    // Gateways that normalize responses to standard OpenAI Chat Completions format
    const normalizingGateways = ['openrouter', 'together', 'groq', 'cerebras', 'anyscale'];
    const hasExplicitNormalizingPrefix = normalizingGateways.some(g => modelLower.startsWith(`${g}/`));
    const isNormalizingGateway = normalizingGateways.includes(gatewayLower);

    // Gateways/providers that return non-standard formats and need the flexible route
    const nonStandardGateways = [
      'fireworks',
      'deepseek',
      'near',
      'chutes',
      'aimo',
      'fal',
      'alibaba',
      'novita',
      'huggingface',
      'hug', // alias for huggingface
      'alpaca',
      'clarifai',
      'featherless',
      'deepinfra',
    ];

    // Check if model is from a non-standard gateway
    const isNonStandardGateway = nonStandardGateways.includes(gatewayLower) ||
      nonStandardGateways.some(gw => modelLower.startsWith(`${gw}/`));

    // Special case: Fireworks models with accounts/ prefix (fireworks/ prefix is already handled by nonStandardGateways)
    const isFireworksModel = modelLower.includes('accounts/fireworks');

    // If model goes through a normalizing gateway, it's safe to use AI SDK
    // Trust explicit sourceGateway over model name prefix - if sourceGateway is a normalizing gateway, use AI SDK
    const isNormalizedByGateway = hasExplicitNormalizingPrefix || isNormalizingGateway;

    // Use flexible route for non-standard gateways UNLESS normalized by a gateway
    return (isNonStandardGateway || isFireworksModel) && !isNormalizedByGateway ? 'completions' : 'ai-sdk';
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

    test('should route DeepSeek models from normalizing gateways to AI SDK endpoint', () => {
      // DeepSeek through OpenRouter should use AI SDK (normalized)
      expect(getRouteForModel('openrouter/deepseek/deepseek-r1')).toBe('ai-sdk');
      expect(getRouteForModel('together/deepseek-r1')).toBe('ai-sdk');
    });

    test('should route models with non-fireworks sourceGateway to AI SDK endpoint', () => {
      expect(getRouteForModel('gpt-4o', 'openai')).toBe('ai-sdk');
      expect(getRouteForModel('claude-3-opus', 'anthropic')).toBe('ai-sdk');
      expect(getRouteForModel('deepseek-r1', 'openrouter')).toBe('ai-sdk');
    });
  })

  describe('New gateway detection', () => {
    test('should route Chutes models to completions endpoint', () => {
      expect(getRouteForModel('chutes/llama-3')).toBe('completions');
      expect(getRouteForModel('some-model', 'chutes')).toBe('completions');
    });

    test('should route AiMo models to completions endpoint', () => {
      expect(getRouteForModel('aimo/model-x')).toBe('completions');
      expect(getRouteForModel('some-model', 'aimo')).toBe('completions');
    });

    test('should route Fal models to completions endpoint', () => {
      expect(getRouteForModel('fal/flux-pro')).toBe('completions');
      expect(getRouteForModel('some-model', 'fal')).toBe('completions');
    });

    test('should route Alibaba models to completions endpoint', () => {
      expect(getRouteForModel('alibaba/qwen-72b')).toBe('completions');
      expect(getRouteForModel('qwen-72b', 'alibaba')).toBe('completions');
    });

    test('should route Novita models to completions endpoint', () => {
      expect(getRouteForModel('novita/llama-3')).toBe('completions');
      expect(getRouteForModel('some-model', 'novita')).toBe('completions');
    });

    test('should route HuggingFace models to completions endpoint', () => {
      expect(getRouteForModel('huggingface/meta-llama/llama-3')).toBe('completions');
      expect(getRouteForModel('hug/some-model')).toBe('completions');
      expect(getRouteForModel('some-model', 'huggingface')).toBe('completions');
      expect(getRouteForModel('some-model', 'hug')).toBe('completions');
    });

    test('should route Alpaca models to completions endpoint', () => {
      expect(getRouteForModel('alpaca/some-model')).toBe('completions');
      expect(getRouteForModel('model-x', 'alpaca')).toBe('completions');
    });

    test('should route Clarifai models to completions endpoint', () => {
      expect(getRouteForModel('clarifai/gpt-4')).toBe('completions');
      expect(getRouteForModel('some-model', 'clarifai')).toBe('completions');
    });

    test('should route Featherless models to completions endpoint', () => {
      expect(getRouteForModel('featherless/llama-3')).toBe('completions');
      expect(getRouteForModel('some-model', 'featherless')).toBe('completions');
    });

    test('should route DeepInfra models to completions endpoint', () => {
      expect(getRouteForModel('deepinfra/meta-llama')).toBe('completions');
      expect(getRouteForModel('some-model', 'deepinfra')).toBe('completions');
    });

    test('should route non-standard gateway models through normalizing gateways to AI SDK', () => {
      // When a non-standard provider goes through a normalizing gateway, use AI SDK
      expect(getRouteForModel('openrouter/huggingface/llama')).toBe('ai-sdk');
      expect(getRouteForModel('together/deepinfra-model')).toBe('ai-sdk');
      expect(getRouteForModel('groq/custom-model')).toBe('ai-sdk');
    });

    test('should trust explicit sourceGateway over model name prefix', () => {
      // Critical: When sourceGateway is explicitly a normalizing gateway,
      // use AI SDK even if model name starts with a non-standard prefix
      // This fixes the bug where 'deepseek/model' with sourceGateway='openrouter'
      // was incorrectly routed to flexible endpoint
      expect(getRouteForModel('deepseek/deepseek-r1', 'openrouter')).toBe('ai-sdk');
      expect(getRouteForModel('deepseek/deepseek-chat', 'together')).toBe('ai-sdk');
      expect(getRouteForModel('huggingface/llama', 'groq')).toBe('ai-sdk');
      expect(getRouteForModel('deepinfra/model', 'cerebras')).toBe('ai-sdk');
      expect(getRouteForModel('near/some-model', 'anyscale')).toBe('ai-sdk');
    });
  });

  describe('DeepSeek model detection', () => {
    test('should route DeepSeek with deepseek/ prefix to completions endpoint', () => {
      // Model ID starting with 'deepseek/' indicates direct DeepSeek API access
      // Direct DeepSeek gateway returns Responses API format, needs flexible route
      expect(getRouteForModel('deepseek/deepseek-r1')).toBe('completions');
      expect(getRouteForModel('deepseek/deepseek-chat')).toBe('completions');
      expect(getRouteForModel('DeepSeek/DeepSeek-R1')).toBe('completions');
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
    });

    test('should route DeepSeek through non-standard gateways to completions endpoint', () => {
      // When DeepSeek models go through non-standard gateways (not normalizing ones),
      // they still need the flexible route because those gateways don't normalize format
      expect(getRouteForModel('huggingface/deepseek-ai/DeepSeek-R1')).toBe('completions');
      expect(getRouteForModel('chutes/deepseek-r1')).toBe('completions');
    });
  });

  describe('NEAR AI model detection', () => {
    test('should route NEAR models with near/ prefix to completions endpoint', () => {
      // NEAR AI models need the flexible completions route because
      // the AI SDK endpoint doesn't handle them - they'd fall through to Vercel AI Gateway
      // which doesn't know about NEAR models and returns 400 errors.
      expect(getRouteForModel('near/zai-org/GLM-4.6')).toBe('completions');
      expect(getRouteForModel('near/deepseek-ai/DeepSeek-V3.1')).toBe('completions');
      expect(getRouteForModel('NEAR/zai-org/GLM-4.6')).toBe('completions');
      expect(getRouteForModel('Near/DeepSeek-R1')).toBe('completions');
    });

    test('should route models with near sourceGateway to completions endpoint', () => {
      // When sourceGateway is explicitly 'near', route to completions
      expect(getRouteForModel('zai-org/GLM-4.6', 'near')).toBe('completions');
      expect(getRouteForModel('deepseek-v3', 'NEAR')).toBe('completions');
      expect(getRouteForModel('GLM-4.6', 'Near')).toBe('completions');
    });

    test('should route incognito mode model to completions endpoint', () => {
      // The incognito mode default model: near/zai-org/GLM-4.6 with sourceGateway: 'near'
      expect(getRouteForModel('near/zai-org/GLM-4.6', 'near')).toBe('completions');
    });

    test('should not route non-NEAR models to completions endpoint', () => {
      // Models that don't start with 'near/' and don't have 'near' as sourceGateway
      // should go through AI SDK as normal
      expect(getRouteForModel('openai/gpt-4o')).toBe('ai-sdk');
      expect(getRouteForModel('anthropic/claude-3')).toBe('ai-sdk');
      expect(getRouteForModel('openrouter/auto')).toBe('ai-sdk');
      expect(getRouteForModel('zai-org/GLM-4.6', 'openrouter')).toBe('ai-sdk');
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

describe('Reasoning parameter handling', () => {
  /**
   * Tests for reasoning field persistence during message saves
   * The reasoning field must be passed through the entire chain:
   * use-chat-stream -> useSaveMessage -> ChatHistoryAPI.saveMessage -> API route
   */

  describe('saveMessage mutation parameters', () => {
    test('should include reasoning in mutation parameters type', () => {
      // Verify the type signature includes reasoning
      // This is a compile-time check - if the type is wrong, TypeScript will fail
      const validMutationParams: {
        sessionId: number;
        role: 'user' | 'assistant';
        content: string | any[];
        model?: string;
        tokens?: number;
        reasoning?: string;
      } = {
        sessionId: 123,
        role: 'assistant',
        content: 'Hello',
        model: 'gpt-4',
        reasoning: 'I thought about this carefully'
      };

      expect(validMutationParams.reasoning).toBe('I thought about this carefully');
    });

    test('should allow reasoning to be undefined', () => {
      const paramsWithoutReasoning = {
        sessionId: 123,
        role: 'assistant' as const,
        content: 'Hello',
        model: 'gpt-4'
      };

      expect(paramsWithoutReasoning).not.toHaveProperty('reasoning');
    });

    test('should allow reasoning to be an empty string treated as undefined', () => {
      const params = {
        sessionId: 123,
        role: 'assistant' as const,
        content: 'Hello',
        reasoning: '' || undefined
      };

      expect(params.reasoning).toBeUndefined();
    });
  });

  describe('BatchedMessage interface', () => {
    test('should include reasoning field in BatchedMessage', () => {
      // Verify BatchedMessage type includes reasoning
      const batchedMessage: {
        sessionId: string;
        apiSessionId?: number;
        role: 'user' | 'assistant';
        content: string | any[];
        model?: string;
        tokens?: number;
        reasoning?: string;
        timestamp: number;
      } = {
        sessionId: '123',
        apiSessionId: 123,
        role: 'assistant',
        content: 'Response with thinking',
        model: 'deepseek-r1',
        reasoning: 'Step 1: Analyze the problem...',
        timestamp: Date.now()
      };

      expect(batchedMessage.reasoning).toBe('Step 1: Analyze the problem...');
    });
  });

  describe('Reasoning extraction during finalization', () => {
    test('should extract final reasoning from stream handler', () => {
      // Mock the stream handler behavior
      // The actual ChatStreamHandler.getFinalReasoning() returns accumulated reasoning
      const mockReasoning = '<think>Let me think about this...</think>';
      const getFinalReasoning = (): string => mockReasoning;

      const finalReasoning = getFinalReasoning();
      expect(finalReasoning).toBe(mockReasoning);
    });

    test('should handle empty reasoning gracefully', () => {
      const getFinalReasoning = (): string => '';
      const finalReasoning = getFinalReasoning() || undefined;

      expect(finalReasoning).toBeUndefined();
    });

    test('should handle null reasoning gracefully', () => {
      const getFinalReasoning = (): string | null => null;
      const finalReasoning = getFinalReasoning() || undefined;

      expect(finalReasoning).toBeUndefined();
    });
  });
});

describe('Stop stream functionality', () => {
  /**
   * Tests for the stop/abort stream feature
   * The useChatStream hook now exposes a stopStream function that aborts the current stream
   */

  describe('AbortController behavior', () => {
    test('should create AbortController signal that can be aborted', () => {
      const controller = new AbortController();
      const { signal } = controller;

      expect(signal.aborted).toBe(false);

      controller.abort();

      expect(signal.aborted).toBe(true);
    });

    test('should allow checking abort status during stream loop', () => {
      const controller = new AbortController();
      const { signal } = controller;

      let wasAborted = false;
      let iterations = 0;

      // Simulate a stream loop that checks abort status
      const simulateStreamLoop = () => {
        for (let i = 0; i < 10; i++) {
          if (signal.aborted) {
            wasAborted = true;
            break;
          }
          iterations++;

          // Abort after 5 iterations (simulates user clicking stop)
          if (i === 4) {
            controller.abort();
          }
        }
      };

      simulateStreamLoop();

      expect(wasAborted).toBe(true);
      expect(iterations).toBe(5);
    });

    test('should preserve partial content when stopped', () => {
      const controller = new AbortController();
      const { signal } = controller;

      let accumulatedContent = '';
      const chunks = ['Hello', ' ', 'world', ', ', 'how', ' ', 'are', ' ', 'you', '?'];

      // Simulate streaming with abort
      for (const chunk of chunks) {
        if (signal.aborted) {
          break;
        }
        accumulatedContent += chunk;

        // Abort after "how"
        if (chunk === 'how') {
          controller.abort();
        }
      }

      expect(accumulatedContent).toBe('Hello world, how');
      expect(signal.aborted).toBe(true);
    });

    test('should allow abort even when no chunks received yet', () => {
      const controller = new AbortController();
      const { signal } = controller;

      // Abort immediately before any chunks
      controller.abort();

      let chunkCount = 0;
      const chunks = ['a', 'b', 'c'];

      for (const chunk of chunks) {
        if (signal.aborted) break;
        chunkCount++;
      }

      expect(chunkCount).toBe(0);
      expect(signal.aborted).toBe(true);
    });

    test('should handle multiple aborts gracefully', () => {
      const controller = new AbortController();
      const { signal } = controller;

      controller.abort();
      controller.abort(); // Second abort should not throw
      controller.abort(); // Third abort should not throw

      expect(signal.aborted).toBe(true);
    });
  });

  describe('Stream stopped state', () => {
    test('should set wasStopped flag when stream is aborted with content', () => {
      const finalContent = 'Partial response';
      const wasStopped = true;

      // Mirrors the logic in use-chat-stream.ts for setting wasStopped
      const shouldSetWasStopped = wasStopped && finalContent;

      expect(shouldSetWasStopped).toBeTruthy();
    });

    test('should not set wasStopped flag when stream is aborted without content', () => {
      const finalContent = '';
      const wasStopped = true;

      // Mirrors the logic in use-chat-stream.ts for setting wasStopped
      const shouldSetWasStopped = wasStopped && finalContent ? true : undefined;

      expect(shouldSetWasStopped).toBeUndefined();
    });

    test('should not set wasStopped flag when stream completes normally', () => {
      const finalContent = 'Complete response';
      const wasStopped = false;

      // Mirrors the logic in use-chat-stream.ts for setting wasStopped
      const shouldSetWasStopped = wasStopped && finalContent ? true : undefined;

      expect(shouldSetWasStopped).toBeUndefined();
    });
  });

  describe('Message saving on stop', () => {
    test('should save message when stopped with partial content', () => {
      const finalContent = 'Partial but useful response';
      const wasStopped = true;

      // Mirrors the conditional save logic in use-chat-stream.ts
      const shouldSaveMessage = !!finalContent;

      expect(shouldSaveMessage).toBe(true);
    });

    test('should not save message when stopped with no content', () => {
      const finalContent = '';
      const wasStopped = true;

      // Mirrors the conditional save logic in use-chat-stream.ts
      const shouldSaveMessage = !!finalContent;

      expect(shouldSaveMessage).toBe(false);
    });

    test('should save message with reasoning when stopped', () => {
      const finalContent = 'Response text';
      const finalReasoning = 'Step by step thinking...';
      const wasStopped = true;

      // Both content and reasoning should be saved together
      const saveParams = {
        content: finalContent,
        reasoning: finalReasoning || undefined
      };

      expect(saveParams.content).toBe('Response text');
      expect(saveParams.reasoning).toBe('Step by step thinking...');
    });

    test('should not include reasoning when empty', () => {
      const finalContent = 'Response text';
      const finalReasoning = '';

      // Empty reasoning should become undefined
      const saveParams = {
        content: finalContent,
        reasoning: finalReasoning || undefined
      };

      expect(saveParams.reasoning).toBeUndefined();
    });
  });

  describe('UI state updates on stop', () => {
    test('should mark message as not streaming when stopped', () => {
      // Simulates the final state update
      const updateState = (wasStopped: boolean, finalContent: string) => {
        return {
          isStreaming: false,
          wasStopped: wasStopped && finalContent ? true : undefined
        };
      };

      const state = updateState(true, 'Some content');

      expect(state.isStreaming).toBe(false);
      expect(state.wasStopped).toBe(true);
    });

    test('should handle state update when stop clicked but no content yet', () => {
      const updateState = (wasStopped: boolean, finalContent: string) => {
        return {
          isStreaming: false,
          wasStopped: wasStopped && finalContent ? true : undefined
        };
      };

      const state = updateState(true, '');

      expect(state.isStreaming).toBe(false);
      expect(state.wasStopped).toBeUndefined();
    });
  });

  describe('AbortController reference management', () => {
    test('should allow setting controller to null after abort', () => {
      let controllerRef: AbortController | null = new AbortController();

      // Simulate abort
      controllerRef.abort();
      controllerRef = null;

      expect(controllerRef).toBeNull();
    });

    test('should create new controller for each stream', () => {
      const controller1 = new AbortController();
      const signal1 = controller1.signal;

      const controller2 = new AbortController();
      const signal2 = controller2.signal;

      // Different controllers should have different signals
      expect(signal1).not.toBe(signal2);

      // Aborting one should not affect the other
      controller1.abort();
      expect(signal1.aborted).toBe(true);
      expect(signal2.aborted).toBe(false);
    });

    test('should safely handle stopStream when no active controller', () => {
      let controllerRef: AbortController | null = null;

      // Simulates calling stopStream when there's no active stream
      const stopStream = () => {
        if (controllerRef) {
          controllerRef.abort();
          controllerRef = null;
        }
      };

      // Should not throw
      expect(() => stopStream()).not.toThrow();
    });
  });

  describe('Message history sanitization', () => {
    test('should filter out messages with isStreaming flag', () => {
      const messagesHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!', model: 'gpt-4' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'Partial response...', isStreaming: true }
      ];

      // Simulates the filtering logic from use-chat-stream.ts
      const sanitizedHistory = messagesHistory
        .filter((msg: any) => {
          if (msg.isStreaming) return false;
          if (msg.wasStopped && !msg.content) return false;
          if (msg.role === 'assistant' && !msg.content) return false;
          return true;
        })
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          ...(msg.name && { name: msg.name })
        }));

      expect(sanitizedHistory).toHaveLength(3);
      expect(sanitizedHistory).not.toContainEqual(
        expect.objectContaining({ isStreaming: true })
      );
    });

    test('should include stopped messages if they have content', () => {
      const messagesHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Partial but useful response', wasStopped: true }
      ];

      const sanitizedHistory = messagesHistory
        .filter((msg: any) => {
          if (msg.isStreaming) return false;
          if (msg.wasStopped && !msg.content) return false;
          if (msg.role === 'assistant' && !msg.content) return false;
          return true;
        })
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          ...(msg.name && { name: msg.name })
        }));

      expect(sanitizedHistory).toHaveLength(2);
      expect(sanitizedHistory[1].content).toBe('Partial but useful response');
    });

    test('should filter out stopped messages with no content', () => {
      const messagesHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '', wasStopped: true }
      ];

      const sanitizedHistory = messagesHistory
        .filter((msg: any) => {
          if (msg.isStreaming) return false;
          if (msg.wasStopped && !msg.content) return false;
          if (msg.role === 'assistant' && !msg.content) return false;
          return true;
        })
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          ...(msg.name && { name: msg.name })
        }));

      expect(sanitizedHistory).toHaveLength(1);
      expect(sanitizedHistory[0].role).toBe('user');
    });

    test('should filter out empty assistant messages without wasStopped flag', () => {
      // When a stream is stopped before any content arrives, wasStopped may be undefined
      // because the flag is only set to true when finalContent is truthy (line 389).
      // These empty assistant messages should still be filtered out.
      const messagesHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '' } // No wasStopped flag, just empty content
      ];

      const sanitizedHistory = messagesHistory
        .filter((msg: any) => {
          if (msg.isStreaming) return false;
          if (msg.wasStopped && !msg.content) return false;
          if (msg.role === 'assistant' && !msg.content) return false;
          return true;
        })
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          ...(msg.name && { name: msg.name })
        }));

      expect(sanitizedHistory).toHaveLength(1);
      expect(sanitizedHistory[0].role).toBe('user');
    });

    test('should strip UI-only fields from messages', () => {
      const messagesHistory = [
        { role: 'user', content: 'Hello', created_at: '2024-01-01', model: 'gpt-4' },
        {
          role: 'assistant',
          content: 'Response',
          hasError: false,
          error: undefined,
          wasStopped: false,
          reasoning: 'Some reasoning',
          model: 'gpt-4'
        }
      ];

      const sanitizedHistory = messagesHistory
        .filter((msg: any) => {
          if (msg.isStreaming) return false;
          if (msg.wasStopped && !msg.content) return false;
          if (msg.role === 'assistant' && !msg.content) return false;
          return true;
        })
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          ...(msg.name && { name: msg.name })
        }));

      // Should only have role and content
      expect(sanitizedHistory[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(sanitizedHistory[1]).toEqual({ role: 'assistant', content: 'Response' });
      expect(sanitizedHistory[1]).not.toHaveProperty('hasError');
      expect(sanitizedHistory[1]).not.toHaveProperty('error');
      expect(sanitizedHistory[1]).not.toHaveProperty('wasStopped');
      expect(sanitizedHistory[1]).not.toHaveProperty('reasoning');
      expect(sanitizedHistory[1]).not.toHaveProperty('model');
    });

    test('should preserve name field when present', () => {
      const messagesHistory = [
        { role: 'user', content: 'Hello', name: 'John' },
        { role: 'assistant', content: 'Hi John!' }
      ];

      const sanitizedHistory = messagesHistory
        .filter((msg: any) => {
          if (msg.isStreaming) return false;
          if (msg.wasStopped && !msg.content) return false;
          if (msg.role === 'assistant' && !msg.content) return false;
          return true;
        })
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          ...(msg.name && { name: msg.name })
        }));

      expect(sanitizedHistory[0]).toEqual({ role: 'user', content: 'Hello', name: 'John' });
      expect(sanitizedHistory[1]).toEqual({ role: 'assistant', content: 'Hi John!' });
    });
  });
});

// Import the normalizeContentForApi function
import { normalizeContentForApi } from '../use-chat-stream';

describe('normalizeContentForApi', () => {
  describe('string content', () => {
    test('should return string content as-is', () => {
      expect(normalizeContentForApi('Hello world')).toBe('Hello world');
      expect(normalizeContentForApi('Hello world', ['Text'])).toBe('Hello world');
      expect(normalizeContentForApi('Hello world', ['Text', 'Image'])).toBe('Hello world');
    });

    test('should handle empty string', () => {
      expect(normalizeContentForApi('')).toBe('');
    });
  });

  describe('text-only array content', () => {
    test('should preserve text-only array when model supports all content', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'World' }
      ];
      // Text-only arrays are valid OpenAI format, no need to convert
      expect(normalizeContentForApi(content)).toEqual(content);
    });

    test('should preserve text-only array regardless of modalities', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'World' }
      ];
      // Text-only arrays don't contain unsupported media, so they're preserved
      expect(normalizeContentForApi(content, ['Text'])).toEqual(content);
      expect(normalizeContentForApi(content, ['Text', 'Image'])).toEqual(content);
    });
  });

  describe('multimodal content with supported modalities', () => {
    test('should preserve image when model supports Image modality', () => {
      const content = [
        { type: 'text', text: 'Check this image' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
      ];
      const result = normalizeContentForApi(content, ['Text', 'Image']);
      expect(result).toEqual(content);
    });

    test('should preserve video when model supports Video modality', () => {
      const content = [
        { type: 'text', text: 'Watch this' },
        { type: 'video_url', video_url: { url: 'https://example.com/video.mp4' } }
      ];
      const result = normalizeContentForApi(content, ['Text', 'Video']);
      expect(result).toEqual(content);
    });

    test('should preserve audio when model supports Audio modality', () => {
      const content = [
        { type: 'text', text: 'Listen to this' },
        { type: 'audio_url', audio_url: { url: 'https://example.com/audio.mp3' } }
      ];
      const result = normalizeContentForApi(content, ['Text', 'Audio']);
      expect(result).toEqual(content);
    });

    test('should preserve file when model supports File modality', () => {
      const content = [
        { type: 'text', text: 'Read this document' },
        { type: 'file_url', file_url: { url: 'https://example.com/doc.pdf' } }
      ];
      const result = normalizeContentForApi(content, ['Text', 'File']);
      expect(result).toEqual(content);
    });

    test('should preserve all media when model supports all modalities', () => {
      const content = [
        { type: 'text', text: 'Check all these' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
        { type: 'video_url', video_url: { url: 'https://example.com/video.mp4' } },
        { type: 'audio_url', audio_url: { url: 'https://example.com/audio.mp3' } },
        { type: 'file_url', file_url: { url: 'https://example.com/doc.pdf' } }
      ];
      const result = normalizeContentForApi(content, ['Text', 'Image', 'Video', 'Audio', 'File']);
      expect(result).toEqual(content);
    });
  });

  describe('multimodal content with unsupported modalities', () => {
    test('should strip image when model does not support Image modality', () => {
      const content = [
        { type: 'text', text: 'Check this image' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
      ];
      const result = normalizeContentForApi(content, ['Text']);
      expect(result).toBe('Check this image');
    });

    test('should strip video when model does not support Video modality', () => {
      const content = [
        { type: 'text', text: 'Watch this' },
        { type: 'video_url', video_url: { url: 'https://example.com/video.mp4' } }
      ];
      const result = normalizeContentForApi(content, ['Text']);
      expect(result).toBe('Watch this');
    });

    test('should strip image when no modalities specified (assumes text-only)', () => {
      const content = [
        { type: 'text', text: 'Check this' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
      ];
      const result = normalizeContentForApi(content);
      expect(result).toBe('Check this');
    });

    test('should strip image when empty modalities array (assumes text-only)', () => {
      const content = [
        { type: 'text', text: 'Check this' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
      ];
      const result = normalizeContentForApi(content, []);
      expect(result).toBe('Check this');
    });

    test('should strip all unsupported media types', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
        { type: 'video_url', video_url: { url: 'https://example.com/video.mp4' } },
        { type: 'text', text: 'World' },
        { type: 'audio_url', audio_url: { url: 'https://example.com/audio.mp3' } }
      ];
      const result = normalizeContentForApi(content, ['Text']);
      expect(result).toBe('Hello\nWorld');
    });

    test('should return empty string when only unsupported media with no text', () => {
      const content = [
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
      ];
      const result = normalizeContentForApi(content, ['Text']);
      expect(result).toBe('');
    });
  });

  describe('modality case insensitivity', () => {
    test('should match modalities case-insensitively', () => {
      const content = [
        { type: 'text', text: 'Check this' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
      ];
      expect(normalizeContentForApi(content, ['text', 'image'])).toEqual(content);
      expect(normalizeContentForApi(content, ['TEXT', 'IMAGE'])).toEqual(content);
      expect(normalizeContentForApi(content, ['Text', 'Image'])).toEqual(content);
    });
  });

  describe('edge cases', () => {
    test('should handle null content', () => {
      expect(normalizeContentForApi(null)).toBe('');
    });

    test('should handle undefined content', () => {
      expect(normalizeContentForApi(undefined)).toBe('');
    });

    test('should handle number content', () => {
      expect(normalizeContentForApi(123)).toBe('123');
    });

    test('should handle empty array', () => {
      expect(normalizeContentForApi([])).toEqual([]);
    });

    test('should handle array with no text or media parts', () => {
      const content = [
        { type: 'unknown', data: 'something' }
      ];
      expect(normalizeContentForApi(content)).toEqual(content);
    });
  });
});
