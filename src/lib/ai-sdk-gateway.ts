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
    'claude-3-5-sonnet': {
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      supportsThinking: true,
    },
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
    'gemini-1.5-pro': {
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      modelId: 'gemini-1.5-pro-latest',
      supportsThinking: false,
    },
    'gemini-pro': {
      name: 'Gemini Pro',
      provider: 'google',
      modelId: 'gemini-pro',
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
