"use client";

import React from "react";
import { StatsigProvider, useClientAsyncInit } from '@statsig/react-bindings';
import { StatsigAutoCapturePlugin } from '@statsig/web-analytics';
import { StatsigSessionReplayPlugin } from '@statsig/session-replay';
import { usePrivy } from '@privy-io/react-auth';
import { getUserData } from '@/lib/api';

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

  // Initialize Statsig client with enhanced error handling
  const { client } = useClientAsyncInit(
    sdkKey || '',
    { userID: userId },
    {
      plugins: [
        new StatsigAutoCapturePlugin(),
        new StatsigSessionReplayPlugin()
      ],
    },
  );

  // Log warning if SDK key is missing
  React.useEffect(() => {
    if (!sdkKey) {
      console.warn('[Statsig] SDK key not found - analytics disabled');
      setShouldBypassStatsig(true);
    }
  }, [sdkKey]);

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
