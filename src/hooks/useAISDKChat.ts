'use client';

import { useCallback, useRef, useState } from 'react';
import {
  AISDKMessage,
  AISDKStreamChunk,
  parseAISDKStream,
  callAISDKCompletion,
  modelSupportsThinking
} from '@/lib/ai-sdk-gateway';

export interface UseAISDKChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  enableThinking?: boolean;
  onChunk?: (chunk: AISDKStreamChunk) => void;
  onError?: (error: Error) => void;
}

export interface UseAISDKChatState {
  messages: AISDKMessage[];
  isLoading: boolean;
  currentContent: string;
  currentReasoning: string;
  error: Error | null;
}

/**
 * Custom hook for AI SDK chat with chain-of-thought reasoning support
 *
 * Usage:
 * ```tsx
 * const { messages, sendMessage, isLoading, currentReasoning } = useAISDKChat({
 *   model: 'claude-3-5-sonnet',
 *   enableThinking: true,
 * });
 *
 * await sendMessage('Hello, can you think about this?');
 * ```
 */
export function useAISDKChat(options: UseAISDKChatOptions) {
  const [messages, setMessages] = useState<AISDKMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentContent, setCurrentContent] = useState('');
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      try {
        setError(null);
        setCurrentContent('');
        setCurrentReasoning('');
        setIsLoading(true);

        // Add user message to history
        const newMessages: AISDKMessage[] = [
          ...messages,
          { role: 'user', content: userMessage },
        ];
        setMessages(newMessages);

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        // Call AI SDK API with streaming
        const stream = await callAISDKCompletion(
          newMessages,
          options.model,
          {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            topP: options.topP,
            useThinking:
              options.enableThinking &&
              modelSupportsThinking(options.model),
          }
        );

        // Parse streaming response
        let assistantContent = '';
        let assistantReasoning = '';

        for await (const chunk of parseAISDKStream(stream)) {
          // Check if aborted
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }

          switch (chunk.type) {
            case 'content':
              if (chunk.content) {
                assistantContent += chunk.content;
                setCurrentContent(assistantContent);
              }
              break;

            case 'reasoning':
              if (chunk.reasoning) {
                assistantReasoning += chunk.reasoning;
                setCurrentReasoning(assistantReasoning);
              }
              break;

            case 'error':
              throw new Error(chunk.error || 'Stream error');

            case 'done':
              break;
          }

          // Call optional chunk callback
          options.onChunk?.(chunk);
        }

        // Add assistant message to history
        const assistantMessage: AISDKMessage = {
          role: 'assistant',
          content: assistantContent,
          reasoning: assistantReasoning || undefined,
        };

        setMessages([...newMessages, assistantMessage]);
        setCurrentContent('');
        setCurrentReasoning('');
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options.onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options]
  );

  const cancelMessage = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentContent('');
    setCurrentReasoning('');
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    currentContent,
    currentReasoning,
    error,
    sendMessage,
    cancelMessage,
    clearMessages,
  };
}
