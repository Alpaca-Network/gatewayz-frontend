/**
 * AI SDK Chat Service
 *
 * Bridges the existing Gatewayz chat system with AI SDK integration
 * Provides a unified interface for sending messages with chain-of-thought support
 */

import type { Message } from '@/app/chat/page';
import { AISDKStreamChunk, parseAISDKStream } from './ai-sdk-gateway';

export interface AISDKChatOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  enableThinking?: boolean;
  apiKey: string;
}

export interface StreamMessage {
  content: string;
  reasoning: string;
  isStreaming: boolean;
  model: string;
}

/**
 * Stream chat completion using AI SDK endpoint
 * Compatible with existing Gatewayz message format
 */
export async function* streamAISDKChat(
  options: AISDKChatOptions
): AsyncGenerator<{ content?: string; reasoning?: string; done?: boolean }> {
  const {
    model,
    messages,
    temperature = 0.7,
    maxTokens = 4096,
    topP = 1,
    enableThinking = false,
    apiKey,
  } = options;

  // Convert Gatewayz message format to request format
  const requestMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    reasoning: msg.reasoning,
  }));

  const body = {
    model,
    messages: requestMessages,
    temperature,
    max_tokens: maxTokens,
    top_p: topP,
    enable_thinking: enableThinking,
    stream: true,
  };

  try {
    const response = await fetch('/api/chat/ai-sdk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error ||
        `AI SDK API error: ${response.status} ${response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error('No response body from AI SDK');
    }

    // Parse the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          yield { done: true };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));

              // Handle content blocks
              if (data.type === 'content.block.start') {
                // Block starting
              } else if (data.type === 'content_block_delta') {
                if (data.delta?.type === 'text_delta') {
                  yield { content: data.delta.text };
                } else if (data.delta?.type === 'thinking_delta') {
                  yield { reasoning: data.delta.thinking };
                }
              } else if (data.type === 'message.start') {
                // Message starting
              } else if (data.type === 'message.delta') {
                // Message update
              } else if (data.type === 'message.stop') {
                // Message complete
                yield { done: true };
              }
            } catch (parseError) {
              console.error('[AI SDK Chat] Error parsing stream line:', parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('[AI SDK Chat] Stream error:', error);
    throw error;
  }
}

/**
 * Check if a model is available via AI SDK gateway
 */
export function isAISDKModel(modelId: string): boolean {
  // Normalize model ID: remove provider prefix (e.g., 'google/gemini-pro' -> 'gemini-pro')
  // and convert to lowercase for consistent matching
  const normalizedId = modelId.toLowerCase().replace(/^[^/]+\//, '');

  // Pattern-based matching for Google models
  const googleModelPatterns = [
    /^gemini-/,           // All Gemini models (gemini-pro, gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash, gemini-2.5-flash, etc.)
    /^gemma-/,            // All Gemma models (gemma-2b, gemma-7b, gemma-3n-e2b-it, etc.)
    /^codegemma-/,        // All CodeGemma models (codegemma-7b-it, codegemma-2b-it, etc.)
    /^paligemma-/,        // All PaliGemma models (paligemma-3b-mix-224, paligemma-3b-pt-224, etc.)
  ];

  // Check if it matches any Google model pattern
  const isGoogleModel = googleModelPatterns.some(pattern => pattern.test(normalizedId));

  // Explicit list for non-Google models
  const explicitModels = [
    // Anthropic Claude models
    'claude-3-5-sonnet',
    'claude-3-opus',
    'claude-3-haiku',
    'claude-opus-4',

    // OpenAI GPT models
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',

    // Perplexity models
    'perplexity-sonar',
  ];

  // Check if it matches any explicit model (using includes for partial matching)
  const matchesExplicitModel = explicitModels.some((model) =>
    normalizedId.includes(model.toLowerCase())
  );

  return isGoogleModel || matchesExplicitModel;
}

/**
 * Get available models from AI SDK
 */
export function getAISDKAvailableModels() {
  return [
    {
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      supportsThinking: true,
      description: 'Latest Claude model with extended thinking capabilities',
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4 Omni',
      provider: 'OpenAI',
      supportsThinking: false,
      description: 'Latest OpenAI GPT-4 model',
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'OpenAI',
      supportsThinking: false,
      description: 'Fast and capable GPT-4 variant',
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'Google',
      supportsThinking: false,
      description: 'Google\'s advanced multimodal model',
    },
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      provider: 'Google',
      supportsThinking: false,
      description: 'Google\'s high-performance model',
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      provider: 'Google',
      supportsThinking: false,
      description: 'Fast and efficient Gemini model optimized for speed',
    },
  ];
}
