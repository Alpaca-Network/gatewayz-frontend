"use client";

import { useEffect, useState } from "react";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthStatusOverlayProps {
  /**
   * Minimum time (in ms) to show the overlay before hiding.
   * Prevents flickering for fast auth.
   */
  minDisplayTime?: number;
  /**
   * Whether to show as a full overlay or inline indicator
   */
  variant?: "overlay" | "inline" | "toast";
}

// Phase-specific messages for progressive feedback
const PHASE_MESSAGES: Record<string, { title: string; description: string }> = {
  idle: { title: "", description: "" },
  connecting: { title: "Connecting...", description: "Establishing secure connection" },
  verifying: { title: "Verifying...", description: "Checking your credentials" },
  syncing: {
    title: "Backend is slow...",
    description: "Please wait while we connect to our servers"
  },
  retrying: {
    title: "Connection issue detected",
    description: "Automatically retrying..."
  },
  complete: { title: "Signed in!", description: "Welcome back" },
  error: { title: "Sign in failed", description: "Please try again" },
};

// Get detailed message based on elapsed time
function getProgressMessage(elapsedMs: number, retryCount: number): string {
  if (retryCount > 1) {
    return `Retry attempt ${retryCount} of 3...`;
  }

  if (elapsedMs > 30000) {
    return "This is taking longer than usual. Our servers may be under heavy load.";
  }

  if (elapsedMs > 15000) {
    return "Still working... Backend response is slow.";
  }

  if (elapsedMs > 5000) {
    return "Taking a bit longer than expected...";
  }

  return "";
}

export function AuthStatusOverlay({
  minDisplayTime = 500,
  variant = "toast"
}: AuthStatusOverlayProps) {
  const { status, authTiming, error } = useGatewayzAuth();
  const [visible, setVisible] = useState(false);
  const [displayStartTime, setDisplayStartTime] = useState<number | null>(null);

  const { phase, elapsedMs, retryCount, isSlowAuth } = authTiming;
  const phaseInfo = PHASE_MESSAGES[phase] || PHASE_MESSAGES.idle;
  const progressMessage = getProgressMessage(elapsedMs, retryCount);

  // Show overlay when authenticating, with minimum display time
  useEffect(() => {
    if (status === "authenticating") {
      setVisible(true);
      // Only set start time once to prevent infinite re-render loop
      if (!displayStartTime) {
        setDisplayStartTime(Date.now());
      }
    } else if (visible && displayStartTime) {
      // Ensure minimum display time before hiding
      const elapsed = Date.now() - displayStartTime;
      const remaining = Math.max(0, minDisplayTime - elapsed);

      const timeout = setTimeout(() => {
        setVisible(false);
        setDisplayStartTime(null);
      }, remaining);

      return () => clearTimeout(timeout);
    }
  }, [status, visible, displayStartTime, minDisplayTime]);

  // Don't render if not visible
  if (!visible && status !== "authenticating") {
    return null;
  }

  // Format elapsed time for display
  const formatElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 1) return "";
    return `${seconds}s`;
  };

  // Get icon based on phase
  const Icon = phase === "complete"
    ? CheckCircle2
    : phase === "error"
      ? AlertCircle
      : phase === "retrying"
        ? RefreshCw
        : Loader2;

  const iconClasses = cn(
    "h-5 w-5",
    phase === "complete" && "text-green-500",
    phase === "error" && "text-destructive",
    (phase === "connecting" || phase === "verifying" || phase === "syncing") && "animate-spin text-primary",
    phase === "retrying" && "animate-spin text-yellow-500"
  );

  if (variant === "toast") {
    return (
      <div
        className={cn(
          "fixed bottom-4 right-4 z-[100] flex items-start gap-3 rounded-lg border bg-background p-4 shadow-lg transition-all duration-300",
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          isSlowAuth && "border-yellow-500/50",
          phase === "error" && "border-destructive/50"
        )}
        role="status"
        aria-live="polite"
      >
        <Icon className={iconClasses} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{phaseInfo.title}</p>
          <p className="text-xs text-muted-foreground">
            {error || phaseInfo.description}
          </p>
          {progressMessage && (
            <p className="text-xs text-muted-foreground/80 italic">
              {progressMessage}
            </p>
          )}
          {isSlowAuth && elapsedMs > 5000 && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatElapsed(elapsedMs)} elapsed
            </p>
          )}
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
        <Icon className={iconClasses} />
        <span className="text-muted-foreground">{phaseInfo.title}</span>
        {isSlowAuth && (
          <span className="text-xs text-muted-foreground/60">
            ({formatElapsed(elapsedMs)})
          </span>
        )}
      </div>
    );
  }

  // Full overlay variant
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-status-title"
    >
      <div className="flex flex-col items-center gap-4 rounded-lg border bg-background p-8 shadow-xl max-w-sm mx-4">
        <Icon className={cn(iconClasses, "h-10 w-10")} />
        <div className="text-center">
          <h2 id="auth-status-title" className="text-lg font-semibold">
            {phaseInfo.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {error || phaseInfo.description}
          </p>
          {progressMessage && (
            <p className="text-xs text-muted-foreground/80 mt-2 italic">
              {progressMessage}
            </p>
          )}
        </div>
        {isSlowAuth && (
          <div className="w-full">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Connecting...</span>
              <span>{formatElapsed(elapsedMs)}</span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{
                  width: `${Math.min(100, (elapsedMs / 60000) * 100)}%`
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
