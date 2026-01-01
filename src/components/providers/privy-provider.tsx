"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { PrivyProvider } from "@privy-io/react-auth";
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { RateLimitHandler } from "@/components/auth/rate-limit-handler";
import { GatewayzAuthProvider } from "@/context/gatewayz-auth-context";
import { PreviewHostnameInterceptor } from "@/components/auth/preview-hostname-interceptor";
import { isVercelPreviewDeployment } from "@/lib/preview-hostname-handler";
import { buildPreviewSafeRedirectUrl, DEFAULT_PREVIEW_REDIRECT_ORIGIN } from "@/lib/preview-oauth-redirect";
import { waitForLocalStorageAccess, canUseLocalStorage } from "@/lib/safe-storage";
import { shouldDisableEmbeddedWallets } from "@/lib/browser-detection";

interface PrivyProviderWrapperProps {
  children: ReactNode;
  className?: string;
}

// Context to track storage readiness - used by useAuth to provide safe fallback
type StorageStatus = "checking" | "ready" | "blocked";
const StorageStatusContext = createContext<StorageStatus>("checking");

export function useStorageStatus() {
  return useContext(StorageStatusContext);
}

interface PrivyProviderWrapperInnerProps extends PrivyProviderWrapperProps {
  storageStatus: StorageStatus;
}

function PrivyProviderWrapperInner({ children, className, storageStatus }: PrivyProviderWrapperInnerProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "clxxxxxxxxxxxxxxxxxxx";
  const [showRateLimit, setShowRateLimit] = useState(false);
  const hasLoggedWalletConnectRelayErrorRef = useRef(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams?.toString() ?? "";
  const previewRedirectOrigin =
    process.env.NEXT_PUBLIC_PRIVY_OAUTH_REDIRECT_ORIGIN?.trim() || DEFAULT_PREVIEW_REDIRECT_ORIGIN;

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
      console.warn("NEXT_PUBLIC_PRIVY_APP_ID is not set - authentication will not work");
    }
  }, []);

  useEffect(() => {
    type WalletErrorType = "extension" | "relay";
    type PrivyErrorType = "iframe" | "java_object";

    const classifyWalletError = (errorStr?: string): WalletErrorType | null => {
      if (!errorStr) {
        return null;
      }

      const normalized = errorStr.toLowerCase();
      const isRelayError =
        normalized.includes("walletconnect") ||
        normalized.includes("requestrelay") ||
        normalized.includes("websocket error 1006") ||
        normalized.includes("explorer-api.walletconnect.com") ||
        normalized.includes("relay.walletconnect.com");

      if (isRelayError) {
        return "relay";
      }

      const isExtensionError =
        normalized.includes("chrome.runtime.sendmessage") ||
        normalized.includes("runtime.sendmessage") ||
        (normalized.includes("extension id") && normalized.includes("from a webpage"));

      return isExtensionError ? "extension" : null;
    };

    // Classify Privy-specific errors that are non-blocking
    type IndexedDBErrorType = "database_deleted" | "connector_timeout";
    const classifyPrivyError = (errorStr?: string): PrivyErrorType | null => {
      if (!errorStr) {
        return null;
      }

      const normalized = errorStr.toLowerCase();

      // "iframe not initialized" - Privy iframe timing issue
      if (normalized.includes("iframe not initialized")) {
        return "iframe";
      }

      // "Java object is gone" - WebView/Android bridge timing issue
      if (normalized.includes("java object is gone")) {
        return "java_object";
      }

      return null;
    };

    // Classify IndexedDB-related errors from embedded wallet initialization
    const classifyIndexedDBError = (errorStr?: string): IndexedDBErrorType | null => {
      if (!errorStr) {
        return null;
      }

      const normalized = errorStr.toLowerCase();

      // "Database deleted by request of the user" - iOS WebKit storage eviction
      if (normalized.includes("database deleted") || normalized.includes("deleted by request")) {
        return "database_deleted";
      }

      // "Unable to initialize all expected connectors before timeout" - connector timeout
      if (normalized.includes("unable to initialize") && normalized.includes("connectors")) {
        return "connector_timeout";
      }

      return null;
    };

    const logIndexedDBError = (type: IndexedDBErrorType, message: string, source: "unhandledrejection" | "error") => {
      const labels: Record<IndexedDBErrorType, string> = {
        database_deleted: "IndexedDB database deleted (iOS storage eviction)",
        connector_timeout: "Wallet connector initialization timeout",
      };
      const label = labels[type];

      console.warn(`[Auth] ${label} detected (non-blocking via ${source}):`, message);

      // Log to Sentry as warning - this is a known iOS issue
      Sentry.captureMessage(`${label}: ${message}`, {
        level: "warning",
        tags: {
          auth_error: `indexeddb_${type}`,
          blocking: "false",
          event_source: source,
          is_ios_in_app_browser: String(shouldDisableEmbeddedWallets()),
        },
      });
    };

    const logWalletError = (type: WalletErrorType, message: string, source: "unhandledrejection" | "error") => {
      const label = type === "relay" ? "WalletConnect relay error" : "Wallet extension error";
      console.warn(`[Auth] ${label} detected (non-blocking via ${source}):`, message);

      const alreadyLoggedRelay = hasLoggedWalletConnectRelayErrorRef.current;
      if (type === "relay" && alreadyLoggedRelay) {
        return;
      }

      if (type === "relay") {
        hasLoggedWalletConnectRelayErrorRef.current = true;
      }

      Sentry.captureMessage(`${label}: ${message}`, {
        level: type === "relay" ? "warning" : "info",
        tags: {
          auth_error: type === "relay" ? "walletconnect_relay_error" : "wallet_extension_error",
          blocking: "false",
          event_source: source,
        },
      });
    };

    const logPrivyError = (type: PrivyErrorType, message: string, source: "unhandledrejection" | "error") => {
      const labels: Record<PrivyErrorType, string> = {
        iframe: "Privy iframe initialization error",
        java_object: "WebView bridge error",
      };
      const label = labels[type];

      console.warn(`[Auth] ${label} detected (non-blocking via ${source}):`, message);

      // Log to Sentry as info level - these are expected transient errors
      Sentry.captureMessage(`${label}: ${message}`, {
        level: "info",
        tags: {
          auth_error: `privy_${type}_error`,
          blocking: "false",
          event_source: source,
        },
      });
    };

    const rateLimitListener = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { status?: number; message?: string } | undefined;
      const reasonStr = reason?.message ?? String(reason);

      // Handle rate limit errors
      // Note: We intentionally do NOT send 429s to Sentry because:
      // 1. They are expected during high traffic or rapid auth attempts
      // 2. We handle them gracefully with the RateLimitHandler UI component
      // 3. Sending them creates noise in Sentry without actionable insights
      if (reason?.status === 429 || reasonStr?.includes("429")) {
        console.warn("[Auth] Rate limit (429) detected - showing user notification");
        setShowRateLimit(true);
        event.preventDefault();
        return;
      }

      // Handle Privy-specific errors (iframe not initialized, Java object gone)
      const privyErrorType = classifyPrivyError(reasonStr);
      if (privyErrorType) {
        logPrivyError(privyErrorType, reasonStr, "unhandledrejection");
        // Don't preventDefault - let Privy handle recovery
        return;
      }

      // Handle IndexedDB errors (iOS storage eviction, connector timeout)
      const indexedDBErrorType = classifyIndexedDBError(reasonStr);
      if (indexedDBErrorType) {
        logIndexedDBError(indexedDBErrorType, reasonStr, "unhandledrejection");
        // Prevent the error from appearing in console as unhandled
        event.preventDefault();
        return;
      }

      const walletErrorType = classifyWalletError(reasonStr);

      // Log wallet extension and WalletConnect relay errors
      // For extension errors, we CAN call preventDefault() safely since these are from
      // third-party browser extensions (like MetaMask's inpage.js) - not from Privy itself.
      // This prevents the "Uncaught (in promise)" console error without affecting Privy.
      if (walletErrorType) {
        logWalletError(walletErrorType, reasonStr, "unhandledrejection");
        if (walletErrorType === "extension") {
          event.preventDefault();
        }
        return;
      }
    };

    // Handle regular errors (not promise rejections) that might be triggered by wallet extensions
    // Note: "Cannot redefine property: ethereum" errors are handled by ErrorSuppressor component
    // which is loaded earlier in the component tree (layout.tsx) to avoid duplicate handling
    const errorListener = (event: ErrorEvent) => {
      // Handle Privy-specific errors
      const privyErrorType = classifyPrivyError(event.message);
      if (privyErrorType) {
        logPrivyError(privyErrorType, event.message, "error");
        // Don't preventDefault - these are transient errors that Privy recovers from
        return;
      }

      // Handle IndexedDB errors
      const indexedDBErrorType = classifyIndexedDBError(event.message);
      if (indexedDBErrorType) {
        logIndexedDBError(indexedDBErrorType, event.message, "error");
        // Prevent the error from appearing in console
        event.preventDefault();
        return;
      }

      const walletErrorType = classifyWalletError(event.message);
      if (walletErrorType) {
        logWalletError(walletErrorType, event.message, "error");

        // Don't call event.preventDefault() - let Privy handle its own flow
        // Just log the error for visibility
        return;
      }
    };

    window.addEventListener("unhandledrejection", rateLimitListener);
    window.addEventListener("error", errorListener);

    return () => {
      window.removeEventListener("unhandledrejection", rateLimitListener);
      window.removeEventListener("error", errorListener);
    };
  }, []);

  const handleAuthError = useMemo(
    () => (error?: { status?: number; message?: string }) => {
      if (!error) return;
      // Handle rate limit errors gracefully with UI - no Sentry logging needed
      // as these are expected during high traffic and handled by RateLimitHandler
      if (error.status === 429 || error.message?.includes("429")) {
        console.warn("[Auth] Rate limit (429) from Privy - showing user notification");
        setShowRateLimit(true);
      }
    },
    []
  );

  const previewSafeOAuthRedirectUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (!isVercelPreviewDeployment()) {
      return undefined;
    }

    if (!previewRedirectOrigin) {
      return undefined;
    }

    return buildPreviewSafeRedirectUrl({
      currentHref: window.location.href,
      targetOrigin: previewRedirectOrigin,
    });
  }, [pathname, searchParamsKey, previewRedirectOrigin]);

  // Check if we should disable embedded wallets (iOS in-app browsers have IndexedDB issues)
  const disableEmbeddedWallets = useMemo(() => shouldDisableEmbeddedWallets(), []);

  const privyConfig = useMemo<PrivyClientConfig>(() => {
    const config: PrivyClientConfig = {
      loginMethods: ["email", "sms", "google", "github"],
      appearance: {
        theme: "light",
        accentColor: "#000000",
        logo: "/logo_black.svg",
      },
      // Only enable embedded wallets if not in a problematic environment
      // iOS in-app browsers (Twitter, Facebook, etc.) have IndexedDB issues
      // that cause "Database deleted by request of the user" errors
      embeddedWallets: disableEmbeddedWallets
        ? undefined
        : {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
      defaultChain: base,
    };

    if (previewSafeOAuthRedirectUrl) {
      config.customOAuthRedirectUrl = previewSafeOAuthRedirectUrl;
    }

    // Log when embedded wallets are disabled for debugging
    if (disableEmbeddedWallets) {
      console.info("[Auth] Embedded wallets disabled due to iOS in-app browser environment");
    }

    return config;
  }, [previewSafeOAuthRedirectUrl, disableEmbeddedWallets]);

  return (
    <StorageStatusContext.Provider value={storageStatus}>
      <RateLimitHandler show={showRateLimit} onDismiss={() => setShowRateLimit(false)} />
      <PrivyProvider
        appId={appId}
        config={privyConfig}
      >
        <PreviewHostnameInterceptor />
        <GatewayzAuthProvider onAuthError={handleAuthError}>{children}</GatewayzAuthProvider>
      </PrivyProvider>
    </StorageStatusContext.Provider>
  );
}

const PrivyProviderNoSSR = dynamic<PrivyProviderWrapperInnerProps>(
  () => Promise.resolve(PrivyProviderWrapperInner),
  { ssr: false }
);

function StorageDisabledNotice() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-2">
        <p className="text-base font-semibold">Browser storage is disabled</p>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Gatewayz needs access to localStorage to securely cache your encrypted API key. Please enable browser
          storage or use a standard browser window, then refresh this page to continue.
        </p>
      </div>
    </div>
  );
}

export function PrivyProviderWrapper(props: PrivyProviderWrapperProps) {
  // Always start with "checking" during SSR to ensure consistent hydration
  // This prevents server/client mismatch since canUseLocalStorage() returns false on server
  const [status, setStatus] = useState<StorageStatus>("checking");

  useEffect(() => {
    // Check localStorage availability after mount (client-side only)
    if (canUseLocalStorage()) {
      setStatus("ready");
      return;
    }

    // If not immediately available, wait and retry
    let active = true;
    waitForLocalStorageAccess({ attempts: 5, baseDelayMs: 200 }).then((available) => {
      if (!active) return;
      setStatus(available ? "ready" : "blocked");
    });

    return () => {
      active = false;
    };
  }, []);

  // Always render the provider to ensure the context chain is never broken.
  // This fixes the "Invalid hook call" error that occurred when hooks like usePrivy
  // were called while the provider was conditionally unmounted during "checking" state.
  // The storageStatus prop allows child components to know the current state and
  // render appropriate loading/blocked UI as needed.
  
  // When storage is blocked, show the notice instead of children
  if (status === "blocked") {
    return (
      <PrivyProviderNoSSR {...props} storageStatus={status}>
        <StorageDisabledNotice />
      </PrivyProviderNoSSR>
    );
  }

  // For "checking" and "ready" states, always render the provider with children
  // Children can use useStorageStatus() to show loading states if needed
  return <PrivyProviderNoSSR {...props} storageStatus={status} />;
}

