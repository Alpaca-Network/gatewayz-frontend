import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatHistoryAPI, ChatSession } from '@/lib/chat-history';
import { useAuthStore } from '@/lib/store/auth-store';
import { getApiKey, getUserData } from '@/lib/api';

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

  // Fallback to localStorage (handles race conditions on mobile)
  const apiKey = getApiKey();
  const userData = getUserData();
  if (apiKey && userData) {
    return new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
  }

  return null;
};

// --- Queries ---

export const useChatSessions = () => {
  const api = useChatApi();
  const { isAuthenticated, isLoading } = useAuthStore();

  return useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      if (!api) return [];
      // Use cache-aware loading that returns cached data immediately
      return api.getSessionsWithCache(50, 0);
    },
    // Only fetch when fully authenticated and not in loading state
    // This prevents unnecessary API calls during auth transitions or when logged out
    enabled: !!api && isAuthenticated && !isLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
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
      if (!api || !sessionId) return [];
      const session = await api.getSession(sessionId);
      return session.messages || [];
    },
    // Only fetch when fully authenticated and not in loading state
    enabled: !!api && !!sessionId && isAuthenticated && !isLoading,
    staleTime: 60 * 1000,
    // Keep previous data while fetching to prevent UI flicker
    placeholderData: (previousData) => previousData,
  });
};

// --- Mutations ---

export const useCreateSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, model }: { title?: string; model?: string }) => {
      // Get API at execution time to avoid stale closure issues on mobile
      const api = getChatApiNow();
      if (!api) throw new Error("Not authenticated");
      return api.createSession(title, model);
    },
    onSuccess: (newSession) => {
      // Invalidate sessions list to refetch
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      // Pre-seed the cache for this new session
      queryClient.setQueryData(['chat-sessions', newSession.id], newSession);
      queryClient.setQueryData(['chat-messages', newSession.id], []);
    }
  });
};

export const useUpdateSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, title, model }: { sessionId: number; title?: string; model?: string }) => {
      // Get API at execution time to avoid stale closure issues on mobile
      const api = getChatApiNow();
      if (!api) throw new Error("Not authenticated");
      return api.updateSession(sessionId, title, model);
    },
    onSuccess: (updatedSession) => {
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
      // Get API at execution time to avoid stale closure issues on mobile
      const api = getChatApiNow();
      if (!api) throw new Error("Not authenticated");
      await api.deleteSession(sessionId);
      return sessionId;
    },
    onSuccess: (deletedSessionId) => {
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
            tokens
        }: {
            sessionId: number,
            role: 'user' | 'assistant',
            content: string | any[],
            model?: string,
            tokens?: number
        }) => {
            // Get API at execution time to avoid stale closure issues on mobile
            const api = getChatApiNow();
            if (!api) throw new Error("Not authenticated");
            return api.saveMessage(sessionId, role, content, model, tokens);
        },
        onSuccess: (savedMessage, variables) => {
            // Don't invalidate chat-messages - this would trigger a refetch that overwrites
            // the optimistic updates from use-chat-stream.ts before the backend has persisted
            // the batched messages. The local cache already has the correct data.

            // Only invalidate sessions list to update "updated_at" timestamp in sidebar
            queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
        }
    })
}
