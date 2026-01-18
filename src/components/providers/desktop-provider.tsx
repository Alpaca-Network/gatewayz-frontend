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
import {
  ShortcutInfoDialog,
  hasShownShortcutInfo,
  showShortcutInfoDialog,
} from "@/components/dialogs/shortcut-info-dialog";

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

  // Add data-tauri attribute to body for CSS styling when running in Tauri
  useEffect(() => {
    if (isTauri && typeof document !== "undefined") {
      document.body.setAttribute("data-tauri", "true");
      return () => {
        document.body.removeAttribute("data-tauri");
      };
    }
  }, [isTauri]);

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
  // The callback URL format is: gatewayz://auth/callback?token=xxx&user_id=xxx&privy_user_id=xxx&email=xxx
  useAuthCallback(async (query) => {
    // Parse the query string and handle the OAuth callback
    const params = new URLSearchParams(query);

    // New format from login page: token, user_id, privy_user_id, email
    const token = params.get("token");
    const userId = params.get("user_id");
    const privyUserId = params.get("privy_user_id");
    const email = params.get("email");

    // Legacy format: code, state (for backwards compatibility)
    const code = params.get("code");

    if (token && userId) {
      // New format: direct token from web login
      try {
        console.log("[Desktop Auth] Received auth callback with token");

        // Import storage functions
        const { saveApiKey, saveUserData, AUTH_REFRESH_EVENT } = await import("@/lib/api");

        // Save the API key and user data
        saveApiKey(token);
        saveUserData({
          user_id: parseInt(userId, 10),
          api_key: token,
          auth_method: "desktop_deep_link",
          privy_user_id: privyUserId || "",
          display_name: email || "",
          email: email || "",
          credits: 0, // Will be populated on next sync
        });

        console.log("[Desktop Auth] Credentials saved, dispatching refresh event");

        // Dispatch refresh event to update auth context
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
        }

        // Navigate to chat
        router.refresh();
        router.push("/chat");
      } catch (error) {
        console.error("[Desktop Auth] Error handling token callback:", error);
      }
    } else if (code) {
      // Legacy format: OAuth code exchange (kept for backwards compatibility)
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
    } else {
      console.error("[Desktop Auth] Invalid callback: missing token or code");
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

  // Show shortcut info dialog on first launch (desktop only)
  useEffect(() => {
    if (isTauri && !hasShownShortcutInfo()) {
      // Show after a short delay to let the app settle
      const timer = setTimeout(() => {
        showShortcutInfoDialog();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isTauri]);

  return (
    <>
      {children}
      {isTauri && <ShortcutInfoDialog />}
    </>
  );
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
