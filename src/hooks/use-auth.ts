"use client";

import { usePrivy } from '@privy-io/react-auth';

export function useAuth() {
  const { user, authenticated, ready } = usePrivy();

  return {
    user,
    loading: !ready,
    isAuthenticated: authenticated,
  };
}
