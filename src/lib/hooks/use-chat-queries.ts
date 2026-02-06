import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatHistoryAPI, ChatSession, ChatMessage } from '@/lib/chat-history';
import { useAuthStore } from '@/lib/store/auth-store';
import { getApiKey, getUserData } from '@/lib/api';
import { networkMonitor } from '@/lib/network-utils';
import { executeWithOfflineRetry } from '@/lib/network-utils';
import { getCachedSessions } from '@/lib/session-cache';
import {
  getGuestSessions,
  getGuestMessages,
  saveGuestSession,
  updateGuestSession,
  deleteGuestSession,
  saveGuestMessage
} from '@/lib/guest-chat';

// Helper to get API instance with current credentials (for queries)
const useChatApi = () => {
  const { apiKey, userData } = useAuthStore();
  // Only return API if we have credentials
  if (!apiKey || !userData) return null;
  return new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
};

// Helper to get API instance at execution time (for mutations)
// This avoids stale closure issues on mobile where auth state may update after render
const getChatApiNow = (): ChatHistoryAPI | null => {
  // First check Zustand store (reactive state)
  const storeState = useAuthStore.getState();
  if (storeState.apiKey && storeState.userData) {
    return new ChatHistoryAPI(storeState.apiKey, undefined, storeState.userData.privy_user_id);
  }

  // Fallback to localStorage (handles race conditions on mobile and during auth transitions)
  // This is critical for session creation when auth state is still loading
  const apiKey = getApiKey();
  const userData = getUserData();
  if (apiKey) {
    // userData may not be fully populated yet, but we can still create sessions
    return new ChatHistoryAPI(apiKey, undefined, userData?.privy_user_id);
  }

  return null;
};

// --- Queries ---

export const useChatSessions = () => {
  const api = useChatApi();
  const { isAuthenticated, isLoading } = useAuthStore();

  return useQuery({
    // OPTIMIZATION: Remove isAuthenticated from queryKey to prevent cache invalidation
    // when auth state changes. The queryFn handles guest vs authenticated logic.
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      // For guest users, return sessions from localStorage
      if (!isAuthenticated) {
        return getGuestSessions();
      }
      if (!api) return [];
      // Use cache-aware loading that returns cached data immediately
      return api.getSessionsWithCache(50, 0);
    },
    // OPTIMIZATION: Enable immediately when we have cached data or are not loading
    // This allows showing cached sessions before auth fully resolves
    enabled: !isLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    // OPTIMIZATION: Provide initial data from localStorage cache for instant rendering
    // This eliminates the loading state for returning users with cached sessions
    // SECURITY: Only return cached sessions when authenticated or still loading
    // to prevent exposing previous user's sessions during auth transitions
    initialData: () => {
      // Only return cached sessions for authenticated users or during auth loading
      // This prevents cross-user data exposure during logout/login transitions
      const cached = getCachedSessions();
      if (cached.length > 0 && (isAuthenticated || isLoading)) return cached;
      // For guest users or no cache, try guest sessions
      return getGuestSessions();
    },
    // Mark initialData as potentially stale to trigger background refetch
    initialDataUpdatedAt: 0,
    // Always return cached data immediately while fetching in background
    placeholderData: (previousData) => previousData,
  });
};

export const useSessionMessages = (sessionId: number | null) => {
  const api = useChatApi();
  const { isAuthenticated, isLoading } = useAuthStore();

  return useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];

      // For guest users (negative session IDs), return from localStorage
      if (!isAuthenticated || sessionId < 0) {
        return getGuestMessages(sessionId);
      }

      if (!api) return [];
      const session = await api.getSession(sessionId);
      return session.messages || [];
    },
    // Enable for both authenticated and guest sessions when sessionId exists
    enabled: !!sessionId && !isLoading,
    // OPTIMIZATION: Increase staleTime from 60s to 5 minutes to reduce unnecessary refetches
    staleTime: 5 * 60 * 1000,
    // Keep previous data while fetching to prevent UI flicker
    placeholderData: (previousData) => previousData,
  });
};

// --- Mutations ---

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  return useMutation({
    mutationFn: async ({ title, model }: { title?: string; model?: string }) => {
      // For guest users, create a persistent client-side session
      if (!isAuthenticated) {
        // Generate a unique negative session ID for guest mode
        // Use Date.now() + random to prevent collisions from rapid session creation
        const guestSessionId = -(Date.now() + Math.floor(Math.random() * 10000));
        const guestSession: ChatSession = {
          id: guestSessionId,
          user_id: -1,
          title: title || 'Guest Chat',
          model: model || 'openai/gpt-3.5-turbo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
          messages: []
        };

        // Persist guest session to localStorage
        saveGuestSession(guestSession);

        return guestSession;
      }

      // Get API at execution time to avoid stale closure issues on mobile
      const api = getChatApiNow();
      if (!api) throw new Error("Not authenticated");

      // Use offline-aware retry wrapper for reliability on spotty connections
      return executeWithOfflineRetry(
        () => api.createSession(title, model),
        {
          maxRetries: 3,
          retryDelayMs: 2000,
          waitForOnlineTimeoutMs: 30000,
        }
      );
    },
    onSuccess: (newSession) => {
      // Invalidate sessions list to refetch (use simplified key without isAuthenticated)
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      // Pre-seed the cache for this new session's messages
      queryClient.setQueryData(['chat-messages', newSession.id], []);
    },
    // Configure retry behavior at the mutation level
    retry: (failureCount, error) => {
      // Don't retry auth errors or guest mode (already handled)
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        return false;
      }
      // Retry up to 2 more times for network errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};

export const useUpdateSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, title, model }: { sessionId: number; title?: string; model?: string }) => {
      // For guest sessions (negative IDs), update in localStorage
      if (sessionId < 0) {
        const updates: Partial<ChatSession> = {};
        if (title !== undefined) updates.title = title;
        if (model !== undefined) updates.model = model;
        updateGuestSession(sessionId, updates);

        // Return updated session
        const sessions = getGuestSessions();
        const updated = sessions.find(s => s.id === sessionId);
        if (!updated) throw new Error('Session not found');
        return updated;
      }

      // Get API at execution time to avoid stale closure issues on mobile
      const api = getChatApiNow();
      if (!api) throw new Error("Not authenticated");
      return api.updateSession(sessionId, title, model);
    },
    onSuccess: (updatedSession) => {
        // Use simplified cache key without isAuthenticated
        queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
        // Update the specific session in cache if it exists
        queryClient.setQueryData(['chat-sessions'], (old: ChatSession[] | undefined) => {
            if (!old) return [updatedSession];
            return old.map(s => s.id === updatedSession.id ? updatedSession : s);
        });
    }
  });
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: number) => {
      // For guest sessions (negative IDs), delete from localStorage
      if (sessionId < 0) {
        deleteGuestSession(sessionId);
        return sessionId;
      }

      // Get API at execution time to avoid stale closure issues on mobile
      const api = getChatApiNow();
      if (!api) throw new Error("Not authenticated");
      await api.deleteSession(sessionId);
      return sessionId;
    },
    onSuccess: (deletedSessionId) => {
      // Use simplified cache key without isAuthenticated
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['chat-messages', deletedSessionId] });
    }
  });
};

export const useSaveMessage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            sessionId,
            role,
            content,
            model,
            tokens,
            reasoning
        }: {
            sessionId: number,
            role: 'user' | 'assistant',
            content: string | any[],
            model?: string,
            tokens?: number,
            reasoning?: string
        }) => {
            // For guest sessions (negative IDs), save to localStorage
            if (sessionId < 0) {
                return saveGuestMessage(sessionId, {
                    role,
                    content,
                    model,
                    tokens,
                    reasoning,
                    created_at: new Date().toISOString()
                });
            }

            // Get API at execution time to avoid stale closure issues on mobile
            const api = getChatApiNow();
            if (!api) throw new Error("Not authenticated");
            return api.saveMessage(sessionId, role, content, model, tokens, reasoning);
        },
        onSuccess: (savedMessage, variables) => {
            // Don't invalidate chat-messages - this would trigger a refetch that overwrites
            // the optimistic updates from use-chat-stream.ts before the backend has persisted
            // the batched messages. The local cache already has the correct data.

            // Use simplified cache key without isAuthenticated
            // Only invalidate sessions list to update "updated_at" timestamp in sidebar
            queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
        }
    })
}
