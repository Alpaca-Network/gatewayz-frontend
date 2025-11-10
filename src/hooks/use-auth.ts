"use client";

import { usePrivy } from '@privy-io/react-auth';

export function useAuth() {
  const { user, authenticated, ready, login } = usePrivy();

  return {
    user,
    loading: !ready,
    isAuthenticated: authenticated,
    login,
  };
}
