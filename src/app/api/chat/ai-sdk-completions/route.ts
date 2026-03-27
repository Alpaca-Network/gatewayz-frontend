import { NextRequest } from 'next/server';
import { streamText, APICallError, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { checkGuestRateLimit, incrementGuestRateLimit, getClientIP, formatResetTime } from '@/lib/guest-rate-limiter';

/**
 * Content part types for OpenAI format (what frontend sends)
 */
interface OpenAITextPart {
  type: 'text';
  text: string;
}

interface OpenAIImageUrlPart {
  type: 'image_url';
  image_url: { url: string; detail?: string };
}

interface OpenAIAudioUrlPart {
  type: 'audio_url';
  audio_url: { url: string };
}

interface OpenAIVideoUrlPart {
  type: 'video_url';
  video_url: { url: string };
}

interface OpenAIFileUrlPart {
  type: 'file_url';
  file_url: { url: string; mime_type?: string };
}

type OpenAIContentPart = OpenAITextPart | OpenAIImageUrlPart | OpenAIAudioUrlPart | OpenAIVideoUrlPart | OpenAIFileUrlPart;

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OpenAIContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

/**
 * AI SDK v5 content part types for proper type casting
 */
interface AISDKTextPart {
  type: 'text';
  text: string;
}

interface AISDKImagePart {
  type: 'image';
  image: URL | string; // URL object or base64 string
  mediaType?: string;
}

interface AISDKFilePart {
  type: 'file';
  data: URL | string; // URL object or base64 string
  mediaType: string;
  filename?: string;
}

interface AISDKToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: unknown;
}

interface AISDKToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  output: { type: 'text'; text: string };
}

type AISDKUserContentPart = AISDKTextPart | AISDKImagePart | AISDKFilePart;
type AISDKAssistantContentPart = AISDKTextPart | AISDKToolCallPart;

/**
 * Convert OpenAI format messages to AI SDK ModelMessage format.
 *
 * The AI SDK v5 uses strict Zod validation and expects messages in a specific format:
 * - User messages: role: 'user', content: string | Array<{type: 'text', text} | {type: 'image', image} | {type: 'file', data, mediaType}>
 * - Assistant messages: role: 'assistant', content: string | Array<...>
 * - System messages: role: 'system', content: string
 * - Tool messages: role: 'tool', content: Array<{type: 'tool-result', ...}>
 *
 * OpenAI format uses:
 * - type: 'image_url' with image_url: { url: ... }
 * - type: 'text' with text: ...
 *
 * This function converts between these formats.
 */
function convertToAISDKMessages(openAIMessages: OpenAIMessage[]): ModelMessage[] {
  return openAIMessages.map((msg): ModelMessage => {
    const { role, content, name, tool_call_id, tool_calls } = msg;

    // Handle tool messages
    if (role === 'tool') {
      // Tool messages require specific format, cast through unknown for TypeScript
      return {
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: tool_call_id || '',
          toolName: name || '',
          output: {
            type: 'text',
            text: typeof content === 'string' ? content : JSON.stringify(content)
          },
        }],
      } as unknown as ModelMessage;
    }

    // Handle system messages - always string content
    if (role === 'system') {
      return {
        role: 'system',
        content: typeof content === 'string' ? content :
          Array.isArray(content)
            ? content.filter((p): p is OpenAITextPart => p.type === 'text').map(p => p.text).join('\n')
            : String(content),
      };
    }

    // Handle string content - pass through
    if (typeof content === 'string') {
      if (role === 'assistant') {
        // Check if there are tool calls
        if (tool_calls && tool_calls.length > 0) {
          const parts: AISDKAssistantContentPart[] = [];

          if (content) {
            parts.push({ type: 'text', text: content });
          }

          for (const tc of tool_calls) {
            let parsedInput: unknown = {};
            try {
              parsedInput = JSON.parse(tc.function.arguments || '{}');
            } catch (parseError) {
              console.warn(`[AI SDK Route] Failed to parse tool call arguments for ${tc.function.name}: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
              // Use empty object as fallback for malformed JSON
            }
            parts.push({
              type: 'tool-call',
              toolCallId: tc.id,
              toolName: tc.function.name,
              input: parsedInput,
            });
          }

          return { role: 'assistant', content: parts } as ModelMessage;
        }
        return { role: 'assistant', content };
      }
      return { role: 'user', content };
    }

    // Handle array content - convert each part
    if (Array.isArray(content)) {
      // For user messages: can include text, image, and file parts
      // For assistant messages: can only include text parts (and tool-call which are handled separately above)
      // AI SDK's Zod validation rejects image/file parts in assistant messages
      const isAssistant = role === 'assistant';
      const convertedParts: AISDKUserContentPart[] = [];

      for (const part of content) {
        if (part.type === 'text') {
          convertedParts.push({ type: 'text', text: part.text });
        } else if (part.type === 'image_url' && part.image_url?.url) {
          // Skip image parts for assistant messages - AI SDK rejects them
          if (isAssistant) {
            console.warn('[AI SDK Route] Skipping image_url in assistant message - not supported by AI SDK');
            continue;
          }
          // Convert OpenAI image_url format to AI SDK image format
          const url = part.image_url.url;
          // Check if it's a data URL (base64)
          if (url.startsWith('data:')) {
            // For base64 data URLs, the AI SDK accepts them as strings
            convertedParts.push({
              type: 'image',
              image: url,
            });
          } else {
            // For regular URLs, parse as URL object
            try {
              convertedParts.push({
                type: 'image',
                image: new URL(url),
              });
            } catch {
              console.warn('[AI SDK Route] Failed to parse image URL, skipping:', url.substring(0, 50));
            }
          }
        } else if (part.type === 'file_url' && part.file_url?.url) {
          // Skip file parts for assistant messages - AI SDK rejects them
          if (isAssistant) {
            console.warn('[AI SDK Route] Skipping file_url in assistant message - not supported by AI SDK');
            continue;
          }
          const url = part.file_url.url;
          const mediaType = part.file_url.mime_type || 'application/octet-stream';

          if (url.startsWith('data:')) {
            convertedParts.push({
              type: 'file',
              data: url,
              mediaType,
            });
          } else {
            try {
              convertedParts.push({
                type: 'file',
                data: new URL(url),
                mediaType,
              });
            } catch {
              console.warn('[AI SDK Route] Failed to parse file URL, skipping');
            }
          }
        }
        // Skip audio_url and video_url as they're not supported by the AI SDK in the same way
        // They would need special handling based on the model/provider
      }

      // If no parts were converted, use empty string and log a warning
      // This can happen when all content parts are unsupported media types
      if (convertedParts.length === 0) {
        console.warn(`[AI SDK Route] Message with role "${role}" had all content parts filtered out. Original parts: ${content.map((p: OpenAIContentPart) => p.type).join(', ')}`);
        return role === 'assistant'
          ? { role: 'assistant', content: '' }
          : { role: 'user', content: '' };
      }

      // If only text parts, consider joining them for simpler format
      const hasOnlyText = convertedParts.every(p => p.type === 'text');
      if (hasOnlyText && convertedParts.length === 1) {
        return role === 'assistant'
          ? { role: 'assistant', content: (convertedParts[0] as AISDKTextPart).text }
          : { role: 'user', content: (convertedParts[0] as AISDKTextPart).text };
      }

      // For assistant messages with multiple parts, filter to only text parts to satisfy AI SDK validation
      if (isAssistant) {
        const textOnlyParts = convertedParts.filter((p): p is AISDKTextPart => p.type === 'text');
        if (textOnlyParts.length === 0) {
          console.warn('[AI SDK Route] Assistant message had no text parts after filtering');
          return { role: 'assistant', content: '' };
        }
        return { role: 'assistant', content: textOnlyParts } as ModelMessage;
      }

      // Cast to ModelMessage to satisfy TypeScript - the runtime validation happens in AI SDK
      return { role: 'user', content: convertedParts } as ModelMessage;
    }

    // Fallback for unexpected content types
    return role === 'assistant'
      ? { role: 'assistant', content: String(content || '') }
      : { role: 'user', content: String(content || '') };
  });
}

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

    // For explicit guest requests or missing API key, use the guest API key from environment
    if (isExplicitGuestRequest || isMissingApiKey) {
      const guestKey = process.env.GUEST_API_KEY;

      if (!guestKey) {
        // Guest mode is not configured - return a helpful error
        console.warn('[AI SDK Route] Guest mode attempted but GUEST_API_KEY not configured');
        return new Response(JSON.stringify({
          error: 'Guest mode not available',
          code: 'GUEST_NOT_CONFIGURED',
          message: 'Please sign in to use the chat feature. Create a free account to get started!',
          detail: 'Guest chat is temporarily unavailable. Sign up for a free account to continue.'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check guest rate limit before proceeding
      const clientIP = getClientIP(request);
      const rateLimitCheck = checkGuestRateLimit(clientIP);

      if (!rateLimitCheck.allowed) {
        const resetTime = formatResetTime(rateLimitCheck.resetInMs);
        console.log(`[AI SDK Route] Guest rate limit exceeded for IP ${clientIP}. Reset in ${resetTime}`);
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          code: 'GUEST_RATE_LIMIT_EXCEEDED',
          message: `You've reached the free chat limit. Create a free account for unlimited access, or try again in ${resetTime}.`,
          detail: `Guest users are limited to ${rateLimitCheck.limit} messages per day.`,
          remaining: 0,
          limit: rateLimitCheck.limit,
          resetInMs: rateLimitCheck.resetInMs
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(rateLimitCheck.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + Math.ceil(rateLimitCheck.resetInMs / 1000))
          },
        });
      }

      // Store guest info for rate limit increment after successful stream initialization
      // We don't increment here to avoid consuming quota on pre-stream errors
      (request as any).__guestClientIP = clientIP;

      apiKey = guestKey;
      console.log('[AI SDK Route] Using guest API key for unauthenticated request');
    }

    // Resolve router models to actual model IDs
    let modelId = resolveRouterModel(requestedModelId);
    const wasRouterResolved = modelId !== requestedModelId;
    const isRouterModel = requestedModelId === 'openrouter/auto' || requestedModelId === 'auto-router';

    // IMPORTANT: Redirect models that return non-standard formats to the flexible completions route
    // These providers return non-OpenAI formats that the AI SDK cannot parse.
    // The /api/chat/completions route has flexible format handling.
    // This is a server-side fallback in case client-side detection fails.
    const modelLower = modelId.toLowerCase();
    const gatewayLower = (body.gateway || '').toLowerCase();

    // Gateways that normalize responses to standard OpenAI Chat Completions format
    const normalizingGateways = ['openrouter', 'together', 'groq', 'cerebras', 'anyscale'];
    const hasExplicitNormalizingPrefix = normalizingGateways.some(g => modelLower.startsWith(`${g}/`));
    const isNormalizingGateway = normalizingGateways.includes(gatewayLower);

    // Gateways/providers that return non-standard formats and need the flexible route
    const nonStandardGateways = [
      'fireworks',
      'deepseek',
      'near',
      'chutes',
      'aimo',
      'fal',
      'alibaba',
      'novita',
      'huggingface',
      'hug', // alias for huggingface
      'alpaca',
      'clarifai',
      'featherless',
      'deepinfra',
    ];

    // Check if model is from a non-standard gateway
    const isNonStandardGateway = nonStandardGateways.includes(gatewayLower) ||
      nonStandardGateways.some(gw => modelLower.startsWith(`${gw}/`));

    // Special case: Fireworks models with accounts/ prefix (fireworks/ prefix is already handled by nonStandardGateways)
    const isFireworksModel = modelLower.includes('accounts/fireworks');

    // If model goes through a normalizing gateway, it's safe to use AI SDK
    // Trust explicit sourceGateway over model name prefix - if sourceGateway is a normalizing gateway, use AI SDK
    const isNormalizedByGateway = hasExplicitNormalizingPrefix || isNormalizingGateway;

    // Use flexible route for non-standard gateways UNLESS normalized by a gateway
    const needsFlexibleRoute = (isNonStandardGateway || isFireworksModel) && !isNormalizedByGateway;

    if (needsFlexibleRoute) {
      const reason = isFireworksModel ? 'fireworks-format' : `non-standard-gateway:${gatewayLower || 'model-prefix'}`;
      console.log(`[AI SDK Route] Redirecting to flexible completions route (${reason}): ${modelId}`);

      // Forward the request to /api/chat/completions instead
      // SECURITY: Use a hardcoded trusted origin to prevent SSRF via Host header spoofing.
      // We use the app's known internal URL or fall back to localhost for local dev.
      const trustedOrigin = process.env.NEXT_PUBLIC_APP_URL ||
                            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const searchParams = new URL(request.url).searchParams;
      const completionsUrl = new URL('/api/chat/completions', trustedOrigin);
      searchParams.forEach((value, key) => completionsUrl.searchParams.set(key, value));

      // Update the body with the resolved API key (important for guest users where
      // 'guest' was resolved to GUEST_API_KEY) to ensure consistent authentication
      const forwardedBody = { ...body, apiKey };

      const forwardedResponse = await fetch(completionsUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(forwardedBody),
      });

      // Increment guest rate limit for redirected requests if the response was successful
      // This is critical: we check rate limits before redirect but must increment after
      // to prevent guests from bypassing limits on non-standard model requests
      const guestClientIP = (request as any).__guestClientIP;
      if (guestClientIP && forwardedResponse.ok) {
        const incrementResult = incrementGuestRateLimit(guestClientIP);
        console.log(`[AI SDK Route] Guest redirected request from ${guestClientIP}. Remaining: ${incrementResult.remaining}/${incrementResult.limit}`);
      }

      // Return the response from the flexible completions route
      return new Response(forwardedResponse.body, {
        status: forwardedResponse.status,
        headers: {
          'Content-Type': forwardedResponse.headers.get('Content-Type') || 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Redirected-From': 'ai-sdk-completions',
          'X-Redirect-Reason': reason,
        },
      });
    }

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

        // Convert OpenAI format messages to AI SDK ModelMessage format
        // The AI SDK v5 uses strict Zod validation that rejects OpenAI format (e.g., 'image_url' vs 'image')
        const convertedMessages = convertToAISDKMessages(messages as OpenAIMessage[]);
        console.log('[AI SDK Route] Converted messages to AI SDK format:', {
          originalCount: messages.length,
          convertedCount: convertedMessages.length,
        });

        // Stream the response using AI SDK
        result = streamText({
          model,
          messages: convertedMessages,
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

        // Increment guest rate limit only after successful stream initialization
        // This ensures quota is not consumed on pre-stream errors (invalid model, connection failure, etc.)
        const guestClientIP = (request as any).__guestClientIP;
        if (guestClientIP) {
          const incrementResult = incrementGuestRateLimit(guestClientIP);
          console.log(`[AI SDK Route] Guest request from ${guestClientIP}. Remaining: ${incrementResult.remaining}/${incrementResult.limit}`);
        }

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

            // Log start events for debugging
            if (part.type === 'start' || part.type === 'start-step' || part.type === 'finish-step') {
              console.log('[AI SDK Route] Lifecycle event:', part.type, JSON.stringify(part).substring(0, 300));
            }

            // Handle different part types from AI SDK fullStream
            // Note: fullStream uses text-delta/reasoning-delta (TextStreamPart types)
            // This is different from UIMessageStream which uses text-start/text-delta/text-end
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
            } else if (part.type === 'raw') {
              // Log raw provider responses for debugging
              console.log('[AI SDK Route] Raw part received:', JSON.stringify(part).substring(0, 500));
            } else if (part.type === 'finish') {
              // Log finish details for debugging empty responses
              console.log('[AI SDK Route] Finish received:', {
                finishReason: part.finishReason,
                contentReceived,
                usage: (part as any).usage,
              });
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
            // Silently ignore boundary markers and lifecycle events:
            // - text-start, text-end: Text content boundaries (UIMessageStream format)
            // - reasoning-start, reasoning-end: Reasoning boundaries
            // - step-start, step-finish: Multi-step completion tracking
            // - tool-call, tool-result, tool-error: Tool invocation events
            // - tool-input-start, tool-input-delta, tool-input-end: Tool input streaming
            // - source, file: Content source references
            // - raw: Raw provider output
            // - abort: Stream aborted
            // These don't contain text/reasoning content but are normal AI SDK behavior
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
              } else if (partTypesReceived.every(t => t === 'finish' || t === 'step-finish' || t === 'step-start')) {
                // Only received lifecycle events, no actual content
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
