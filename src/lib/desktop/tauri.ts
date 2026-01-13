/**
 * Tauri Desktop Integration Utilities
 *
 * This module provides utilities for integrating with Tauri desktop features
 * including system tray, notifications, updates, and IPC commands.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Check if the app is running in a Tauri desktop environment
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes("Mac");
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes("Win");
}

/**
 * Application version information from Rust backend
 */
export interface AppVersion {
  version: string;
  name: string;
  tauri_version: string;
}

/**
 * Platform information
 */
export interface PlatformInfo {
  os: string;
  arch: string;
  version: string;
  hostname: string;
}

/**
 * Window state for persistence
 */
export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
  fullscreen: boolean;
}

/**
 * Update information
 */
export interface UpdateInfo {
  available: boolean;
  version: string | null;
  notes: string | null;
  date: string | null;
}

/**
 * Get the application version
 */
export async function getAppVersion(): Promise<AppVersion> {
  if (!isTauri()) {
    return {
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
      name: "gatewayz-web",
      tauri_version: "N/A",
    };
  }
  return invoke<AppVersion>("get_app_version");
}

/**
 * Get platform information
 */
export async function getPlatformInfo(): Promise<PlatformInfo> {
  if (!isTauri()) {
    return {
      os: typeof navigator !== "undefined" ? navigator.platform : "unknown",
      arch: "unknown",
      version: "unknown",
      hostname: "unknown",
    };
  }
  return invoke<PlatformInfo>("get_platform_info");
}

/**
 * Show a system notification
 */
export async function showNotification(
  title: string,
  body: string,
  icon?: string
): Promise<void> {
  if (!isTauri()) {
    // Fallback to browser notifications
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon });
    } else if ("Notification" in window && Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification(title, { body, icon });
      }
    }
    return;
  }
  return invoke("show_notification", { title, body, icon });
}

/**
 * Open an external URL in the default browser
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke("open_external_url", { url });
}

/**
 * Get the stored authentication token
 */
export async function getAuthToken(): Promise<string | null> {
  if (!isTauri()) {
    return localStorage.getItem("gatewayz_auth_token");
  }
  return invoke<string | null>("get_auth_token");
}

/**
 * Store the authentication token securely
 */
export async function setAuthToken(token: string): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem("gatewayz_auth_token", token);
    return;
  }
  return invoke("set_auth_token", { token });
}

/**
 * Clear the stored authentication token
 */
export async function clearAuthToken(): Promise<void> {
  if (!isTauri()) {
    localStorage.removeItem("gatewayz_auth_token");
    return;
  }
  return invoke("clear_auth_token");
}

/**
 * Check for application updates
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  if (!isTauri()) {
    return {
      available: false,
      version: null,
      notes: null,
      date: null,
    };
  }
  return invoke<UpdateInfo>("check_for_updates");
}

/**
 * Install a pending update
 */
export async function installUpdate(): Promise<void> {
  if (!isTauri()) {
    throw new Error("Updates are only available in the desktop app");
  }
  return invoke("install_update");
}

/**
 * Get the current window state
 */
export async function getWindowState(): Promise<WindowState> {
  if (!isTauri()) {
    return {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      maximized: false,
      fullscreen: false,
    };
  }
  return invoke<WindowState>("get_window_state");
}

/**
 * Set the window state
 */
export async function setWindowState(state: WindowState): Promise<void> {
  if (!isTauri()) return;
  return invoke("set_window_state", { state });
}

/**
 * Toggle always-on-top mode
 */
export async function toggleAlwaysOnTop(): Promise<boolean> {
  if (!isTauri()) {
    console.warn("Always on top is only available in the desktop app");
    return false;
  }
  return invoke<boolean>("toggle_always_on_top");
}

/**
 * Minimize the window to system tray
 */
export async function minimizeToTray(): Promise<void> {
  if (!isTauri()) {
    window.blur();
    return;
  }
  return invoke("minimize_to_tray");
}

/**
 * Listen for new chat events from system tray
 */
export function onNewChat(callback: () => void): Promise<() => void> {
  if (!isTauri()) {
    return Promise.resolve(() => {});
  }
  return listen("new-chat", callback).then((unlisten) => unlisten);
}

/**
 * Listen for check updates events from system tray
 */
export function onCheckUpdates(callback: () => void): Promise<() => void> {
  if (!isTauri()) {
    return Promise.resolve(() => {});
  }
  return listen("check-updates", callback).then((unlisten) => unlisten);
}

/**
 * Listen for auth callback events (OAuth deep link)
 */
export function onAuthCallback(
  callback: (query: string) => void
): Promise<() => void> {
  if (!isTauri()) {
    return Promise.resolve(() => {});
  }
  return listen<string>("auth-callback", (event) => callback(event.payload)).then(
    (unlisten) => unlisten
  );
}

/**
 * Emit an event to the Rust backend
 */
export async function emitEvent(event: string, payload?: unknown): Promise<void> {
  if (!isTauri()) return;
  return emit(event, payload);
}

/**
 * Focus the main window
 */
export async function focusWindow(): Promise<void> {
  if (!isTauri()) {
    globalThis.window?.focus();
    return;
  }
  const tauriWindow = getCurrentWindow();
  await tauriWindow.show();
  await tauriWindow.setFocus();
}

/**
 * Set window title
 */
export async function setWindowTitle(title: string): Promise<void> {
  if (!isTauri()) {
    document.title = title;
    return;
  }
  const tauriWindow = getCurrentWindow();
  await tauriWindow.setTitle(title);
}

/**
 * Register keyboard shortcuts for the desktop app
 */
export function registerDesktopShortcuts(): void {
  if (typeof window === "undefined") return;

  // Handle Cmd/Ctrl+N for new chat
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "n") {
      e.preventDefault();
      // Emit new chat event
      if (isTauri()) {
        emitEvent("keyboard-new-chat");
      }
      // Also trigger locally
      window.dispatchEvent(new CustomEvent("gatewayz:new-chat"));
    }

    // Handle Cmd/Ctrl+, for settings
    if ((e.metaKey || e.ctrlKey) && e.key === ",") {
      e.preventDefault();
      window.location.href = "/settings";
    }

    // Handle Cmd/Ctrl+H to minimize to tray (desktop only)
    if ((e.metaKey || e.ctrlKey) && e.key === "h" && isTauri()) {
      e.preventDefault();
      minimizeToTray();
    }
  });
}
