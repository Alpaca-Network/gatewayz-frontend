"use client";

import { usePrivy } from '@privy-io/react-auth';
import { captureHookError, setUserContext, clearUserContext } from '@/lib/sentry-utils';

export function useAuth() {
  try {
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
  } catch (error) {
    captureHookError(error, {
      hookName: 'useAuth',
      operation: 'privy_initialization',
    });
    throw error;
  }
}
