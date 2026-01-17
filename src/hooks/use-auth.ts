"use client";

import { setUserContext, clearUserContext } from '@/lib/sentry-utils';
import { useStorageStatus } from '@/components/providers/privy-provider';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';

export function useAuth() {
  // Check storage status first - during SSR/initial hydration, this will be "checking"
  // and the PrivyProvider may not have initialized yet
  const storageStatus = useStorageStatus();

  // Get GatewayzAuth context (works on both web and desktop)
  // On desktop, this is provided by DesktopAuthProvider
  // On web, this is provided by GatewayzAuthProvider which wraps Privy
  const gatewayzAuth = useGatewayzAuth();

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

  // Use GatewayzAuth as the primary source of truth
  // It works on both desktop (DesktopAuthProvider) and web (wraps Privy)
  const isAuthenticated = gatewayzAuth.status === 'authenticated';
  const loading = gatewayzAuth.status === 'idle' || gatewayzAuth.status === 'authenticating';

  // Determine user data - prefer gatewayzAuth.userData, fallback to privyUser
  const user = gatewayzAuth.userData || gatewayzAuth.privyUser;

  // Track user in Sentry if authenticated
  if (isAuthenticated && user) {
    const userId = gatewayzAuth.userData?.user_id || gatewayzAuth.privyUser?.id;
    const email = gatewayzAuth.userData?.email || gatewayzAuth.privyUser?.email?.address;
    if (userId) {
      setUserContext(String(userId), email);
    }
  } else if (!isAuthenticated) {
    clearUserContext();
  }

  return {
    user,
    loading,
    isAuthenticated,
    login: gatewayzAuth.login,
  };
}
