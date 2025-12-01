import { NextRequest } from 'next/server';
import { streamText, convertToCoreMessages } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

/**
 * AI SDK Chat Completions Route
 *
 * This route uses the official Vercel AI SDK for streaming chat completions
 * with support for chain-of-thought reasoning and multiple providers.
 *
 * Supports:
 * - OpenAI (GPT models)
 * - Anthropic (Claude models with extended thinking)
 * - Google (Gemini models)
 * - OpenRouter (via OpenAI-compatible API)
 */

// Initialize provider SDKs
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || '',
});

/**
 * Create an OpenRouter client using OpenAI-compatible API
 */
function createOpenRouter(apiKey: string) {
  return createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}

/**
 * Get the appropriate provider and model based on the model ID
 */
function getProviderAndModel(modelId: string, apiKey?: string) {
  const normalized = modelId.toLowerCase();

  // OpenAI models
  if (normalized.includes('gpt') || normalized.includes('o1')) {
    return {
      provider: 'openai',
      model: openai(modelId),
    };
  }

  // Anthropic Claude models
  if (normalized.includes('claude')) {
    return {
      provider: 'anthropic',
      model: anthropic(modelId),
    };
  }

  // Google Gemini models
  if (normalized.includes('gemini')) {
    return {
      provider: 'google',
      model: google(modelId),
    };
  }

  // OpenRouter (default fallback)
  // Use the user's API key for OpenRouter
  if (apiKey) {
    const openrouter = createOpenRouter(apiKey);
    return {
      provider: 'openrouter',
      model: openrouter(modelId),
    };
  }

  // Fallback to OpenAI format
  return {
    provider: 'openai',
    model: openai(modelId),
  };
}

/**
 * POST handler for AI SDK chat completions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      model: modelId,
      temperature = 0.7,
      max_tokens = 4096,
      top_p = 1,
      frequency_penalty = 0,
      presence_penalty = 0,
      apiKey: userApiKey,
    } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!modelId) {
      return new Response(
        JSON.stringify({ error: 'model is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from request or headers
    const apiKey = userApiKey || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    // Get the appropriate provider and model
    const { provider, model } = getProviderAndModel(modelId, apiKey);

    console.log('[AI SDK Route] Using provider:', provider, 'for model:', modelId);

    // Convert messages to AI SDK core messages format
    const coreMessages = convertToCoreMessages(messages);

    // Determine if model supports extended thinking
    const supportsThinking = modelId.toLowerCase().includes('claude-3-7-sonnet') ||
                            modelId.toLowerCase().includes('claude-opus-4') ||
                            modelId.toLowerCase().includes('o1');

    // Stream the response using AI SDK
    const result = streamText({
      model,
      messages: coreMessages,
      temperature,
      maxOutputTokens: max_tokens,
      topP: top_p,
      frequencyPenalty: frequency_penalty,
      presencePenalty: presence_penalty,
      onFinish: ({ text, finishReason, usage }) => {
        console.log('[AI SDK Route] Completion finished:', {
          provider,
          model: modelId,
          finishReason,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          textLength: text.length,
        });
      },
    });

    // Return the streaming response with proper headers
    return result.toTextStreamResponse({
      headers: {
        'X-Provider': provider,
        'X-Model': modelId,
        'X-Supports-Thinking': supportsThinking ? 'true' : 'false',
      },
    });
  } catch (error) {
    console.error('[AI SDK Route] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('API key') ? 401 : 500;

    return new Response(
      JSON.stringify({
        error: message,
        details: 'Failed to process chat completion with AI SDK',
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
