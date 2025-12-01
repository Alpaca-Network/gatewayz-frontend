import { NextRequest } from 'next/server';
import { streamText, convertToCoreMessages } from 'ai';
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
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'X-Supports-Thinking': 'false'
          }
        }
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
    console.log('[AI SDK Route] Request parameters:', {
      modelId,
      temperature,
      max_tokens,
      messagesCount: messages.length,
      apiKeyPrefix: apiKey.substring(0, 10) + '...'
    });

    // Convert messages to AI SDK core messages format
    // Wrap in try-catch to provide better error messages for conversion issues
    let coreMessages;
    try {
      coreMessages = convertToCoreMessages(messages);
    } catch (conversionError) {
      console.error('[AI SDK Route] Message conversion error:', conversionError);
      console.error('[AI SDK Route] Messages that failed conversion:', JSON.stringify(messages, null, 2));
      throw new Error(`Failed to convert messages: ${conversionError instanceof Error ? conversionError.message : 'Unknown conversion error'}`);
    }

    // Stream the response using AI SDK
    let result;
    try {
      result = streamText({
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
