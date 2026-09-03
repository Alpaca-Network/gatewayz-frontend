import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { useChatUIStore } from '@/lib/store/chat-ui-store';
import { processAuthResponse, AuthResponse, getApiKey, getUserData, saveApiKey, saveUserData, AUTH_REFRESH_COMPLETE_EVENT, AUTH_REFRESH_EVENT } from '@/lib/api';
import { getUserMessage } from '@/lib/errors';
import { buildAuthRequestBody, getPrivyAccessTokenWithRetry } from '@/lib/auth/build-auth-request';

export function useAuthSync() {
  const { user, ready, authenticated, getAccessToken } = usePrivy();
  const { setAuth, setLoading, setError, clearAuth } = useAuthStore();
  const { resetChatState } = useChatUIStore();
  const queryClient = useQueryClient();

  // OPTIMIZATION: Removed redundant localStorage initialization effect.
  // The auth store now initializes synchronously from localStorage during store creation
  // (see auth-store.ts getInitialAuthState), eliminating the need for this useEffect.
  // This was the critical change that reduced load time from 10-30s to <100ms.

  // Listen for AUTH_REFRESH_EVENT to sync Zustand store with localStorage
  // This is crucial for desktop (Tauri) where auth callback saves to localStorage
  // and dispatches this event to notify the UI to update
  useEffect(() => {
    const handleAuthRefresh = () => {
      console.log("[useAuthSync] AUTH_REFRESH_EVENT received, syncing store from localStorage");
      const storedKey = getApiKey();
      const storedUser = getUserData();
      if (storedKey && storedUser) {
        setAuth(storedKey, storedUser);
        console.log("[useAuthSync] Auth store updated from localStorage");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(AUTH_REFRESH_EVENT, handleAuthRefresh);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(AUTH_REFRESH_EVENT, handleAuthRefresh);
      }
    };
  }, [setAuth]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['auth-sync', user?.id],
    // IMPORTANT: Disable this query if we already have valid credentials
    // to prevent duplicate auth calls that can cause API key switching issues
    enabled: ready && authenticated && !!user && !getApiKey(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    queryFn: async () => {
      if (!user) throw new Error("No user");

      // 1. Get Token — retried (see getPrivyAccessTokenWithRetry); the backend requires a
      // verified Privy token on every /auth call now (W0). No "continue with an empty token"
      // fallback — react-query's own `retry: 2` handles surfacing the failure.
      const token = await getPrivyAccessTokenWithRetry(getAccessToken);
      if (!token) {
        throw new Error('Could not verify your session — please retry');
      }

      // 2. Prepare Body — shared with gatewayz-auth-context.tsx and integrations/privy/auth-sync.ts
      // (src/lib/auth/build-auth-request.ts) so wallet linked-accounts and auto_create_api_key
      // behave identically across every sync path.
      const existingUserData = getUserData();
      const authRequestBody = buildAuthRequestBody(user, { token, existingUserData });

      // 3. Fetch
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authRequestBody),
      });

      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status}`);
      }

      const authData = await response.json() as AuthResponse;

      // Validate
      if (!authData.api_key) {
           // Fallback check
          const fallbackApiKey = (authData as any)?.data?.api_key ?? (authData as any)?.apiKey;
          if (fallbackApiKey) {
              authData.api_key = fallbackApiKey;
          } else {
              throw new Error("Missing API Key in response");
          }
      }

      return authData;
    },
  });

  // React to query changes
  useEffect(() => {
    if (data) {
      processAuthResponse(data); // Saves to localStorage
      // Re-read from storage to ensure we have the exact format expected by the app
      // (processAuthResponse does some normalization)
      const userData = getUserData();
      if (data.api_key && userData) {
          setAuth(data.api_key, userData);
      }
    }
  }, [data, setAuth]);

  useEffect(() => {
      if (error) {
          setError(getUserMessage(error));
          // If auth fails hard, we might want to clear local auth state, but 
          // usually we keep the cached state until explicit logout.
          // clearAuth(); 
      }
  }, [error, setError]);

  // Listen for auth refresh completion (triggered by legacy context or other components)
  // This breaks the loop where ChatHistoryAPI triggers refresh, Context updates localStorage,
  // but this store remains stale, causing subsequent 401s.
  useEffect(() => {
    const handleRefreshComplete = () => {
      const storedKey = getApiKey();
      const storedUser = getUserData();
      if (storedKey && storedUser) {
        console.log('[useAuthSync] Refresh complete, updating store from storage');
        setAuth(storedKey, storedUser);
        // Invalidate query to ensure fresh data next time
        queryClient.invalidateQueries({ queryKey: ['auth-sync'] });
      } else {
        // If storage is empty after a refresh attempt, it likely means auth failed or user was logged out.
        // We should sync the store to reflect this to prevent UI from showing stale auth state.
        console.log('[useAuthSync] Refresh complete but no credentials found - clearing auth');
        clearAuth();
        // Clear chat state to remove cached session and messages
        resetChatState();
        // Clear all React Query caches to remove stale data
        queryClient.clear();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_REFRESH_COMPLETE_EVENT, handleRefreshComplete);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_REFRESH_COMPLETE_EVENT, handleRefreshComplete);
      }
    };
  }, [setAuth, clearAuth, queryClient]);
  
  // Handle Logout
  useEffect(() => {
      if (ready && !authenticated && !user) {
          // Check if we have a valid session in storage before clearing
          // The original code had logic to "keep session" if privy expired but local key existed
          // For now, let's keep it simple: if Privy says out, we strictly check if we should be out.
          // Actually, sticking to the "Single Source of Truth" = Privy:
          // If Privy is not authenticated, we should probably clear our store.
          // BUT, original code said: "Privy not authenticated but cached credentials found - maintaining session"
          // This implies the Gatewayz session might live longer than the Privy session?
          // Or it handles the "refresh" case where Privy is reloading.
          
          // I'll leave the store alone if it has data, but maybe mark it as "offline"?
          // For now, let's NOT clearAuth automatically to avoid flashing.
      }
  }, [ready, authenticated, user]);

  return {
    isLoading: isLoading && !useAuthStore.getState().isAuthenticated, // Only loading if we don't have auth yet
    isAuthenticated: useAuthStore.getState().isAuthenticated
  };
}
