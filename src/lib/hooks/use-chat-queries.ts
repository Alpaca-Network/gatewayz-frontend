import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatHistoryAPI, ChatSession } from '@/lib/chat-history';
import { useAuthStore } from '@/lib/store/auth-store';

// Helper to get API instance with current credentials
const useChatApi = () => {
  const { apiKey, userData } = useAuthStore();
  // Only return API if we have credentials
  if (!apiKey || !userData) return null;
  return new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
};

// --- Queries ---

export const useChatSessions = () => {
  const api = useChatApi();
  const { isAuthenticated } = useAuthStore();
  
  return useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      if (!api) return [];
      return api.getSessions(50, 0); 
    },
    enabled: !!api && isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
};

export const useSessionMessages = (sessionId: number | null) => {
  const api = useChatApi();
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: async () => {
      if (!api || !sessionId) return [];
      const session = await api.getSession(sessionId);
      return session.messages || [];
    },
    enabled: !!api && !!sessionId && isAuthenticated,
    staleTime: 60 * 1000,
  });
};

// --- Mutations ---

export const useCreateSession = () => {
  const api = useChatApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, model }: { title?: string; model?: string }) => {
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
  const api = useChatApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, title, model }: { sessionId: number; title?: string; model?: string }) => {
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
  const api = useChatApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: number) => {
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
    const api = useChatApi();
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
             if (!api) throw new Error("Not authenticated");
             return api.saveMessage(sessionId, role, content, model, tokens);
        },
        onSuccess: (savedMessage, variables) => {
            // Optimistically update or invalidate
            queryClient.invalidateQueries({ queryKey: ['chat-messages', variables.sessionId] });
            // Also invalidate session list because "updated_at" changed
            queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
        }
    })
}
