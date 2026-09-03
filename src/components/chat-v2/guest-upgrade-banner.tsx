"use client";

import { useCallback, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrivy, useLinkAccount } from "@privy-io/react-auth";
import { AUTH_REFRESH_EVENT } from "@/lib/api";

/**
 * Guest upgrade nudge (M2 W3b — gatewayz-backend#2253).
 *
 * Shown in chat to Privy guest accounts (`user.isGuest === true`) — visitors who got a
 * persistent identity via `useEnsureGuestAccount()` (`src/lib/auth/guest-account.ts`) without
 * ever seeing a login screen. Linking a real method (not `login()`, which would start a
 * *different* session) attaches it to the same Privy user id, so the same backend account
 * (chat history, settings) carries over — see `useLinkAccount`'s doc comment.
 */
const DISMISS_KEY = "gatewayz_guest_upgrade_banner_dismissed";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

export function GuestUpgradeBanner() {
  const { user } = usePrivy();
  const [dismissed, setDismissed] = useState(readDismissed);

  // Same event gatewayz-auth-context.tsx and use-auth-sync.ts already listen for to force a
  // fresh POST /auth — after a link, the backend sees the newly-attached account and the
  // updated `is_guest: false` on the next sync.
  const requestResync = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
    }
  }, []);

  const { linkEmail, linkGoogle, linkWallet } = useLinkAccount({
    onSuccess: requestResync,
  });

  if (!user?.isGuest || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(DISMISS_KEY, "true");
      } catch {
        // Best-effort — worst case the banner reappears after a remount this session.
      }
    }
  };

  return (
    <div
      role="note"
      className="mx-auto mt-2 mb-2 flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <UserPlus className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm text-foreground/80">
          <span className="font-medium text-foreground">You&apos;re using a guest account.</span>{" "}
          Sign in to keep your history and unlock paid models.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" onClick={() => linkEmail()}>
          Sign in
        </Button>
        <Button size="sm" variant="outline" onClick={() => linkGoogle()}>
          Google
        </Button>
        <Button size="sm" variant="outline" onClick={() => linkWallet()}>
          Wallet
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
