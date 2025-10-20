/**
 * Utility for handling streaming responses from chat API
 */

import { removeApiKey, requestAuthRefresh } from '@/lib/api';

export interface StreamChunk {
  content?: string;
  reasoning?: string;
  done?: boolean;
  status?: 'rate_limit_retry';
  retryAfterMs?: number;
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
  // Client-side timeout for the fetch request (2 minutes for streaming)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Log full error details for debugging
    console.error('API Error Response:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      url
    });

    // Handle specific error cases with helpful messages
    if (response.status === 403) {
      throw new Error(
        errorData.detail || errorData.error?.message ||
        'API key validation failed. Your session may need to refresh. Please try logging out and back in.'
      );
    }

    // Handle 500 Internal Server Error
    if (response.status === 500) {
      const errorMessage = errorData.detail || errorData.error?.message || errorData.message || 'Internal server error';
      console.error('500 Internal Server Error details:', errorData);
      throw new Error(
        `Server error: ${errorMessage}. Please try again or contact support if the issue persists.`
      );
    }

    // Handle 404 Model Not Found
    if (response.status === 404) {
      const errorMessage = errorData.detail || errorData.error?.message || errorData.message || 'Model not found';
      console.error('404 Model Not Found details:', errorData);
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

        console.log(`Rate limit hit, retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        if (detailMessage) {
          console.log('Rate limit detail:', detailMessage);
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

      removeApiKey();
      requestAuthRefresh();
      throw new Error(
        detailMessage ||
        'Rate limit exceeded. Please wait a moment and try again.'
      );
    }

    if (response.status === 401) {
      removeApiKey();
      requestAuthRefresh();
      throw new Error(
        'Authentication failed. Please check your API key or log in again.'
      );
    }

    // Generic error with the response message
    throw new Error(
      errorData.error?.message ||
      errorData.detail ||
      `Request failed with status ${response.status}`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let chunkCount = 0;

  console.log('[Streaming] Starting to read stream...');

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log(`[Streaming] Stream completed. Total chunks processed: ${chunkCount}`);
        break;
      }

      chunkCount++;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      console.log(`[Streaming] Processing ${lines.length} lines from chunk ${chunkCount}`);

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine === 'data: [DONE]') {
          if (trimmedLine === 'data: [DONE]') {
            console.log('[Streaming] Received [DONE] signal');
          }
          continue;
        }

        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6);
            const data = JSON.parse(jsonStr);

            console.log('[Streaming] Parsed SSE data:', {
              hasOutput: !!data.output,
              hasChoices: !!data.choices,
              hasType: !!data.type,
              dataKeys: Object.keys(data),
              fullData: data  // Log the full data structure to debug
            });

            let chunk: StreamChunk | null = null;

            // Handle backend response format with "output" array
            const output = data.output?.[0];
            if (output && typeof output === 'object') {
              const outputRecord = output as Record<string, unknown>;
              const contentText = toPlainText(outputRecord.content ?? outputRecord.output_text);
              const reasoningText =
                toPlainText(outputRecord.reasoning) ||
                toPlainText(outputRecord.thinking) ||
                toPlainText(outputRecord.analysis);
              const finishReason = outputRecord.finish_reason;

              // Log when reasoning fields are present
              if (outputRecord.reasoning || outputRecord.thinking || outputRecord.analysis) {
                console.log('[Streaming] Found reasoning field in output:', {
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
                  console.log('[Streaming] Adding reasoning to chunk:', reasoningText.length, 'chars');
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
                const contentText =
                  toPlainText(deltaRecord.content) ||
                  toPlainText(deltaRecord.text) ||
                  toPlainText(deltaRecord.output_text);
                const reasoningText =
                  toPlainText(deltaRecord.reasoning) ||
                  toPlainText(deltaRecord.thinking) ||
                  toPlainText(deltaRecord.analysis) ||
                  toPlainText(deltaRecord.inner_thought) ||
                  toPlainText(deltaRecord.thoughts);
                const finishReason = choice.finish_reason;

                // Log when reasoning fields are present
                if (deltaRecord.reasoning || deltaRecord.thinking || deltaRecord.analysis || deltaRecord.inner_thought || deltaRecord.thoughts) {
                  console.log('[Streaming] Found reasoning field in delta:', {
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
                    console.log('[Streaming] Adding reasoning to chunk from delta:', reasoningText.length, 'chars');
                  }
                  if (finishReason) {
                    chunk.done = true;
                  }
                }
              } else if (choice?.finish_reason) {
                chunk = { done: true };
              }
            }

            // Handle event-based streaming formats
            if (!chunk && typeof data.type === 'string') {
              const eventType = data.type;
              switch (eventType) {
                case 'response.output_text.delta': {
                  const delta = data.delta;
                  const deltaText = toPlainText(delta);
                  const reasoningText =
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
              console.log('[Streaming] Yielding chunk:', {
                hasContent: !!chunk.content,
                contentLength: chunk.content?.length || 0,
                hasReasoning: !!chunk.reasoning,
                isDone: !!chunk.done
              });
              yield chunk;
            } else {
              console.warn('[Streaming] No chunk created from SSE data. This may indicate an unsupported response format or an error from the backend.');
              console.warn('[Streaming] Unrecognized data structure:', data);
              console.warn('[Streaming] Data as JSON:', JSON.stringify(data, null, 2));
            }
          } catch (error) {
            console.error('[Streaming] Error parsing SSE data:', error, trimmedLine);
          }
        } else {
          console.log('[Streaming] Line does not start with "data: ":', trimmedLine.substring(0, 50));
        }
      }
    }
  } finally {
    console.log('[Streaming] Stream reader released');
    reader.releaseLock();
  }
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort/timeout errors
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 2 minutes. The model may be overloaded or unavailable. Please try again.');
      }
    }

    // Re-throw other errors
    throw error;
  }
}
