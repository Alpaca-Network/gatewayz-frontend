"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { getApiKey, getUserData } from "@/lib/api";

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

    // Check if hostname matches allowed domains or is a subdomain of terragon.ai/gatewayz.ai
    return ALLOWED_CALLBACK_DOMAINS.includes(hostname) ||
           hostname.endsWith(".terragon.ai") ||
           hostname.endsWith(".gatewayz.ai");
  } catch {
    return false;
  }
}

/**
 * Auth bridge page for Terragon integration.
 *
 * Flow:
 * 1. Terragon redirects user here with callback URL
 * 2. If user is not logged in, trigger Privy login
 * 3. Once authenticated, generate a Terragon auth token
 * 4. Redirect back to Terragon with the token
 */
export default function TerragonAuthPage() {
  const searchParams = useSearchParams();
  const callback = searchParams.get("callback");
  const { isAuthenticated, loading, login, privyReady } = useAuth();
  const [status, setStatus] = useState<"loading" | "authenticating" | "redirecting" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loginTriggeredRef = useRef(false);

  useEffect(() => {
    async function handleAuth() {
      // If no callback URL, show error
      if (!callback) {
        setStatus("error");
        setErrorMessage("Missing callback URL. Please try logging in from Terragon again.");
        return;
      }

      // Validate callback URL to prevent open redirect attacks
      if (!isAllowedCallbackUrl(callback)) {
        setStatus("error");
        setErrorMessage("Invalid callback URL. Please try logging in from Terragon again.");
        return;
      }

      // Wait for Privy to be ready
      if (!privyReady) {
        setStatus("loading");
        return;
      }

      // If not authenticated, trigger login (with one-shot guard to prevent repeated calls)
      if (!isAuthenticated && !loading) {
        if (!loginTriggeredRef.current) {
          loginTriggeredRef.current = true;
          setStatus("authenticating");
          login();
        }
        return;
      }

      // Still loading auth state
      if (loading) {
        setStatus("loading");
        return;
      }

      // User is authenticated, generate Terragon token
      if (isAuthenticated) {
        setStatus("redirecting");

        try {
          const apiKey = getApiKey();
          const userData = getUserData();

          if (!apiKey) {
            throw new Error("No API key available");
          }

          // Call the Terragon auth API to generate a token
          const response = await fetch("/api/terragon/auth", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              userId: userData?.user_id,
              email: userData?.email,
              username: userData?.display_name,
              tier: userData?.tier || "free",
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to generate auth token: ${response.status}`);
          }

          const { token } = await response.json();

          // Redirect back to Terragon with the token
          const callbackUrl = new URL(callback);
          callbackUrl.searchParams.set("gwauth", token);

          window.location.href = callbackUrl.toString();
        } catch (error) {
          console.error("[TerragonAuthPage] Error generating token:", error);
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "Failed to authenticate. Please try again.");
        }
      }
    }

    handleAuth();
  }, [callback, isAuthenticated, loading, login, privyReady]);

  // Render loading/status UI
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
