"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { RateLimitHandler } from "@/components/auth/rate-limit-handler";
import { GatewayzAuthProvider } from "@/context/gatewayz-auth-context";

interface PrivyProviderWrapperProps {
  children: ReactNode;
  className?: string;
}

export function PrivyProviderWrapper({ children, className }: PrivyProviderWrapperProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const [showRateLimit, setShowRateLimit] = useState(false);

  useEffect(() => {
    if (!appId) {
      throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set");
    }
  }, [appId]);

  useEffect(() => {
    const rateLimitListener = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { status?: number; message?: string } | undefined;
      if (reason?.status === 429 || reason?.message?.includes("429")) {
        console.warn("Caught 429 error globally");
        setShowRateLimit(true);
        event.preventDefault();
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

  const renderChildren = className ? <div className={className}>{children}</div> : children;

  return (
    <>
      <RateLimitHandler show={showRateLimit} onDismiss={() => setShowRateLimit(false)} />
      <PrivyProvider
        appId={appId!}
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
        <GatewayzAuthProvider onAuthError={handleAuthError}>{renderChildren}</GatewayzAuthProvider>
      </PrivyProvider>
    </>
  );
}

