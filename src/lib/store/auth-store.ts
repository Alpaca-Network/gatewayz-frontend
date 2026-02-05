import { create } from 'zustand';
import { UserData, getApiKey, getUserData } from '@/lib/api';
import { clearSessionCacheOnLogout } from '@/lib/session-cache';

interface AuthState {
  apiKey: string | null;
  userData: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setAuth: (apiKey: string, userData: UserData) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Get initial auth state synchronously from localStorage.
 * This runs during store creation, before any components mount,
 * eliminating the need to wait for useEffect to set auth state.
 *
 * CRITICAL: This is the key optimization that reduces load time from
 * 10-30 seconds to < 100ms for returning users with cached credentials.
 */
const getInitialAuthState = (): Pick<AuthState, 'apiKey' | 'userData' | 'isAuthenticated' | 'isLoading'> => {
  // During SSR, return loading state to avoid hydration mismatch
  if (typeof window === 'undefined') {
    return {
      apiKey: null,
      userData: null,
      isAuthenticated: false,
      isLoading: true,
    };
  }

  // Synchronously read cached credentials from localStorage
  const apiKey = getApiKey();
  const userData = getUserData();

  if (apiKey && userData) {
    // Cached credentials found - user is authenticated, not loading
    return {
      apiKey,
      userData,
      isAuthenticated: true,
      isLoading: false,
    };
  }

  // No cached credentials - guest user, also not loading
  // CRITICAL: Set isLoading to false so guest users see welcome screen immediately
  return {
    apiKey: null,
    userData: null,
    isAuthenticated: false,
    isLoading: false,
  };
};

// Initialize auth state synchronously from localStorage
const initialState = getInitialAuthState();

export const useAuthStore = create<AuthState>((set) => ({
  apiKey: initialState.apiKey,
  userData: initialState.userData,
  isAuthenticated: initialState.isAuthenticated,
  isLoading: initialState.isLoading,
  error: null,
  setAuth: (apiKey, userData) => set({ apiKey, userData, isAuthenticated: true, isLoading: false, error: null }),
  clearAuth: () => {
    // Clear session cache BEFORE clearing auth state (while user ID is still available)
    clearSessionCacheOnLogout();
    set({ apiKey: null, userData: null, isAuthenticated: false, isLoading: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
