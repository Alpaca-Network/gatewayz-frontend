"use client";

import { useEffect, type ReactNode } from "react";
import {
  useIsTauri,
  useDesktopShortcuts,
  useWindowStatePersistence,
  useDesktopUpdates,
  useNewChatEvent,
  useAuthCallback,
  useNavigateEvent,
} from "@/lib/desktop";
import { useRouter } from "next/navigation";

interface DesktopProviderProps {
  children: ReactNode;
}

/**
 * Desktop Provider Component
 *
 * This provider wraps the application with desktop-specific functionality
 * when running in the Tauri desktop environment. It handles:
 * - Keyboard shortcuts registration
 * - Window state persistence
 * - Update checking
 * - System tray events
 * - OAuth deep link handling
 */
export function DesktopProvider({ children }: DesktopProviderProps) {
  const isTauri = useIsTauri();
  const router = useRouter();

  // Register desktop keyboard shortcuts
  useDesktopShortcuts();

  // Persist window state across sessions
  useWindowStatePersistence();

  // Handle update management
  const { updateInfo, checkForUpdates } = useDesktopUpdates();

  // Handle new chat events from system tray
  useNewChatEvent(() => {
    router.push("/chat");
  });

  // Handle navigation events from Rust backend (replaces eval)
  useNavigateEvent((path) => {
    router.push(path);
  });

  // Handle OAuth callbacks from deep links
  useAuthCallback(async (query) => {
    // Parse the query string and handle the OAuth callback
    const params = new URLSearchParams(query);
    const code = params.get("code");
    const state = params.get("state");

    if (code) {
      try {
        // Use the desktop-specific auth callback endpoint
        const { handleDesktopOAuthCallback } = await import("@/lib/desktop");
        const result = await handleDesktopOAuthCallback(query);

        if (result.success) {
          // Refresh the page to pick up the new auth state
          router.refresh();
          router.push("/chat");
        } else {
          console.error("[Desktop Auth] Callback failed:", result.error);
        }
      } catch (error) {
        console.error("[Desktop Auth] Error handling callback:", error);
      }
    }
  });

  // Check for updates on mount (desktop only)
  useEffect(() => {
    if (isTauri) {
      // Check for updates after a short delay to not block initial load
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isTauri, checkForUpdates]);

  // Show update notification if available
  useEffect(() => {
    if (updateInfo?.available && isTauri) {
      // Import dynamically to avoid SSR issues
      import("@/lib/desktop").then(({ showNotification }) => {
        showNotification(
          "Update Available",
          `GatewayZ ${updateInfo.version} is available. Click to update.`
        );
      });
    }
  }, [updateInfo, isTauri]);

  return <>{children}</>;
}

/**
 * Desktop-only component wrapper
 *
 * Only renders children when running in the Tauri desktop environment.
 */
export function DesktopOnly({ children }: { children: ReactNode }) {
  const isTauri = useIsTauri();

  if (!isTauri) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Web-only component wrapper
 *
 * Only renders children when NOT running in the Tauri desktop environment.
 */
export function WebOnly({ children }: { children: ReactNode }) {
  const isTauri = useIsTauri();

  if (isTauri) {
    return null;
  }

  return <>{children}</>;
}
