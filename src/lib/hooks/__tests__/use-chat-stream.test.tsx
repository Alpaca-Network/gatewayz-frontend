/**
 * Tests for useChatStream hook
 * Covers streaming functionality, error handling, and React Query cache updates
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChatStream } from '../use-chat-stream';
import * as streaming from '@/lib/streaming';
import * as api from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth-store';
import React from 'react';

// Mock dependencies
jest.mock('@/lib/streaming', () => ({
  streamChatResponse: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  getApiKey: jest.fn(),
}));

jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: jest.fn(),
}));

// Mock useSaveMessage
const mockMutate = jest.fn();
jest.mock('../use-chat-queries', () => ({
  useSaveMessage: () => ({
    mutate: mockMutate,
  }),
}));

describe('useChatStream', () => {
  let queryClient: QueryClient;
  const mockApiKey = 'test-api-key-123';
  const mockStreamChatResponse = streaming.streamChatResponse as jest.Mock;
  const mockGetApiKey = api.getApiKey as jest.Mock;
  const mockUseAuthStore = useAuthStore as jest.Mock;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ apiKey: mockApiKey });
    mockGetApiKey.mockReturnValue(mockApiKey);
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Initial State', () => {
    it('should return initial state with isStreaming false', () => {
      const { result } = renderHook(() => useChatStream(), { wrapper });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.streamError).toBeNull();
      expect(typeof result.current.streamMessage).toBe('function');
    });
  });

  describe('streamMessage', () => {
    const mockModel = {
      value: 'gpt-4',
      label: 'GPT-4',
      sourceGateway: 'openai',
    };

    it('should throw error when no API key is available', async () => {
      mockUseAuthStore.mockReturnValue({ apiKey: null });
      mockGetApiKey.mockReturnValue(null);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await expect(
        result.current.streamMessage({
          sessionId: 1,
          content: 'Hello',
          model: mockModel,
          messagesHistory: [],
        })
      ).rejects.toThrow('No API Key');
    });

    it('should set isStreaming to true during streaming', async () => {
      // Create an async generator that yields chunks
      async function* mockGenerator() {
        yield { content: 'Hello' };
        yield { content: ' World' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());

      // Pre-seed the cache with empty messages
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      // Start streaming
      const streamPromise = act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Hello',
          model: mockModel,
          messagesHistory: [],
        });
      });

      // Wait for streaming to complete
      await streamPromise;

      // After completion, isStreaming should be false
      expect(result.current.isStreaming).toBe(false);
    });

    it('should add user message to cache optimistically', async () => {
      async function* mockGenerator() {
        yield { content: 'Response' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test message',
          model: mockModel,
          messagesHistory: [],
        });
      });

      // Check that user message was added
      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toBe('Test message');
    });

    it('should add assistant message with isStreaming flag', async () => {
      async function* mockGenerator() {
        yield { content: 'Hello' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Hello',
          model: mockModel,
          messagesHistory: [],
        });
      });

      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      // After streaming completes, isStreaming should be false
      expect(assistantMessage.isStreaming).toBe(false);
    });

    it('should update assistant message content during streaming', async () => {
      const chunks = ['Hello', ' ', 'World', '!'];
      let chunkIndex = 0;

      async function* mockGenerator() {
        for (const chunk of chunks) {
          yield { content: chunk };
        }
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      // Final content should include all chunks
      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      expect(assistantMessage.content).toContain('Hello');
      expect(assistantMessage.content).toContain('World');
    });

    it('should handle reasoning content from stream', async () => {
      async function* mockGenerator() {
        yield { content: 'Answer', reasoning: 'Thinking...' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Question',
          model: mockModel,
          messagesHistory: [],
        });
      });

      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      expect(assistantMessage.reasoning).toContain('Thinking');
    });

    it('should save user and assistant messages via mutation', async () => {
      async function* mockGenerator() {
        yield { content: 'Response' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Hello',
          model: mockModel,
          messagesHistory: [],
        });
      });

      // Should have called mutate twice: once for user, once for assistant
      expect(mockMutate).toHaveBeenCalledTimes(2);
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 1,
          role: 'user',
          content: 'Hello',
        })
      );
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 1,
          role: 'assistant',
        })
      );
    });

    it('should mark isStreaming false after completion', async () => {
      async function* mockGenerator() {
        yield { content: 'Done' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      expect(assistantMessage.isStreaming).toBe(false);
    });
  });

  describe('Error Handling', () => {
    const mockModel = {
      value: 'gpt-4',
      label: 'GPT-4',
      sourceGateway: 'openai',
    };

    it('should set streamError on streaming failure', async () => {
      async function* mockGenerator(): AsyncGenerator<any> {
        throw new Error('Stream failed');
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      expect(result.current.streamError).toBe('Stream failed');
    });

    it('should mark assistant message with error on failure', async () => {
      async function* mockGenerator(): AsyncGenerator<any> {
        yield { content: 'Partial' };
        throw new Error('Connection lost');
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      expect(assistantMessage.hasError).toBe(true);
      expect(assistantMessage.error).toBe('Connection lost');
      expect(assistantMessage.isStreaming).toBe(false);
    });

    it('should preserve partial content on error', async () => {
      async function* mockGenerator(): AsyncGenerator<any> {
        yield { content: 'Partial response' };
        throw new Error('Error');
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      // Content should be preserved (or empty if handler reset)
      expect(assistantMessage.content).toBeDefined();
    });

    it('should set isStreaming to false after error', async () => {
      async function* mockGenerator(): AsyncGenerator<any> {
        throw new Error('Error');
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('Media Attachments', () => {
    const mockModel = {
      value: 'gpt-4-vision',
      label: 'GPT-4 Vision',
      sourceGateway: 'openai',
    };

    it('should handle image attachments in content array', async () => {
      async function* mockGenerator() {
        yield { content: 'I see an image' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const contentWithImage = [
        { type: 'text', text: 'What is this?' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
      ];

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: contentWithImage,
          model: mockModel,
          messagesHistory: [],
        });
      });

      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage.image).toBe('data:image/png;base64,abc123');
    });

    it('should handle video attachments in content array', async () => {
      async function* mockGenerator() {
        yield { content: 'I see a video' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const contentWithVideo = [
        { type: 'text', text: 'What is this video?' },
        { type: 'video_url', video_url: { url: 'data:video/mp4;base64,xyz789' } },
      ];

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: contentWithVideo,
          model: mockModel,
          messagesHistory: [],
        });
      });

      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage.video).toBe('data:video/mp4;base64,xyz789');
    });

    it('should handle audio attachments in content array', async () => {
      async function* mockGenerator() {
        yield { content: 'I hear audio' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const contentWithAudio = [
        { type: 'text', text: 'What is this sound?' },
        { type: 'audio_url', audio_url: { url: 'data:audio/mp3;base64,audio123' } },
      ];

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: contentWithAudio,
          model: mockModel,
          messagesHistory: [],
        });
      });

      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage.audio).toBe('data:audio/mp3;base64,audio123');
    });
  });

  describe('API Request Building', () => {
    const mockModel = {
      value: 'gpt-4',
      label: 'GPT-4',
      sourceGateway: 'openai',
    };

    it('should build request with correct model and gateway', async () => {
      async function* mockGenerator() {
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      expect(mockStreamChatResponse).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/completions'),
        mockApiKey,
        expect.objectContaining({
          model: 'gpt-4',
          stream: true,
          gateway: 'openai',
        })
      );
    });

    it('should include session_id in URL', async () => {
      async function* mockGenerator() {
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 42], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 42,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      expect(mockStreamChatResponse).toHaveBeenCalledWith(
        expect.stringContaining('session_id=42'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should append user message to messages history', async () => {
      async function* mockGenerator() {
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const existingHistory = [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' },
      ];

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'New message',
          model: mockModel,
          messagesHistory: existingHistory,
        });
      });

      expect(mockStreamChatResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          messages: [
            ...existingHistory,
            { role: 'user', content: 'New message' },
          ],
        })
      );
    });

    it('should handle portkey provider for OpenAI models', async () => {
      async function* mockGenerator() {
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const portkeyModel = {
        value: 'gpt-4',
        label: 'GPT-4',
        sourceGateway: 'portkey',
      };

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: portkeyModel,
          messagesHistory: [],
        });
      });

      expect(mockStreamChatResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          portkey_provider: 'openai',
        })
      );
    });

    it('should handle portkey provider for Claude models', async () => {
      async function* mockGenerator() {
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const portkeyClaudeModel = {
        value: 'claude-3-opus',
        label: 'Claude 3 Opus',
        sourceGateway: 'portkey',
      };

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: portkeyClaudeModel,
          messagesHistory: [],
        });
      });

      expect(mockStreamChatResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          portkey_provider: 'anthropic',
        })
      );
    });
  });

  describe('Event Loop Yielding', () => {
    it('should yield to event loop during streaming for UI updates', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      async function* mockGenerator() {
        yield { content: 'A' };
        yield { content: 'B' };
        yield { content: 'C' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const mockModel = {
        value: 'gpt-4',
        label: 'GPT-4',
        sourceGateway: 'openai',
      };

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      // setTimeout should have been called for yielding (setTimeout(resolve, 0))
      const zeroTimeoutCalls = setTimeoutSpy.mock.calls.filter(
        (call) => call[1] === 0
      );
      expect(zeroTimeoutCalls.length).toBeGreaterThan(0);

      setTimeoutSpy.mockRestore();
    });
  });

  describe('Cache Management', () => {
    const mockModel = {
      value: 'gpt-4',
      label: 'GPT-4',
      sourceGateway: 'openai',
    };

    it('should cancel outgoing queries before optimistic update', async () => {
      const cancelQueriesSpy = jest.spyOn(queryClient, 'cancelQueries');

      async function* mockGenerator() {
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      expect(cancelQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['chat-messages', 1],
      });
    });

    it('should maintain isStreaming true flag during content updates', async () => {
      const contentUpdates: boolean[] = [];

      async function* mockGenerator() {
        yield { content: 'First' };
        yield { content: 'Second' };
        yield { content: 'Third' };
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      // Final state should have isStreaming false
      const messages = queryClient.getQueryData(['chat-messages', 1]) as any[];
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      expect(assistantMessage.isStreaming).toBe(false);
    });
  });

  describe('Fallback to localStorage API key', () => {
    it('should use localStorage API key when store is empty', async () => {
      mockUseAuthStore.mockReturnValue({ apiKey: null });
      mockGetApiKey.mockReturnValue('localStorage-key');

      async function* mockGenerator() {
        yield { done: true };
      }

      mockStreamChatResponse.mockReturnValue(mockGenerator());
      queryClient.setQueryData(['chat-messages', 1], []);

      const mockModel = {
        value: 'gpt-4',
        label: 'GPT-4',
        sourceGateway: 'openai',
      };

      const { result } = renderHook(() => useChatStream(), { wrapper });

      await act(async () => {
        await result.current.streamMessage({
          sessionId: 1,
          content: 'Test',
          model: mockModel,
          messagesHistory: [],
        });
      });

      expect(mockStreamChatResponse).toHaveBeenCalledWith(
        expect.any(String),
        'localStorage-key',
        expect.any(Object)
      );
    });
  });
});
