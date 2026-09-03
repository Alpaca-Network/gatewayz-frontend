/**
 * Desktop Authentication Utilities
 *
 * This module provides authentication utilities specific to the desktop environment,
 * including deep link OAuth handling and secure token storage.
 */

import { isTauri, getAuthToken, setAuthToken, clearAuthToken } from "./tauri";

// NOTE: this module used to also contain a legacy raw-OAuth "code exchange"
// path (generateDesktopOAuthUrl/handleDesktopOAuthCallback/initiateDesktopOAuth,
// posting a client-supplied `code` to /api/auth/desktop/callback). That
// backend route never verified the code was real — it minted a session token
// from unverified input, a full auth-bypass shape — and the path was dead
// code besides: the real desktop login flow (src/app/login/page.tsx's
// desktop branch, via DesktopAuthProvider.login()) already gets a real,
// backend-verified Gatewayz api_key through the same Privy sync used on web,
// and hands it to the app via a `gatewayz://auth/callback?token=...` deep
// link — see the `token && userId` branch in desktop-provider.tsx. Both the
// legacy path and the route it called have been removed.

/**
 * Check if user is authenticated in desktop environment
 */
export async function isDesktopAuthenticated(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }

  const token = await getAuthToken();
  return token !== null && token.length > 0;
}

/**
 * Sign out from desktop environment
 */
export async function signOutDesktop(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  // Clear stored token
  await clearAuthToken();

  // Notify backend to invalidate session
  try {
    await fetch("/api/auth/signout", {
      method: "POST",
    });
  } catch (e) {
    console.error("Failed to notify backend of signout:", e);
  }
}

/**
 * Get authentication headers for API requests in desktop environment
 */
export async function getDesktopAuthHeaders(): Promise<Record<string, string>> {
  if (!isTauri()) {
    return {};
  }

  const token = await getAuthToken();
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
    "X-Desktop-Client": "true",
  };
}

/**
 * Desktop auth state interface
 */
export interface DesktopAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
  } | null;
}

/**
 * Initialize desktop auth state
 */
export function createInitialDesktopAuthState(): DesktopAuthState {
  return {
    isAuthenticated: false,
    isLoading: true,
    error: null,
    user: null,
  };
}
