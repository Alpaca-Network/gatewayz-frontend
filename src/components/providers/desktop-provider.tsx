"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { isTauriDesktop } from "@/lib/browser-detection";

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

  // Synchronously detect Tauri for immediate CSS styling
  // This prevents flash of wrong styles (scrollbars visible, wrong viewport)
  // before useIsTauri's useEffect runs
  const [isTauriSync] = useState(() => {
    if (typeof window === "undefined") return false;
    return isTauriDesktop();
  });

  // Add data-tauri attribute to body for CSS styling when running in Tauri
  // Use synchronous detection to avoid flash of unstyled content
  useEffect(() => {
    if (isTauriSync && typeof document !== "undefined") {
      document.body.setAttribute("data-tauri", "true");
      return () => {
        document.body.removeAttribute("data-tauri");
      };
    }
  }, [isTauriSync]);

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
  // Note: The Rust backend may emit multiple events with retry logic for reliability,
  // so we track processed tokens to prevent duplicate handling
  useAuthCallback(async (query) => {
    // Parse the query string and handle the OAuth callback
    const params = new URLSearchParams(query);

    // New format from login page: token, user_id, privy_user_id, email, credits, display_name, tier, tier_display_name
    const token = params.get("token");
    const userId = params.get("user_id");
    const privyUserId = params.get("privy_user_id");
    const email = params.get("email");
    const creditsStr = params.get("credits");
    const displayName = params.get("display_name");
    const tier = params.get("tier");
    const tierDisplayName = params.get("tier_display_name");

    // Parse credits as number, default to 0 if not provided
    const credits = creditsStr ? parseInt(creditsStr, 10) : 0;

    // Legacy format: code, state (for backwards compatibility)
    const code = params.get("code");

    if (token && userId) {
      // Process the callback - always allow credentials to be updated/overwritten
      try {
        // Import storage functions
        const { saveApiKey, saveUserData, AUTH_REFRESH_EVENT, getApiKey } = await import("@/lib/api");

        // First, save the API key so we can make authenticated requests
        saveApiKey(token);

        // Fetch full user profile from backend to get display_name, credits, tier, etc.
        // The callback URL may not include all fields
        let fullUserData = {
          user_id: parseInt(userId, 10),
          api_key: token,
          auth_method: "desktop_deep_link",
          privy_user_id: privyUserId || "",
          display_name: displayName || email || "",
          email: email || "",
          credits: credits,
          tier: tier || undefined,
          tier_display_name: tierDisplayName || undefined,
        };

        try {
          const profileResponse = await fetch("/api/user/me", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();

            // Merge profile data with callback data (profile data takes precedence)
            fullUserData = {
              user_id: profileData.user_id || fullUserData.user_id,
              api_key: token,
              auth_method: "desktop_deep_link",
              privy_user_id: profileData.privy_user_id || fullUserData.privy_user_id,
              display_name: profileData.display_name || profileData.email || fullUserData.display_name,
              email: profileData.email || fullUserData.email,
              credits: profileData.credits ?? fullUserData.credits,
              tier: profileData.tier || fullUserData.tier,
              tier_display_name: profileData.tier_display_name || fullUserData.tier_display_name,
            };
          }
        } catch {
          // Failed to fetch profile, use callback data
        }

        // Save the full user data
        saveUserData(fullUserData);

        // Dispatch refresh event to update UI
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
        }

        // Wait for the next frame to ensure React has processed the state updates
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 50);
          });
        });

        // Verify credentials were saved before navigating
        const savedKey = getApiKey();

        if (savedKey) {
          router.push("/chat");
          // Fallback: force navigation via window.location after a short delay
          setTimeout(() => {
            if (window.location.pathname !== "/chat") {
              window.location.href = "/chat";
            }
          }, 500);
        } else {
          console.error("[Desktop Auth] Credentials not found after save");
          window.location.href = "/chat";
        }
      } catch (error) {
        console.error("[Desktop Auth] Error handling token callback:", error);
      }
    } else if (code) {
      // Legacy format: OAuth code exchange (kept for backwards compatibility)
      try {
        const { handleDesktopOAuthCallback } = await import("@/lib/desktop");
        const result = await handleDesktopOAuthCallback(query);

        if (result.success) {
          await new Promise(resolve => setTimeout(resolve, 100));
          router.push("/chat");
        } else {
          console.error("[Desktop Auth] Legacy callback failed:", result.error);
        }
      } catch (error) {
        console.error("[Desktop Auth] Error handling legacy callback:", error);
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
