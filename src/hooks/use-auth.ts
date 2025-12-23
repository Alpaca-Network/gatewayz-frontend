"use client";

import { usePrivy } from '@privy-io/react-auth';
import { setUserContext, clearUserContext } from '@/lib/sentry-utils';

/**
 * Authentication hook that wraps usePrivy with Sentry user context tracking.
 *
 * Note: This hook requires PrivyProvider to be mounted. The PrivyProviderWrapper
 * in our app ensures that children only render when the provider is ready,
 * preventing "Invalid hook call" errors during SSR/hydration.
 */
export function useAuth() {
  const { user, authenticated, ready, login } = usePrivy();

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
