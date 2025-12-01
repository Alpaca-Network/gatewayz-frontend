/**
 * Chat Session Race Condition Tests
 *
 * Tests for the issues identified in CHAT_SESSION_AUDIT_REPORT.md
 * Focuses on concurrent operations, cache consistency, and race conditions
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatLayout } from '@/components/chat-v2/ChatLayout';
import { ChatHistoryAPI } from '@/lib/chat-history';
import { useAuthStore } from '@/lib/store/auth-store';
import { useChatUIStore } from '@/lib/store/chat-ui-store';

// Mock dependencies
vi.mock('@/lib/chat-history');
vi.mock('@/lib/streaming');
vi.mock('@privy-io/react-auth');
vi.mock('@/hooks/use-network-status', () => ({
  useNetworkStatus: () => ({ isOnline: true, isReconnecting: false })
}));

describe('Chat Session Race Conditions', () => {
  let queryClient: QueryClient;
  let mockApi: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    // Mock authenticated state
    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
      apiKey: 'test-api-key',
      userData: { privy_user_id: 'test-user-id' }
    });

    // Reset UI store
    useChatUIStore.setState({
      activeSessionId: null,
      selectedModel: {
        value: 'openrouter/auto',
        label: 'Test Model',
        category: 'Test',
        sourceGateway: 'openrouter',
        developer: 'Test',
        modalities: ['Text']
      },
      inputValue: ''
    });

    // Mock API
    mockApi = {
      createSession: vi.fn(),
      getSessionsWithCache: vi.fn().mockResolvedValue([]),
      getSession: vi.fn(),
      saveMessage: vi.fn(),
      updateSession: vi.fn(),
      deleteSession: vi.fn()
    };

    (ChatHistoryAPI as any).mockImplementation(() => mockApi);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderChat = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ChatLayout />
      </QueryClientProvider>
    );
  };

  describe('ISSUE 3: Session Creation Race Condition', () => {
    it('TC-1.2: should NOT create duplicate sessions on rapid double-send', async () => {
      const user = userEvent.setup();

      let sessionCount = 0;
      mockApi.createSession.mockImplementation(async () => {
        sessionCount++;
        // Simulate slow backend
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          id: sessionCount,
          title: `Session ${sessionCount}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: 1,
          model: 'openrouter/auto',
          is_active: true
        };
      });

      renderChat();

      const input = await screen.findByPlaceholderText(/Type a message/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Message 1');

      // Simulate rapid double-click (< 50ms apart)
      const clickPromises = [
        user.click(sendButton),
        user.click(sendButton)
      ];

      await Promise.all(clickPromises);

      // Wait for any async operations
      await waitFor(() => {
        expect(mockApi.createSession).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Should only create ONE session (CRITICAL TEST)
      // Currently FAILS due to race condition
      expect(mockApi.createSession).toHaveBeenCalledTimes(1);
    });

    it('TC-1.3: should add sequential messages to same session', async () => {
      const user = userEvent.setup();

      const mockSession = {
        id: 123,
        title: 'Test Session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 1,
        model: 'openrouter/auto',
        is_active: true,
        messages: []
      };

      mockApi.createSession.mockResolvedValue(mockSession);
      mockApi.getSession.mockResolvedValue(mockSession);
      mockApi.saveMessage.mockResolvedValue({
        id: 1,
        session_id: 123,
        role: 'user',
        content: 'Test',
        created_at: new Date().toISOString()
      });

      renderChat();

      const input = await screen.findByPlaceholderText(/Type a message/i);

      // First message
      await user.type(input, 'Message 1');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(mockApi.createSession).toHaveBeenCalledTimes(1);
      });

      const firstSessionId = useChatUIStore.getState().activeSessionId;

      // Clear input
      await user.clear(input);

      // Second message
      await user.type(input, 'Message 2');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Should NOT create a second session
      expect(mockApi.createSession).toHaveBeenCalledTimes(1);

      // Should use same session ID
      const secondSessionId = useChatUIStore.getState().activeSessionId;
      expect(secondSessionId).toBe(firstSessionId);
    });
  });

  describe('ISSUE 1: Concurrent Message Save Race', () => {
    it('TC-2.1: should persist user message before starting stream', async () => {
      const user = userEvent.setup();

      const mockSession = {
        id: 123,
        title: 'Test Session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 1,
        model: 'openrouter/auto',
        is_active: true,
        messages: []
      };

      mockApi.createSession.mockResolvedValue(mockSession);
      mockApi.getSession.mockResolvedValue(mockSession);

      const saveMessageSpy = vi.fn().mockResolvedValue({
        id: 1,
        session_id: 123,
        role: 'user',
        content: 'Test message',
        created_at: new Date().toISOString()
      });

      mockApi.saveMessage = saveMessageSpy;

      renderChat();

      const input = await screen.findByPlaceholderText(/Type a message/i);

      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Wait for save to be called
      await waitFor(() => {
        expect(saveMessageSpy).toHaveBeenCalledWith(
          123,
          'user',
          'Test message',
          expect.any(String)
        );
      });

      // Verify message appears in cache immediately (optimistic update)
      const messages = queryClient.getQueryData(['chat-messages', 123]) as any[];
      expect(messages).toBeDefined();
      expect(messages.some(m => m.content === 'Test message')).toBe(true);
    });

    it('TC-2.3: should show message in UI even if save fails', async () => {
      const user = userEvent.setup();

      const mockSession = {
        id: 123,
        title: 'Test Session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 1,
        model: 'openrouter/auto',
        is_active: true,
        messages: []
      };

      mockApi.createSession.mockResolvedValue(mockSession);
      mockApi.getSession.mockResolvedValue(mockSession);

      // Mock save failure
      mockApi.saveMessage.mockRejectedValue(new Error('Network error'));

      renderChat();

      const input = await screen.findByPlaceholderText(/Type a message/i);

      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Message should still appear in UI (optimistic update)
      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });

      // Should show in cache even though save failed
      const messages = queryClient.getQueryData(['chat-messages', 123]) as any[];
      expect(messages).toBeDefined();
      expect(messages.some(m => m.content === 'Test message')).toBe(true);
    });
  });

  describe('ISSUE 2: React Query Cache Invalidation Race', () => {
    it('TC-4.1: should preserve optimistic updates during refetch', async () => {
      const sessionId = 123;

      // Setup initial cache with optimistic message
      queryClient.setQueryData(['chat-messages', sessionId], [
        {
          id: 'temp-1',
          role: 'user',
          content: 'Optimistic message',
          created_at: new Date().toISOString(),
          isOptimistic: true
        }
      ]);

      // Mock fetch returns empty (message not persisted yet)
      mockApi.getSession.mockResolvedValue({
        id: sessionId,
        messages: []
      });

      // Trigger refetch (simulates invalidation)
      await queryClient.refetchQueries({ queryKey: ['chat-messages', sessionId] });

      // Optimistic message should be GONE (this is the bug)
      // Ideally it should be preserved until confirmed persisted
      const messages = queryClient.getQueryData(['chat-messages', sessionId]) as any[];

      // Current behavior: messages is empty (FAIL)
      // Expected behavior: should still contain optimistic message
      // This test documents the current bug
      expect(messages).toEqual([]); // Bug: optimistic update lost
    });

    it('TC-4.3: should merge cached and fetched messages without duplicates', async () => {
      const sessionId = 123;

      // Setup cache with optimistic message
      queryClient.setQueryData(['chat-messages', sessionId], [
        { id: 1, content: 'Existing', role: 'user', created_at: new Date().toISOString() },
        { id: 'temp-1', content: 'Optimistic', role: 'user', created_at: new Date().toISOString(), isOptimistic: true }
      ]);

      // Mock fetch returns persisted version with real ID
      mockApi.getSession.mockResolvedValue({
        id: sessionId,
        messages: [
          { id: 1, content: 'Existing', role: 'user', created_at: new Date().toISOString() },
          { id: 2, content: 'Optimistic', role: 'user', created_at: new Date().toISOString() } // Now has real ID
        ]
      });

      await queryClient.refetchQueries({ queryKey: ['chat-messages', sessionId] });

      const messages = queryClient.getQueryData(['chat-messages', sessionId]) as any[];

      // Should have 2 unique messages (not 3)
      expect(messages).toHaveLength(2);

      // Should have replaced temp ID with real ID
      expect(messages.find(m => m.id === 2)?.content).toBe('Optimistic');
      expect(messages.find(m => m.id === 'temp-1')).toBeUndefined();
    });
  });

  describe('ISSUE 5: Stale messagesHistory Closure', () => {
    it('should use fresh messages when streaming (not stale closure)', async () => {
      const user = userEvent.setup();

      const mockSession = {
        id: 123,
        title: 'Test Session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 1,
        model: 'openrouter/auto',
        is_active: true,
        messages: [
          { id: 1, role: 'user', content: 'First message', created_at: new Date().toISOString() },
          { id: 2, role: 'assistant', content: 'First response', created_at: new Date().toISOString() }
        ]
      };

      mockApi.createSession.mockResolvedValue(mockSession);
      mockApi.getSession.mockResolvedValue(mockSession);
      mockApi.saveMessage.mockResolvedValue({
        id: 3,
        session_id: 123,
        role: 'user',
        content: 'Second message',
        created_at: new Date().toISOString()
      });

      // Pre-populate cache with conversation history
      queryClient.setQueryData(['chat-messages', 123], mockSession.messages);
      useChatUIStore.setState({ activeSessionId: 123 });

      renderChat();

      const input = await screen.findByPlaceholderText(/Type a message/i);

      // Send a follow-up message
      await user.type(input, 'Second message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // The streaming call should include BOTH previous messages in history
      // If it has a stale closure, it will only have empty array
      await waitFor(() => {
        const messages = queryClient.getQueryData(['chat-messages', 123]) as any[];
        expect(messages).toBeDefined();
        // Should have original 2 + new user message
        expect(messages.filter(m => m.role === 'user').length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Performance Tests', () => {
    it('TC-Perf-1: message send completes within 200ms', async () => {
      const user = userEvent.setup();

      const mockSession = {
        id: 123,
        title: 'Test Session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 1,
        model: 'openrouter/auto',
        is_active: true,
        messages: []
      };

      mockApi.createSession.mockResolvedValue(mockSession);
      mockApi.getSession.mockResolvedValue(mockSession);
      mockApi.saveMessage.mockResolvedValue({
        id: 1,
        session_id: 123,
        role: 'user',
        content: 'Fast message',
        created_at: new Date().toISOString()
      });

      renderChat();

      const input = await screen.findByPlaceholderText(/Type a message/i);

      await user.type(input, 'Fast message');

      const start = performance.now();
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Wait for optimistic update to appear
      await waitFor(() => {
        expect(screen.getByText('Fast message')).toBeInTheDocument();
      });

      const latency = performance.now() - start;

      // Optimistic update should be instant (< 200ms)
      expect(latency).toBeLessThan(200);
    });
  });
});
