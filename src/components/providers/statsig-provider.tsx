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
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[Statsig] Error boundary caught error (likely ad blocker):', error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.children;
    }
    return this.props.children;
  }
}

function StatsigProviderInternal({ children }: { children: React.ReactNode }) {
  const { user, authenticated } = usePrivy();
  const [userId, setUserId] = React.useState<string>('anonymous');
  const [shouldBypassStatsig, setShouldBypassStatsig] = React.useState(false);

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

  // Initialize Statsig client
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
    }
  }, [sdkKey]);

  // Aggressive timeout: if Statsig doesn't initialize within 1 second, bypass it
  // This prevents ad blocker delays from blocking app rendering
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (!client) {
        console.warn('[Statsig] Init timeout (likely ad blocker) - bypassing analytics');
        setShouldBypassStatsig(true);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [client]);

  // Bypass Statsig if SDK key missing, timeout, or client not ready
  if (!sdkKey || shouldBypassStatsig || !client) {
    return <>{children}</>;
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
