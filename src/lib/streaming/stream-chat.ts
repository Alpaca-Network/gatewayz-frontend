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

import * as Sentry from '@sentry/nextjs';
import { StreamCoordinator } from '@/lib/stream-coordinator';
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
  console.error('[Streaming ERROR]', ...args);
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
 * Handle HTTP error responses with appropriate error types.
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

  devError('API Error Response:', {
    status: response.status,
    errorData,
    url,
  });

  // Handle specific status codes
  switch (response.status) {
    case 400: {
      // Extract error message from various response formats:
      // - Direct: errorData.detail, errorData.message
      // - Nested error object: errorData.error?.message
      // - Wrapped by API proxy: errorData.errorData?.detail, errorData.errorData?.message
      const errorMessage =
        errorData.detail ||
        errorData.error?.message ||
        errorData.message ||
        errorData.errorData?.detail ||
        errorData.errorData?.message ||
        errorData.errorData?.error?.message ||
        'Bad request';

      devError('400 Bad Request details:', {
        detail: errorData.detail,
        message: errorData.message,
        errorMessage: errorData.error?.message,
        nestedDetail: errorData.errorData?.detail,
        nestedMessage: errorData.errorData?.message,
        fullErrorData: errorData,
      });

      if (
        errorMessage.toLowerCase().includes('trial has expired') ||
        errorMessage.toLowerCase().includes('insufficient credits')
      ) {
        throw new StreamingError(
          'Trial credits have been used up. You can still use FREE models! Look for models with the "FREE" badge, or add credits to use premium models.'
        );
      }

      if (errorMessage.toLowerCase().includes('upstream rejected')) {
        throw new StreamingError(
          `Backend error: ${errorMessage}. This may be a temporary issue. Please try again or select a different model.`
        );
      }

      throw new StreamingError(`Bad request: ${errorMessage}`);
    }

    case 401: {
      const errorCode = errorData.code;

      // Capture auth error to Sentry
      Sentry.captureException(
        new Error(`Chat 401 Unauthorized: ${errorData.detail || errorData.message || 'Authentication required'}`),
        {
          tags: {
            error_type: 'chat_auth_error',
            http_status: 401,
            error_code: errorCode || 'unknown',
            model: String(requestBody.model || 'unknown'),
          },
          extra: {
            errorData,
            url,
            retryCount,
          },
          level: 'warning',
        }
      );

      if (errorCode === 'GUEST_NOT_CONFIGURED') {
        throw new AuthenticationError(
          'Please sign in to use the chat feature. Create a free account to get started!'
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

      throw new AuthenticationError(
        'Your session has expired. Please sign in again to continue.'
      );
    }

    case 403:
      // Capture auth error to Sentry
      Sentry.captureException(
        new Error('Chat 403 Forbidden - session expired'),
        {
          tags: {
            error_type: 'chat_auth_error',
            http_status: 403,
            model: String(requestBody.model || 'unknown'),
          },
          extra: {
            errorData,
            url,
          },
          level: 'warning',
        }
      );
      throw new AuthenticationError(
        'Your session has expired. Please log out and log back in to continue. If this issue persists, clear your browser cookies and log in again.'
      );

    case 404:
      throw new StreamingError(
        `Model not found: ${errorData.detail || errorData.message || 'Unknown model'}`
      );

    case 413:
      throw new StreamingError(
        'Image or request too large. Please try with a smaller image or reduce image quality.'
      );

    case 429: {
      const detailMessage =
        errorData.detail || errorData.message || errorData.error?.message || '';

      if (retryCount < maxRetries) {
        const retryAfterHeader = response.headers.get('retry-after');
        const isConcurrencyLimit = detailMessage.toLowerCase().includes('concurrency');
        const isBurstLimit = detailMessage.toLowerCase().includes('burst');

        const baseDelay = isConcurrencyLimit || isBurstLimit ? 3000 : 1500;
        const maxDelay = isConcurrencyLimit || isBurstLimit ? 30000 : 15000;
        let waitTime = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

        if (retryAfterHeader) {
          const numericRetry = Number(retryAfterHeader);
          if (!Number.isNaN(numericRetry) && numericRetry > 0) {
            waitTime = Math.max(waitTime, numericRetry * 1000);
          }
        }

        waitTime = Math.max(waitTime, 1500) + Math.floor(Math.random() * 500);

        devLog(`Rate limit hit, retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})...`);

        // Return a generator that yields rate limit status then retries
        return (async function* () {
          yield { status: 'rate_limit_retry' as const, retryAfterMs: waitTime };
          await sleep(waitTime);
          yield* streamGenerator(url, apiKey, requestBody, retryCount + 1, maxRetries);
        })();
      }

      throw new RateLimitError(
        detailMessage || 'Rate limit exceeded. Please wait a moment and try again.'
      );
    }

    case 500:
      throw new StreamingError(
        `Server error: ${errorData.detail || errorData.message || 'Internal server error'}. Please try again.`
      );

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

      throw new StreamingError(
        `Service unavailable. The backend appears to be temporarily unavailable. Please try again.`
      );
    }

    default:
      throw new StreamingError(
        errorData.error?.message ||
          errorData.detail ||
          `Request failed with status ${response.status}`
      );
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
          // Handle error chunks from SSE parsing (e.g., finish_reason: 'error')
          if (chunk.error) {
            throw new StreamingError(chunk.error.message, {
              type: chunk.error.type,
              code: chunk.error.code,
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
    throw error;
  }
}
