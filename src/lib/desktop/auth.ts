/**
 * Desktop Authentication Utilities
 *
 * This module provides authentication utilities specific to the desktop environment,
 * including deep link OAuth handling and secure token storage.
 */

import { isTauri, getAuthToken, setAuthToken, clearAuthToken } from "./tauri";

/**
 * Configuration for desktop OAuth
 */
export interface DesktopOAuthConfig {
  /** The OAuth provider (e.g., 'google', 'github') */
  provider: string;
  /** The OAuth client ID */
  clientId: string;
  /** The redirect URI scheme (e.g., 'gatewayz://') */
  redirectScheme: string;
  /** The authorization endpoint */
  authorizationEndpoint: string;
  /** The token endpoint */
  tokenEndpoint: string;
  /** OAuth scopes to request */
  scopes: string[];
}

/**
 * Desktop OAuth providers configuration
 */
export const DESKTOP_OAUTH_PROVIDERS: Record<string, DesktopOAuthConfig> = {
  google: {
    provider: "google",
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    redirectScheme: "gatewayz",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
  },
  github: {
    provider: "github",
    clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "",
    redirectScheme: "gatewayz",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    scopes: ["read:user", "user:email"],
  },
};

/**
 * Generate a cryptographically secure random string for OAuth state/PKCE
 */
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Generate OAuth authorization URL for desktop deep linking
 */
export function generateDesktopOAuthUrl(provider: string): string {
  const config = DESKTOP_OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }

  // Generate state for CSRF protection
  const state = generateRandomString(32);
  sessionStorage.setItem("oauth_state", state);

  // Build the authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: `${config.redirectScheme}://auth/callback`,
    response_type: "code",
    scope: config.scopes.join(" "),
    state: state,
  });

  return `${config.authorizationEndpoint}?${params.toString()}`;
}

/**
 * Handle OAuth callback from deep link
 */
export async function handleDesktopOAuthCallback(
  query: string
): Promise<{ success: boolean; error?: string }> {
  const params = new URLSearchParams(query);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) {
    return { success: false, error };
  }

  if (!code || !state) {
    return { success: false, error: "Missing code or state parameter" };
  }

  // Verify state matches
  const storedState = sessionStorage.getItem("oauth_state");
  if (state !== storedState) {
    return { success: false, error: "Invalid state parameter" };
  }

  // Clear stored state
  sessionStorage.removeItem("oauth_state");

  // Exchange code for token via backend
  try {
    const response = await fetch("/api/auth/desktop/callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || "Authentication failed" };
    }

    const { token } = await response.json();

    // Store token securely
    await setAuthToken(token);

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

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
 * Open OAuth flow in external browser for desktop
 */
export async function initiateDesktopOAuth(provider: string): Promise<void> {
  if (!isTauri()) {
    // Fallback to web OAuth
    window.location.href = `/api/auth/${provider}`;
    return;
  }

  const url = generateDesktopOAuthUrl(provider);

  // Open in external browser
  const { openExternalUrl } = await import("./tauri");
  await openExternalUrl(url);
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
