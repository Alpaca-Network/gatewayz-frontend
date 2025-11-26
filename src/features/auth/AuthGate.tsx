"use client";

import { PropsWithChildren, useMemo } from "react";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react";

type AuthGateProps = PropsWithChildren<{ title?: string; description?: string }>;

/**
 * Small, reusable boundary that keeps pages honest about authentication state.
 *
 * - Uses GatewayzAuthContext (privy + backend sync) instead of talking directly
 *   to Privy to avoid the many race conditions we had on /chat.
 * - Presents explicit UI states so users never stare at a blank screen while
 *   auth or session transfer is running.
 */
export function AuthGate({ children, title, description }: AuthGateProps) {
  const { status, login, refresh, error, privyReady } = useGatewayzAuth();

  const view = useMemo(() => {
    if (!privyReady || status === "idle" || status === "authenticating") {
      return "loading" as const;
    }

    if (status === "error") {
      return "error" as const;
    }

    if (status !== "authenticated") {
      return "unauthenticated" as const;
    }

    return "ready" as const;
  }, [privyReady, status]);

  if (view === "ready") {
    return <>{children}</>;
  }

  if (view === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Connecting to your account…</span>
        </div>
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Auth needs attention
            </CardTitle>
            <CardDescription>
              {error ?? "We could not sync your session. Please retry."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => refresh({ force: true })} className="w-full" variant="default">
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title ?? "Sign in to continue"}</CardTitle>
          <CardDescription>
            {description ?? "Access to chat requires a verified session. Use email, Google, or GitHub to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={() => login()}>Continue with Privy</Button>
          <p className="text-xs text-muted-foreground text-center">
            We never ship your keys to the browser until authentication is complete.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

