import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrivy, User, LinkedAccountWithMetadata } from '@privy-io/react-auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { useChatUIStore } from '@/lib/store/chat-ui-store';
import { processAuthResponse, AuthResponse, getApiKey, getUserData, saveApiKey, saveUserData, AUTH_REFRESH_COMPLETE_EVENT } from '@/lib/api';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safe-storage';

// Helper to strip undefined values (copied from original context)
const stripUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as unknown as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, stripUndefined(v)]);
    return Object.fromEntries(entries) as unknown as T;
  }

  return value;
};

const toUnixSeconds = (value: unknown): number | undefined => {
  if (!value) return undefined;
  if (typeof value === "number") return Math.floor(value);
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) return Math.floor(numeric);
  }
  return undefined;
};

const mapLinkedAccount = (account: LinkedAccountWithMetadata) => {
  if (account.type === "wallet") return null;

  const get = (key: string) =>
    Object.prototype.hasOwnProperty.call(account, key)
      ? (account as unknown as Record<string, unknown>)[key]
      : undefined;

  let normalizedType = account.type as string | undefined;
  if (normalizedType === "github_oauth") normalizedType = "github";

  return stripUndefined({
    type: normalizedType,
    subject: get("subject") as string | undefined,
    email: get("email") as string | undefined,
    name: get("name") as string | undefined,
    chain_type: get("chainType") as string | undefined,
    wallet_client_type: get("walletClientType") as string | undefined,
    connector_type: get("connectorType") as string | undefined,
    verified_at: toUnixSeconds(get("verifiedAt")),
    first_verified_at: toUnixSeconds(get("firstVerifiedAt")),
    latest_verified_at: toUnixSeconds(get("latestVerifiedAt")),
  });
};

export function useAuthSync() {
  const { user, ready, authenticated, getAccessToken } = usePrivy();
  const { setAuth, setLoading, setError, clearAuth } = useAuthStore();
  const { resetChatState } = useChatUIStore();
  const queryClient = useQueryClient();

  // Initialize store from localStorage on mount
  // This effect MUST set isLoading to false to allow the chat UI to render
  useEffect(() => {
    const storedKey = getApiKey();
    const storedUser = getUserData();
    if (storedKey && storedUser) {
      // User has cached credentials - set auth state
      setAuth(storedKey, storedUser);
    } else {
      // No cached credentials - this is a guest user or fresh session
      // CRITICAL: Set loading to false so the chat UI renders
      setLoading(false);
    }
  }, [setAuth, setLoading]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['auth-sync', user?.id],
    // IMPORTANT: Disable this query if we already have valid credentials
    // to prevent duplicate auth calls that can cause API key switching issues
    enabled: ready && authenticated && !!user && !getApiKey(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    queryFn: async () => {
      if (!user) throw new Error("No user");

      // 1. Get Token
      const token = await getAccessToken();

      // 2. Prepare Body
      const existingUserData = getUserData();
      const isNewUser = !existingUserData;
      const hasStoredApiKey = Boolean(existingUserData?.api_key);

      let referralCode = safeLocalStorageGet("gatewayz_referral_code");
      if (!referralCode && typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const urlRefCode = urlParams.get("ref");
        if (urlRefCode) {
          referralCode = urlRefCode;
          safeLocalStorageSet("gatewayz_referral_code", urlRefCode);
        }
      }

      const authRequestBody = {
        user: stripUndefined({
          id: user.id,
          created_at: toUnixSeconds(user.createdAt) ?? Math.floor(Date.now() / 1000),
          linked_accounts: (user.linkedAccounts || []).map(mapLinkedAccount).filter(Boolean),
          mfa_methods: user.mfaMethods || [],
          has_accepted_terms: user.hasAcceptedTerms ?? false,
          is_guest: user.isGuest ?? false,
        }),
        token: token ?? "",
        // ALWAYS request API key creation to avoid temp keys
        auto_create_api_key: true,
        is_new_user: isNewUser,
        has_referral_code: !!referralCode,
        referral_code: referralCode ?? null,
        privy_user_id: user.id,
        // Add trial credits if new
        ...(isNewUser ? { trial_credits: 10 } : {})
      };

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
          setError(error instanceof Error ? error.message : "Authentication failed");
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
