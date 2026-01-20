"use client";

/**
 * Desktop-only authentication provider that bypasses Privy entirely.
 *
 * This is in a separate file to avoid importing the Privy SDK on desktop.
 * The Privy SDK checks for HTTPS during module initialization and throws
 * "Embedded wallet is only available over HTTPS" before any config is applied.
 *
 * By keeping this provider in a separate file with no Privy imports,
 * we ensure the Privy SDK is never loaded on Tauri desktop apps.
 *
 * Desktop auth flow:
 * 1. User clicks login -> opens browser to beta.gatewayz.ai/login
 * 2. After login, browser redirects with deep link gatewayz://auth/callback?token=xxx
 * 3. Desktop app receives token via deep link handler in desktop-provider.tsx
 * 4. Token is stored in Tauri secure store and used for API calls
 */

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { GatewayzAuthContext, type AuthTimingInfo } from "@/context/gatewayz-auth-context";
import { AUTH_REFRESH_EVENT, getApiKey, getUserData, type UserData } from "@/lib/api";
import { signOutDesktop } from "@/lib/desktop/auth";
import { useAuthStore } from "@/lib/store/auth-store";

// Storage status context - mirrors the one in privy-provider.tsx
type StorageStatus = "checking" | "ready" | "blocked";
const StorageStatusContext = createContext<StorageStatus>("checking");

export function useStorageStatus() {
  return useContext(StorageStatusContext);
}

interface DesktopAuthProviderProps {
  children: ReactNode;
  storageStatus: StorageStatus;
}

export function DesktopAuthProvider({ children, storageStatus }: DesktopAuthProviderProps) {
  // Get Zustand store setters - this syncs the global auth state that ChatLayout uses
  const { setAuth: setZustandAuth, clearAuth: clearZustandAuth, setLoading: setZustandLoading } = useAuthStore();

  // Initialize state synchronously by checking localStorage immediately
  // This avoids the "idle" state that causes loading screens
  const [apiKey, setApiKey] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return getApiKey();
    }
    return null;
  });
  const [userData, setUserData] = useState<UserData | null>(() => {
    if (typeof window !== "undefined") {
      return getUserData();
    }
    return null;
  });
  const [status, setStatus] = useState<"idle" | "unauthenticated" | "authenticating" | "authenticated" | "error">(() => {
    // Initialize status based on whether we have credentials
    if (typeof window !== "undefined") {
      const storedKey = getApiKey();
      const storedUser = getUserData();
      if (storedKey && storedUser) {
        return "authenticated";
      }
      return "unauthenticated";
    }
    return "idle";
  });

  // Helper function to refresh credentials from storage
  // Also syncs to Zustand store so components using useAuthStore() get updated
  const refreshCredentials = useCallback(() => {
    const storedKey = getApiKey();
    const storedUser = getUserData();

    if (storedKey && storedUser) {
      setApiKey(storedKey);
      setUserData(storedUser);
      setStatus("authenticated");
      // Sync to Zustand store for components like ChatLayout that use useAuthStore()
      setZustandAuth(storedKey, storedUser);
      console.info("[Auth] Desktop: Found stored credentials, synced to Zustand store");
    } else {
      setApiKey(null);
      setUserData(null);
      setStatus("unauthenticated");
      // Clear Zustand store
      clearZustandAuth();
      console.info("[Auth] Desktop: No stored credentials found");
    }
  }, [setZustandAuth, clearZustandAuth]);

  // Initialize on mount - sync localStorage to both local state and Zustand store
  useEffect(() => {
    console.info("[Auth] Running in Tauri desktop mode - Privy SDK bypassed");
    // Set Zustand loading to false immediately since we're checking localStorage synchronously
    setZustandLoading(false);
    refreshCredentials();
  }, [refreshCredentials, setZustandLoading]);

  // Listen for AUTH_REFRESH_EVENT to update state after OAuth login callback
  // This ensures the UI updates when handleDesktopOAuthCallback stores the token
  useEffect(() => {
    const handleAuthRefresh = () => {
      console.info("[Auth] Desktop: AUTH_REFRESH_EVENT received, refreshing credentials");
      refreshCredentials();
    };

    if (typeof window !== "undefined") {
      window.addEventListener(AUTH_REFRESH_EVENT, handleAuthRefresh);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(AUTH_REFRESH_EVENT, handleAuthRefresh);
      }
    };
  }, [refreshCredentials]);

  // Desktop auth context value - provides the same interface as GatewayzAuthProvider
  // but without Privy dependencies
  const desktopAuthValue = useMemo(() => {
    const defaultAuthTiming: AuthTimingInfo = {
      startTime: null,
      elapsedMs: 0,
      retryCount: 0,
      maxRetries: 3,
      isSlowAuth: false,
      phase: "idle",
    };

    return {
      status,
      apiKey,
      userData,
      privyUser: null, // No Privy user on desktop
      privyReady: true, // Always "ready" since we're not using Privy
      privyAuthenticated: false, // Not using Privy auth
      error: null,
      authTiming: defaultAuthTiming,
      login: async () => {
        // Desktop login opens external browser to beta.gatewayz.ai/login
        // The deep link handler will receive the callback
        console.info("[Auth] Desktop: Opening external browser for login");
        if (typeof window !== "undefined") {
          if ("__TAURI__" in window) {
            // Use Tauri shell API to open external browser
            try {
              const { open } = await import("@tauri-apps/plugin-shell");
              await open("https://beta.gatewayz.ai/login?desktop=true");
            } catch (err) {
              console.error("[Auth] Desktop: Failed to open browser via Tauri shell", err);
              // Fallback to window.open
              window.open("https://beta.gatewayz.ai/login?desktop=true", "_blank");
            }
          } else {
            // Fallback for when __TAURI__ isn't available yet
            console.info("[Auth] Desktop: __TAURI__ not available, using window.open fallback");
            window.open("https://beta.gatewayz.ai/login?desktop=true", "_blank");
          }
        }
      },
      logout: async () => {
        console.info("[Auth] Desktop: Logging out");
        // Use signOutDesktop to properly clear all credentials including Tauri secure store
        await signOutDesktop();
        // Also clear localStorage credentials
        if (typeof window !== "undefined") {
          localStorage.removeItem("gatewayz_api_key");
          localStorage.removeItem("gatewayz_user_data");
          localStorage.removeItem("gatewayz_auth_token");
        }
        setApiKey(null);
        setUserData(null);
        setStatus("unauthenticated");
      },
      refresh: async () => {
        // Re-check stored credentials using the shared helper
        refreshCredentials();
      },
    };
  }, [status, apiKey, userData, refreshCredentials]);

  // For desktop, we provide both StorageStatusContext and GatewayzAuthContext
  // This ensures that useGatewayzAuth() works throughout the app
  return (
    <StorageStatusContext.Provider value={storageStatus}>
      <GatewayzAuthContext.Provider value={desktopAuthValue}>
        {children}
      </GatewayzAuthContext.Provider>
    </StorageStatusContext.Provider>
  );
}
