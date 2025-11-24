"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
    // Helper function to check if error is a non-blocking wallet extension error
    const isWalletExtensionError = (errorStr: string): boolean => {
      return errorStr?.includes("chrome.runtime.sendMessage") ||
             errorStr?.includes("Extension ID") ||
             errorStr?.includes("from a webpage") ||
             errorStr?.includes("runtime.sendMessage");
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

      // Log wallet extension errors but DON'T preventDefault
      // preventDefault() would block Privy's error recovery and break authentication
      if (isWalletExtensionError(reasonStr)) {
        console.warn("[Auth] Wallet extension error detected (non-blocking):", reasonStr);

        // Capture wallet extension error to Sentry as warning (non-blocking)
        Sentry.captureMessage(`Wallet extension error: ${reasonStr}`, {
          level: 'warning',
          tags: {
            auth_error: 'wallet_extension_error',
            blocking: 'false',
          },
        });

        // Don't call event.preventDefault() - let Privy handle its own error recovery
        return;
      }
    };

    // Handle regular errors (not promise rejections) that might be triggered by wallet extensions
    const errorListener = (event: ErrorEvent) => {
      if (isWalletExtensionError(event.message)) {
        console.warn("[Auth] Wallet extension error detected (non-blocking):", event.message);

        // Capture wallet extension error to Sentry as warning (non-blocking)
        Sentry.captureMessage(`Wallet extension error: ${event.message}`, {
          level: 'warning',
          tags: {
            auth_error: 'wallet_extension_error',
            blocking: 'false',
          },
        });

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
  const [status, setStatus] = useState<"checking" | "ready" | "blocked">(() =>
    canUseLocalStorage() ? "ready" : "checking"
  );

  useEffect(() => {
    if (status !== "checking") {
      return;
    }

    let active = true;
    waitForLocalStorageAccess({ attempts: 5, baseDelayMs: 200 }).then((available) => {
      if (!active) return;
      setStatus(available ? "ready" : "blocked");
    });

    return () => {
      active = false;
    };
  }, [status]);

  if (status === "checking") {
    return null;
  }

  if (status === "blocked") {
    return <StorageDisabledNotice />;
  }

  return <PrivyProviderNoSSR {...props} />;
}

