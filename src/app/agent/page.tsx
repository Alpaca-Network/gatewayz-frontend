"use client";

import { useEffect, useState, useRef, useCallback } from "react";

// Timeout for iframe loading (30 seconds)
const IFRAME_LOAD_TIMEOUT = 30000;

/**
 * Validates that the agent URL is safe to load in an iframe.
 * Only allows HTTPS URLs from approved domains.
 */
function isValidAgentUrl(url: string | undefined): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    // Must be HTTPS
    if (parsed.protocol !== "https:") return false;

    // Allow Vercel deployments and localhost for development
    const allowedPatterns = [
      /\.vercel\.app$/,
      /\.gatewayz\.ai$/,
      /^localhost(:\d+)?$/,
    ];

    return allowedPatterns.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

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
  // Get the agent URL from environment variable
  const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;

  // Only show loading if we have a valid URL to load
  const [isLoading, setIsLoading] = useState(() => isValidAgentUrl(agentUrl));
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout helper
  const clearLoadingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Validate URL and set appropriate error state
    if (!agentUrl) {
      setError(
        "Agent URL not configured. Please set NEXT_PUBLIC_AGENT_URL environment variable."
      );
      setIsLoading(false);
      return;
    }

    if (!isValidAgentUrl(agentUrl)) {
      setError(
        "Invalid agent URL. The URL must be HTTPS and from an approved domain (*.vercel.app or *.gatewayz.ai)."
      );
      setIsLoading(false);
      return;
    }

    // Set up loading timeout - iframe onError doesn't fire for most network errors
    timeoutRef.current = setTimeout(() => {
      setError("Failed to load the coding agent. The request timed out.");
      setIsLoading(false);
    }, IFRAME_LOAD_TIMEOUT);

    return clearLoadingTimeout;
  }, [agentUrl, clearLoadingTimeout]);

  const handleIframeLoad = () => {
    clearLoadingTimeout();
    setIsLoading(false);
  };

  const handleIframeError = () => {
    clearLoadingTimeout();
    setError("Failed to load the coding agent. Please try again later.");
    setIsLoading(false);
  };

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

  return (
    <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Loading Coding Agent...</p>
          </div>
        </div>
      )}

      {agentUrl && (
        <iframe
          src={agentUrl}
          className="w-full h-full border-0"
          title="Coding Agent"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          allow="clipboard-read; clipboard-write"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      )}
    </div>
  );
}
