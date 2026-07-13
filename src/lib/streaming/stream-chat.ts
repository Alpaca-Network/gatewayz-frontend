/**
 * Stream Chat Response
 *
 * Main streaming function that handles fetching and parsing SSE responses.
 * Supports retry logic, auth refresh, and multiple provider formats.
 *
 * @deprecated This module is deprecated. Use the AI SDK route (/api/chat/ai-sdk-completions)
 * which now handles all provider formats including Fireworks and DeepSeek.
 * This file is kept for backwards compatibility during migration.
 */

import { StreamCoordinator } from '@/lib/stream-coordinator';
import { classifyApiError, getUserMessage, ApiError, type AppError } from '@/lib/errors';
import { trackBackendError } from '@/lib/backend-error-tracking';
import type { StreamChunk, StreamConfig } from './types';
import { parseSSEBuffer } from './sse-parser';
import {
  StreamingError,
  AuthenticationError,
  RateLimitError,
  StreamTimeoutError,
  EmptyResponseError,
} from './errors';

// Re-export types for backwards compatibility
export type { StreamChunk } from './types';

// Logging helpers
const isDebugEnabled =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_DEBUG_STREAMING === 'true';

const devLog = (...args: unknown[]) => {
  if (isDebugEnabled) {
    console.log('[Streaming]', ...args);
  }
};

const devError = (...args: unknown[]) => {
  // Serialize objects to avoid [object Object] in logs/Sentry
  const serializedArgs = args.map(arg =>
    typeof arg === 'object' && arg !== null ? JSON.stringify(arg, null, 2) : arg
  );
  console.error('[Streaming ERROR]', ...serializedArgs);
};

// Helper function to wait/sleep
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Configuration with defaults applied.
 */
const CONFIG: Required<StreamConfig> = {
  streamTimeoutMs: 60_000, // 1 minute max
  firstChunkTimeoutMs: 10_000, // 10 seconds
  chunkTimeoutMs: 30_000, // 30 seconds
  maxRetries: 7,
  debug: isDebugEnabled,
};

/**
 * Read Retry-After from a response as seconds (supports numeric and HTTP-date forms).
 */
function readRetryAfterSeconds(response: Response): number | undefined {
  const header = response.headers.get('retry-after');
  if (!header) return undefined;

  const numeric = Number(header);
  if (!Number.isNaN(numeric) && numeric > 0) return numeric;

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    const seconds = (date - Date.now()) / 1000;
    if (seconds > 0) return seconds;
  }
  return undefined;
}

/** Pull the backend's error code/type out of a (possibly proxy-wrapped) error body. */
function readErrorCodeAndType(errorData: Record<string, unknown>): { code?: string; type?: string } {
  const candidates = [errorData, errorData.errorData].filter(
    (c): c is Record<string, unknown> => !!c && typeof c === 'object'
  );
  for (const candidate of candidates) {
    const errorField = candidate.error;
    if (errorField && typeof errorField === 'object') {
      const obj = errorField as Record<string, unknown>;
      return {
        code: typeof obj.code === 'string' ? obj.code : undefined,
        type: typeof obj.type === 'string' ? obj.type : undefined,
      };
    }
    if (typeof candidate.code === 'string') {
      return { code: candidate.code, type: typeof candidate.type === 'string' ? candidate.type : undefined };
    }
  }
  return {};
}

/**
 * Errors whose raw payload has already been sent to telemetry. Prevents
 * double-reporting when nested retry generators re-throw the same error.
 */
const reportedErrors = new WeakSet<Error>();

/** Mark an error as already reported to telemetry, then return it for throwing. */
function markReported<T extends Error>(error: T): T {
  reportedErrors.add(error);
  return error;
}

/**
 * Report a mid-stream (SSE) error to telemetry with its raw detail. No-op if
 * this error object was already reported.
 */
function reportStreamError(error: StreamingError, url: string, requestBody: Record<string, unknown>): void {
  if (reportedErrors.has(error)) return;
  reportedErrors.add(error);
  try {
    trackBackendError(error, {
      endpoint: url,
      method: 'POST',
      model: String(requestBody.model || 'unknown'),
      gateway: typeof requestBody.gateway === 'string' ? requestBody.gateway : undefined,
      requestId: error.requestId,
      errorCode: error.code,
      errorType: error.type,
      rateLimitScope: error.rateLimitScope,
      responseBody: error.rawDetail,
    });
  } catch {
    // Telemetry must never break the stream.
  }
}

/**
 * Send the full raw failure payload to telemetry (Sentry). This is the ONLY
 * place raw backend error text is allowed to go — never to the screen.
 */
function reportBackendFailure(
  status: number,
  errorData: unknown,
  url: string,
  requestBody: Record<string, unknown>,
  extras: { requestId?: string; rateLimitScope?: string; retryCount?: number; errorCode?: string; errorType?: string }
): void {
  try {
    let responseBody: string | undefined;
    try {
      responseBody = JSON.stringify(errorData);
    } catch {
      responseBody = String(errorData);
    }
    trackBackendError(new Error(`Chat API error: ${status} at ${url}`), {
      endpoint: url,
      statusCode: status,
      method: 'POST',
      model: String(requestBody.model || 'unknown'),
      gateway: typeof requestBody.gateway === 'string' ? requestBody.gateway : undefined,
      retryCount: extras.retryCount,
      requestId: extras.requestId,
      errorCode: extras.errorCode,
      errorType: extras.errorType,
      rateLimitScope: extras.rateLimitScope,
      responseBody,
    });
  } catch {
    // Telemetry must never break the stream.
  }
}

/**
 * Handle HTTP error responses with appropriate error types.
 *
 * Every thrown error carries safe, user-facing copy in `.message` (mapped by
 * status + backend error code via classifyApiError) plus the classified
 * AppError so downstream display keeps request IDs / retry metadata. Raw
 * backend text goes to telemetry only.
 */
async function handleHttpError(
  response: Response,
  url: string,
  apiKey: string,
  requestBody: Record<string, unknown>,
  retryCount: number,
  maxRetries: number,
  streamGenerator: typeof streamChatResponse
): Promise<AsyncGenerator<StreamChunk> | null> {
  const errorData = await response.json().catch(() => ({}));

  const retryAfterSeconds = readRetryAfterSeconds(response);
  const rateLimitScopeHeader = response.headers.get('x-ratelimit-scope');
  const headerRequestId = response.headers.get('x-request-id');
  const { code: backendCode, type: backendType } = readErrorCodeAndType(errorData);

  const appError = classifyApiError(response.status, errorData, {
    retryAfter: retryAfterSeconds,
    rateLimitScope: rateLimitScopeHeader,
    requestId: headerRequestId,
  });

  devError('API Error Response:', {
    status: response.status,
    errorData,
    url,
  });

  // Raw payload → telemetry. Friendly copy → screen.
  reportBackendFailure(response.status, errorData, url, requestBody, {
    requestId: appError.requestId,
    rateLimitScope: appError.rateLimitScope,
    retryCount,
    errorCode: backendCode,
    errorType: backendType,
  });

  const throwWithAppError = (error: AppError): never => {
    throw markReported(
      new StreamingError(getUserMessage(error), {
        code: error.code,
        retryable: error.retryable,
        requestId: error.requestId,
        retryAfterSeconds: error.retryAfterSeconds,
        rateLimitScope: error.rateLimitScope,
        appError: error,
      })
    );
  };

  // Handle specific status codes
  switch (response.status) {
    case 400: {
      // Internal-only raw text, used purely to classify legacy 400s that
      // predate structured error codes. Never displayed.
      const rawMessage = String(
        errorData.detail ||
          errorData.error?.message ||
          errorData.message ||
          errorData.errorData?.detail ||
          errorData.errorData?.message ||
          errorData.errorData?.error?.message ||
          ''
      ).toLowerCase();

      if (rawMessage.includes('trial has expired') || rawMessage.includes('insufficient credits')) {
        const creditsError = new ApiError(
          'API_PAYMENT_REQUIRED',
          'Trial credits have been used up. You can still use FREE models! Look for models with the "FREE" badge, or add credits to use premium models.',
          { statusCode: 400, requestId: appError.requestId }
        );
        return throwWithAppError(creditsError);
      }

      return throwWithAppError(appError);
    }

    case 401: {
      const errorCode = errorData.code;

      if (errorCode === 'GUEST_NOT_CONFIGURED') {
        throw markReported(
          new AuthenticationError(
            'Please sign in to use the chat feature. Create a free account to get started!'
          )
        );
      }

      // Attempt auth refresh on first try using StreamCoordinator for concurrency handling
      if (retryCount === 0 && typeof window !== 'undefined') {
        devLog('Attempting auth refresh for 401 error...');

        try {
          // Use StreamCoordinator to handle concurrent 401 errors and prevent multiple refreshes
          await StreamCoordinator.handleAuthError();
          const newApiKey = StreamCoordinator.getApiKey();

          if (newApiKey) {
            // Add backoff delay to allow backend state to propagate after refresh
            const backoffDelay = 1000 * Math.pow(2, retryCount); // 1s, 2s, 4s, etc.
            devLog(`Waiting ${backoffDelay}ms before retry after auth refresh...`);
            await sleep(backoffDelay);

            devLog('Retrying with refreshed credentials...');
            // Retry even if key is unchanged - backend state may have been updated
            return streamGenerator(url, newApiKey, requestBody, 1, maxRetries);
          }
        } catch (refreshError) {
          devError('Auth refresh failed:', refreshError);
        }
      }

      throw markReported(
        new AuthenticationError('Your session has expired. Please sign in again to continue.')
      );
    }

    case 402:
      // Insufficient credits. classifyApiError produced API_PAYMENT_REQUIRED
      // copy; the UI attaches an "Add credits" CTA to that code.
      return throwWithAppError(appError);

    case 403: {
      // 403 = the key is valid but lacks access/subscription for this action. This is NOT
      // an expired session; a re-login loop can never resolve a billing/access problem.
      if (appError.code === 'SUBSCRIPTION_INACTIVE') {
        // subscription_* error codes — the UI attaches a "Renew" CTA.
        return throwWithAppError(appError);
      }
      const accessError = new ApiError(
        'API_ERROR',
        "You don't have access to this model or action. If this is a paid model, add credits or upgrade your plan, then try again.",
        { statusCode: 403, requestId: appError.requestId }
      );
      return throwWithAppError(accessError);
    }

    case 404: {
      const notFoundError = new ApiError(
        'API_NOT_FOUND',
        "That model isn't available. Please choose a different model.",
        { statusCode: 404, requestId: appError.requestId }
      );
      return throwWithAppError(notFoundError);
    }

    case 413: {
      const tooLargeError = new ApiError(
        'API_VALIDATION_ERROR',
        'Image or request too large. Please try with a smaller image or reduce image quality.',
        { statusCode: 413, requestId: appError.requestId }
      );
      return throwWithAppError(tooLargeError);
    }

    case 429: {
      const isUpstream = appError.rateLimitScope === 'upstream';

      if (isUpstream) {
        // The model provider is rate limited (common on free models) — this is
        // NOT the user's fault. Auto-retry ONCE after Retry-After; the yielded
        // status chunk lets the UI show a countdown while we wait.
        if (retryCount === 0) {
          const waitTime = Math.max(1000, Math.round((retryAfterSeconds ?? 3) * 1000)) + Math.floor(Math.random() * 500);
          devLog(`Upstream rate limit, auto-retrying once in ${waitTime}ms...`);

          return (async function* () {
            yield {
              status: 'rate_limit_retry' as const,
              retryAfterMs: waitTime,
              rateLimitScope: 'upstream' as const,
            };
            await sleep(waitTime);
            yield* streamGenerator(url, apiKey, requestBody, Math.max(retryCount + 1, 1), maxRetries);
          })();
        }

        throw markReported(
          new RateLimitError(getUserMessage(appError), (retryAfterSeconds ?? 0) * 1000 || undefined, {
            rateLimitScope: 'upstream',
            requestId: appError.requestId,
            appError,
          })
        );
      }

      // Gateway rate limit — the user is sending requests too quickly. Retry
      // with backoff a few times, then surface the wait-N-seconds copy.
      if (retryCount < maxRetries) {
        const rawDetail = String(
          errorData.detail || errorData.message || errorData.error?.message || ''
        ).toLowerCase();
        const isConcurrencyLimit = rawDetail.includes('concurrency');
        const isBurstLimit = rawDetail.includes('burst');

        const baseDelay = isConcurrencyLimit || isBurstLimit ? 3000 : 1500;
        const maxDelay = isConcurrencyLimit || isBurstLimit ? 30000 : 15000;
        let waitTime = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

        if (retryAfterSeconds) {
          waitTime = Math.max(waitTime, retryAfterSeconds * 1000);
        }

        waitTime = Math.max(waitTime, 1500) + Math.floor(Math.random() * 500);

        devLog(`Rate limit hit, retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})...`);

        // Return a generator that yields rate limit status then retries
        return (async function* () {
          yield {
            status: 'rate_limit_retry' as const,
            retryAfterMs: waitTime,
            rateLimitScope: 'gateway' as const,
          };
          await sleep(waitTime);
          yield* streamGenerator(url, apiKey, requestBody, retryCount + 1, maxRetries);
        })();
      }

      throw markReported(
        new RateLimitError(getUserMessage(appError), (retryAfterSeconds ?? 0) * 1000 || undefined, {
          rateLimitScope: 'gateway',
          requestId: appError.requestId,
          appError,
        })
      );
    }

    case 502:
    case 503:
    case 504: {
      if (retryCount < maxRetries) {
        const baseDelay = 2000;
        const maxDelay = 30000;
        const waitTime =
          Math.min(baseDelay * Math.pow(2, retryCount), maxDelay) +
          Math.floor(Math.random() * 1000);

        devLog(`${response.status} error, retrying in ${waitTime}ms...`);
        await sleep(waitTime);
        return streamGenerator(url, apiKey, requestBody, retryCount + 1, maxRetries);
      }

      const unavailableError = new ApiError(
        'API_SERVER_ERROR',
        'Service unavailable. The backend appears to be temporarily unavailable. Please try again.',
        { statusCode: response.status, requestId: appError.requestId, retryable: true }
      );
      return throwWithAppError(unavailableError);
    }

    default:
      // 500s and anything unmapped: generic copy from the classifier. The
      // request ID rides along so the UI can show a subtle "Error ID".
      return throwWithAppError(appError);
  }
}

/**
 * Stream chat response from the API.
 *
 * @deprecated Use the AI SDK route instead. This function is kept for backwards compatibility.
 *
 * @param url - API endpoint URL
 * @param apiKey - Authentication API key
 * @param requestBody - Request body including model and messages
 * @param retryCount - Current retry attempt (internal use)
 * @param maxRetries - Maximum retry attempts
 * @yields StreamChunk objects with content, reasoning, or status
 */
export async function* streamChatResponse(
  url: string,
  apiKey: string,
  requestBody: Record<string, unknown>,
  retryCount = 0,
  maxRetries = CONFIG.maxRetries
): AsyncGenerator<StreamChunk> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.streamTimeoutMs);

  try {
    devLog('Initiating fetch request to:', url);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Handle network errors with retry
      if (
        fetchError instanceof TypeError ||
        (fetchError instanceof Error &&
          (fetchError.message.includes('fetch') ||
            fetchError.message.includes('network') ||
            fetchError.message.includes('ECONNREFUSED') ||
            fetchError.message.includes('ECONNRESET') ||
            fetchError.message.includes('ETIMEDOUT')))
      ) {
        if (retryCount < maxRetries) {
          const waitTime =
            Math.min(2000 * Math.pow(2, retryCount), 32000) +
            Math.floor(Math.random() * 1000);
          devLog(`Network error, retrying in ${waitTime}ms...`);
          await sleep(waitTime);
          yield* streamChatResponse(url, apiKey, requestBody, retryCount + 1, maxRetries);
          return;
        }
        throw new StreamingError(
          'Network connection failed. Please check your internet connection and try again.'
        );
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);
    devLog('Response status:', response.status);

    // Handle error responses
    if (!response.ok) {
      const result = await handleHttpError(
        response,
        url,
        apiKey,
        requestBody,
        retryCount,
        maxRetries,
        streamChatResponse
      );
      if (result) {
        yield* result;
        return;
      }
    }

    // Extract timing headers
    const backendTimeStr = response.headers.get('X-Backend-Time');
    const networkTimeStr = response.headers.get('X-Network-Time');
    const totalTimeStr = response.headers.get('X-Response-Time');

    if (backendTimeStr || networkTimeStr || totalTimeStr) {
      yield {
        status: 'timing_info',
        timingMetadata: {
          backendTimeMs: backendTimeStr ? parseFloat(backendTimeStr) : undefined,
          networkTimeMs: networkTimeStr ? parseFloat(networkTimeStr) : undefined,
          totalTimeMs: totalTimeStr ? parseFloat(totalTimeStr) : undefined,
        },
      };
    }

    // Get stream reader
    const reader = response.body?.getReader();
    if (!reader) {
      throw new StreamingError('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let contentChunkCount = 0;
    let yieldedDoneSignal = false;
    let firstChunkReceived = false;
    let isFirstContentChunk = true;
    let chunkTimeoutHandle: NodeJS.Timeout | null = null;

    const resetChunkTimeout = () => {
      if (chunkTimeoutHandle) clearTimeout(chunkTimeoutHandle);
      const timeoutMs = firstChunkReceived
        ? CONFIG.chunkTimeoutMs
        : CONFIG.firstChunkTimeoutMs;
      chunkTimeoutHandle = setTimeout(() => {
        const msg = firstChunkReceived
          ? 'Stream timeout - no data received for 30 seconds'
          : 'First chunk timeout - backend did not respond in time';
        devError(msg);
        reader.cancel(msg);
      }, timeoutMs);
    };

    try {
      while (true) {
        resetChunkTimeout();
        const { done, value } = await reader.read();

        if (!firstChunkReceived && value) {
          firstChunkReceived = true;
        }

        if (chunkTimeoutHandle) {
          clearTimeout(chunkTimeoutHandle);
          chunkTimeoutHandle = null;
        }

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE buffer
        const { chunks, remaining, done: streamDone } = parseSSEBuffer(buffer);
        buffer = remaining;

        // Yield parsed chunks
        for (const chunk of chunks) {
          // Handle error chunks from SSE parsing (e.g., finish_reason: 'error').
          // chunk.error.message is already safe copy from the parser.
          if (chunk.error) {
            throw new StreamingError(chunk.error.message, {
              type: chunk.error.type,
              code: chunk.error.code,
              retryable: chunk.error.retryable ?? true,
              requestId: chunk.error.requestId,
              rawDetail: chunk.error.rawDetail,
              appError: chunk.error.appError,
            });
          }

          // Handle tool call events (server executing a tool)
          if (chunk.type === 'tool_call' && chunk.toolCall) {
            yield {
              type: 'tool_call',
              toolCall: chunk.toolCall,
            };
            continue;
          }

          // Handle tool result events (tool execution completed)
          if (chunk.type === 'tool_result' && chunk.toolResult) {
            yield {
              type: 'tool_result',
              toolResult: chunk.toolResult,
            };
            continue;
          }

          if (chunk.content || chunk.reasoning) {
            contentChunkCount++;

            const streamChunk: StreamChunk = {};
            if (chunk.content) streamChunk.content = chunk.content;
            if (chunk.reasoning) streamChunk.reasoning = chunk.reasoning;

            // Mark first content chunk
            if (isFirstContentChunk) {
              streamChunk.status = 'first_token';
              isFirstContentChunk = false;
            }

            yield streamChunk;
          }

          if (chunk.done && !yieldedDoneSignal) {
            yieldedDoneSignal = true;
            yield { done: true };
          }
        }

        if (streamDone) break;
      }

      // Check for empty response
      if (contentChunkCount === 0) {
        const modelId = String(requestBody.model || 'unknown');
        throw new EmptyResponseError(modelId);
      }

      // Yield final done if not already yielded
      if (!yieldedDoneSignal) {
        yield { done: true };
      }
    } finally {
      if (chunkTimeoutHandle) clearTimeout(chunkTimeoutHandle);
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new StreamTimeoutError(
        'Request timed out. The model may be overloaded or generating a very long response.'
      );
    }
    // Mid-stream (SSE) errors weren't reported by handleHttpError — send their
    // raw payload to telemetry here before rethrowing the friendly message.
    if (error instanceof StreamingError) {
      reportStreamError(error, url, requestBody);
    }
    throw error;
  }
}
