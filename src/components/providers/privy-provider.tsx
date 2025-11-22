"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { RateLimitHandler } from "@/components/auth/rate-limit-handler";
import { GatewayzAuthProvider } from "@/context/gatewayz-auth-context";
import { PreviewHostnameInterceptor } from "@/components/auth/preview-hostname-interceptor";
import { waitForLocalStorageAccess, canUseLocalStorage } from "@/lib/safe-storage";

interface PrivyProviderWrapperProps {
  children: ReactNode;
  className?: string;
}

function PrivyProviderWrapperInner({ children, className }: PrivyProviderWrapperProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "clxxxxxxxxxxxxxxxxxxx";
  const [showRateLimit, setShowRateLimit] = useState(false);

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
        event.preventDefault();
        return;
      }

      // Log wallet extension errors but DON'T preventDefault
      // preventDefault() would block Privy's error recovery and break authentication
      if (isWalletExtensionError(reasonStr)) {
        console.warn("[Auth] Wallet extension error detected (non-blocking):", reasonStr);
        // Don't call event.preventDefault() - let Privy handle its own error recovery
        return;
      }
    };

    // Handle regular errors (not promise rejections) that might be triggered by wallet extensions
    const errorListener = (event: ErrorEvent) => {
      if (isWalletExtensionError(event.message)) {
        console.warn("[Auth] Wallet extension error detected (non-blocking):", event.message);
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
      }
    },
    []
  );

  const renderChildren = children;

  return (
    <>
      <RateLimitHandler show={showRateLimit} onDismiss={() => setShowRateLimit(false)} />
      <PrivyProvider
        appId={appId}
        config={{
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
        }}
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

