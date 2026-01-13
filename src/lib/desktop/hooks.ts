/**
 * React Hooks for Tauri Desktop Integration
 *
 * These hooks provide React-friendly access to Tauri desktop features
 * with proper cleanup and state management.
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  isTauri,
  getAppVersion,
  getPlatformInfo,
  checkForUpdates,
  installUpdate,
  onNewChat,
  onCheckUpdates,
  onAuthCallback,
  onNavigate,
  registerDesktopShortcuts,
  showNotification,
  type AppVersion,
  type PlatformInfo,
  type UpdateInfo,
} from "./tauri";

/**
 * Hook to check if running in Tauri desktop environment
 */
export function useIsTauri(): boolean {
  const [isTauriEnv, setIsTauriEnv] = useState(false);

  useEffect(() => {
    setIsTauriEnv(isTauri());
  }, []);

  return isTauriEnv;
}

/**
 * Hook to get application version information
 */
export function useAppVersion(): AppVersion | null {
  const [version, setVersion] = useState<AppVersion | null>(null);

  useEffect(() => {
    getAppVersion().then(setVersion).catch(console.error);
  }, []);

  return version;
}

/**
 * Hook to get platform information
 */
export function usePlatformInfo(): PlatformInfo | null {
  const [info, setInfo] = useState<PlatformInfo | null>(null);

  useEffect(() => {
    getPlatformInfo().then(setInfo).catch(console.error);
  }, []);

  return info;
}

/**
 * Hook to manage desktop updates
 */
export function useDesktopUpdates(): {
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  isInstalling: boolean;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  error: string | null;
} {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTauriEnv = useIsTauri();

  const doCheckForUpdates = useCallback(async () => {
    if (!isTauriEnv) return;

    setIsChecking(true);
    setError(null);

    try {
      const info = await checkForUpdates();
      setUpdateInfo(info);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check for updates");
    } finally {
      setIsChecking(false);
    }
  }, [isTauriEnv]);

  const doInstallUpdate = useCallback(async () => {
    if (!isTauriEnv || !updateInfo?.available) return;

    setIsInstalling(true);
    setError(null);

    try {
      await installUpdate();
      // App will restart after this
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to install update");
      setIsInstalling(false);
    }
  }, [isTauriEnv, updateInfo]);

  // Listen for check-updates event from system tray
  useEffect(() => {
    if (!isTauriEnv) return;

    let unlisten: (() => void) | undefined;

    onCheckUpdates(() => {
      doCheckForUpdates();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [isTauriEnv, doCheckForUpdates]);

  return {
    updateInfo,
    isChecking,
    isInstalling,
    checkForUpdates: doCheckForUpdates,
    installUpdate: doInstallUpdate,
    error,
  };
}

/**
 * Hook to handle new chat events from system tray or keyboard shortcuts
 */
export function useNewChatEvent(callback: () => void): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // Listen for Tauri events
    if (isTauri()) {
      onNewChat(() => {
        callbackRef.current();
      }).then((fn) => {
        unlisten = fn;
      });
    }

    // Listen for local keyboard shortcut events
    const handleLocalEvent = () => {
      callbackRef.current();
    };

    window.addEventListener("gatewayz:new-chat", handleLocalEvent);

    return () => {
      unlisten?.();
      window.removeEventListener("gatewayz:new-chat", handleLocalEvent);
    };
  }, []);
}

/**
 * Hook to handle OAuth callback from deep links
 */
export function useAuthCallback(
  callback: (query: string) => void
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    onAuthCallback((query) => {
      callbackRef.current(query);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);
}

/**
 * Hook to handle navigation events from Rust backend
 */
export function useNavigateEvent(
  callback: (path: string) => void
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    onNavigate((path) => {
      callbackRef.current(path);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);
}

/**
 * Hook to register desktop keyboard shortcuts
 */
export function useDesktopShortcuts(): void {
  useEffect(() => {
    registerDesktopShortcuts();
  }, []);
}

/**
 * Hook to show desktop notifications
 */
export function useDesktopNotification(): {
  show: (title: string, body: string, icon?: string) => Promise<void>;
  isSupported: boolean;
} {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(isTauri() || "Notification" in window);
  }, []);

  const show = useCallback(
    async (title: string, body: string, icon?: string) => {
      await showNotification(title, body, icon);
    },
    []
  );

  return { show, isSupported };
}

/**
 * Hook to persist window state across sessions
 */
export function useWindowStatePersistence(): void {
  const isTauriEnv = useIsTauri();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isTauriEnv) return;

    const saveWindowState = async () => {
      try {
        const { getWindowState } = await import("./tauri");
        const state = await getWindowState();

        // Store in local storage as backup
        localStorage.setItem("gatewayz_window_state", JSON.stringify(state));
      } catch (e) {
        console.error("Failed to save window state:", e);
      }
    };

    // Debounced save to avoid excessive writes during resize operations
    const debouncedSaveWindowState = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveWindowState();
      }, 500);
    };

    const restoreWindowState = async () => {
      try {
        const { setWindowState } = await import("./tauri");
        const savedState = localStorage.getItem("gatewayz_window_state");

        if (savedState) {
          const state = JSON.parse(savedState);
          await setWindowState(state);
        }
      } catch (e) {
        console.error("Failed to restore window state:", e);
      }
    };

    // Restore state on mount
    restoreWindowState();

    // Save state on window resize/move (debounced)
    window.addEventListener("resize", debouncedSaveWindowState);

    return () => {
      window.removeEventListener("resize", debouncedSaveWindowState);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Final save on unmount
      saveWindowState();
    };
  }, [isTauriEnv]);
}
