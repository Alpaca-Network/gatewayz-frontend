"use client";

import React from "react";
import { StatsigProvider, useClientAsyncInit } from '@statsig/react-bindings';
import { StatsigAutoCapturePlugin } from '@statsig/web-analytics';
import { StatsigSessionReplayPlugin } from '@statsig/session-replay';
import { usePrivy } from '@privy-io/react-auth';
import { getUserData } from '@/lib/api';

export function StatsigProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user, authenticated } = usePrivy();
  const [userId, setUserId] = React.useState<string>('anonymous');
  const [initTimeout, setInitTimeout] = React.useState(false);

  // Get user ID from Privy or backend user data
  React.useEffect(() => {
    if (authenticated && user) {
      // Prefer Privy user ID
      setUserId(user.id || 'anonymous');
    } else {
      // Fallback to backend user data if available
      const userData = getUserData();
      if (userData?.user_id) {
        setUserId(String(userData.user_id));
      }
    }
  }, [authenticated, user]);

  const sdkKey = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY;

  const { client } = useClientAsyncInit(
    sdkKey || '',
    { userID: userId },
    {
      plugins: [
        new StatsigAutoCapturePlugin(),
        new StatsigSessionReplayPlugin()
      ]
    },
  );

  // Log warning if SDK key is missing
  React.useEffect(() => {
    if (!sdkKey) {
      console.warn('[Statsig] SDK key not found in environment variables. Please set NEXT_PUBLIC_STATSIG_CLIENT_KEY');
    }
  }, [sdkKey]);

  // Timeout fallback: if Statsig doesn't initialize within 3 seconds, render children anyway
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (!client) {
        console.warn('[Statsig] Initialization timeout - rendering app without analytics');
        setInitTimeout(true);
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [client]);

  // If SDK key is missing or timeout occurred, render children without Statsig
  if (!sdkKey || initTimeout) {
    return <>{children}</>;
  }

  return (
    <StatsigProvider client={client} loadingComponent={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      {children}
    </StatsigProvider>
  );
}
