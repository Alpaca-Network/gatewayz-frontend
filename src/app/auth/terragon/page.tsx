"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import { getApiKey, getUserData, getApiKeyWithRetry } from "@/lib/api";
import { navigateTo } from "./navigate";

/**
 * Session storage key used to signal that an auth bridge flow is active.
 * When set, the auth context skips the onboarding redirect so the bridge
 * page can complete its token generation and redirect back to the caller.
 */
const AUTH_BRIDGE_FLAG_KEY = "auth_bridge_active";

/** How long to wait for auth before showing an error (ms) */
const AUTH_TIMEOUT_MS = 30_000;

/**
 * Static allow-list of callback URL domains.
 * Extended at runtime by NEXT_PUBLIC_TERRAGON_CALLBACK_URLS env variable.
 */
const STATIC_ALLOWED_DOMAINS = [
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
 * Build the full allow-list by merging static domains with any from
 * NEXT_PUBLIC_TERRAGON_CALLBACK_URLS (comma-separated).
 *
 * Kept as a function (not module-level const) so tests can set the
 * env variable per-test without needing module reloads.
 */
function getAllowedDomains(): string[] {
  const envUrls = process.env.NEXT_PUBLIC_TERRAGON_CALLBACK_URLS ?? "";
  const envDomains = envUrls
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      try {
        return [new URL(entry).hostname.toLowerCase()];
      } catch {
        return [entry.toLowerCase()];
      }
    });

  return [...STATIC_ALLOWED_DOMAINS, ...envDomains];
}

/**
 * Validates that a callback URL is from an allowed domain.
 * Prevents open redirect vulnerabilities.
 */
function isAllowedCallbackUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const protocol = parsedUrl.protocol;

    // Require HTTPS for non-localhost callbacks to prevent token leakage
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (!isLocalhost && protocol !== "https:") {
      return false;
    }

    return (
      getAllowedDomains().includes(hostname) ||
      hostname.endsWith(".terragon.ai") ||
      hostname.endsWith(".gatewayz.ai")
    );
  } catch {
    return false;
  }
}

type PageStatus = "loading" | "authenticating" | "redirecting" | "error";

/** Maximum number of token-generation attempts */
const MAX_TOKEN_RETRIES = 2;

/** Maximum number of auth error → re-login cycles before giving up */
const MAX_AUTH_RETRIES = 2;

/**
 * Inner component that handles the auth bridge logic.
 * Separated from the page export so useSearchParams is inside a Suspense boundary.
 */
function TerragonAuthBridge() {
  const searchParams = useSearchParams();
  const callback =
    searchParams.get("callback") || searchParams.get("redirect_uri");

  const { status: authStatus, login, privyReady } = useGatewayzAuth();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loginTriggeredRef = useRef(false);
  const tokenGenerationStartedRef = useRef(false);
  const tokenRetryCountRef = useRef(0);
  const authRetryCountRef = useRef(0);
  const statusRef = useRef<PageStatus>("loading");
  const mountTimeRef = useRef(Date.now());
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateStatus = useCallback((newStatus: PageStatus) => {
    statusRef.current = newStatus;
    setStatus(newStatus);
  }, []);

  const isAuthenticated = authStatus === "authenticated";
  const isAuthError = authStatus === "error";
  const isLoading = authStatus === "idle" || authStatus === "authenticating";

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      try {
        sessionStorage.removeItem(AUTH_BRIDGE_FLAG_KEY);
      } catch {
        // sessionStorage may not be available
      }
    };
  }, []);

  // Wall-clock timeout — fires once, not restarted on status changes
  useEffect(() => {
    const remaining = AUTH_TIMEOUT_MS - (Date.now() - mountTimeRef.current);
    if (remaining <= 0) return;

    const timer = setTimeout(() => {
      const s = statusRef.current;
      if (s === "loading" || s === "authenticating") {
        console.error("[TerragonAuth] Timed out waiting for authentication");
        updateStatus("error");
        setErrorMessage("Authentication is taking too long. Please try again.");
      }
    }, remaining);
    return () => clearTimeout(timer);
  }, [updateStatus]);

  // Generate token and redirect back to Terragon
  const generateTokenAndRedirect = useCallback(
    async (callbackUrl: string) => {
      if (tokenGenerationStartedRef.current) return;
      if (tokenRetryCountRef.current >= MAX_TOKEN_RETRIES) return;
      tokenGenerationStartedRef.current = true;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      updateStatus("redirecting");

      try {
        const apiKey = await getApiKeyWithRetry(5);
        const userData = getUserData();

        if (!apiKey) {
          throw new Error("No API key available. Please try again.");
        }
        if (!userData?.email) {
          throw new Error("User data not available. Please try again.");
        }

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
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Failed to generate auth token: ${response.status}`
          );
        }

        const { token } = await response.json();

        if (!token || !token.trim()) {
          throw new Error("Server returned an empty auth token. Please try again.");
        }

        // Clean up bridge flag before redirecting
        try {
          sessionStorage.removeItem(AUTH_BRIDGE_FLAG_KEY);
        } catch {
          // ignore
        }

        // Build redirect URL and navigate
        const redirectUrl = new URL(callbackUrl);
        redirectUrl.searchParams.set("gwauth", token);
        navigateTo(redirectUrl.toString());
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("[TerragonAuth] Error generating token:", error);
        tokenRetryCountRef.current += 1;
        tokenGenerationStartedRef.current = false;
        updateStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to authenticate. Please try again."
        );
      }
    },
    [updateStatus]
  );

  // Main auth effect
  useEffect(() => {
    if (!callback) {
      updateStatus("error");
      setErrorMessage(
        "Missing callback URL. Please try logging in from Terragon again."
      );
      return;
    }

    if (!isAllowedCallbackUrl(callback)) {
      updateStatus("error");
      setErrorMessage(
        "Invalid callback URL. Please try logging in from Terragon again."
      );
      return;
    }

    // FAST PATH: cached credentials in localStorage
    const cachedApiKey = getApiKey();
    const cachedUserData = getUserData();
    if (cachedApiKey && cachedUserData?.email) {
      console.log(
        "[TerragonAuth] Fast path: found cached credentials, generating token"
      );
      generateTokenAndRedirect(callback);
      return;
    }

    // SLOW PATH: authenticate via Privy

    if (!privyReady) {
      updateStatus("loading");
      return;
    }

    if (isAuthenticated) {
      generateTokenAndRedirect(callback);
      return;
    }

    // Auth errored — try localStorage fallback
    if (isAuthError) {
      const retryApiKey = getApiKey();
      const retryUserData = getUserData();
      if (retryApiKey && retryUserData?.email) {
        console.log(
          "[TerragonAuth] Auth error but found cached credentials, generating token"
        );
        generateTokenAndRedirect(callback);
        return;
      }

      if (authRetryCountRef.current >= MAX_AUTH_RETRIES) {
        console.error("[TerragonAuth] Auth retries exhausted, giving up");
        updateStatus("error");
        setErrorMessage(
          "Unable to authenticate after multiple attempts. Please try again."
        );
        return;
      }

      authRetryCountRef.current += 1;
      loginTriggeredRef.current = false;
    }

    if (isLoading && loginTriggeredRef.current) {
      updateStatus("authenticating");
      return;
    }

    // Check wall-clock timeout before triggering login
    if (Date.now() - mountTimeRef.current >= AUTH_TIMEOUT_MS) {
      updateStatus("error");
      setErrorMessage("Authentication is taking too long. Please try again.");
      return;
    }

    if (isLoading && !loginTriggeredRef.current) {
      updateStatus("loading");
      return;
    }

    // Trigger Privy login
    if (!loginTriggeredRef.current) {
      loginTriggeredRef.current = true;
      updateStatus("authenticating");

      try {
        sessionStorage.setItem(AUTH_BRIDGE_FLAG_KEY, "terragon");
      } catch {
        // sessionStorage may not be available
      }

      login();
    }
  }, [
    callback,
    isAuthenticated,
    isLoading,
    isAuthError,
    login,
    privyReady,
    generateTokenAndRedirect,
    updateStatus,
  ]);

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
