"use client";

import React from "react";
import { StatsigProvider, useClientAsyncInit } from '@statsig/react-bindings';
import { StatsigAutoCapturePlugin } from '@statsig/web-analytics';
import { StatsigSessionReplayPlugin } from '@statsig/session-replay';
import { getUserData } from '@/lib/api';
import { isTauriDesktop } from '@/lib/browser-detection';

// Check if running in Tauri desktop mode at module level
// This is checked once and cached for the lifetime of the app
const IS_TAURI_DESKTOP = typeof window !== 'undefined' && isTauriDesktop();

// Custom hook that safely gets Privy user info
// Returns null values when running in Tauri desktop (where PrivyProvider is not used)
// IMPORTANT: This hook pattern is intentionally conditional on a module-level constant
// to avoid calling usePrivy() in desktop mode where PrivyProvider doesn't exist
function usePrivySafe(): { user: { id?: string } | null; authenticated: boolean } {
  // In desktop mode, never try to use Privy - just return empty values
  // The getUserData() fallback in the effect will provide user info from localStorage
  if (IS_TAURI_DESKTOP) {
    return { user: null, authenticated: false };
  }

  // In web mode, use the actual Privy hook
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const privyModule = require('@privy-io/react-auth') as typeof import('@privy-io/react-auth');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return privyModule.usePrivy();
}

// Check if SDK key is valid (exists and is not a placeholder)
const hasValidSdkKey = (): boolean => {
  const key = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY;
  return !!key && key !== 'disabled' && key.length > 10;
};

// Create plugins only when SDK key is valid
// This prevents DOM manipulation from session replay when analytics is disabled
const createPlugins = () => {
  if (!hasValidSdkKey()) {
    return []; // No plugins when SDK key is invalid - prevents DOM conflicts
  }
  return [
    new StatsigSessionReplayPlugin(), // Captures user sessions for debugging and analysis
    new StatsigAutoCapturePlugin(),   // Automatically captures clicks, scrolls, and navigation events
  ];
};

// Suppress Statsig SDK warnings when SDK key is missing
// This prevents console spam from the Statsig SDK initialization
const suppressStatsigWarnings = () => {
  if (typeof window === 'undefined') return;

  const originalWarn = console.warn;
  const originalError = console.error;

  // Only suppress if SDK key is not configured
  const hasSDKKey = hasValidSdkKey();

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

    // Check if this is a DOM manipulation error (from Session Replay plugin)
    const isDOMError =
      error.message?.includes('removeChild') ||
      error.message?.includes('insertBefore') ||
      error.message?.includes('Node') ||
      error.message?.includes('not a child');

    if (isNetworkError) {
      console.warn('[Statsig] Network/ad blocker error caught - analytics will be disabled:', error.message);
    } else if (isDOMError) {
      console.warn('[Statsig] DOM manipulation error caught (likely from session replay) - analytics will be disabled:', error.message);
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

// Inner component that actually initializes the Statsig SDK
// This is only rendered when we have a valid SDK key, preventing
// the useClientAsyncInit hook from making network requests with an invalid key
function StatsigClientProvider({ children, userId }: { children: React.ReactNode; userId: string }) {
  const [shouldBypassStatsig, setShouldBypassStatsig] = React.useState(false);
  const initTimeoutRef = React.useRef<NodeJS.Timeout>();
  const bypassRef = React.useRef(false);
  // Memoize plugins to prevent re-creation on every render
  const pluginsRef = React.useRef(createPlugins());

  const sdkKey = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY!; // Safe: only called when hasValidSdkKey() is true

  // Initialize Statsig client with enhanced error handling and caching
  // CRITICAL: Plugins are only created when SDK key is valid (see pluginsRef above)
  // This prevents StatsigSessionReplayPlugin from manipulating the DOM when analytics is disabled,
  // which was causing React VDOM desynchronization and removeChild errors.
  // disableStorage: false enables localStorage caching which persists feature flags across sessions
  const { client } = useClientAsyncInit(
    sdkKey,
    { userID: userId },
    {
      plugins: pluginsRef.current,
      disableStorage: false, // Enable localStorage caching for feature flags (reduces API calls by ~50%)
    },
  );

  // Timeout: if Statsig doesn't initialize within 2 seconds, bypass it
  // This prevents ad blocker/network delays from blocking app rendering
  React.useEffect(() => {
    if (bypassRef.current) {
      return;
    }

    initTimeoutRef.current = setTimeout(() => {
      if (!client && !bypassRef.current) {
        console.warn('[Statsig] Initialization timeout (likely ad blocker or slow network) - bypassing analytics');
        bypassRef.current = true;
        setShouldBypassStatsig(true);
      }
    }, 2000);

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [client]);

  // Bypass if timeout or client not ready
  if (shouldBypassStatsig || !client) {
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

function StatsigProviderInternal({ children }: { children: React.ReactNode }) {
  const { user, authenticated } = usePrivySafe();
  const [userId, setUserId] = React.useState<string>('anonymous');

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

  const isValidKey = hasValidSdkKey();

  // If SDK key is missing or invalid, bypass Statsig entirely
  // This prevents the Statsig SDK from making network requests with an invalid key
  // which would result in 401 errors to prodregistryv2.org
  if (!isValidKey) {
    if (typeof window !== 'undefined') {
      window.statsigAvailable = false;
    }
    return <>{children}</>;
  }

  // Only render the client provider (which calls useClientAsyncInit) when we have a valid key
  return (
    <StatsigClientProvider userId={userId}>
      {children}
    </StatsigClientProvider>
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
