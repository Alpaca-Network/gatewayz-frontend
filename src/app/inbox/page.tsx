"use client";

import { useEffect, useState, useCallback } from "react";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, ExternalLink } from "lucide-react";
import { redirectTo } from "@/lib/utils";

/**
 * Inbox page that redirects to the Terragon application with SSO authentication.
 *
 * The inbox provides AI-powered coding agent capabilities using:
 * - Claude Code or other AI coding agents
 * - Isolated sandbox execution
 * - Automatic Git branching and commits
 *
 * Authentication flow:
 * 1. Check if user is authenticated with GatewayZ (Privy)
 * 2. If authenticated, call /api/terragon/auth to get an encrypted token
 * 3. Redirect to Terragon with the auth token for seamless SSO
 *
 * @see https://github.com/terragon-labs/terragon-oss
 */
export default function InboxPage() {
  const { status, apiKey, userData, login, privyReady } = useGatewayzAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the Terragon URL from environment variable
  const baseTerragonUrl = process.env.NEXT_PUBLIC_TERRAGON_URL;

  // Fetch a signed auth token from the bridge API and redirect to Terragon
  const redirectToTerragon = useCallback(async () => {
    if (!baseTerragonUrl) {
      setError(
        "Terragon URL not configured. Please set NEXT_PUBLIC_TERRAGON_URL environment variable."
      );
      return;
    }

    if (!apiKey || !userData) {
      // Not authenticated - redirect without auth token (will show Terragon login)
      redirectTo(baseTerragonUrl);
      return;
    }

    setIsRedirecting(true);
    setError(null);

    try {
      const response = await fetch("/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          userId: userData.user_id,
          email: userData.email,
          username: userData.display_name,
          tier: userData.tier || "free",
          // Include GatewayZ credits information for display in Terragon
          credits: userData.credits,
          subscriptionAllowance: userData.subscription_allowance,
          purchasedCredits: userData.purchased_credits,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Auth bridge failed: ${response.status}`);
      }

      const data = await response.json();
      const token = data.token as string;

      // Build redirect URL with auth token
      const url = new URL(baseTerragonUrl);
      url.searchParams.set("gwauth", token);

      // Redirect to Terragon with SSO token
      redirectTo(url.toString());
    } catch (err) {
      console.error("[Inbox] Failed to get auth token:", err);
      setError(err instanceof Error ? err.message : "Failed to authenticate");
      setIsRedirecting(false);
    }
  }, [apiKey, userData, baseTerragonUrl]);

  // Auto-redirect when authenticated
  useEffect(() => {
    if (!baseTerragonUrl) {
      setError(
        "Terragon URL not configured. Please set NEXT_PUBLIC_TERRAGON_URL environment variable."
      );
      return;
    }

    // If not authenticated, show login prompt
    if (status === "unauthenticated") {
      return;
    }

    // Wait for authentication to complete
    if (status === "authenticating" || status === "idle") {
      return;
    }

    // If authenticated and no error, redirect to Terragon
    if (status === "authenticated" && apiKey && userData && !isRedirecting && !error) {
      redirectToTerragon();
    }
  }, [baseTerragonUrl, status, apiKey, userData, isRedirecting, error, redirectToTerragon]);

  // Configuration error UI
  if (error && !isRedirecting) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-6xl">📥</div>
          <h1 className="text-2xl font-semibold">Coding Inbox</h1>
          <p className="text-muted-foreground">{error}</p>

          {baseTerragonUrl && (
            <div className="flex flex-col gap-3 mt-6">
              <Button onClick={() => redirectToTerragon()} variant="default">
                <ExternalLink className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={baseTerragonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Terragon Directly
                </a>
              </Button>
            </div>
          )}

          {!baseTerragonUrl && (
            <div className="mt-8 p-4 bg-muted rounded-lg text-left text-sm">
              <h3 className="font-medium mb-2">Setup Instructions:</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>
                  Deploy{" "}
                  <a
                    href="https://github.com/terragon-labs/terragon-oss"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    terragon-oss
                  </a>{" "}
                  to Railway or your preferred hosting
                </li>
                <li>
                  Set{" "}
                  <code className="bg-background px-1 rounded">
                    NEXT_PUBLIC_TERRAGON_URL
                  </code>{" "}
                  to your deployed URL
                </li>
                <li>
                  Set matching{" "}
                  <code className="bg-background px-1 rounded">
                    GATEWAYZ_AUTH_BRIDGE_SECRET
                  </code>{" "}
                  on both services
                </li>
                <li>Restart your application</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Unauthenticated UI - prompt login
  if (status === "unauthenticated") {
    const isPrivyLoading = !privyReady;
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-6xl">📥</div>
          <h1 className="text-2xl font-semibold">Coding Inbox</h1>
          <p className="text-muted-foreground">
            Sign in to access your AI coding inbox where you can manage PRs,
            review code, and collaborate with AI agents.
          </p>

          <Button
            onClick={() => login()}
            size="lg"
            className="mt-4"
            disabled={isPrivyLoading}
          >
            {isPrivyLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Sign In to Continue
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Redirecting or loading state
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {isRedirecting ? "Redirecting to Coding Inbox..." : "Loading..."}
        </p>
      </div>
    </div>
  );
}
