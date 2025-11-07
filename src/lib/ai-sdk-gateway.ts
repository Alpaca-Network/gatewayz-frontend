/**
 * AI SDK Gateway Integration
 *
 * Provides a wrapper around Vercel AI SDK for chain-of-thought reasoning
 * Works as an additional gateway alongside existing multi-gateway architecture
 */

import type { LanguageModel } from 'ai';

export interface AISDKModelConfig {
  name: string;
  provider: string;
  modelId: string;
  apiKey?: string;
  baseURL?: string;
  supportsThinking?: boolean; // Whether model supports chain-of-thought/thinking
}

export interface AISDKStreamChunk {
  type: 'content' | 'reasoning' | 'done' | 'error';
  content?: string;
  reasoning?: string;
  error?: string;
}

export interface AISDKMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string; // For storing thinking/reasoning from previous responses
}

/**
 * Detects if a model supports AI SDK thinking/reasoning
 * Based on Vercel AI SDK supported models
 */
export function modelSupportsThinking(modelId: string): boolean {
  // Models with native thinking/extended thinking support
  const thinkingModels = [
    'claude-3-7-sonnet',
    'claude-opus-4',
    'gpt-4o',
    'gpt-4-turbo',
    'deepseek-reasoner',
    'qwen-plus',
  ];

  return thinkingModels.some(model => modelId.toLowerCase().includes(model));
}

/**
 * Converts Gatewayz message format to AI SDK message format
 */
export function convertToAISDKMessage(msg: any): AISDKMessage {
  return {
    role: msg.role,
    content: msg.content,
    reasoning: msg.reasoning,
  };
}

/**
 * Converts AI SDK response to Gatewayz format with reasoning support
 */
export function convertFromAISDKResponse(response: any): {
  content: string;
  reasoning?: string;
} {
  return {
    content: typeof response === 'string' ? response : response.content || '',
    reasoning: response.reasoning || response.thinking,
  };
}

/**
 * Parses AI SDK streaming response with thinking support
 * Handles both regular content and thinking/reasoning blocks
 */
export async function* parseAISDKStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<AISDKStreamChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        yield { type: 'done' };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));

            // Handle content delta
            if (data.type === 'content.block.delta' && data.delta?.text) {
              yield {
                type: 'content',
                content: data.delta.text,
              };
            }

            // Handle thinking/reasoning delta
            if (data.type === 'content_block_delta') {
              const contentBlock = data.content_block;
              if (contentBlock?.type === 'thinking') {
                yield {
                  type: 'reasoning',
                  reasoning: data.delta?.thinking || data.delta?.text || '',
                };
              } else if (contentBlock?.type === 'text') {
                yield {
                  type: 'content',
                  content: data.delta?.text || '',
                };
              }
            }

            // Handle errors
            if (data.type === 'error' || data.error) {
              yield {
                type: 'error',
                error: data.error?.message || data.message || 'Unknown error',
              };
            }
          } catch (error) {
            console.error('[AI SDK] Error parsing stream:', error);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * API endpoint for AI SDK chat completions
 * Bridges between Gatewayz frontend and AI SDK backend
 */
export async function callAISDKCompletion(
  messages: AISDKMessage[],
  modelId: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    useThinking?: boolean;
  }
) {
  const apiKey = process.env.AI_SDK_API_KEY || '';

  if (!apiKey) {
    throw new Error('AI_SDK_API_KEY not configured');
  }

  // Determine which API endpoint to use based on model provider
  let baseURL = process.env.AI_SDK_BASE_URL || 'https://api.anthropic.com/v1';
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Route to appropriate provider API
  if (modelId.toLowerCase().includes('gemini')) {
    // For Gemini models, use the Gatewayz backend proxy
    baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (modelId.toLowerCase().includes('gpt')) {
    // For OpenAI models
    baseURL = process.env.AI_SDK_BASE_URL || 'https://api.openai.com/v1';
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    // For Anthropic Claude models
    baseURL = process.env.AI_SDK_BASE_URL || 'https://api.anthropic.com/v1';
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['Anthropic-Version'] = '2023-06-01';
  }

  const body: any = {
    model: modelId,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
    top_p: options?.topP ?? 1,
    frequency_penalty: options?.frequencyPenalty ?? 0,
    presence_penalty: options?.presencePenalty ?? 0,
    stream: true,
  };

  // Add thinking for models that support it
  if (options?.useThinking && modelSupportsThinking(modelId)) {
    body.thinking = {
      type: 'enabled',
      budget_tokens: Math.min(options.maxTokens ?? 4096, 10000),
    };
  }

  // Determine endpoint path based on model provider
  let endpoint = '/messages';
  if (modelId.toLowerCase().includes('gemini')) {
    endpoint = '/v1/chat/completions';
  } else if (modelId.toLowerCase().includes('gpt')) {
    endpoint = '/chat/completions';
  }

  const response = await fetch(`${baseURL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`AI SDK API error: ${error.message}`);
  }

  return response.body!;
}

/**
 * Check if a model is available through AI SDK gateway
 */
export function isAISDKModel(modelId: string): boolean {
  const supportedProviders = [
    'anthropic',
    'openai',
    'google',
    'perplexity',
    'mistral',
  ];

  return supportedProviders.some(provider =>
    modelId.toLowerCase().includes(provider)
  );
}

/**
 * Get AI SDK model metadata
 */
export function getAISDKModelMetadata(modelId: string): AISDKModelConfig | null {
  const modelConfigs: Record<string, AISDKModelConfig> = {
    // Anthropic Claude models
    'claude-3-5-sonnet': {
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      supportsThinking: true,
    },
    // OpenAI models
    'gpt-4o': {
      name: 'GPT-4 Omni',
      provider: 'openai',
      modelId: 'gpt-4o-2024-08-06',
      supportsThinking: false,
    },
    'gpt-4-turbo': {
      name: 'GPT-4 Turbo',
      provider: 'openai',
      modelId: 'gpt-4-turbo-2024-04-09',
      supportsThinking: false,
    },
    // Google Gemini models - Latest versions
    'gemini-2.1-pro': {
      name: 'Gemini 2.1 Pro',
      provider: 'google',
      modelId: 'gemini-2.1-pro-latest',
      supportsThinking: false,
    },
    'gemini-2.0-pro': {
      name: 'Gemini 2.0 Pro',
      provider: 'google',
      modelId: 'gemini-2.0-pro-latest',
      supportsThinking: false,
    },
    'gemini-2.0-flash': {
      name: 'Gemini 2.0 Flash',
      provider: 'google',
      modelId: 'gemini-2.0-flash-latest',
      supportsThinking: false,
    },
    'gemini-2.0-flash-lite': {
      name: 'Gemini 2.0 Flash Lite',
      provider: 'google',
      modelId: 'gemini-2.0-flash-lite-latest',
      supportsThinking: false,
    },
    'gemini-2.0-flash-thinking-exp': {
      name: 'Gemini 2.0 Flash Thinking Exp',
      provider: 'google',
      modelId: 'gemini-2.0-flash-thinking-exp-01-21',
      supportsThinking: false,
    },
    'gemini-1.5-pro': {
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      modelId: 'gemini-1.5-pro-latest',
      supportsThinking: false,
    },
    'gemini-1.5-pro-exp-0801': {
      name: 'Gemini 1.5 Pro Exp 0801',
      provider: 'google',
      modelId: 'gemini-1.5-pro-exp-0801',
      supportsThinking: false,
    },
    'gemini-1.5-flash': {
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      modelId: 'gemini-1.5-flash-latest',
      supportsThinking: false,
    },
    'gemini-1.5-flash-exp-0827': {
      name: 'Gemini 1.5 Flash Exp 0827',
      provider: 'google',
      modelId: 'gemini-1.5-flash-exp-0827',
      supportsThinking: false,
    },
    'gemini-1.5-flash-8b': {
      name: 'Gemini 1.5 Flash 8B',
      provider: 'google',
      modelId: 'gemini-1.5-flash-8b-latest',
      supportsThinking: false,
    },
    'gemini-pro': {
      name: 'Gemini Pro',
      provider: 'google',
      modelId: 'gemini-pro',
      supportsThinking: false,
    },
    'gemini-pro-vision': {
      name: 'Gemini Pro Vision',
      provider: 'google',
      modelId: 'gemini-pro-vision',
      supportsThinking: false,
    },
    'gemini-1.0-pro': {
      name: 'Gemini 1.0 Pro',
      provider: 'google',
      modelId: 'gemini-1.0-pro-latest',
      supportsThinking: false,
    },
    'gemini-1.0-pro-vision': {
      name: 'Gemini 1.0 Pro Vision',
      provider: 'google',
      modelId: 'gemini-1.0-pro-vision-latest',
      supportsThinking: false,
    },
    'gemini-1.0-pro-001': {
      name: 'Gemini 1.0 Pro 001',
      provider: 'google',
      modelId: 'gemini-1.0-pro-001',
      supportsThinking: false,
    },
    'gemini-1.0-pro-vision-001': {
      name: 'Gemini 1.0 Pro Vision 001',
      provider: 'google',
      modelId: 'gemini-1.0-pro-vision-001',
      supportsThinking: false,
    },
    'gemini-1.0-pro-002': {
      name: 'Gemini 1.0 Pro 002',
      provider: 'google',
      modelId: 'gemini-1.0-pro-002',
      supportsThinking: false,
    },
    'gemini-1.0-pro-vision-002': {
      name: 'Gemini 1.0 Pro Vision 002',
      provider: 'google',
      modelId: 'gemini-1.0-pro-vision-002',
      supportsThinking: false,
    },
    // Google Gemma models
    'gemma-3-2b-it': {
      name: 'Gemma 3 2B IT',
      provider: 'google',
      modelId: 'gemma-3-2b-it-latest',
      supportsThinking: false,
    },
    'gemma-3-7b-it': {
      name: 'Gemma 3 7B IT',
      provider: 'google',
      modelId: 'gemma-3-7b-it-latest',
      supportsThinking: false,
    },
    'gemma-3n-e2b-it': {
      name: 'Gemma 3n E2B IT',
      provider: 'google',
      modelId: 'gemma-3n-e2b-it:free',
      supportsThinking: false,
    },
    'gemma-3-27b-it': {
      name: 'Gemma 3 27B IT',
      provider: 'google',
      modelId: 'gemma-3-27b-it-latest',
      supportsThinking: false,
    },
    'gemma-2-27b-it': {
      name: 'Gemma 2 27B IT',
      provider: 'google',
      modelId: 'gemma-2-27b-it-latest',
      supportsThinking: false,
    },
    'gemma-2-9b-it': {
      name: 'Gemma 2 9B IT',
      provider: 'google',
      modelId: 'gemma-2-9b-it-latest',
      supportsThinking: false,
    },
    'gemma-2-2b-it': {
      name: 'Gemma 2 2B IT',
      provider: 'google',
      modelId: 'gemma-2-2b-it-latest',
      supportsThinking: false,
    },
    'gemma-1.1-7b-it': {
      name: 'Gemma 1.1 7B IT',
      provider: 'google',
      modelId: 'gemma-1.1-7b-it-latest',
      supportsThinking: false,
    },
    'gemma-1.1-2b-it': {
      name: 'Gemma 1.1 2B IT',
      provider: 'google',
      modelId: 'gemma-1.1-2b-it-latest',
      supportsThinking: false,
    },
    'gemma-7b-it': {
      name: 'Gemma 7B IT',
      provider: 'google',
      modelId: 'gemma-7b-it-latest',
      supportsThinking: false,
    },
    'gemma-2b-it': {
      name: 'Gemma 2B IT',
      provider: 'google',
      modelId: 'gemma-2b-it-latest',
      supportsThinking: false,
    },
    // Google Code models
    'codegemma-7b-it': {
      name: 'CodeGemma 7B IT',
      provider: 'google',
      modelId: 'codegemma-7b-it-latest',
      supportsThinking: false,
    },
    // Google Vision models
    'paligemma-3b-mix-224': {
      name: 'PaliGemma 3B Mix 224',
      provider: 'google',
      modelId: 'paligemma-3b-mix-224-latest',
      supportsThinking: false,
    },
  };

  return (
    modelConfigs[modelId] ||
    Object.values(modelConfigs).find(config =>
      config.modelId.toLowerCase() === modelId.toLowerCase()
    ) ||
    null
  );
}
