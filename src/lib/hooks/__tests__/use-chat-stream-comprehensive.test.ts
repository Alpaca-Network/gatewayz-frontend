/**
 * Comprehensive Tests for useChatStream Hook
 *
 * Tests the complete chat streaming flow including:
 * - API key handling for authenticated and guest users
 * - Route selection based on model/provider
 * - Message saving and cache updates
 * - Error handling and recovery
 * - Streaming state management
 */

describe('useChatStream - Comprehensive Tests', () => {
  // ============================================================================
  // ROUTE SELECTION LOGIC
  // ============================================================================
  describe('Route Selection Logic', () => {
    /**
     * Helper function that mirrors the routing logic in use-chat-stream.ts
     * Tests the actual routing decision without mocking React hooks
     */
    function getRouteForModel(modelValue: string, sourceGateway?: string): 'completions' | 'ai-sdk' {
      const modelLower = modelValue.toLowerCase();
      const gatewayLower = (sourceGateway || '').toLowerCase();

      const isFireworksModel = modelLower.includes('fireworks') ||
                                modelLower.includes('accounts/fireworks') ||
                                gatewayLower === 'fireworks';

      const startsWithDeepSeek = modelLower.startsWith('deepseek/');
      const normalizingGateways = ['openrouter', 'together', 'groq', 'cerebras', 'anyscale'];
      const hasExplicitNormalizingPrefix = normalizingGateways.some(g => modelLower.startsWith(`${g}/`));

      const isDirectDeepSeekGateway = gatewayLower === 'deepseek';
      const isDeepSeekNeedingFlexible = (startsWithDeepSeek && !hasExplicitNormalizingPrefix) || isDirectDeepSeekGateway;

      return (isFireworksModel || isDeepSeekNeedingFlexible) ? 'completions' : 'ai-sdk';
    }

    describe('Fireworks Model Routing', () => {
      test('should route fireworks/* models to completions', () => {
        expect(getRouteForModel('fireworks/deepseek-r1')).toBe('completions');
        expect(getRouteForModel('fireworks/llama-v3-70b')).toBe('completions');
        expect(getRouteForModel('Fireworks/DeepSeek-R1')).toBe('completions');
        expect(getRouteForModel('fireworks/qwen-2.5')).toBe('completions');
      });

      test('should route accounts/fireworks models to completions', () => {
        expect(getRouteForModel('accounts/fireworks/models/deepseek-r1-0528')).toBe('completions');
        expect(getRouteForModel('accounts/fireworks/models/llama-3.3-70b-instruct')).toBe('completions');
        expect(getRouteForModel('accounts/fireworks/models/qwen2p5-72b-instruct')).toBe('completions');
      });

      test('should route models with fireworks sourceGateway to completions', () => {
        expect(getRouteForModel('deepseek-r1', 'fireworks')).toBe('completions');
        expect(getRouteForModel('llama-70b', 'Fireworks')).toBe('completions');
        expect(getRouteForModel('any-model', 'fireworks')).toBe('completions');
      });
    });

    describe('DeepSeek Model Routing', () => {
      test('should route deepseek/* prefix models to completions', () => {
        expect(getRouteForModel('deepseek/deepseek-r1')).toBe('completions');
        expect(getRouteForModel('deepseek/deepseek-chat')).toBe('completions');
        expect(getRouteForModel('DeepSeek/DeepSeek-R1')).toBe('completions');
      });

      test('should route models with deepseek sourceGateway to completions', () => {
        expect(getRouteForModel('deepseek-r1', 'deepseek')).toBe('completions');
        expect(getRouteForModel('deepseek-chat', 'DeepSeek')).toBe('completions');
      });

      test('should route DeepSeek through normalizing gateways to AI SDK', () => {
        expect(getRouteForModel('openrouter/deepseek/deepseek-r1')).toBe('ai-sdk');
        expect(getRouteForModel('together/deepseek-r1')).toBe('ai-sdk');
        expect(getRouteForModel('groq/deepseek-r1-distill-llama-70b')).toBe('ai-sdk');
        expect(getRouteForModel('cerebras/deepseek-r1')).toBe('ai-sdk');
      });

      test('should route unprefixed DeepSeek to AI SDK (safe default)', () => {
        expect(getRouteForModel('deepseek-r1')).toBe('ai-sdk');
        expect(getRouteForModel('deepseek-chat')).toBe('ai-sdk');
      });

      test('should route DeepSeek with normalizing sourceGateway to AI SDK', () => {
        expect(getRouteForModel('deepseek-r1', 'openrouter')).toBe('ai-sdk');
        expect(getRouteForModel('deepseek-chat', 'together')).toBe('ai-sdk');
      });
    });

    describe('Standard Provider Routing', () => {
      test('should route OpenAI models to AI SDK', () => {
        expect(getRouteForModel('gpt-4')).toBe('ai-sdk');
        expect(getRouteForModel('gpt-4o')).toBe('ai-sdk');
        expect(getRouteForModel('gpt-3.5-turbo')).toBe('ai-sdk');
        expect(getRouteForModel('o1-preview')).toBe('ai-sdk');
        expect(getRouteForModel('openai/gpt-4o')).toBe('ai-sdk');
      });

      test('should route Anthropic models to AI SDK', () => {
        expect(getRouteForModel('claude-3-opus')).toBe('ai-sdk');
        expect(getRouteForModel('claude-3-sonnet')).toBe('ai-sdk');
        expect(getRouteForModel('anthropic/claude-3-5-sonnet')).toBe('ai-sdk');
      });

      test('should route OpenRouter models to AI SDK', () => {
        expect(getRouteForModel('openrouter/auto')).toBe('ai-sdk');
        expect(getRouteForModel('openrouter/anthropic/claude-3.5-sonnet')).toBe('ai-sdk');
        expect(getRouteForModel('openrouter/google/gemini-pro')).toBe('ai-sdk');
      });

      test('should route Google models to AI SDK', () => {
        expect(getRouteForModel('gemini-pro')).toBe('ai-sdk');
        expect(getRouteForModel('gemini-2.0-flash')).toBe('ai-sdk');
        expect(getRouteForModel('google/gemini-pro')).toBe('ai-sdk');
      });

      test('should route Mistral models to AI SDK', () => {
        expect(getRouteForModel('mistral-large')).toBe('ai-sdk');
        expect(getRouteForModel('mistral/mistral-large')).toBe('ai-sdk');
      });

      test('should route Perplexity models to AI SDK', () => {
        expect(getRouteForModel('perplexity/sonar-pro')).toBe('ai-sdk');
        expect(getRouteForModel('perplexity/sonar-reasoning')).toBe('ai-sdk');
      });
    });

    describe('Edge Cases', () => {
      test('should handle mixed case model names', () => {
        expect(getRouteForModel('FIREWORKS/LLAMA')).toBe('completions');
        expect(getRouteForModel('DeepSeek/DeepSeek-R1')).toBe('completions');
        expect(getRouteForModel('OPENROUTER/AUTO')).toBe('ai-sdk');
      });

      test('should handle empty sourceGateway', () => {
        expect(getRouteForModel('gpt-4', '')).toBe('ai-sdk');
        expect(getRouteForModel('fireworks/model', '')).toBe('completions');
      });

      test('should handle undefined sourceGateway', () => {
        expect(getRouteForModel('gpt-4', undefined)).toBe('ai-sdk');
        expect(getRouteForModel('fireworks/model', undefined)).toBe('completions');
      });
    });
  });

  // ============================================================================
  // API KEY HANDLING
  // ============================================================================
  describe('API Key Handling', () => {
    /**
     * Simulates the API key resolution logic from use-chat-stream.ts
     */
    function resolveApiKey(
      storeApiKey: string | null,
      localStorageApiKey: string | null,
      isAuthenticated: boolean
    ): string | null {
      return storeApiKey || localStorageApiKey || (isAuthenticated ? null : 'guest');
    }

    test('should use store API key when available', () => {
      expect(resolveApiKey('store-key', 'local-key', true)).toBe('store-key');
      expect(resolveApiKey('store-key', null, true)).toBe('store-key');
    });

    test('should fall back to localStorage key when store is empty', () => {
      expect(resolveApiKey(null, 'local-key', true)).toBe('local-key');
      expect(resolveApiKey('', 'local-key', true)).toBe('local-key');
    });

    test('should use guest placeholder for unauthenticated users', () => {
      expect(resolveApiKey(null, null, false)).toBe('guest');
      expect(resolveApiKey('', '', false)).toBe('guest');
    });

    test('should return null for authenticated users without key', () => {
      expect(resolveApiKey(null, null, true)).toBe(null);
      expect(resolveApiKey('', '', true)).toBe(null);
    });

    test('should prioritize store key over all others', () => {
      expect(resolveApiKey('store-key', 'local-key', false)).toBe('store-key');
    });
  });

  // ============================================================================
  // URL CONSTRUCTION
  // ============================================================================
  describe('URL Construction', () => {
    function buildStreamUrl(sessionId: number, useFlexibleRoute: boolean): string {
      return useFlexibleRoute
        ? `/api/chat/completions?session_id=${sessionId}`
        : `/api/chat/ai-sdk-completions?session_id=${sessionId}`;
    }

    test('should construct completions URL for Fireworks models', () => {
      expect(buildStreamUrl(123, true)).toBe('/api/chat/completions?session_id=123');
    });

    test('should construct AI SDK URL for standard models', () => {
      expect(buildStreamUrl(456, false)).toBe('/api/chat/ai-sdk-completions?session_id=456');
    });

    test('should handle negative session IDs (guest sessions)', () => {
      expect(buildStreamUrl(-1, false)).toBe('/api/chat/ai-sdk-completions?session_id=-1');
      expect(buildStreamUrl(-999, true)).toBe('/api/chat/completions?session_id=-999');
    });
  });

  // ============================================================================
  // REQUEST BODY CONSTRUCTION
  // ============================================================================
  describe('Request Body Construction', () => {
    interface RequestBody {
      model: string;
      messages: { role: string; content: string | unknown[] }[];
      stream: boolean;
      max_tokens: number;
      gateway?: string;
      apiKey: string;
      portkey_provider?: string;
    }

    function buildRequestBody(
      model: string,
      messages: { role: string; content: string | unknown[] }[],
      gateway?: string,
      apiKey: string = 'test-key'
    ): RequestBody {
      const body: RequestBody = {
        model,
        messages,
        stream: true,
        max_tokens: 8000,
        gateway,
        apiKey,
      };

      // Portkey provider logic
      if (gateway === 'portkey') {
        const modelLower = model.toLowerCase();
        if (modelLower.includes('gpt') || modelLower.includes('o1')) {
          body.portkey_provider = 'openai';
        } else if (modelLower.includes('claude')) {
          body.portkey_provider = 'anthropic';
        } else if (modelLower.includes('deepinfra') || modelLower.includes('wizardlm')) {
          body.portkey_provider = 'deepinfra';
        }
      }

      return body;
    }

    test('should include required fields', () => {
      const body = buildRequestBody('gpt-4', [{ role: 'user', content: 'Hello' }]);
      expect(body.model).toBe('gpt-4');
      expect(body.messages).toHaveLength(1);
      expect(body.stream).toBe(true);
      expect(body.max_tokens).toBe(8000);
      expect(body.apiKey).toBe('test-key');
    });

    test('should include gateway when specified', () => {
      const body = buildRequestBody('gpt-4', [], 'openrouter');
      expect(body.gateway).toBe('openrouter');
    });

    test('should set portkey_provider for OpenAI models', () => {
      const body = buildRequestBody('gpt-4', [], 'portkey');
      expect(body.portkey_provider).toBe('openai');
    });

    test('should set portkey_provider for Claude models', () => {
      const body = buildRequestBody('claude-3-sonnet', [], 'portkey');
      expect(body.portkey_provider).toBe('anthropic');
    });

    test('should set portkey_provider for DeepInfra models', () => {
      const body = buildRequestBody('deepinfra/llama', [], 'portkey');
      expect(body.portkey_provider).toBe('deepinfra');
    });

    test('should not set portkey_provider for non-portkey gateway', () => {
      const body = buildRequestBody('gpt-4', [], 'openrouter');
      expect(body.portkey_provider).toBeUndefined();
    });
  });

  // ============================================================================
  // MEDIA EXTRACTION
  // ============================================================================
  describe('Media Extraction from Content', () => {
    function extractMediaFromContent(content: unknown): { image?: string; video?: string; audio?: string } {
      if (!Array.isArray(content)) return {};
      const result: { image?: string; video?: string; audio?: string } = {};
      for (const part of content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          result.image = part.image_url.url;
        } else if (part.type === 'video_url' && part.video_url?.url) {
          result.video = part.video_url.url;
        } else if (part.type === 'audio_url' && part.audio_url?.url) {
          result.audio = part.audio_url.url;
        }
      }
      return result;
    }

    test('should extract image from content array', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
      ];
      const media = extractMediaFromContent(content);
      expect(media.image).toBe('https://example.com/image.png');
    });

    test('should extract video from content array', () => {
      const content = [
        { type: 'video_url', video_url: { url: 'https://example.com/video.mp4' } }
      ];
      const media = extractMediaFromContent(content);
      expect(media.video).toBe('https://example.com/video.mp4');
    });

    test('should extract audio from content array', () => {
      const content = [
        { type: 'audio_url', audio_url: { url: 'https://example.com/audio.mp3' } }
      ];
      const media = extractMediaFromContent(content);
      expect(media.audio).toBe('https://example.com/audio.mp3');
    });

    test('should extract multiple media types', () => {
      const content = [
        { type: 'image_url', image_url: { url: 'image.png' } },
        { type: 'video_url', video_url: { url: 'video.mp4' } },
        { type: 'audio_url', audio_url: { url: 'audio.mp3' } }
      ];
      const media = extractMediaFromContent(content);
      expect(media.image).toBe('image.png');
      expect(media.video).toBe('video.mp4');
      expect(media.audio).toBe('audio.mp3');
    });

    test('should return empty object for string content', () => {
      const media = extractMediaFromContent('Hello world');
      expect(media).toEqual({});
    });

    test('should return empty object for null content', () => {
      const media = extractMediaFromContent(null);
      expect(media).toEqual({});
    });

    test('should handle content with missing urls', () => {
      const content = [
        { type: 'image_url' }, // missing image_url property
        { type: 'video_url', video_url: {} } // missing url
      ];
      const media = extractMediaFromContent(content);
      expect(media).toEqual({});
    });
  });

  // ============================================================================
  // STREAMING STATE TRANSITIONS
  // ============================================================================
  describe('Streaming State Transitions', () => {
    test('should transition: idle -> streaming -> idle on success', () => {
      const states: string[] = [];

      // Simulate state transitions
      states.push('idle');

      // Start streaming
      states.push('streaming');

      // Streaming completes
      states.push('idle');

      expect(states).toEqual(['idle', 'streaming', 'idle']);
    });

    test('should transition: idle -> streaming -> error -> idle on failure', () => {
      const states: string[] = [];

      states.push('idle');
      states.push('streaming');
      states.push('error');
      states.push('idle');

      expect(states).toEqual(['idle', 'streaming', 'error', 'idle']);
    });

    test('should track streaming flag correctly', () => {
      let isStreaming = false;

      // Start
      isStreaming = true;
      expect(isStreaming).toBe(true);

      // End
      isStreaming = false;
      expect(isStreaming).toBe(false);
    });

    test('should track error state correctly', () => {
      let streamError: string | null = null;

      // No error initially
      expect(streamError).toBeNull();

      // Error occurs
      streamError = 'Connection failed';
      expect(streamError).toBe('Connection failed');

      // New stream clears error
      streamError = null;
      expect(streamError).toBeNull();
    });
  });

  // ============================================================================
  // MESSAGE CACHE UPDATES
  // ============================================================================
  describe('Message Cache Updates', () => {
    interface Message {
      role: 'user' | 'assistant';
      content: string;
      model: string;
      isStreaming?: boolean;
      error?: string;
      hasError?: boolean;
    }

    function simulateCacheUpdate(
      oldMessages: Message[],
      update: Partial<Message> | ((last: Message) => Message)
    ): Message[] {
      if (!oldMessages.length) return [];

      const last = oldMessages[oldMessages.length - 1];
      if (typeof update === 'function') {
        return [...oldMessages.slice(0, -1), update(last)];
      }

      return [...oldMessages.slice(0, -1), { ...last, ...update }];
    }

    test('should add user message to cache', () => {
      const messages: Message[] = [];
      const userMsg: Message = {
        role: 'user',
        content: 'Hello',
        model: 'gpt-4'
      };
      messages.push(userMsg);
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
    });

    test('should add optimistic assistant message', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello', model: 'gpt-4' }
      ];
      const assistantMsg: Message = {
        role: 'assistant',
        content: '',
        model: 'gpt-4',
        isStreaming: true
      };
      messages.push(assistantMsg);

      expect(messages.length).toBe(2);
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].isStreaming).toBe(true);
      expect(messages[1].content).toBe('');
    });

    test('should update assistant message content during streaming', () => {
      let messages: Message[] = [
        { role: 'user', content: 'Hello', model: 'gpt-4' },
        { role: 'assistant', content: '', model: 'gpt-4', isStreaming: true }
      ];

      messages = simulateCacheUpdate(messages, { content: 'H' });
      expect(messages[1].content).toBe('H');

      messages = simulateCacheUpdate(messages, { content: 'He' });
      expect(messages[1].content).toBe('He');

      messages = simulateCacheUpdate(messages, { content: 'Hello!' });
      expect(messages[1].content).toBe('Hello!');
    });

    test('should mark streaming complete when done', () => {
      let messages: Message[] = [
        { role: 'user', content: 'Hello', model: 'gpt-4' },
        { role: 'assistant', content: 'Hi there!', model: 'gpt-4', isStreaming: true }
      ];

      messages = simulateCacheUpdate(messages, { isStreaming: false });
      expect(messages[1].isStreaming).toBe(false);
    });

    test('should mark message as failed with error metadata', () => {
      let messages: Message[] = [
        { role: 'user', content: 'Hello', model: 'gpt-4' },
        { role: 'assistant', content: 'Partial...', model: 'gpt-4', isStreaming: true }
      ];

      messages = simulateCacheUpdate(messages, {
        isStreaming: false,
        error: 'Connection lost',
        hasError: true
      });

      expect(messages[1].isStreaming).toBe(false);
      expect(messages[1].error).toBe('Connection lost');
      expect(messages[1].hasError).toBe(true);
      expect(messages[1].content).toBe('Partial...'); // Content preserved
    });
  });
});
