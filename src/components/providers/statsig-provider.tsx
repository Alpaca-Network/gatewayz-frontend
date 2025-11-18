"use client";

import React from "react";
import { StatsigProvider, useClientAsyncInit } from '@statsig/react-bindings';
import { StatsigAutoCapturePlugin } from '@statsig/web-analytics';
import { StatsigSessionReplayPlugin } from '@statsig/session-replay';
import { usePrivy } from '@privy-io/react-auth';
import { getUserData } from '@/lib/api';

// Suppress Statsig SDK warnings when SDK key is missing
// This prevents console spam from the Statsig SDK initialization
const suppressStatsigWarnings = () => {
  if (typeof window === 'undefined') return;

  const originalWarn = console.warn;
  const originalError = console.error;

  // Only suppress if SDK key is not configured
  const hasSDKKey = !!process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY;

  if (!hasSDKKey) {
    console.warn = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      // Suppress specific Statsig SDK warnings about missing SDK key
      if (
        message.includes('Unable to make request without an SDK key') ||
        message.includes('SDK key') ||
        message.includes('statsig')
      ) {
        return; // Suppress these warnings
      }
      originalWarn.apply(console, args);
    };

    console.error = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      // Suppress specific Statsig SDK errors about missing SDK key
      if (
        message.includes('Unable to make request without an SDK key') ||
        message.includes('SDK key')
      ) {
        return; // Suppress these errors
      }
      originalError.apply(console, args);
    };
  }
};

// Run suppression once on module load
suppressStatsigWarnings();

// Error boundary for Statsig initialization
class StatsigErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Check if this is a network/ad blocker related error
    const isNetworkError =
      error.message?.includes('net::ERR_BLOCKED_BY_CLIENT') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('CORS') ||
      error.message?.includes('blocked');

    if (isNetworkError) {
      console.warn('[Statsig] Network/ad blocker error caught - analytics will be disabled:', error.message);
    } else {
      console.error('[Statsig] Unexpected error in Statsig initialization:', error.message, errorInfo);
    }

    // Track that analytics is unavailable (for conditional logic)
    if (typeof window !== 'undefined') {
      window.statsigAvailable = false;
    }
  }

  render() {
    // Always render children regardless of error - analytics should never block UI
    return this.props.children;
  }
}

function StatsigProviderInternal({ children }: { children: React.ReactNode }) {
  const { user, authenticated } = usePrivy();
  const [userId, setUserId] = React.useState<string>('anonymous');
  const [shouldBypassStatsig, setShouldBypassStatsig] = React.useState(false);
  const initTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Get user ID from Privy or backend user data
  React.useEffect(() => {
    if (authenticated && user) {
      setUserId(user.id || 'anonymous');
    } else {
      const userData = getUserData();
      if (userData?.user_id) {
        setUserId(String(userData.user_id));
      }
    }
  }, [authenticated, user]);

  const sdkKey = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY;

  // Early exit: bypass Statsig entirely if SDK key is missing
  // This prevents Statsig from trying to initialize and emitting warnings
  React.useEffect(() => {
    if (!sdkKey) {
      console.warn('[Statsig] SDK key not found in environment - analytics disabled');
      setShouldBypassStatsig(true);
    }
  }, [sdkKey]);

  // Initialize Statsig client with enhanced error handling
  // Defer heavy plugins until after auth is complete to avoid blocking
  // Only initialize if SDK key is present
  const { client } = useClientAsyncInit(
    sdkKey || 'disabled',
    { userID: userId },
    {
      plugins: [], // Initialize without plugins first for faster startup
      disableStorage: !sdkKey, // Disable storage if SDK key missing
    },
  );

  // Timeout: if Statsig doesn't initialize within 2 seconds, bypass it
  // This prevents ad blocker/network delays from blocking app rendering
  React.useEffect(() => {
    initTimeoutRef.current = setTimeout(() => {
      if (!client && !shouldBypassStatsig) {
        console.warn('[Statsig] Initialization timeout (likely ad blocker or slow network) - bypassing analytics');
        setShouldBypassStatsig(true);
      }
    }, 2000);

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [client, shouldBypassStatsig]);

  // Bypass Statsig if SDK key missing, timeout, client not ready, or initialization failed
  if (!sdkKey || shouldBypassStatsig || !client) {
    // Mark analytics as unavailable
    if (typeof window !== 'undefined') {
      window.statsigAvailable = false;
    }
    return <>{children}</>;
  }

  // Mark analytics as available
  if (typeof window !== 'undefined') {
    window.statsigAvailable = true;
  }

  return (
    <StatsigProvider client={client}>
      {children}
    </StatsigProvider>
  );
}

export function StatsigProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <StatsigErrorBoundary>
      <StatsigProviderInternal>
        {children}
      </StatsigProviderInternal>
    </StatsigErrorBoundary>
  );
}
