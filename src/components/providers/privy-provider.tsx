"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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

interface PrivyProviderWrapperProps {
  children: ReactNode;
  className?: string;
}

function PrivyProviderWrapperInner({ children, className }: PrivyProviderWrapperProps) {
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
    type PrivyErrorType = "iframe" | "java_object" | "wallet_creation_cancelled";

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
    const classifyPrivyError = (errorStr?: string, reason?: unknown): PrivyErrorType | null => {
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

      // "User wallet creation failed" - User dismissed the wallet creation modal
      // This happens when createOnLogin triggers wallet creation and user closes the modal
      if (normalized.includes("user wallet creation failed")) {
        return "wallet_creation_cancelled";
      }

      // Check for Privy error code in the reason object
      const privyErrorCode = (reason as { privyErrorCode?: string })?.privyErrorCode;
      if (privyErrorCode === "unknown_embedded_wallet_error") {
        return "wallet_creation_cancelled";
      }

      return null;
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
        wallet_creation_cancelled: "User cancelled wallet creation",
      };
      const label = labels[type];

      // For wallet creation cancellation, use debug level since it's user-initiated
      const isUserAction = type === "wallet_creation_cancelled";
      
      if (isUserAction) {
        console.log(`[Auth] ${label} (user action via ${source}):`, message);
      } else {
        console.warn(`[Auth] ${label} detected (non-blocking via ${source}):`, message);
      }

      // Log to Sentry - info for transient errors, debug for user actions
      Sentry.captureMessage(`${label}: ${message}`, {
        level: isUserAction ? "debug" : "info",
        tags: {
          auth_error: `privy_${type}_error`,
          blocking: "false",
          event_source: source,
          user_initiated: isUserAction ? "true" : "false",
        },
      });
    };

    const rateLimitListener = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { status?: number; message?: string } | undefined;
      const reasonStr = reason?.message ?? String(reason);

      // Handle rate limit errors
      if (reason?.status === 429 || reasonStr?.includes("429")) {
        console.warn("Caught 429 error globally");
        setShowRateLimit(true);

        // Capture rate limit error to Sentry
        Sentry.captureMessage("Authentication rate limit exceeded (429)", {
          level: 'warning',
          tags: {
            auth_error: 'rate_limit_exceeded',
            http_status: 429,
          },
        });

        event.preventDefault();
        return;
      }

      // Handle Privy-specific errors (iframe not initialized, Java object gone, wallet creation cancelled)
      const privyErrorType = classifyPrivyError(reasonStr, reason);
      if (privyErrorType) {
        logPrivyError(privyErrorType, reasonStr, "unhandledrejection");
        // For user-initiated actions like wallet creation cancellation, prevent the error from bubbling
        // to avoid "Uncaught (in promise)" console errors
        if (privyErrorType === "wallet_creation_cancelled") {
          event.preventDefault();
        }
        // Don't preventDefault for other types - let Privy handle recovery
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
      const privyErrorType = classifyPrivyError(event.message, event.error);
      if (privyErrorType) {
        logPrivyError(privyErrorType, event.message, "error");
        // For user-initiated actions like wallet creation cancellation, prevent the error from bubbling
        if (privyErrorType === "wallet_creation_cancelled") {
          event.preventDefault();
        }
        // Don't preventDefault for other types - these are transient errors that Privy recovers from
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
      if (error.status === 429 || error.message?.includes("429")) {
        setShowRateLimit(true);

        // Capture rate limit error to Sentry
        Sentry.captureMessage("Authentication rate limit exceeded (429)", {
          level: 'warning',
          tags: {
            auth_error: 'rate_limit_exceeded',
            http_status: 429,
          },
        });
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

  const privyConfig = useMemo<PrivyClientConfig>(() => {
    const config: PrivyClientConfig = {
      loginMethods: ["email", "google", "github"],
      appearance: {
        theme: "light",
        accentColor: "#000000",
        logo: "/logo_black.svg",
      },
      embeddedWallets: {
        ethereum: {
          createOnLogin: "users-without-wallets",
        },
      },
      defaultChain: base,
    };

    if (previewSafeOAuthRedirectUrl) {
      config.customOAuthRedirectUrl = previewSafeOAuthRedirectUrl;
    }

    return config;
  }, [previewSafeOAuthRedirectUrl]);

  const renderChildren = children;

  return (
    <>
      <RateLimitHandler show={showRateLimit} onDismiss={() => setShowRateLimit(false)} />
      <PrivyProvider
        appId={appId}
        config={privyConfig}
      >
        <PreviewHostnameInterceptor />
        <GatewayzAuthProvider onAuthError={handleAuthError}>{renderChildren}</GatewayzAuthProvider>
      </PrivyProvider>
    </>
  );
}

const PrivyProviderNoSSR = dynamic(
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
  const [status, setStatus] = useState<"checking" | "ready" | "blocked">("checking");

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

  if (status === "checking") {
    // Return empty fragment instead of null for consistent hydration
    return <></>;
  }

  if (status === "blocked") {
    return <StorageDisabledNotice />;
  }

  return <PrivyProviderNoSSR {...props} />;
}

