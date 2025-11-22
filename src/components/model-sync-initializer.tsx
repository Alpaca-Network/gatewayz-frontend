'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initializeModelSync } from '@/lib/background-sync';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';

const ROUTE_SKIP_PREFIXES = [
  '/signup',
  '/start',
  '/onboarding',
  '/developers',
  '/email-preview',
  '/deck',
];

/**
 * Component that initializes background model synchronization.
 * Only runs after authentication on routes that actually need live model data.
 */
export function ModelSyncInitializer() {
  const pathname = usePathname();
  const { status } = useGatewayzAuth();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current || typeof window === 'undefined') {
      return;
    }

    const currentPath = pathname || '/';
    const shouldSkipRoute = ROUTE_SKIP_PREFIXES.some(
      (prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`)
    );
    const isAuthenticated = status === 'authenticated';

    if (!isAuthenticated || shouldSkipRoute) {
      return;
    }

    hasInitializedRef.current = true;

    const startSync = () => {
      initializeModelSync().catch((error) => {
        console.error('Failed to initialize model sync:', error);
      });
    };

    const idleCallback = (
      window as typeof window & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      }
    ).requestIdleCallback;

    if (typeof idleCallback === 'function') {
      idleCallback(startSync, { timeout: 4000 });
    } else {
      window.setTimeout(startSync, 2000);
    }
  }, [pathname, status]);

  // This component doesn't render anything
  return null;
}