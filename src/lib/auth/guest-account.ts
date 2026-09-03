"use client";

/**
 * Privy guest accounts (M2 W3b — gatewayz-backend#2253).
 *
 * Today, an unauthenticated chat visitor is a hashed-IP daily bucket in Redis with no
 * persistent entity (`src/lib/guest-chat.ts`, `src/lib/guest-rate-limiter.ts`) — refresh the
 * tab and history is gone. Privy guest accounts give that visitor a real, persistent Privy
 * user (with an embedded wallet) with zero UI friction: no login screen, just a silent
 * `createGuestAccount()` call. Once Privy flips to `authenticated`, the existing sync path
 * (`use-auth-sync.ts` → `buildAuthRequestBody`, which already sends `is_guest:
 * privyUser.isGuest`) creates an ordinary 0-credit backend account for it — no backend
 * change needed (spec.md §5: guests are just accounts with no payment signal).
 *
 * Feature-flagged and fully killable via `NEXT_PUBLIC_PRIVY_GUEST_ACCOUNTS` — with it off (the
 * default), nothing here runs and behaviour is unchanged from today's anonymous IP bucket.
 */
import { useEffect, useRef, useState } from "react";
import { usePrivy, useGuestAccounts } from "@privy-io/react-auth";
import * as Sentry from "@sentry/nextjs";
import { isTauriDesktop } from "@/lib/browser-detection";

export type GuestAccountStatus = "idle" | "creating" | "created" | "unavailable";

/** sessionStorage key guarding against re-attempting `createGuestAccount()` after a failure
 * (e.g. the Privy dashboard feature is off, or a transient error) within the same tab session —
 * a failing Privy must never turn into a retry loop on every remount/navigation. */
const SESSION_ATTEMPTED_KEY = "gatewayz_guest_account_attempted";

export function isGuestAccountsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PRIVY_GUEST_ACCOUNTS === "true";
}

function hasAttemptedThisSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_ATTEMPTED_KEY) === "true";
  } catch {
    // Storage inaccessible (private mode, disabled storage) — fall back to the in-memory
    // guard below, which still prevents a loop within this page load.
    return false;
  }
}

function markAttemptedThisSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_ATTEMPTED_KEY, "true");
  } catch {
    // Best-effort — see hasAttemptedThisSession.
  }
}

/**
 * When Privy is ready and the visitor isn't authenticated (no real login, no existing guest
 * session), silently creates a Privy guest account — once per tab session, at most once per
 * mount. Never blocks rendering: callers get a status back but nothing here throws or awaits
 * from the caller's perspective.
 *
 * Tauri desktop is a no-op (Privy is never mounted there, see `isTauriDesktop()`).
 */
export function useEnsureGuestAccount(): { status: GuestAccountStatus } {
  const { ready, authenticated } = usePrivy();
  const { createGuestAccount } = useGuestAccounts();
  const [status, setStatus] = useState<GuestAccountStatus>("idle");
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!isGuestAccountsEnabled()) return;
    if (typeof window !== "undefined" && isTauriDesktop()) return;
    if (!ready || authenticated) return;
    if (attemptedRef.current || hasAttemptedThisSession()) return;

    attemptedRef.current = true;
    markAttemptedThisSession();
    setStatus("creating");

    createGuestAccount()
      .then(() => {
        setStatus("created");
      })
      .catch((error) => {
        setStatus("unavailable");
        console.warn("[GuestAccount] createGuestAccount failed — falling back to anonymous", error);
        Sentry.captureMessage("Guest account creation unavailable", {
          level: "info",
          tags: { auth_error: "guest_account_unavailable" },
        });
      });
  }, [ready, authenticated, createGuestAccount]);

  return { status };
}
