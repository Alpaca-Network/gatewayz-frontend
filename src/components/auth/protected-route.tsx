"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading, privyReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect when:
    // 1. Not in a loading state (auth context has resolved)
    // 2. Privy SDK is ready (so we know the true auth state)
    // 3. No user is authenticated
    //
    // This prevents redirecting users who have a valid Privy session but no
    // cached Gatewayz credentials (e.g., after clearing localStorage).
    // Without waiting for privyReady, we would redirect before Privy has a
    // chance to restore the session.
    if (!loading && privyReady && !user) {
      router.push('/signin');
    }
  }, [user, loading, privyReady, router]);

  // Show loading state while auth is resolving OR while waiting for Privy
  // This gives Privy time to restore sessions for returning users
  if (loading || !privyReady) {
    return fallback || (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
