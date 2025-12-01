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

/**
 * Detect if a model supports chain-of-thought reasoning based on model ID
 * This is a comprehensive list that covers known reasoning-capable models
 */
function supportsReasoning(modelId: string): boolean {
  const normalized = modelId.toLowerCase();

  // Claude models with extended thinking
  if (normalized.includes('claude')) {
    // Claude 3.7 Sonnet and newer
    if (normalized.includes('3-7') || normalized.includes('3.7')) return true;
    if (normalized.includes('3.7')) return true;
    // Claude Opus 4 and newer
    if (normalized.includes('opus') && normalized.includes('4')) return true;
    // Claude Sonnet 4 and newer
    if (normalized.includes('sonnet') && normalized.includes('4')) return true;
  }

  // OpenAI reasoning models
  if (normalized.includes('o1') || normalized.includes('o3')) return true;
  if (normalized.includes('o1-preview') || normalized.includes('o1-mini')) return true;
  if (normalized.includes('o3-mini')) return true;

  // Google Gemini with thinking
  if (normalized.includes('gemini')) {
    if (normalized.includes('2.0') || normalized.includes('2-0')) return true;
    if (normalized.includes('thinking') || normalized.includes('pro-exp')) return true;
  }

  // DeepSeek reasoning models
  if (normalized.includes('deepseek')) {
    if (normalized.includes('r1') || normalized.includes('reasoner')) return true;
  }

  // Qwen reasoning models
  if (normalized.includes('qwen')) {
    if (normalized.includes('qwq') || normalized.includes('thinking')) return true;
  }

  // Other known reasoning models
  if (normalized.includes('thinking') || normalized.includes('reasoning')) return true;
  if (normalized.includes('reflection')) return true;
  if (normalized.includes('chain-of-thought') || normalized.includes('cot')) return true;

  return false;
}

/**
 * Get the appropriate provider and model based on the model ID
 * All providers route through Gatewayz backend API
 */
function getProviderAndModel(modelId: string, apiKey: string) {
  const normalized = modelId.toLowerCase();
  const gatewayBaseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
  const supportsThinking = supportsReasoning(modelId);

  // Anthropic Claude models - use Gatewayz backend
  if (normalized.includes('claude')) {
    const anthropic = createAnthropic({
      apiKey: apiKey,  // Use Gatewayz API key
      baseURL: `${gatewayBaseURL}/v1`,  // Route through Gatewayz
    });
    return {
      provider: 'anthropic',
      model: anthropic(modelId),
      supportsThinking,
    };
  }

  // OpenAI models - use Gatewayz backend
  if (normalized.includes('gpt') || normalized.includes('o1') || normalized.includes('o3')) {
    const openai = createOpenAI({
      apiKey: apiKey,  // Use Gatewayz API key
      baseURL: `${gatewayBaseURL}/v1`,  // Route through Gatewayz
    });
    return {
      provider: 'openai',
      model: openai(modelId),
      supportsThinking,
    };
  }

  // Google Gemini models - use Gatewayz backend
  if (normalized.includes('gemini')) {
    const google = createGoogleGenerativeAI({
      apiKey: apiKey,  // Use Gatewayz API key
      baseURL: `${gatewayBaseURL}/v1`,  // Route through Gatewayz
    });
    return {
      provider: 'google',
      model: google(modelId),
      supportsThinking,
    };
  }

  // Default fallback - use OpenAI-compatible endpoint through Gatewayz
  // This handles DeepSeek, Qwen, and other reasoning models
  const openai = createOpenAI({
    apiKey: apiKey,  // Use Gatewayz API key
    baseURL: `${gatewayBaseURL}/v1`,  // Route through Gatewayz
  });
  return {
    provider: 'gatewayz',
    model: openai(modelId),
    supportsThinking,
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

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the appropriate provider and model
    const { provider, model, supportsThinking } = getProviderAndModel(modelId, apiKey);

    console.log('[AI SDK Route] Using provider:', provider, 'for model:', modelId);
    console.log('[AI SDK Route] Supports thinking:', supportsThinking);

    // Convert messages to AI SDK core messages format
    const coreMessages = convertToCoreMessages(messages);

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

    // Convert AI SDK stream to SSE format that the frontend expects
    // Use fullStream() to access reasoning, text, and other parts
    const stream = result.fullStream;
    const encoder = new TextEncoder();

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of stream) {
            // Handle different part types from AI SDK
            if (part.type === 'text-delta') {
              // Regular text content
              const sseData = {
                choices: [{
                  delta: {
                    content: part.text
                  },
                  finish_reason: null
                }]
              };
              const sseMessage = `data: ${JSON.stringify(sseData)}\n\n`;
              controller.enqueue(encoder.encode(sseMessage));
            } else if (part.type === 'reasoning-delta') {
              // Chain-of-thought reasoning
              const sseData = {
                choices: [{
                  delta: {
                    reasoning_content: part.text
                  },
                  finish_reason: null
                }]
              };
              const sseMessage = `data: ${JSON.stringify(sseData)}\n\n`;
              controller.enqueue(encoder.encode(sseMessage));
              console.log('[AI SDK Route] Reasoning chunk:', part.text.substring(0, 100));
            } else if (part.type === 'finish') {
              // Stream finished
              const sseData = {
                choices: [{
                  delta: {},
                  finish_reason: part.finishReason
                }]
              };
              const sseMessage = `data: ${JSON.stringify(sseData)}\n\n`;
              controller.enqueue(encoder.encode(sseMessage));
            }
          }

          // Send final [DONE] message
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[AI SDK Route] Stream error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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
