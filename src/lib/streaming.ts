/**
 * Utility for handling streaming responses from chat API
 */

import { requestAuthRefresh, getApiKey } from '@/lib/api';
import { StreamCoordinator } from '@/lib/stream-coordinator';

// OPTIMIZATION: Dev-only logging helpers to remove console logs from production
const devLog = (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(...args);
    }
};

const devError = (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
        console.error(...args);
    }
};

const devWarn = (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
        console.warn(...args);
    }
};

export interface StreamChunk {
  content?: string;
  reasoning?: string;
  done?: boolean;
  status?: 'rate_limit_retry' | 'first_token' | 'timing_info';
  retryAfterMs?: number;

  // Performance timing metadata
  timingMetadata?: {
    backendTimeMs?: number;
    networkTimeMs?: number;
    totalTimeMs?: number;
  };
}

const toPlainText = (input: unknown): string => {
  if (!input) {
    return '';
  }

  if (typeof input === 'string') {
    return input;
  }

  if (Array.isArray(input)) {
    return input
      .map(item => toPlainText(item))
      .filter(Boolean)
      .join('');
  }

  if (typeof input === 'object') {
    const record = input as Record<string, unknown>;

    if (typeof record.text === 'string') {
      return record.text;
    }

    if (Array.isArray(record.text)) {
      return toPlainText(record.text);
    }

    if (typeof record.value === 'string') {
      return record.value;
    }

    if (typeof record.message === 'string' || Array.isArray(record.message)) {
      return toPlainText(record.message);
    }

    if (typeof record.content === 'string' || Array.isArray(record.content)) {
      return toPlainText(record.content);
    }

    if (typeof record.output_text === 'string' || Array.isArray(record.output_text)) {
      return toPlainText(record.output_text);
    }

    if (Array.isArray(record.reasoning)) {
      return toPlainText(record.reasoning);
    }

    if (Array.isArray(record.thoughts)) {
      return toPlainText(record.thoughts);
    }

    if (Array.isArray(record.parts)) {
      return toPlainText(record.parts);
    }
  }

  return '';
};

// Helper function to wait/sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function* streamChatResponse(
  url: string,
  apiKey: string,
  requestBody: Record<string, unknown>,
  retryCount = 0,
  maxRetries = 5
): AsyncGenerator<StreamChunk> {
  // Client-side timeout for the fetch request (10 minutes for streaming)
  // Increased to accommodate reasoning models, slow providers, and models with large context windows
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000);

  try {
    devLog('[Streaming] Initiating fetch request to:', url);
    devLog('[Streaming] Request body:', requestBody);
    devLog('[Streaming] API Key prefix:', apiKey.substring(0, 20) + '...');

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Handle network errors with retry logic
      if (fetchError instanceof TypeError ||
          (fetchError instanceof Error && (
            fetchError.message.includes('fetch') ||
            fetchError.message.includes('network') ||
            fetchError.message.includes('ECONNREFUSED') ||
            fetchError.message.includes('ECONNRESET') ||
            fetchError.message.includes('ETIMEDOUT')
          ))) {

        if (retryCount < maxRetries) {
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          const waitTime = Math.min(2000 * Math.pow(2, retryCount), 32000);
          const jitter = Math.floor(Math.random() * 1000);
          const totalWaitTime = waitTime + jitter;

          devLog(`Network error detected, retrying in ${totalWaitTime}ms (attempt ${retryCount + 1}/${maxRetries})...`);
          devError('Network error details:', fetchError);

          await sleep(totalWaitTime);

          // Recursive retry
          yield* streamChatResponse(url, apiKey, requestBody, retryCount + 1, maxRetries);
          return;
        }

        // Max retries exceeded
        throw new Error(
          `Network connection failed after ${maxRetries} attempts. Please check your internet connection and try again.`
        );
      }

      // Re-throw non-network errors
      throw fetchError;
    }

    clearTimeout(timeoutId);

    devLog('[Streaming] Fetch completed. Status:', response.status);
    devLog('[Streaming] Response headers:', Object.fromEntries(response.headers.entries()));
    devLog('[Streaming] Response ok:', response.ok);
    devLog('[Streaming] Response body exists:', !!response.body);
    devLog('[Streaming] Content-Type:', response.headers.get('content-type'));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Log full error details for debugging
    devError('API Error Response:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      errorDataJSON: JSON.stringify(errorData, null, 2),
      url
    });

    // Handle specific error cases with helpful messages
    // Handle 400 Bad Request
    if (response.status === 400) {
      const errorMessage = errorData.detail || errorData.error?.message || errorData.message || 'Bad request';
      devError('400 Bad Request details:', errorData);
      // Log the actual error message for debugging credit issues
      console.error('🔴 BACKEND ERROR MESSAGE:', errorMessage);
      console.error('🔴 FULL ERROR DATA:', JSON.stringify(errorData, null, 2));

      // Check for common error patterns that indicate trial/credit issues
      if (errorMessage.toLowerCase().includes('trial has expired') ||
          errorMessage.toLowerCase().includes('upgrade to') ||
          errorMessage.toLowerCase().includes('insufficient credits')) {
        throw new Error(
          'Trial credits have been used up. You can still use FREE models! Look for models with the "FREE" badge in the model selector, or add credits to use premium models.'
        );
      }

      // Handle "upstream rejected" errors with the actual backend message
      if (errorMessage.toLowerCase().includes('upstream rejected')) {
        throw new Error(
          `Backend error: ${errorMessage}. This may be a temporary issue with the model provider. Please try again or select a different model.`
        );
      }

      throw new Error(
        `Bad request: ${errorMessage}`
      );
    }

    if (response.status === 403) {
      throw new Error(
        errorData.detail || errorData.error?.message ||
        'API key validation failed. Your session may need to refresh. Please try logging out and back in.'
      );
    }

    // Handle 500 Internal Server Error
    if (response.status === 500) {
      const errorMessage = errorData.detail || errorData.error?.message || errorData.message || 'Internal server error';
      devError('500 Internal Server Error details:', errorData);
      throw new Error(
        `Server error: ${errorMessage}. Please try again or contact support if the issue persists.`
      );
    }

    // Handle 503 Service Unavailable and 504 Gateway Timeout with retry logic
    if (response.status === 503 || response.status === 504) {
      const isTimeout = response.status === 504;
      const statusText = isTimeout ? 'Gateway Timeout' : 'Service Unavailable';
      const errorMessage = errorData.detail || errorData.error?.message || errorData.message || statusText;

      if (retryCount < maxRetries) {
        // Use exponential backoff with longer delays for server errors
        // 503/504 often indicate temporary overload, so give the server time to recover
        const baseDelay = 2000; // Start with 2 seconds
        const maxDelay = 30000; // Up to 30 seconds
        const waitTime = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
        const jitter = Math.floor(Math.random() * 1000);
        const totalWaitTime = waitTime + jitter;

        devLog(`${statusText} (${response.status}) detected, retrying in ${totalWaitTime}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        devError(`${statusText} error details:`, errorData);

        await sleep(totalWaitTime);

        // Recursive retry
        yield* streamChatResponse(url, apiKey, requestBody, retryCount + 1, maxRetries);
        return;
      }

      // Max retries exceeded
      devError(`Max retries exceeded for ${statusText}`);
      throw new Error(
        `${statusText} error: ${errorMessage}. The backend service appears to be temporarily unavailable. Please try again in a moment.`
      );
    }

    // Handle 404 Model Not Found
    if (response.status === 404) {
      const errorMessage = errorData.detail || errorData.error?.message || errorData.message || 'Model not found';
      devError('404 Model Not Found details:', errorData);
      throw new Error(
        `Model not found: ${errorMessage}`
      );
    }

    if (response.status === 429) {
      const detailMessage: string =
        (typeof errorData.detail === 'string' && errorData.detail) ||
        (typeof errorData.message === 'string' && errorData.message) ||
        (typeof errorData.error?.message === 'string' && errorData.error?.message) ||
        '';

      // Retry with exponential backoff for rate limits
      if (retryCount < maxRetries) {
        const retryAfterHeader = response.headers.get('retry-after');
        const isConcurrencyLimit = detailMessage.toLowerCase().includes('concurrency');
        const baseDelay = isConcurrencyLimit ? 4000 : 1000;
        const maxDelay = isConcurrencyLimit ? 20000 : 8000;

        let waitTime = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

        if (retryAfterHeader) {
          const numericRetry = Number(retryAfterHeader);
          if (!Number.isNaN(numericRetry) && numericRetry > 0) {
            waitTime = Math.max(waitTime, numericRetry * 1000);
          } else {
            const retryDate = Date.parse(retryAfterHeader);
            if (!Number.isNaN(retryDate)) {
              const headerWait = retryDate - Date.now();
              if (headerWait > 0) {
                waitTime = Math.max(waitTime, headerWait);
              }
            }
          }
        }

        waitTime = Math.max(waitTime, 1000); // Ensure a minimum delay
        const jitter = Math.floor(Math.random() * 250);
        waitTime += jitter;

        devLog(`Rate limit hit, retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        if (detailMessage) {
          devLog('Rate limit detail:', detailMessage);
        }

        // Yield a signal chunk so UI can react without showing text in the transcript
        yield {
          status: 'rate_limit_retry',
          retryAfterMs: waitTime
        };

        await sleep(waitTime);

        // Recursive retry
        yield* streamChatResponse(url, apiKey, requestBody, retryCount + 1, maxRetries);
        return;
      }

      throw new Error(
        detailMessage ||
        'Rate limit exceeded. Please wait a moment and try again.'
      );
    }

    if (response.status === 401) {
      // Handle 401 authentication error with potential recovery
      // 1. Attempt to refresh authentication
      // 2. Retry with new API key if available
      // 3. If retry fails or no new key, throw error to user

      try {
        devLog('[Streaming] 401 Authentication error - attempting refresh');

        // Wait for auth refresh to complete
        await StreamCoordinator.handleAuthError();

        // Try to get the new API key after refresh
        const newApiKey = StreamCoordinator.getApiKey();

        if (newApiKey && newApiKey !== apiKey) {
          devLog('[Streaming] New API key obtained after refresh, retrying stream');

          // Retry the stream with the new API key
          yield* streamChatResponse(url, newApiKey, requestBody, retryCount, maxRetries);
          return;
        } else {
          devLog('[Streaming] No new API key available after refresh');
          throw new Error('No new credentials available after refresh');
        }
      } catch (refreshError) {
        devError('[Streaming] Auth refresh failed:', refreshError);

        // If refresh fails, provide user-friendly error
        const refreshErrorMsg = refreshError instanceof Error
          ? refreshError.message
          : 'Unknown error during refresh';

        throw new Error(
          `Authentication failed: ${refreshErrorMsg}. Please log in again.`
        );
      }
    }

    // Generic error with the response message
    throw new Error(
      errorData.error?.message ||
      errorData.detail ||
      `Request failed with status ${response.status}`
    );
  }

  // Extract timing headers for performance tracking
  const backendTimeStr = response.headers.get('X-Backend-Time');
  const networkTimeStr = response.headers.get('X-Network-Time');
  const totalTimeStr = response.headers.get('X-Response-Time');

  if (backendTimeStr || networkTimeStr || totalTimeStr) {
    // Yield timing metadata as first chunk (doesn't affect UI, just for tracking)
    yield {
      status: 'timing_info',
      timingMetadata: {
        backendTimeMs: backendTimeStr ? parseFloat(backendTimeStr) : undefined,
        networkTimeMs: networkTimeStr ? parseFloat(networkTimeStr) : undefined,
        totalTimeMs: totalTimeStr ? parseFloat(totalTimeStr) : undefined,
      }
    };
  }

  const reader = response.body?.getReader();
  if (!reader) {
    devError('[Streaming] No readable stream in response body');
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let chunkCount = 0;
  let contentChunkCount = 0;  // Track chunks with actual content
  let receivedDoneSignal = false;
  let firstChunkReceived = false;
  let isFirstContentChunk = true; // Track first content token for TTFT

  devLog('[Streaming] Stream reader obtained successfully');
  devLog('[Streaming] Starting to read stream...');

  // Per-chunk timeout to detect stalled streams (30 seconds)
  // This resets on each chunk and prevents hanging if backend stops sending
  const chunkTimeoutMs = 30000;
  const firstChunkTimeoutMs = 10000; // First chunk must arrive within 10 seconds
  let chunkTimeoutId: NodeJS.Timeout | null = null;

  const resetChunkTimeout = () => {
    if (chunkTimeoutId) {
      clearTimeout(chunkTimeoutId);
    }
    // Use shorter timeout for first chunk, longer for subsequent chunks
    const timeoutMs = firstChunkReceived ? chunkTimeoutMs : firstChunkTimeoutMs;
    chunkTimeoutId = setTimeout(() => {
      const timeoutMsg = firstChunkReceived
        ? 'Stream chunk timeout - no data received for 30 seconds'
        : 'First chunk timeout - backend did not start streaming within 10 seconds. This usually means the model is unavailable, overloaded, or the backend is not responding properly.';
      devError('[Streaming]', timeoutMsg);
      console.error('[Streaming] Timeout Details:', {
        firstChunkReceived,
        chunkCount,
        url: requestBody?.model,
        gateway: requestBody?.gateway
      });
      reader.cancel(`Stream timeout: ${timeoutMsg}`);
    }, timeoutMs);
  };

  try {
    while (true) {
      devLog(`[Streaming] About to read chunk ${chunkCount + 1}...`);
      resetChunkTimeout(); // Start chunk timeout before reading

      const { done, value } = await reader.read();

      // Mark first chunk as received for timeout adjustment
      if (!firstChunkReceived && value) {
        firstChunkReceived = true;
        devLog('[Streaming] First chunk received - adjusting timeout to 30 seconds for subsequent chunks');
      }

      // Clear the chunk timeout when we receive data
      if (chunkTimeoutId) {
        clearTimeout(chunkTimeoutId);
        chunkTimeoutId = null;
      }

      devLog(`[Streaming] Read completed. Done: ${done}, Has value: ${!!value}, Value length: ${value?.length || 0}`);

      if (done) {
        devLog(`[Streaming] Stream completed. Total chunks processed: ${chunkCount}`);
        break;
      }

      chunkCount++;
      const decodedValue = decoder.decode(value, { stream: true });
      buffer += decodedValue;

      // Log raw decoded value for debugging
      if (decodedValue.length > 0) {
        devLog(`[Streaming] Raw decoded value (first 200 chars):`, decodedValue.substring(0, 200));
      }

      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      devLog(`[Streaming] Processing ${lines.length} lines from chunk ${chunkCount}`);

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          continue;
        }

        // Always log non-empty lines for debugging
        devLog('[Streaming] Processing line:', trimmedLine.substring(0, 100));

        // Handle [DONE] signal by breaking out of the loop
        if (trimmedLine === 'data: [DONE]') {
          devLog('[Streaming] Received [DONE] signal - ending stream');
          receivedDoneSignal = true;
          break;
        }

        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6);
            const data = JSON.parse(jsonStr);

            devLog('[Streaming] Parsed SSE data:', {
              hasOutput: !!data.output,
              hasChoices: !!data.choices,
              hasType: !!data.type,
              dataKeys: Object.keys(data),
              fullData: JSON.stringify(data)  // Convert to string for better logging
            });

            let chunk: StreamChunk | null = null;

            // Handle backend response format with "output" array
            const output = data.output?.[0];
            if (output && typeof output === 'object') {
              const outputRecord = output as Record<string, unknown>;
              const contentText = toPlainText(outputRecord.content ?? outputRecord.output_text);
              const reasoningText =
                toPlainText(outputRecord.reasoning_content) ||
                toPlainText(outputRecord.reasoning) ||
                toPlainText(outputRecord.thinking) ||
                toPlainText(outputRecord.analysis);
              const finishReason = outputRecord.finish_reason;

              // Log when reasoning fields are present
              if (outputRecord.reasoning || outputRecord.thinking || outputRecord.analysis) {
                devLog('[Streaming] Found reasoning field in output:', {
                  hasReasoning: !!outputRecord.reasoning,
                  hasThinking: !!outputRecord.thinking,
                  hasAnalysis: !!outputRecord.analysis,
                  reasoningLength: reasoningText.length
                });
              }

              if (contentText || reasoningText || finishReason) {
                chunk = {};
                if (contentText) {
                  chunk.content = contentText;
                }
                if (reasoningText) {
                  chunk.reasoning = reasoningText;
                  devLog('[Streaming] Adding reasoning to chunk:', reasoningText.length, 'chars');
                }
                if (finishReason) {
                  chunk.done = true;
                }
              }
            }
            // Handle OpenAI-style "choices" format
            else {
              const choice = data.choices?.[0];

              if (choice?.delta) {
                const delta = choice.delta;
                const deltaRecord = delta as Record<string, unknown>;

                // OPTIMIZATION: Skip processing if delta only contains role (common in initial chunks)
                // This improves performance when models send many empty initialization chunks
                const deltaKeys = Object.keys(deltaRecord);
                if (deltaKeys.length === 1 && deltaKeys[0] === 'role') {
                  continue; // Skip to next line, don't process this empty chunk
                }

                const contentText =
                  toPlainText(deltaRecord.content) ||
                  toPlainText(deltaRecord.text) ||
                  toPlainText(deltaRecord.output_text);
                const reasoningText =
                  toPlainText(deltaRecord.reasoning_content) ||
                  toPlainText(deltaRecord.reasoning) ||
                  toPlainText(deltaRecord.thinking) ||
                  toPlainText(deltaRecord.analysis) ||
                  toPlainText(deltaRecord.inner_thought) ||
                  toPlainText(deltaRecord.thoughts);
                const finishReason = choice.finish_reason;

                // Log when reasoning fields are present
                if (deltaRecord.reasoning || deltaRecord.thinking || deltaRecord.analysis || deltaRecord.inner_thought || deltaRecord.thoughts) {
                  devLog('[Streaming] Found reasoning field in delta:', {
                    hasReasoning: !!deltaRecord.reasoning,
                    hasThinking: !!deltaRecord.thinking,
                    hasAnalysis: !!deltaRecord.analysis,
                    hasInnerThought: !!deltaRecord.inner_thought,
                    hasThoughts: !!deltaRecord.thoughts,
                    reasoningLength: reasoningText.length
                  });
                }

                if (contentText || reasoningText || finishReason) {
                  chunk = {};
                  if (contentText) {
                    chunk.content = contentText;
                  }
                  if (reasoningText) {
                    chunk.reasoning = reasoningText;
                    devLog('[Streaming] Adding reasoning to chunk from delta:', reasoningText.length, 'chars');
                  }
                  if (finishReason) {
                    chunk.done = true;
                  }
                }
              } else if (choice?.finish_reason) {
                chunk = { done: true };
              }
            }

            // Check for error object in the response
            if (data.error && typeof data.error === 'object') {
              const errorObj = data.error as Record<string, unknown>;
              const errorMessage =
                (typeof errorObj.message === 'string' && errorObj.message) ||
                (typeof errorObj.detail === 'string' && errorObj.detail) ||
                'Stream error occurred';

              // Check if it's a trial expiration error
              if (errorMessage.toLowerCase().includes('trial has expired') ||
                  errorMessage.toLowerCase().includes('insufficient credits')) {
                throw new Error(
                  'Trial credits have been used up. You can still use FREE models! Look for models with the "FREE" badge in the model selector, or add credits to use premium models.'
                );
              }

              // Handle "upstream rejected" errors with the actual backend message
              if (errorMessage.toLowerCase().includes('upstream rejected')) {
                throw new Error(
                  `Backend error: ${errorMessage}. This may be a temporary issue with the model provider. Please try again or select a different model.`
                );
              }

              throw new Error(errorMessage);
            }

            // Handle event-based streaming formats
            if (!chunk && typeof data.type === 'string') {
              const eventType = data.type;
              switch (eventType) {
                case 'response.output_text.delta': {
                  const delta = data.delta;
                  const deltaText = toPlainText(delta);
                  const reasoningText =
                    toPlainText((delta as Record<string, unknown>)?.reasoning_content) ||
                    toPlainText((delta as Record<string, unknown>)?.reasoning) ||
                    toPlainText((delta as Record<string, unknown>)?.thinking);
                  if (deltaText || reasoningText) {
                    chunk = {};
                    if (deltaText) {
                      chunk.content = deltaText;
                    }
                    if (reasoningText) {
                      chunk.reasoning = reasoningText;
                    }
                  }
                  break;
                }
                case 'response.reasoning_content.delta':
                case 'response.reasoning.delta':
                case 'response.output_reasoning.delta':
                case 'response.reflection.delta':
                case 'response.thinking.delta':
                case 'response.output_thinking.delta':
                case 'response.inner_thought.delta': {
                  const reasoningText = toPlainText(data.delta);
                  if (reasoningText) {
                    chunk = { reasoning: reasoningText };
                  }
                  break;
                }
                case 'response.output_text.done':
                case 'response.completed':
                case 'response.message.completed':
                case 'response.stop':
                  chunk = { done: true };
                  break;
                case 'response.error': {
                  const errorMessage =
                    (typeof data.error?.message === 'string' && data.error.message) ||
                    (typeof data.message === 'string' && data.message) ||
                    'Response stream error';
                  throw new Error(errorMessage);
                }
                default:
                  break;
              }
            }

            if (chunk) {
              // Only yield chunks that have actual content, reasoning, or are the final chunk
              // Skip empty chunks to improve streaming performance
              if (chunk.content || chunk.reasoning || chunk.done) {
                // Mark first content chunk for TTFT tracking
                if (isFirstContentChunk && (chunk.content || chunk.reasoning)) {
                  chunk.status = 'first_token';
                  isFirstContentChunk = false;
                }

                // Track actual content chunks (not just metadata or done signals)
                if (chunk.content || chunk.reasoning) {
                  contentChunkCount++;
                }

                devLog('[Streaming] Yielding chunk:', {
                  hasContent: !!chunk.content,
                  contentLength: chunk.content?.length || 0,
                  hasReasoning: !!chunk.reasoning,
                  isDone: !!chunk.done,
                  isFirstToken: chunk.status === 'first_token',
                  contentChunkCount
                });
                yield chunk;
              } else {
                devLog('[Streaming] Skipping empty chunk');
              }
            } else {
              // Check if the data has error indicators
              if (data.error || data.detail || data.message) {
                const errorMsg = data.error?.message || data.detail || data.message;
                devError('[Streaming] Possible error in SSE data:', errorMsg);
                console.error('[Streaming] Backend may have returned an error:', data);
              }
              devWarn('[Streaming] No chunk created from SSE data. This may indicate an unsupported response format or an error from the backend.');
              devWarn('[Streaming] Unrecognized data structure:', data);
              devWarn('[Streaming] Data as JSON:', JSON.stringify(data, null, 2));
            }
          } catch (error) {
            devError('[Streaming] Error parsing SSE data:', error, trimmedLine);
          }
        } else {
          devLog('[Streaming] Line does not start with "data: ":', trimmedLine.substring(0, 50));
        }
      }

      // Break out of the outer while loop if we received [DONE] signal
      if (receivedDoneSignal) {
        devLog('[Streaming] Breaking out of read loop due to [DONE] signal');
        // Yield a final done chunk to signal completion to the UI
        yield { done: true };
        break;
      }
    }

    // If we exited the loop normally (stream closed by server), also yield done
    devLog('[Streaming] Stream ended normally, yielding final done signal');

    // Important: Log if we received any content at all
    if (contentChunkCount === 0) {
      const errorMsg = `No response received from model "${requestBody.model}". This model may not be properly configured, may be unavailable, or may not support the requested features. Please try a different model or check the model's availability status.`;
      console.error('[Streaming] ERROR:', errorMsg);
      console.error('[Streaming] Model:', requestBody.model);
      console.error('[Streaming] API Base URL:', url);
      console.error('[Streaming] Total SSE lines processed:', chunkCount);
      // Throw an error so the UI can show a proper error message
      throw new Error(errorMsg);
    }

    // Final signal to indicate stream is complete
    yield { done: true };

    devLog('[Streaming] Stream completed successfully with', contentChunkCount, 'content chunks from', chunkCount, 'total SSE lines');
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort/timeout errors
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 10 minutes. The model may be overloaded, unavailable, or generating a very long response. Please try again or select a different model.');
      }
    }

    // Re-throw other errors
    throw error;
  } finally {
    // Clean up chunk timeout
    if (chunkTimeoutId) {
      clearTimeout(chunkTimeoutId);
    }
    devLog('[Streaming] Stream reader released');
    reader.releaseLock();
  }
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort/timeout errors from outer try block
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 10 minutes. The model may be overloaded, unavailable, or generating a very long response. Please try again or select a different model.');
      }
    }

    // Re-throw other errors
    throw error;
  }
}
