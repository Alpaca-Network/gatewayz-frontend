import { NextRequest } from 'next/server';
import { streamText, APICallError } from 'ai';
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

// Retry configuration for transient failures
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

/**
 * Calculate delay with exponential backoff and jitter
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS);
}

/**
 * Check if an error is retryable (rate limit, server error, or network issue)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof APICallError) {
    const status = error.statusCode;
    // Retry on rate limits (429), server errors (5xx), and certain client errors
    if (status === 429 || (status && status >= 500)) {
      return true;
    }
  }

  // Check for network errors or timeouts
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extract rate limit info from error for better error messages
 */
function extractRateLimitInfo(error: unknown): { retryAfter?: number; message: string } {
  if (error instanceof APICallError) {
    // responseHeaders is Record<string, string>, not a Headers object
    const retryAfterHeader = error.responseHeaders?.['retry-after'] || error.responseHeaders?.['Retry-After'];
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

    if (error.statusCode === 429) {
      return {
        retryAfter,
        message: `Rate limited by upstream provider. ${retryAfter ? `Retry after ${retryAfter}s.` : 'Please try again shortly.'}`
      };
    }
  }

  return { message: error instanceof Error ? error.message : 'Unknown error' };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
 * Fallback models in priority order for when primary model fails
 * These are reliable models that work well with our streaming infrastructure
 */
const FALLBACK_MODELS = [
  'openrouter/anthropic/claude-3.5-sonnet',
  'openrouter/openai/gpt-4o',
  'openrouter/google/gemini-pro-1.5',
  'openrouter/meta-llama/llama-3.1-70b-instruct',
];

/**
 * Resolve "router" models to actual model IDs
 * The "openrouter/auto" model is a special router that auto-selects the best model.
 * Since the backend doesn't support auto-routing, we need to select a fallback model.
 */
function resolveRouterModel(modelId: string): string {
  // Handle the Gatewayz Router / openrouter/auto model
  if (modelId === 'openrouter/auto' || modelId === 'auto-router') {
    // Use first fallback model; subsequent fallbacks handled by getNextFallbackModel
    const fallbackModel = FALLBACK_MODELS[0];
    console.log(`[AI SDK Route] Router model "${modelId}" resolved to fallback: ${fallbackModel}`);
    return fallbackModel;
  }
  return modelId;
}

/**
 * Get the next fallback model when the current one fails
 */
function getNextFallbackModel(currentModel: string, originalModel: string): string | null {
  // Only use fallbacks for router models
  if (originalModel !== 'openrouter/auto' && originalModel !== 'auto-router') {
    return null;
  }

  const currentIndex = FALLBACK_MODELS.indexOf(currentModel);
  if (currentIndex === -1 || currentIndex >= FALLBACK_MODELS.length - 1) {
    return null;
  }

  return FALLBACK_MODELS[currentIndex + 1];
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

    // Get API key from request or headers
    let apiKey = userApiKey || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    // Determine if this is an explicit guest request vs missing/invalid API key
    const isExplicitGuestRequest = apiKey === 'guest';
    const isMissingApiKey = !apiKey || apiKey.trim() === '';

    // Default guest API key for unauthenticated users
    // This key should have limited rate limits on the backend
    const DEFAULT_GUEST_API_KEY = 'gatewayz-guest-demo-key';

    // For explicit guest requests, use the guest API key from environment or default
    if (isExplicitGuestRequest || isMissingApiKey) {
      apiKey = process.env.GUEST_API_KEY || DEFAULT_GUEST_API_KEY;
      console.log('[AI SDK Route] Using guest API key for unauthenticated request');
    }

    // Resolve router models to actual model IDs
    let modelId = resolveRouterModel(requestedModelId);
    const wasRouterResolved = modelId !== requestedModelId;
    const isRouterModel = requestedModelId === 'openrouter/auto' || requestedModelId === 'auto-router';

    // Track retry attempts and last error for better error reporting
    let lastError: Error | null = null;
    let retriesAttempted = 0;
    let result: ReturnType<typeof streamText> | null = null;
    let finalProvider = 'gatewayz';
    let finalSupportsThinking = false;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Get the appropriate provider and model
        const { provider, model, supportsThinking } = getProviderAndModel(modelId, apiKey);
        finalProvider = provider;
        finalSupportsThinking = supportsThinking;

        if (attempt > 0) {
          console.log(`[AI SDK Route] Retry attempt ${attempt}/${MAX_RETRIES} for model: ${modelId}`);
        }

        console.log('[AI SDK Route] Using provider:', provider, 'for model:', modelId);
        console.log('[AI SDK Route] Supports thinking:', supportsThinking);
        console.log('[AI SDK Route] Request parameters:', {
          modelId,
          temperature,
          max_tokens,
          messagesCount: messages.length,
          apiKeyPrefix: apiKey.substring(0, 10) + '...',
          attempt,
        });

        // Messages are already in the correct ModelMessage format (OpenAI-compatible)
        console.log('[AI SDK Route] Using messages directly (already in ModelMessage format)');

        // Stream the response using AI SDK
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
              retriesAttempted,
            });
          },
        });

        console.log('[AI SDK Route] streamText call successful, starting stream...');
        break; // Success - exit retry loop

      } catch (streamInitError) {
        lastError = streamInitError instanceof Error ? streamInitError : new Error(String(streamInitError));
        retriesAttempted = attempt + 1;

        console.error(`[AI SDK Route] Error initializing streamText (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, streamInitError);

        // Check if error is retryable
        if (isRetryableError(streamInitError) && attempt < MAX_RETRIES) {
          const rateLimitInfo = extractRateLimitInfo(streamInitError);
          const delay = rateLimitInfo.retryAfter
            ? rateLimitInfo.retryAfter * 1000
            : getRetryDelay(attempt);

          console.log(`[AI SDK Route] Retryable error detected. Waiting ${delay}ms before retry...`);
          await sleep(delay);

          // For router models, try the next fallback model
          if (isRouterModel) {
            const nextFallback = getNextFallbackModel(modelId, requestedModelId);
            if (nextFallback) {
              console.log(`[AI SDK Route] Switching to fallback model: ${nextFallback}`);
              modelId = nextFallback;
            } else {
              // All fallbacks exhausted, stop retrying - preserve original error for status code
              console.log(`[AI SDK Route] All fallback models exhausted, stopping retries`);
              throw lastError;
            }
          }

          continue;
        }

        // Non-retryable error or max retries reached - preserve original error for status code
        throw lastError;
      }
    }

    if (!result) {
      throw new Error(`Failed to initialize streaming after ${retriesAttempted} attempts`);
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
          let errorAlreadySent = false; // Track if we've already sent an error to prevent duplicates
          let lastErrorMessage = '';
          let partTypesReceived: string[] = []; // Track all part types for debugging

          for await (const part of stream) {
            // Log all part types for debugging empty content issues
            partTypesReceived.push(part.type);

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
              // Stream finished - check if it's an error finish
              if (part.finishReason === 'error' && !contentReceived) {
                // If we finished with error and no content, send an error message
                const errorMessage = lastErrorMessage || `Model "${modelId}" finished with an error. The model may be unavailable, overloaded, or rate limited.`;
                const errorData = {
                  choices: [{
                    delta: {},
                    finish_reason: 'error'
                  }],
                  error: {
                    message: errorMessage,
                    type: 'finish_error'
                  }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
                errorAlreadySent = true; // Prevent duplicate error in !contentReceived check
              } else {
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
            // Silently ignore boundary markers (text-start, text-end, reasoning-start, reasoning-end)
            // These don't contain content but are normal AI SDK behavior
            // Also ignore step-start, step-finish, tool-* parts as they don't affect text output
          }

          // Check if we received any content - if not, send an error message
          // Skip if we already sent an error (e.g., from finish with error reason)
          if (!contentReceived && !errorAlreadySent) {
            console.error('[AI SDK Route] Stream completed without any content');
            console.error('[AI SDK Route] Part types received:', partTypesReceived.join(', ') || 'none');
            console.error('[AI SDK Route] Part count:', partTypesReceived.length);

            // Provide more specific error messages based on what we received
            let errorMessage = lastErrorMessage;
            if (!errorMessage) {
              if (partTypesReceived.length === 0) {
                errorMessage = `Model "${modelId}" returned an empty response. The model may be unavailable or rate limited. Please try again.`;
              } else if (partTypesReceived.every(t => t === 'finish' || t === 'step-finish')) {
                errorMessage = `Model "${modelId}" completed without generating any content. This may indicate the model is overloaded or the request was blocked. Please try again or select a different model.`;
              } else {
                errorMessage = `No response received from model "${modelId}". Part types received: ${partTypesReceived.slice(0, 5).join(', ')}. The model may not be properly configured or may not support the requested features.`;
              }
            }

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
        'X-Provider': finalProvider,
        'X-Model': modelId,
        'X-Supports-Thinking': finalSupportsThinking ? 'true' : 'false',
        // Include original requested model if it was resolved to a different model
        ...(wasRouterResolved && { 'X-Requested-Model': requestedModelId }),
        // Include retry info for debugging
        ...(retriesAttempted > 0 && { 'X-Retries-Attempted': String(retriesAttempted) }),
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

    // Extract detailed error information
    let status = 500;
    let errorType = 'server_error';
    let message = error instanceof Error ? error.message : 'Unknown error';
    let retryAfter: number | undefined;

    if (error instanceof APICallError) {
      status = error.statusCode || 500;
      errorType = status === 429 ? 'rate_limit_error' : 'api_error';

      // Extract retry-after header if available (responseHeaders is Record<string, string>)
      const retryAfterHeader = error.responseHeaders?.['retry-after'] || error.responseHeaders?.['Retry-After'];
      retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

      // Provide more helpful error messages
      if (status === 429) {
        message = `Rate limited by upstream provider. ${retryAfter ? `Please retry after ${retryAfter} seconds.` : 'Please try again shortly.'}`;
      } else if (status === 401 || status === 403) {
        message = 'Authentication failed. Please check your API key.';
        errorType = 'auth_error';
      } else if (status >= 500) {
        message = `Upstream provider error (${status}). Please try again later.`;
        errorType = 'upstream_error';
      }
    } else if (message.includes('API key')) {
      status = 401;
      errorType = 'auth_error';
    }

    return new Response(
      JSON.stringify({
        error: message,
        type: errorType,
        details: 'Failed to process chat completion with AI SDK',
        ...(retryAfter && { retry_after: retryAfter }),
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...(retryAfter && { 'Retry-After': String(retryAfter) }),
        },
      }
    );
  }
}
