"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Agent page that embeds the Vercel Labs Coding Agent Template.
 *
 * The coding agent provides AI-powered coding capabilities using:
 * - Claude Code, OpenAI Codex CLI, GitHub Copilot CLI, Cursor CLI, Gemini CLI, or opencode
 * - Vercel Sandbox for isolated code execution
 * - Automatic Git branching and commits
 *
 * Set NEXT_PUBLIC_AGENT_URL in your environment to point to your deployed coding-agent-template instance.
 *
 * @see https://github.com/vercel-labs/coding-agent-template
 */
export default function AgentPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeLoadedRef = useRef(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get the agent URL from environment variable
  const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;

  useEffect(() => {
    if (!agentUrl) {
      setError(
        "Agent URL not configured. Please set NEXT_PUBLIC_AGENT_URL environment variable."
      );
      setIsLoading(false);
      return;
    }

    // Set a timeout to detect connection failures
    // If the iframe doesn't load within 15 seconds, show a connection error
    loadTimeoutRef.current = setTimeout(() => {
      if (!iframeLoadedRef.current) {
        setConnectionError(true);
        setIsLoading(false);
      }
    }, 15000);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [agentUrl]);

  // Note: iframe onError events don't fire for HTTP errors (4xx, 5xx) or CORS issues.
  // The iframe always fires onLoad even when content fails to load.
  // We rely on onLoad to hide the spinner and let users see the iframe content or blank state.
  const handleIframeLoad = useCallback(() => {
    iframeLoadedRef.current = true;
    setIsLoading(false);
    setConnectionError(false);
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-6xl">🤖</div>
          <h1 className="text-2xl font-semibold">Coding Agent</h1>
          <p className="text-muted-foreground">{error}</p>

          <div className="mt-8 p-4 bg-muted rounded-lg text-left text-sm">
            <h3 className="font-medium mb-2">Setup Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                Deploy the{" "}
                <a
                  href="https://github.com/vercel-labs/coding-agent-template"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  coding-agent-template
                </a>{" "}
                to Vercel
              </li>
              <li>
                Set <code className="bg-background px-1 rounded">NEXT_PUBLIC_AGENT_URL</code>{" "}
                to your deployed URL
              </li>
              <li>Configure required environment variables (see template README)</li>
              <li>Restart your application</li>
            </ol>
          </div>

          <a
            href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fcoding-agent-template"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 76 65"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
            Deploy with Vercel
          </a>
        </div>
      </div>
    );
  }

  // Connection error UI - shown when iframe fails to load
  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-6xl">🔌</div>
          <h1 className="text-2xl font-semibold">Connection Failed</h1>
          <p className="text-muted-foreground">
            Unable to connect to the Coding Agent. The target server may be unavailable or blocking iframe embedding.
          </p>

          <div className="mt-8 p-4 bg-muted rounded-lg text-left text-sm">
            <h3 className="font-medium mb-2">Possible causes:</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>The Coding Agent server is not running or unreachable</li>
              <li>
                The target URL has <code className="bg-background px-1 rounded">X-Frame-Options</code> set to DENY
              </li>
              <li>Network connectivity issues or firewall blocking</li>
              <li>The configured URL is incorrect</li>
            </ul>

            {agentUrl && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Configured URL: <code className="bg-background px-1 rounded break-all">{agentUrl}</code>
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                setConnectionError(false);
                setIsLoading(true);
                iframeLoadedRef.current = false;
                // Increment key to force iframe remount (idiomatic React pattern)
                setIframeKey((prev) => prev + 1);
                // Reset timeout
                if (loadTimeoutRef.current) {
                  clearTimeout(loadTimeoutRef.current);
                }
                loadTimeoutRef.current = setTimeout(() => {
                  if (!iframeLoadedRef.current) {
                    setConnectionError(true);
                    setIsLoading(false);
                  }
                }, 15000);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry Connection
            </button>
            {agentUrl && (
              <a
                href={agentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Directly
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10" role="status" aria-live="polite" aria-label="Loading">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true"></div>
            <p className="text-muted-foreground">Loading Coding Agent...</p>
          </div>
        </div>
      )}

      {agentUrl && (
        <iframe
          key={iframeKey}
          src={agentUrl}
          className="w-full h-full border-0"
          title="Coding Agent"
          onLoad={handleIframeLoad}
          allow="clipboard-read; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        />
      )}
    </div>
  );
}
