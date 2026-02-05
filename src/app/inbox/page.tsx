"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ExternalLink, LogIn } from "lucide-react";
import { KanbanColumnToggle } from "@/components/inbox/kanban-column-toggle";
import { useInboxUIStore, ColumnView } from "@/lib/store/inbox-ui-store";

/**
 * Inbox page that embeds the Terragon inbox application.
 *
 * The inbox provides AI-powered coding agent capabilities using:
 * - Claude Code or other AI coding agents
 * - Isolated sandbox execution
 * - Automatic Git branching and commits
 *
 * Authentication flow:
 * 1. Check if user is authenticated with GatewayZ (Privy)
 * 2. If authenticated, call /api/terragon/auth to get an encrypted token
 * 3. Embed the Terragon inbox and pass the token via postMessage (not URL)
 *
 * Security: Token is passed via postMessage API to avoid exposure in URL/logs
 *
 * @see https://github.com/terragon-labs/terragon-oss
 */
export default function InboxPage() {
  const { status, apiKey, userData, login, privyReady } = useGatewayzAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [terragonUrl, setTerragonUrl] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeLoadedRef = useRef(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authSentRef = useRef(false);
  const columnViewSentRef = useRef(false);

  // Get column view preference from store
  const { columnView, syncColumnViewState } = useInboxUIStore();

  // Get the Terragon URL from environment variable
  const baseTerragonUrl = process.env.NEXT_PUBLIC_TERRAGON_URL;

  // Sync column view state from localStorage on mount
  useEffect(() => {
    syncColumnViewState();
  }, [syncColumnViewState]);

  // Preflight check to verify Terragon URL is accessible
  const checkTerragonHealth = useCallback(async (url: string): Promise<boolean> => {
    try {
      // Make a simple HEAD/GET request to check if the URL is accessible
      // Note: This may fail due to CORS, but we can catch specific error patterns
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "HEAD",
        mode: "no-cors", // Allow cross-origin but we won't get the response
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // With no-cors mode, we get an opaque response
      // If it doesn't throw, the server is reachable
      return true;
    } catch (err) {
      console.error("[Inbox] Terragon health check failed:", err);
      return false;
    }
  }, []);

  // Fetch a signed auth token from the bridge API
  const fetchAuthToken = useCallback(async () => {
    if (!apiKey || !userData) {
      return null;
    }

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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Auth bridge failed: ${response.status}`);
      }

      const data = await response.json();
      return data.token as string;
    } catch (err) {
      console.error("[Inbox] Failed to get auth token:", err);
      throw err;
    }
  }, [apiKey, userData]);

  // Build the iframe URL with authentication token
  // Note: iframeKey is included to trigger a fresh fetch when retry is clicked
  useEffect(() => {
    if (!baseTerragonUrl) {
      setError(
        "Terragon URL not configured. Please set NEXT_PUBLIC_TERRAGON_URL environment variable."
      );
      setIsLoading(false);
      return;
    }

    // If not authenticated, show login prompt
    if (status === "unauthenticated") {
      setIsLoading(false);
      return;
    }

    // Wait for authentication to complete
    if (status === "authenticating" || status === "idle") {
      return;
    }

    // If authenticated, fetch the auth token and build the URL
    if (status === "authenticated" && apiKey && userData) {
      setIsLoading(true);
      authSentRef.current = false;

      // First check if Terragon is accessible
      checkTerragonHealth(baseTerragonUrl)
        .then((isHealthy) => {
          if (!isHealthy) {
            console.warn("[Inbox] Terragon health check failed, proceeding anyway...");
            // Don't block on health check failure - the iframe load timeout will catch issues
          }
          return fetchAuthToken();
        })
        .then((token) => {
          if (token) {
            setAuthToken(token);
            // Use embed mode URL without exposing token in query params
            const url = new URL(baseTerragonUrl);
            url.searchParams.set("embed", "true");
            url.searchParams.set("awaitAuth", "true"); // Tell Terragon to wait for postMessage
            setTerragonUrl(url.toString());
          } else {
            // Fallback: embed without auth (will show Terragon login)
            setTerragonUrl(baseTerragonUrl);
          }
        })
        .catch((err) => {
          console.error("[Inbox] Auth token fetch failed:", err);
          // Fallback: embed without auth
          setTerragonUrl(baseTerragonUrl);
        })
        .finally(() => {
          // Set a timeout to detect connection failures
          loadTimeoutRef.current = setTimeout(() => {
            if (!iframeLoadedRef.current) {
              setConnectionError(true);
              setIsLoading(false);
            }
          }, 15000);
        });
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [baseTerragonUrl, status, apiKey, userData, fetchAuthToken, checkTerragonHealth, iframeKey]);

  // Send auth token to iframe via postMessage when ready
  const sendAuthToIframe = useCallback(() => {
    if (!iframeRef.current?.contentWindow || !authToken || authSentRef.current || !baseTerragonUrl) {
      return;
    }

    try {
      const targetOrigin = new URL(baseTerragonUrl).origin;
      iframeRef.current.contentWindow.postMessage(
        {
          type: "GATEWAYZ_AUTH",
          token: authToken,
        },
        targetOrigin
      );
      authSentRef.current = true;
      console.log("[Inbox] Auth token sent via postMessage");
    } catch (err) {
      console.error("[Inbox] Failed to send auth token:", err);
    }
  }, [authToken, baseTerragonUrl]);

  // Send column view preference to iframe via postMessage
  const sendColumnViewToIframe = useCallback((view: ColumnView) => {
    if (!iframeRef.current?.contentWindow || !baseTerragonUrl) {
      return;
    }

    try {
      const targetOrigin = new URL(baseTerragonUrl).origin;
      iframeRef.current.contentWindow.postMessage(
        {
          type: "GATEWAYZ_COLUMN_VIEW",
          columnView: view,
        },
        targetOrigin
      );
      console.log("[Inbox] Column view preference sent via postMessage:", view);
    } catch (err) {
      console.error("[Inbox] Failed to send column view:", err);
    }
  }, [baseTerragonUrl]);

  // Handle column view change from toggle
  const handleColumnViewChange = useCallback((view: ColumnView) => {
    sendColumnViewToIframe(view);
  }, [sendColumnViewToIframe]);

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    iframeLoadedRef.current = true;
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    // Check if iframe loaded an error page (e.g., S3/CloudFront XML error)
    // We detect this by listening for error messages from the iframe
    // or checking if the iframe reports an error via postMessage
    try {
      // Try to detect if the iframe contains an error response
      // Note: Due to cross-origin restrictions, we can't directly access iframe content
      // Instead, we rely on the Terragon app to send a ready message
      // Set a shorter timeout to detect if the app doesn't respond
      const appReadyTimeout = setTimeout(() => {
        // If we haven't received an auth request from the app within 5 seconds,
        // and auth hasn't been sent, the app might have failed to load properly
        if (!authSentRef.current && authToken) {
          console.warn("[Inbox] Terragon app did not request auth within timeout - may have failed to load");
          // Don't set connection error immediately, give it more time
          // The app might just be slow to initialize
        }
      }, 5000);

      // Clean up timeout if auth is sent
      const checkAuthSent = setInterval(() => {
        if (authSentRef.current) {
          clearTimeout(appReadyTimeout);
          clearInterval(checkAuthSent);
        }
      }, 100);

      // Clean up after 10 seconds max
      setTimeout(() => {
        clearTimeout(appReadyTimeout);
        clearInterval(checkAuthSent);
      }, 10000);
    } catch {
      // Ignore errors from cross-origin checks
    }

    setIsLoading(false);
    setConnectionError(false);
    // Send auth token after iframe loads
    sendAuthToIframe();
    // Send initial column view preference after iframe loads
    if (!columnViewSentRef.current) {
      sendColumnViewToIframe(columnView);
      columnViewSentRef.current = true;
    }
  }, [sendAuthToIframe, sendColumnViewToIframe, columnView, authToken]);

  // Handle iframe error event
  const handleIframeError = useCallback(() => {
    console.error("[Inbox] Iframe failed to load");
    iframeLoadedRef.current = true; // Prevent timeout from also triggering
    setConnectionError(true);
    setIsLoading(false);
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
  }, []);

  // Listen for auth request, column view request, and error reports from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!baseTerragonUrl) return;

      try {
        const expectedOrigin = new URL(baseTerragonUrl).origin;
        if (event.origin !== expectedOrigin) return;

        if (event.data?.type === "GATEWAYZ_AUTH_REQUEST") {
          console.log("[Inbox] Received auth request from iframe");
          sendAuthToIframe();
        }

        if (event.data?.type === "GATEWAYZ_COLUMN_VIEW_REQUEST") {
          console.log("[Inbox] Received column view request from iframe");
          sendColumnViewToIframe(columnView);
        }

        // Handle error reports from Terragon
        if (event.data?.type === "TERRAGON_ERROR") {
          console.error("[Inbox] Received error from Terragon:", event.data.error);
          setError(event.data.error || "An error occurred in the Coding Inbox");
          setIsLoading(false);
        }

        // Handle S3/CloudFront error detection (if Terragon wraps and reports it)
        if (event.data?.type === "TERRAGON_LOAD_ERROR") {
          console.error("[Inbox] Terragon failed to load:", event.data.message);
          setConnectionError(true);
          setIsLoading(false);
        }
      } catch {
        // Ignore invalid URLs
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [baseTerragonUrl, sendAuthToIframe, sendColumnViewToIframe, columnView]);

  // Retry connection handler - clears auth state to trigger fresh token fetch
  const handleRetry = useCallback(() => {
    setConnectionError(false);
    setIsLoading(true);
    iframeLoadedRef.current = false;
    authSentRef.current = false;
    columnViewSentRef.current = false;
    // Clear auth token and URL to trigger the useEffect to fetch a fresh token
    // This ensures retries work even if the original token has expired
    setAuthToken(null);
    setTerragonUrl(null);
    setIframeKey((prev) => prev + 1);

    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
  }, []);

  // Configuration error UI
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-6xl">📥</div>
          <h1 className="text-2xl font-semibold">Coding Inbox</h1>
          <p className="text-muted-foreground">{error}</p>

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

  // Connection error UI
  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-6xl">🔌</div>
          <h1 className="text-2xl font-semibold">Connection Failed</h1>
          <p className="text-muted-foreground">
            Unable to connect to the Coding Inbox. The target server may be
            unavailable or blocking iframe embedding.
          </p>

          <div className="mt-8 p-4 bg-muted rounded-lg text-left text-sm">
            <h3 className="font-medium mb-2">Possible causes:</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>The Terragon server is not running or unreachable</li>
              <li>
                The target URL has{" "}
                <code className="bg-background px-1 rounded">
                  X-Frame-Options
                </code>{" "}
                set to DENY
              </li>
              <li>Network connectivity issues or firewall blocking</li>
              <li>The configured URL is incorrect</li>
            </ul>

            {baseTerragonUrl && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Configured URL:{" "}
                  <code className="bg-background px-1 rounded break-all">
                    {baseTerragonUrl}
                  </code>
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleRetry} variant="default">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Connection
            </Button>
            {baseTerragonUrl && (
              <Button variant="outline" asChild>
                <a
                  href={baseTerragonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Directly
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col">
      {/* Inbox header with column view toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h1 className="text-sm font-medium text-muted-foreground">Task View</h1>
        <KanbanColumnToggle onViewChange={handleColumnViewChange} />
      </div>

      {/* Main content area */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-background z-10"
            role="status"
            aria-live="polite"
            aria-label="Loading"
          >
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading Coding Inbox...</p>
            </div>
          </div>
        )}

        {terragonUrl && (
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={terragonUrl}
            className="w-full h-full border-0"
            title="Coding Inbox"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            allow="clipboard-read; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          />
        )}
      </div>
    </div>
  );
}
