"use client";

import React from "react";
import { StatsigProvider, useClientAsyncInit } from '@statsig/react-bindings';
import { StatsigAutoCapturePlugin } from '@statsig/web-analytics';
import { StatsigSessionReplayPlugin } from '@statsig/session-replay';
import { usePrivy } from '@privy-io/react-auth';
import { getUserData } from '@/lib/api';

// Check if SDK key is available at module load time
// This must be a stable value to ensure consistent component rendering
const STATSIG_SDK_KEY = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY;
const IS_STATSIG_ENABLED = !!STATSIG_SDK_KEY && STATSIG_SDK_KEY.length > 0;

// Suppress Statsig SDK warnings when SDK key is missing
// This prevents console spam from the Statsig SDK initialization
const suppressStatsigWarnings = () => {
  if (typeof window === 'undefined') return;

  const originalWarn = console.warn;
  const originalError = console.error;

  if (!IS_STATSIG_ENABLED) {
    console.warn = (...args: unknown[]) => {
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

    console.error = (...args: unknown[]) => {
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

/**
 * Component that actually initializes Statsig with hooks.
 * This should ONLY be rendered when IS_STATSIG_ENABLED is true.
 * Separating this ensures hooks are called consistently.
 */
function StatsigProviderWithHooks({ children }: { children: React.ReactNode }) {
  const { user, authenticated } = usePrivy();
  const [userId, setUserId] = React.useState<string>('anonymous');
  const [shouldBypassStatsig, setShouldBypassStatsig] = React.useState(false);
  const initTimeoutRef = React.useRef<NodeJS.Timeout>();
  // Create plugins once and memoize to prevent recreation on re-renders
  // This prevents the Session Replay plugin from reinitializing and causing DOM conflicts
  const pluginsRef = React.useRef<Array<StatsigSessionReplayPlugin | StatsigAutoCapturePlugin> | null>(null);

  // Lazily create plugins only once
  if (pluginsRef.current === null) {
    pluginsRef.current = [
      new StatsigSessionReplayPlugin(), // Captures user sessions for debugging and analysis
      new StatsigAutoCapturePlugin(),   // Automatically captures clicks, scrolls, and navigation events
    ];
  }

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

  // Initialize Statsig client with enhanced error handling and caching
  // Includes auto-capture and session replay plugins for automatic event tracking
  // disableStorage: false enables localStorage caching which persists feature flags across sessions
  // Note: The 429 rate limit errors on /monitoring endpoint are from Statsig's servers
  // and are handled gracefully by the SDK - they don't affect application functionality
  const { client } = useClientAsyncInit(
    STATSIG_SDK_KEY!, // We know this is defined since IS_STATSIG_ENABLED is true
    { userID: userId },
    {
      plugins: pluginsRef.current,
      disableStorage: false, // Enable localStorage caching for feature flags (reduces API calls by ~50%)
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

  // Bypass Statsig if timeout, client not ready, or initialization failed
  if (shouldBypassStatsig || !client) {
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

// Log once at module load time if Statsig is disabled
if (typeof window !== 'undefined' && !IS_STATSIG_ENABLED) {
  // Use a flag to log only once
  const logKey = '__statsig_disabled_logged';
  const win = window as unknown as Record<string, unknown>;
  if (!win[logKey]) {
    console.warn('[Statsig] SDK key not found in environment - analytics disabled');
    win[logKey] = true;
  }
}

/**
 * Internal wrapper that decides whether to use Statsig or bypass it entirely.
 * This component does NOT call useClientAsyncInit when Statsig is disabled,
 * preventing the Session Replay plugin from initializing and causing DOM conflicts.
 */
function StatsigProviderInternal({ children }: { children: React.ReactNode }) {
  // If Statsig is not enabled (no SDK key), bypass entirely without calling any Statsig hooks.
  // This prevents the StatsigSessionReplayPlugin from initializing and manipulating the DOM,
  // which would cause conflicts with React's virtual DOM and result in "removeChild" errors.
  if (!IS_STATSIG_ENABLED) {
    // Mark analytics as unavailable
    if (typeof window !== 'undefined') {
      window.statsigAvailable = false;
    }
    return <>{children}</>;
  }

  // Statsig is enabled, render the component with hooks
  return <StatsigProviderWithHooks>{children}</StatsigProviderWithHooks>;
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
