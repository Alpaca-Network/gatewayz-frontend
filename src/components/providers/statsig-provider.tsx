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

  const { client } = useClientAsyncInit(
    process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY || '',
    { userID: userId },
    {
      plugins: [
        new StatsigAutoCapturePlugin(),
        new StatsigSessionReplayPlugin()
      ]
    },
  );

  return (
    <StatsigProvider client={client} loadingComponent={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      {children}
    </StatsigProvider>
  );
}
