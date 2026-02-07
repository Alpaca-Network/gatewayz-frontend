"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { getApiKeyWithRetry, getUserData } from "@/lib/api";

/**
 * Session storage key used to signal that an auth bridge flow is active.
 * When set, the auth context skips the onboarding redirect so the bridge
 * page can complete its token generation and redirect back to the caller.
 */
const AUTH_BRIDGE_FLAG_KEY = "auth_bridge_active";

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

/**
 * Inner component that handles the auth bridge logic.
 * Separated from the page export so useSearchParams is inside a Suspense boundary.
 *
 * Flow:
 * 1. Terragon redirects user here with a redirect_uri (or callback) URL
 * 2. If user is not logged in, trigger Privy login
 * 3. Once authenticated, call /api/terragon/auth to generate an encrypted gwauth token
 * 4. Redirect back to Terragon with the token appended to redirect_uri
 */
function TerragonAuthBridge() {
  const searchParams = useSearchParams();
  // Support both "callback" and "redirect_uri" parameters
  const callback = searchParams.get("callback") || searchParams.get("redirect_uri");
  const { isAuthenticated, loading, login, privyReady } = useAuth();
  const [status, setStatus] = useState<"loading" | "authenticating" | "redirecting" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loginTriggeredRef = useRef(false);
  const tokenGenerationStartedRef = useRef(false);

  // Clean up the auth bridge flag when the component unmounts
  // (e.g., if the user navigates away without completing the flow)
  useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem(AUTH_BRIDGE_FLAG_KEY);
      } catch {
        // sessionStorage may not be available
      }
    };
  }, []);

  // Reset the login guard if the user dismissed the Privy modal
  // (isAuthenticated is false, loading is false, but loginTriggeredRef is true)
  useEffect(() => {
    if (loginTriggeredRef.current && !isAuthenticated && !loading && privyReady) {
      // The user may have dismissed the modal — allow re-triggering
      loginTriggeredRef.current = false;
    }
  }, [isAuthenticated, loading, privyReady]);

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
      // Using URL.searchParams.set handles ?/& correctly even when
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

    // Wait for Privy SDK to initialize
    if (!privyReady) {
      setStatus("loading");
      return;
    }

    // User is authenticated — generate token and redirect
    if (isAuthenticated && !loading) {
      generateTokenAndRedirect(callback);
      return;
    }

    // Still loading auth state (e.g., backend sync in progress)
    if (loading) {
      if (loginTriggeredRef.current) {
        setStatus("authenticating");
      } else {
        setStatus("loading");
      }
      return;
    }

    // Not authenticated and not loading — trigger Privy login
    if (!isAuthenticated && !loading) {
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
    }
  }, [callback, isAuthenticated, loading, login, privyReady, generateTokenAndRedirect]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-6 text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground">Loading...</p>
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
