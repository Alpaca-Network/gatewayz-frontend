"use client";

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { setUserContext, clearUserContext } from '@/lib/sentry-utils';

export function useAuth() {
  const { user, authenticated, ready, login } = usePrivy();

  // Track user in Sentry when authentication state changes
  useEffect(() => {
    if (authenticated && user?.id) {
      setUserContext(user.id, user.email?.address);
    } else if (!authenticated) {
      clearUserContext();
    }
  }, [authenticated, user?.id, user?.email?.address]);

  return {
    user,
    loading: !ready,
    isAuthenticated: authenticated,
    login,
  };
}
