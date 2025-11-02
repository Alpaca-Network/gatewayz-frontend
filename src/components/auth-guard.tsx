"use client";

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { usePathname } from 'next/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login } = usePrivy();
  const pathname = usePathname();

  useEffect(() => {
    // Wait for Privy to be ready
    if (!ready) return;

    // If not on home page and not authenticated, trigger login
    if (pathname !== '/' && !authenticated) {
      login();
    }
  }, [ready, authenticated, pathname, login]);

  return <>{children}</>;
}
