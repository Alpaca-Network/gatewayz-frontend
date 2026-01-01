"use client";

import { usePrivy } from '@privy-io/react-auth';
import { captureHookError, setUserContext, clearUserContext } from '@/lib/sentry-utils';
import { useStorageStatus } from '@/components/providers/privy-provider';

export function useAuth() {
  // Check storage status first - during SSR/initial hydration, this will be "checking"
  // and the PrivyProvider may not have initialized yet
  const storageStatus = useStorageStatus();
  
  // Always call usePrivy unconditionally to respect Rules of Hooks
  // The hook will return safe defaults when called during initialization
  const privyResult = usePrivy();

  // If storage is still being checked, return a loading state
  // This prevents issues during the brief initialization window
  if (storageStatus === "checking") {
    return {
      user: null,
      loading: true,
      isAuthenticated: false,
      login: () => {
        console.warn('[useAuth] Login called while storage is still being checked');
      },
    };
  }

  const { user, authenticated, ready, login } = privyResult;

  // Track user in Sentry if authenticated
  if (authenticated && user?.id) {
    setUserContext(user.id, user.email?.address);
  } else if (!authenticated) {
    clearUserContext();
  }

  return {
    user,
    loading: !ready,
    isAuthenticated: authenticated,
    login,
  };
}
