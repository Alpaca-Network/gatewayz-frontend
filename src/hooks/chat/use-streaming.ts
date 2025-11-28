'use client';

/**
 * useStreaming Hook
 *
 * Manages streaming chat completions:
 * - Stream lifecycle (connect, stream, complete, cancel)
 * - Error handling with retry
 * - Performance metrics (TTFT, TPS)
 * - Auth refresh coordination
 */

import { useState, useCallback, useRef } from 'react';
import {
  UseStreamingReturn,
  StreamState,
  StreamChunk,
  MessageRole,
  createInitialStreamState,
} from './types';
import { getApiKey } from '@/lib/auth';

// =============================================================================
// CONSTANTS
// =============================================================================

const COMPLETIONS_ENDPOINT = '/api/chat/completions';
const STREAM_TIMEOUT = 600_000; // 10 minutes max
const FIRST_CHUNK_TIMEOUT = 30_000; // 30 seconds for first chunk
const CHUNK_TIMEOUT = 60_000; // 60 seconds between chunks
const MAX_RETRIES = 2;

// =============================================================================
// TYPES
// =============================================================================

interface StreamOptions {
  sessionId: number;
  messages: Array<{ role: MessageRole; content: string | any[] }>;
  model: string;
  onChunk: (chunk: StreamChunk) => void;
  temperature?: number;
  maxTokens?: number;
}

// =============================================================================
// HOOK
// =============================================================================

interface UseStreamingOptions {
  onError?: (error: string) => void;
  onComplete?: () => void;
}

export function useStreaming(options: UseStreamingOptions = {}): UseStreamingReturn {
  const { onError, onComplete } = options;

  // State
  const [streamState, setStreamState] = useState<StreamState>(createInitialStreamState());

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  // ===========================================================================
  // COMPUTED
  // ===========================================================================

  const isStreaming = streamState.status === 'streaming' ||
                      streamState.status === 'connecting';

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setStatus = useCallback((
    status: StreamState['status'],
    updates?: Partial<StreamState>
  ) => {
    setStreamState(prev => ({
      ...prev,
      status,
      ...updates,
    }));
  }, []);

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  const startStream = useCallback(async (
    sessionId: number,
    messages: Array<{ role: MessageRole; content: string | any[] }>,
    model: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> => {
    const apiKey = getApiKey();
    if (!apiKey) {
      const error = 'Not authenticated';
      setStatus('error', { error });
      onError?.(error);
      return;
    }

    // Cancel any existing stream
    cleanup();

    // Reset state
    setStreamState({
      status: 'connecting',
      content: '',
      reasoning: '',
      error: null,
      startTime: Date.now(),
      firstTokenTime: null,
      endTime: null,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Set initial timeout for first chunk
    timeoutRef.current = setTimeout(() => {
      if (streamState.status === 'connecting') {
        cleanup();
        setStatus('error', { error: 'Connection timeout - no response from model' });
        onError?.('Connection timeout - no response from model');
      }
    }, FIRST_CHUNK_TIMEOUT);

    try {
      // Include session_id in query params
      const url = `${COMPLETIONS_ENDPOINT}?session_id=${sessionId}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
        }),
        signal: controller.signal,
      });

      // Handle non-streaming errors
      if (!response.ok) {
        cleanup();

        if (response.status === 429) {
          const error = 'Rate limited. Please wait before sending another message.';
          setStatus('error', { error });
          onError?.(error);
          return;
        }

        if (response.status === 401) {
          const error = 'Session expired. Please log in again.';
          setStatus('error', { error });
          onError?.(error);
          return;
        }

        // Retry on server errors
        if ([502, 503, 504].includes(response.status) && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          console.log(`[useStreaming] Retrying (${retryCountRef.current}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, 1000 * retryCountRef.current));
          return startStream(sessionId, messages, model, onChunk);
        }

        const errorText = await response.text().catch(() => 'Unknown error');
        const error = `Request failed: ${response.status} - ${errorText}`;
        setStatus('error', { error });
        onError?.(error);
        return;
      }

      // Start streaming
      setStatus('streaming');
      retryCountRef.current = 0; // Reset retry count on success

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let hasReceivedContent = false;

      while (true) {
        // Reset chunk timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          cleanup();
          setStatus('error', { error: 'Stream timeout - no data received' });
          onError?.('Stream timeout - no data received');
        }, CHUNK_TIMEOUT);

        const { done, value } = await reader.read();

        if (done) {
          cleanup();

          if (!hasReceivedContent) {
            const error = 'No response received from model';
            setStatus('error', { error });
            onError?.(error);
            return;
          }

          setStatus('complete', { endTime: Date.now() });
          onChunk({ done: true });
          onComplete?.();
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;

          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const chunk = parseStreamChunk(parsed);

              if (chunk.content || chunk.reasoning) {
                // Record first token time
                if (!hasReceivedContent) {
                  hasReceivedContent = true;
                  setStreamState(prev => ({
                    ...prev,
                    firstTokenTime: Date.now(),
                  }));
                  onChunk({ status: 'first_token' });
                }

                // Accumulate content
                if (chunk.content) {
                  setStreamState(prev => ({
                    ...prev,
                    content: prev.content + chunk.content,
                  }));
                }
                if (chunk.reasoning) {
                  setStreamState(prev => ({
                    ...prev,
                    reasoning: prev.reasoning + chunk.reasoning,
                  }));
                }

                onChunk(chunk);
              }
            } catch (parseError) {
              console.warn('[useStreaming] Failed to parse chunk:', data);
            }
          }
        }
      }
    } catch (err) {
      cleanup();

      if ((err as Error).name === 'AbortError') {
        setStatus('cancelled');
        return;
      }

      const error = err instanceof Error ? err.message : 'Stream error';
      setStatus('error', { error, endTime: Date.now() });
      onError?.(error);
    }
  }, [cleanup, onError, onComplete, setStatus, streamState.status]);

  const cancelStream = useCallback(() => {
    cleanup();
    setStatus('cancelled', { endTime: Date.now() });
  }, [cleanup, setStatus]);

  const getTimingMetrics = useCallback(() => {
    const { startTime, firstTokenTime, endTime, content } = streamState;

    const timeToFirstToken = startTime && firstTokenTime
      ? firstTokenTime - startTime
      : null;

    const totalTime = startTime && endTime
      ? endTime - startTime
      : null;

    // Rough token estimate (chars / 4)
    const estimatedTokens = content.length / 4;
    const streamingTime = firstTokenTime && endTime
      ? (endTime - firstTokenTime) / 1000
      : null;
    const tokensPerSecond = streamingTime && streamingTime > 0
      ? estimatedTokens / streamingTime
      : null;

    return {
      timeToFirstToken,
      totalTime,
      tokensPerSecond,
    };
  }, [streamState]);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    streamState,
    isStreaming,
    startStream,
    cancelStream,
    getTimingMetrics,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse various streaming response formats into a unified StreamChunk
 */
function parseStreamChunk(data: Record<string, unknown>): StreamChunk {
  const chunk: StreamChunk = {};

  // OpenAI format: choices[0].delta.content
  if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
    const choice = data.choices[0] as Record<string, unknown>;
    const delta = choice.delta as Record<string, unknown> | undefined;

    if (delta?.content) {
      chunk.content = String(delta.content);
    }

    // Check for reasoning in various locations
    if (delta?.reasoning) {
      chunk.reasoning = String(delta.reasoning);
    } else if (delta?.reasoning_content) {
      chunk.reasoning = String(delta.reasoning_content);
    }

    // Check finish reason
    if (choice.finish_reason === 'stop') {
      chunk.done = true;
    }
  }

  // Alternative format: output array
  if (data.output && Array.isArray(data.output)) {
    const output = data.output[0];
    if (output && typeof output === 'object') {
      const text = (output as Record<string, unknown>).text ||
                   (output as Record<string, unknown>).content;
      if (text) {
        chunk.content = String(text);
      }
    }
  }

  // Direct content field
  if (data.content && !chunk.content) {
    chunk.content = String(data.content);
  }

  // Direct reasoning field
  if (data.reasoning && !chunk.reasoning) {
    chunk.reasoning = String(data.reasoning);
  }

  return chunk;
}
