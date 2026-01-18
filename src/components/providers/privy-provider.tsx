"use client";

/**
 * Privy Provider Wrapper with Desktop Support
 *
 * This file provides authentication providers for both web (Privy) and desktop (Tauri).
 *
 * IMPORTANT: The Privy SDK performs HTTPS checks during module initialization.
 * To prevent errors on Tauri desktop (which uses tauri.localhost HTTP), we:
 * 1. Detect Tauri synchronously before any render
 * 2. Use dynamic imports so the Privy SDK is only loaded on non-desktop platforms
 * 3. Use a separate file (desktop-auth-provider.tsx) for desktop that never imports Privy
 */

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { isTauriDesktop } from "@/lib/browser-detection";
import { waitForLocalStorageAccess, canUseLocalStorage } from "@/lib/safe-storage";

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

// Dynamic import of the web provider (with Privy) - only loaded on non-desktop
// This ensures the Privy SDK is never loaded on Tauri desktop
const WebPrivyProviderNoSSR = dynamic<PrivyProviderWrapperInnerProps>(
  () => import("./privy-web-provider").then((mod) => mod.PrivyWebProvider),
  { ssr: false }
);

// Dynamic import of the desktop provider (no Privy) - only loaded on desktop
const DesktopAuthProviderNoSSR = dynamic<PrivyProviderWrapperInnerProps>(
  () => import("./desktop-auth-provider").then((mod) => mod.DesktopAuthProvider),
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

  // CRITICAL: Detect Tauri synchronously during initial state to prevent race condition.
  // The Privy SDK checks for HTTPS during import/initialization, BEFORE useEffect runs.
  // If we use useState(false) + useEffect to detect Tauri, the first render will
  // use WebPrivyProviderNoSSR which dynamically imports Privy and triggers the HTTPS check error.
  // By detecting Tauri in useState's initializer, we ensure the correct provider
  // is used from the very first render.
  const [isTauri] = useState(() => {
    if (typeof window === "undefined") {
      return false; // SSR - will be re-evaluated on client
    }
    return isTauriDesktop();
  });

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

  // For Tauri desktop, use the desktop-specific provider that bypasses Privy
  // This avoids the "Embedded wallet is only available over HTTPS" error
  // The DesktopAuthProviderNoSSR dynamically imports from desktop-auth-provider.tsx
  // which has NO Privy imports, ensuring the Privy SDK is never loaded on desktop
  if (isTauri) {
    return <DesktopAuthProviderNoSSR {...props} storageStatus={status} />;
  }

  // Always render the provider to ensure the context chain is never broken.
  // This fixes the "Invalid hook call" error that occurred when hooks like usePrivy
  // were called while the provider was conditionally unmounted during "checking" state.
  // The storageStatus prop allows child components to know the current state and
  // render appropriate loading/blocked UI as needed.

  // When storage is blocked, show the notice instead of children
  if (status === "blocked") {
    return (
      <WebPrivyProviderNoSSR {...props} storageStatus={status}>
        <StorageDisabledNotice />
      </WebPrivyProviderNoSSR>
    );
  }

  // For "checking" and "ready" states, always render the provider with children
  // Children can use useStorageStatus() to show loading states if needed
  return <WebPrivyProviderNoSSR {...props} storageStatus={status} />;
}
