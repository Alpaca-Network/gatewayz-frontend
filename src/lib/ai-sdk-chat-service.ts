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
  // List of models available through AI SDK
  const aiSdkModels = [
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

    // Google models
    'gemini-pro',
    'gemini-1.5-pro',

    // Perplexity models
    'perplexity-sonar',
  ];

  return aiSdkModels.some((model) =>
    modelId.toLowerCase().includes(model.toLowerCase())
  );
}

/**
 * Get available models from AI SDK
 */
export function getAISDKAvailableModels() {
  return [
    // Anthropic Claude models
    {
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      supportsThinking: true,
      description: 'Latest Claude model with extended thinking capabilities',
    },
    // OpenAI models
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
    // Google Gemini models - Latest versions
    {
      id: 'gemini-2.1-pro',
      name: 'Gemini 2.1 Pro',
      provider: 'Google',
      supportsThinking: false,
      description: 'Latest Gemini pro model with advanced reasoning',
    },
    {
      id: 'gemini-2.0-pro',
      name: 'Gemini 2.0 Pro',
      provider: 'Google',
      supportsThinking: false,
      description: 'Advanced Gemini model for complex tasks',
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      provider: 'Google',
      supportsThinking: false,
      description: 'Fast Gemini model for quick responses',
    },
    {
      id: 'gemini-2.0-flash-lite',
      name: 'Gemini 2.0 Flash Lite',
      provider: 'Google',
      supportsThinking: false,
      description: 'Lightweight Gemini model for efficient inference',
    },
    {
      id: 'gemini-2.0-flash-thinking-exp',
      name: 'Gemini 2.0 Flash Thinking Exp',
      provider: 'Google',
      supportsThinking: false,
      description: 'Experimental thinking-enabled Gemini model',
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'Google',
      supportsThinking: false,
      description: 'Advanced multimodal model with extended context',
    },
    {
      id: 'gemini-1.5-pro-exp-0801',
      name: 'Gemini 1.5 Pro Exp 0801',
      provider: 'Google',
      supportsThinking: false,
      description: 'Experimental version of Gemini 1.5 Pro',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'Google',
      supportsThinking: false,
      description: 'Fast multimodal model',
    },
    {
      id: 'gemini-1.5-flash-exp-0827',
      name: 'Gemini 1.5 Flash Exp 0827',
      provider: 'Google',
      supportsThinking: false,
      description: 'Experimental version of Gemini 1.5 Flash',
    },
    {
      id: 'gemini-1.5-flash-8b',
      name: 'Gemini 1.5 Flash 8B',
      provider: 'Google',
      supportsThinking: false,
      description: 'Lightweight Gemini 1.5 Flash variant',
    },
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      provider: 'Google',
      supportsThinking: false,
      description: 'High-performance Gemini model',
    },
    {
      id: 'gemini-pro-vision',
      name: 'Gemini Pro Vision',
      provider: 'Google',
      supportsThinking: false,
      description: 'Gemini Pro with vision capabilities',
    },
    {
      id: 'gemini-1.0-pro',
      name: 'Gemini 1.0 Pro',
      provider: 'Google',
      supportsThinking: false,
      description: 'Previous generation pro model',
    },
    {
      id: 'gemini-1.0-pro-vision',
      name: 'Gemini 1.0 Pro Vision',
      provider: 'Google',
      supportsThinking: false,
      description: 'Gemini 1.0 Pro with vision',
    },
    {
      id: 'gemini-1.0-pro-001',
      name: 'Gemini 1.0 Pro 001',
      provider: 'Google',
      supportsThinking: false,
      description: 'Gemini 1.0 Pro specific version',
    },
    {
      id: 'gemini-1.0-pro-vision-001',
      name: 'Gemini 1.0 Pro Vision 001',
      provider: 'Google',
      supportsThinking: false,
      description: 'Gemini 1.0 Pro Vision specific version',
    },
    {
      id: 'gemini-1.0-pro-002',
      name: 'Gemini 1.0 Pro 002',
      provider: 'Google',
      supportsThinking: false,
      description: 'Gemini 1.0 Pro version 002',
    },
    {
      id: 'gemini-1.0-pro-vision-002',
      name: 'Gemini 1.0 Pro Vision 002',
      provider: 'Google',
      supportsThinking: false,
      description: 'Gemini 1.0 Pro Vision version 002',
    },
    // Google Gemma models - Latest versions
    {
      id: 'gemma-3-2b-it',
      name: 'Gemma 3 2B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Lightweight Gemma 3 instruction-tuned model',
    },
    {
      id: 'gemma-3-7b-it',
      name: 'Gemma 3 7B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Mid-size Gemma 3 instruction-tuned model',
    },
    {
      id: 'gemma-3n-e2b-it',
      name: 'Gemma 3n E2B IT (Free)',
      provider: 'Google',
      supportsThinking: false,
      description: 'Free Gemma 3n instruction-tuned model',
    },
    {
      id: 'gemma-3-27b-it',
      name: 'Gemma 3 27B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Large Gemma 3 instruction-tuned model',
    },
    {
      id: 'gemma-2-27b-it',
      name: 'Gemma 2 27B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Large Gemma 2 instruction-tuned model',
    },
    {
      id: 'gemma-2-9b-it',
      name: 'Gemma 2 9B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Mid-size Gemma 2 instruction-tuned model',
    },
    {
      id: 'gemma-2-2b-it',
      name: 'Gemma 2 2B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Lightweight Gemma 2 instruction-tuned model',
    },
    {
      id: 'gemma-1.1-7b-it',
      name: 'Gemma 1.1 7B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Gemma 1.1 instruction-tuned model',
    },
    {
      id: 'gemma-1.1-2b-it',
      name: 'Gemma 1.1 2B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Lightweight Gemma 1.1 instruction-tuned model',
    },
    {
      id: 'gemma-7b-it',
      name: 'Gemma 7B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Gemma 7B instruction-tuned model',
    },
    {
      id: 'gemma-2b-it',
      name: 'Gemma 2B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Lightweight Gemma instruction-tuned model',
    },
    // Google specialized models
    {
      id: 'codegemma-7b-it',
      name: 'CodeGemma 7B IT',
      provider: 'Google',
      supportsThinking: false,
      description: 'Specialized model for code generation and understanding',
    },
    {
      id: 'paligemma-3b-mix-224',
      name: 'PaliGemma 3B Mix 224',
      provider: 'Google',
      supportsThinking: false,
      description: 'Vision and language model for multimodal understanding',
    },
  ];
}
