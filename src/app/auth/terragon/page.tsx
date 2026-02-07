"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import { getApiKey, getUserData, getApiKeyWithRetry } from "@/lib/api";

/**
 * Session storage key used to signal that an auth bridge flow is active.
 * When set, the auth context skips the onboarding redirect so the bridge
 * page can complete its token generation and redirect back to the caller.
 */
const AUTH_BRIDGE_FLAG_KEY = "auth_bridge_active";

/** How long to wait for auth before showing an error (ms) */
const AUTH_TIMEOUT_MS = 30_000;

/**
 * Allowed callback URL domains for security.
 * Only these domains can receive auth tokens via redirect.
 */
const ALLOWED_CALLBACK_DOMAINS = [
  "terragon.ai",
  "www.terragon.ai",
  "app.terragon.ai",
  "gatewayz.ai",
  "inbox.gatewayz.ai",
  "terragon-www-production.up.railway.app",
  "localhost",
  "127.0.0.1",
];

/**
 * Validates that a callback URL is from an allowed domain.
 * Prevents open redirect vulnerabilities.
 */
function isAllowedCallbackUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    return ALLOWED_CALLBACK_DOMAINS.includes(hostname) ||
           hostname.endsWith(".terragon.ai") ||
           hostname.endsWith(".gatewayz.ai");
  } catch {
    return false;
  }
}

type PageStatus = "loading" | "authenticating" | "redirecting" | "error";

/**
 * Inner component that handles the auth bridge logic.
 * Separated from the page export so useSearchParams is inside a Suspense boundary.
 *
 * Flow:
 * 1. Terragon redirects user here with a redirect_uri (or callback) URL
 * 2. FAST PATH: if cached credentials exist in localStorage, skip Privy entirely
 * 3. SLOW PATH: trigger Privy login, wait for backend sync
 * 4. Generate encrypted gwauth token via /api/terragon/auth
 * 5. Redirect back to Terragon with the token appended
 */
function TerragonAuthBridge() {
  const searchParams = useSearchParams();
  // Support both "callback" and "redirect_uri" parameters
  const callback = searchParams.get("callback") || searchParams.get("redirect_uri");

  // Use the auth context directly (not the useAuth wrapper) so we can
  // read status/error and detect failures the wrapper hides.
  const { status: authStatus, login, privyReady, error: authError } = useGatewayzAuth();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loginTriggeredRef = useRef(false);
  const tokenGenerationStartedRef = useRef(false);
  const mountTimeRef = useRef(Date.now());

  const isAuthenticated = authStatus === "authenticated";
  const isAuthError = authStatus === "error";
  const isLoading = authStatus === "idle" || authStatus === "authenticating";

  // Clean up the auth bridge flag when the component unmounts
  useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem(AUTH_BRIDGE_FLAG_KEY);
      } catch {
        // sessionStorage may not be available
      }
    };
  }, []);

  // Timeout — if we've been waiting too long, show an error
  useEffect(() => {
    if (status === "loading" || status === "authenticating") {
      const timer = setTimeout(() => {
        if (status === "loading" || status === "authenticating") {
          console.error("[TerragonAuth] Timed out waiting for authentication");
          setStatus("error");
          setErrorMessage("Authentication is taking too long. Please try again.");
        }
      }, AUTH_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Detect auth context error state
  useEffect(() => {
    if (isAuthError && status !== "redirecting" && status !== "error") {
      console.error("[TerragonAuth] Auth context error:", authError);
      // Don't immediately show error — try the fast path first
      // The main effect will handle the fallback
    }
  }, [isAuthError, authError, status]);

  const generateTokenAndRedirect = useCallback(async (callbackUrl: string) => {
    if (tokenGenerationStartedRef.current) return;
    tokenGenerationStartedRef.current = true;

    setStatus("redirecting");

    try {
      // Use retry logic since localStorage may not have synced yet after fresh login
      const apiKey = await getApiKeyWithRetry(5);
      const userData = getUserData();

      if (!apiKey) {
        throw new Error("No API key available. Please try again.");
      }

      if (!userData?.email) {
        throw new Error("User data not available. Please try again.");
      }

      // Call the Terragon auth API to generate an encrypted gwauth token
      const response = await fetch("/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          userId: userData.user_id,
          email: userData.email,
          username: userData.display_name || userData.email.split("@")[0],
          tier: userData.tier || "free",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate auth token: ${response.status}`);
      }

      const { token } = await response.json();

      // Clean up the bridge flag before redirecting
      try {
        sessionStorage.removeItem(AUTH_BRIDGE_FLAG_KEY);
      } catch {
        // ignore
      }

      // Redirect back to Terragon with the gwauth token.
      // URL.searchParams.set handles ?/& correctly even when
      // redirect_uri already contains query parameters.
      const redirectUrl = new URL(callbackUrl);
      redirectUrl.searchParams.set("gwauth", token);
      window.location.href = redirectUrl.toString();
    } catch (error) {
      console.error("[TerragonAuth] Error generating token:", error);
      tokenGenerationStartedRef.current = false;
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to authenticate. Please try again.");
    }
  }, []);

  // Main auth effect
  useEffect(() => {
    // Validate callback URL
    if (!callback) {
      setStatus("error");
      setErrorMessage("Missing callback URL. Please try logging in from Terragon again.");
      return;
    }

    if (!isAllowedCallbackUrl(callback)) {
      setStatus("error");
      setErrorMessage("Invalid callback URL. Please try logging in from Terragon again.");
      return;
    }

    // FAST PATH: If we already have cached credentials in localStorage,
    // skip waiting for Privy/auth context and generate the token immediately.
    // This handles the common case where the user has already logged in before
    // and avoids the Privy "Signing in..." reconnect delay.
    const cachedApiKey = getApiKey();
    const cachedUserData = getUserData();
    if (cachedApiKey && cachedUserData?.email) {
      console.log("[TerragonAuth] Fast path: found cached credentials, generating token");
      generateTokenAndRedirect(callback);
      return;
    }

    // SLOW PATH: No cached credentials, need to authenticate via Privy

    // Wait for Privy SDK to initialize
    if (!privyReady) {
      setStatus("loading");
      return;
    }

    // User is authenticated via context — generate token
    if (isAuthenticated) {
      generateTokenAndRedirect(callback);
      return;
    }

    // Auth context errored — if credentials appeared in localStorage during
    // the failed sync (e.g. from a previous session), try the fast path again
    if (isAuthError) {
      const retryApiKey = getApiKey();
      const retryUserData = getUserData();
      if (retryApiKey && retryUserData?.email) {
        console.log("[TerragonAuth] Auth error but found cached credentials, generating token");
        generateTokenAndRedirect(callback);
        return;
      }

      // No cached credentials either — need to trigger fresh login
      // Reset the login guard so we can try again
      loginTriggeredRef.current = false;
    }

    // Still loading auth state (backend sync in progress)
    if (isLoading && loginTriggeredRef.current) {
      setStatus("authenticating");
      return;
    }

    if (isLoading && !loginTriggeredRef.current) {
      // Auth context is still initializing (idle/syncing) but we didn't trigger it
      // Check how long we've been waiting
      const elapsed = Date.now() - mountTimeRef.current;
      if (elapsed < AUTH_TIMEOUT_MS) {
        setStatus("loading");
        return;
      }
    }

    // Not authenticated — trigger Privy login
    if (!loginTriggeredRef.current) {
      loginTriggeredRef.current = true;
      setStatus("authenticating");

      // Set the auth bridge flag BEFORE triggering login.
      // The auth context checks this flag and skips the onboarding
      // redirect for new users, letting this page handle the redirect.
      try {
        sessionStorage.setItem(AUTH_BRIDGE_FLAG_KEY, "terragon");
      } catch {
        // sessionStorage may not be available
      }

      login();
    }
  }, [callback, isAuthenticated, isLoading, isAuthError, login, privyReady, generateTokenAndRedirect]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-6 text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground">Connecting...</p>
          </div>
        )}

        {status === "authenticating" && (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <h2 className="text-xl font-semibold">Sign in to continue</h2>
            <p className="text-muted-foreground">
              Please sign in to access Terragon with your GatewayZ account.
            </p>
          </div>
        )}

        {status === "redirecting" && (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <h2 className="text-xl font-semibold">Redirecting to Terragon...</h2>
            <p className="text-muted-foreground">
              Please wait while we complete your authentication.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="text-destructive">
              <svg
                className="h-12 w-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">Authentication Error</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
            <div className="pt-4 space-x-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="px-4 py-2 border border-input bg-background rounded-md hover:bg-accent"
              >
                Go Home
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Auth bridge page for Terragon integration.
 * Wrapped in Suspense because useSearchParams requires it in Next.js 15.
 */
export default function TerragonAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md w-full mx-auto p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground mt-4">Loading...</p>
          </div>
        </div>
      }
    >
      <TerragonAuthBridge />
    </Suspense>
  );
}
