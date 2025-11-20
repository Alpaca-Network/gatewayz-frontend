"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { RateLimitHandler } from "@/components/auth/rate-limit-handler";
import { GatewayzAuthProvider } from "@/context/gatewayz-auth-context";
import { PreviewHostnameInterceptor } from "@/components/auth/preview-hostname-interceptor";

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

      // Suppress non-blocking wallet extension errors
      if (reasonStr?.includes("chrome.runtime.sendMessage") ||
          reasonStr?.includes("Extension ID") ||
          reasonStr?.includes("from a webpage")) {
        console.warn("[Auth] Suppressing non-blocking wallet extension error:", reasonStr);
        event.preventDefault();
        return;
      }
    };

    window.addEventListener("unhandledrejection", rateLimitListener);
    return () => window.removeEventListener("unhandledrejection", rateLimitListener);
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

// Export a client-only version that doesn't render during SSR
export const PrivyProviderWrapper = dynamic(
  () => Promise.resolve(PrivyProviderWrapperInner),
  { ssr: false }
);

