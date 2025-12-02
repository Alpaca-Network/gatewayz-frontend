import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

/**
 * AI SDK Chat Completions Route
 *
 * This route uses the official Vercel AI SDK for streaming chat completions
 * with support for chain-of-thought reasoning across all model providers.
 *
 * Architecture:
 * - All models use OpenAI-compatible format (via @ai-sdk/openai)
 * - Requests are sent to Gatewayz backend API
 * - Gatewayz backend handles provider-specific translation
 * - Supports 300+ models from 60+ providers
 *
 * Providers supported (via Gatewayz):
 * - OpenAI (GPT, O1, O3 models)
 * - Anthropic (Claude models with extended thinking)
 * - Google (Gemini models)
 * - DeepSeek (R1, Reasoner models)
 * - Qwen (QwQ and thinking models)
 * - And 60+ other providers
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
 * All models use OpenAI-compatible format through Gatewayz backend
 *
 * NOTE: We use OpenAI provider for ALL models because Gatewayz backend
 * expects OpenAI-compatible requests for all providers. The backend handles
 * the translation to provider-specific formats (Anthropic, Google, etc.).
 */
function getProviderAndModel(modelId: string, apiKey: string) {
  const normalized = modelId.toLowerCase();
  const gatewayBaseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
  const supportsThinking = supportsReasoning(modelId);

  // Detect provider name for logging
  let providerName = 'gatewayz';
  if (normalized.includes('claude')) providerName = 'anthropic';
  else if (normalized.includes('gpt') || normalized.includes('o1') || normalized.includes('o3')) providerName = 'openai';
  else if (normalized.includes('gemini')) providerName = 'google';
  else if (normalized.includes('deepseek')) providerName = 'deepseek';
  else if (normalized.includes('qwen')) providerName = 'qwen';

  // Use OpenAI provider for ALL models - Gatewayz handles provider routing
  const openai = createOpenAI({
    apiKey: apiKey,
    baseURL: `${gatewayBaseURL}/v1`,
    // Don't set any provider-specific headers - let Gatewayz handle it
  });

  return {
    provider: providerName,
    model: openai(modelId),
    supportsThinking,
  };
}

/**
 * Resolve "router" models to actual model IDs
 * The "openrouter/auto" model is a special router that auto-selects the best model.
 * Since the backend doesn't support auto-routing, we need to select a fallback model.
 */
function resolveRouterModel(modelId: string): string {
  // Handle the Gatewayz Router / openrouter/auto model
  if (modelId === 'openrouter/auto' || modelId === 'auto-router') {
    // Use a model that's known to work well with our streaming infrastructure
    // Anthropic models via OpenRouter have proven reliability
    const fallbackModel = 'openrouter/anthropic/claude-3.5-sonnet';
    console.log(`[AI SDK Route] Router model "${modelId}" resolved to fallback: ${fallbackModel}`);
    return fallbackModel;
  }
  return modelId;
}

/**
 * POST handler for AI SDK chat completions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      model: requestedModelId,
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

    if (!requestedModelId) {
      return new Response(
        JSON.stringify({ error: 'model is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'X-Supports-Thinking': 'false'
          }
        }
      );
    }

    // Resolve router models to actual model IDs
    const modelId = resolveRouterModel(requestedModelId);
    const wasRouterResolved = modelId !== requestedModelId;

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
    console.log('[AI SDK Route] Request parameters:', {
      modelId,
      temperature,
      max_tokens,
      messagesCount: messages.length,
      apiKeyPrefix: apiKey.substring(0, 10) + '...'
    });

    // Messages are already in the correct ModelMessage format (OpenAI-compatible)
    // No conversion needed - streamText accepts messages in this format directly
    console.log('[AI SDK Route] Using messages directly (already in ModelMessage format)');

    // Stream the response using AI SDK
    let result;
    try {
      result = streamText({
        model,
        messages,
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
      console.log('[AI SDK Route] streamText call successful, starting stream...');
    } catch (streamInitError) {
      console.error('[AI SDK Route] Error initializing streamText:', streamInitError);
      throw new Error(`Failed to initialize streaming: ${streamInitError instanceof Error ? streamInitError.message : 'Unknown error'}`);
    }

    // Convert AI SDK stream to SSE format that the frontend expects
    // Use fullStream() to access reasoning, text, and other parts
    const stream = result.fullStream;
    const encoder = new TextEncoder();

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          console.log('[AI SDK Route] Starting stream iteration...');
          let contentReceived = false;
          let lastErrorMessage = '';

          for await (const part of stream) {
            // Handle different part types from AI SDK
            if (part.type === 'text-delta') {
              // Regular text content
              contentReceived = true;
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
              contentReceived = true;
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
            } else if (part.type === 'error') {
              // Handle error from the AI SDK / backend
              console.error('[AI SDK Route] Received error part from stream:', part);
              const errorMessage = typeof part.error === 'string'
                ? part.error
                : (part.error as Error)?.message || 'Unknown error from model provider';
              lastErrorMessage = errorMessage;

              // Send error to client
              const errorData = {
                choices: [{
                  delta: {},
                  finish_reason: 'error'
                }],
                error: {
                  message: errorMessage,
                  type: 'provider_error'
                }
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
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

          // Check if we received any content - if not, send an error message
          if (!contentReceived) {
            console.error('[AI SDK Route] Stream completed without any content');
            const errorMessage = lastErrorMessage || `No response received from model "${modelId}". The model may not be properly configured, may be unavailable, or may not support the requested features.`;
            const errorData = {
              choices: [{
                delta: {},
                finish_reason: 'error'
              }],
              error: {
                message: errorMessage,
                type: 'no_content_error'
              }
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
          }

          // Send final [DONE] message
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[AI SDK Route] Stream error:', error);

          // Log additional error details
          if (error instanceof Error) {
            console.error('[AI SDK Route] Stream error name:', error.name);
            console.error('[AI SDK Route] Stream error message:', error.message);
            console.error('[AI SDK Route] Stream error stack:', error.stack);
          }

          // Try to send an error message to the client before closing the stream
          try {
            const errorMessage = error instanceof Error ? error.message : 'Unknown stream error';
            const errorData = {
              choices: [{
                delta: {},
                finish_reason: 'error'
              }],
              error: {
                message: errorMessage,
                type: 'stream_error'
              }
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch (sendError) {
            console.error('[AI SDK Route] Failed to send error to client:', sendError);
          }

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
        // Include original requested model if it was resolved to a different model
        ...(wasRouterResolved && { 'X-Requested-Model': requestedModelId }),
      },
    });
  } catch (error) {
    console.error('[AI SDK Route] Error:', error);

    // Log the full error details for debugging
    if (error instanceof Error) {
      console.error('[AI SDK Route] Error name:', error.name);
      console.error('[AI SDK Route] Error message:', error.message);
      console.error('[AI SDK Route] Error stack:', error.stack);
    }

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
