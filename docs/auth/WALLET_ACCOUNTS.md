# Wallet accounts (M2 — gatewayz-backend#2250 #2251)

Wallets are now first-class parts of a Gatewayz account, not just a display connected to
the WAYZ staking dashboard. This doc covers the frontend half (W3a); the backend
endpoints (W1) and Privy token verification (W0) are documented in the backend repo.

## What changed

1. **Shared auth-request builder.** `gatewayz-auth-context.tsx`, `integrations/privy/auth-sync.ts`,
   and `lib/hooks/use-auth-sync.ts` (the chat-v2 sync path) all now build the `POST /auth`
   request body through `src/lib/auth/build-auth-request.ts`. Previously each carried its own
   copy of this logic and had drifted — see the M2 research doc for the history. This module
   is now the single source of truth; do not add a fourth copy.
2. **Wallet linked-accounts are sent to the backend.** Privy `wallet`/`smart_wallet` linked
   accounts used to be stripped out before the sync (`mapLinkedAccount` had an explicit
   filter). They're now included with `{type, address, chain_type, wallet_client_type,
   verified_at, first_verified_at, latest_verified_at}` — the backend ingests them into
   `user_wallets` once the Privy access token verifies (W1b).
3. **The Privy access token is always required.** `getAccessToken()` is retried up to 3 times
   with backoff (250/500/1000ms, see `getPrivyAccessTokenWithRetry`). If it still resolves
   null, the sync **does not** call `/auth` — it surfaces "Could not verify your session —
   please retry" and logs to Sentry with tag `auth_error: privy_token_unavailable`. There is
   no more "continue without a token, let the backend decide" fallback: the backend now
   verifies the token server-side (W0) and rejects unverified requests once its
   `PRIVY_TOKEN_VERIFICATION` config flips to `enforce`. **This means the frontend must
   deploy no later than that flip**, or every sign-in will fail.

   **Exception**: if the caller already has a valid cached session (`getApiKey()` +
   stored user data) when the token retries exhaust, the hard failure is skipped — status
   stays `"authenticated"`, this resync cycle is silently dropped, and Sentry is logged with
   `had_cached_session: true` at `warning` (not `error`) level. A transient token-fetch
   hiccup (network flake, third-party-cookie issues on the auth domain, etc.) on an
   already-signed-in user must not lock them out of pages that gate on
   `status === "authenticated"` (e.g. Settings) just because one periodic Privy resync
   failed — it'll succeed on the next one. Implemented in both
   `gatewayz-auth-context.tsx`'s `syncWithBackend` and `use-auth-sync.ts`'s `queryFn`.
4. **`trial_credits` is no longer sent.** It was a vestigial field — `PrivyAuthRequest`
   (backend `src/schemas/auth.py`) has no such field, so Pydantic silently dropped it. New
   accounts get 0 credits regardless of what the frontend sends.

## Continue with wallet

`/login` and `/signup` both render a "Continue with wallet" button, wired to
`useActiveWallet().connect()` (`src/lib/hooks/use-active-wallet.ts`), which calls
`login({ loginMethods: ["wallet"] })` when unauthenticated. It's hidden on Tauri desktop
(Privy is never mounted there — see `isTauriDesktop()`).

Wallet-only accounts start with 0 credits; free models work immediately, and adding
credits unlocks paid models. The onboarding page (`/onboarding`) shows this copy in a
callout when `getUserData()?.auth_method === 'wallet'`.

## Settings → Wallets

`src/app/settings/wallets/page.tsx` lists the caller's linked wallets
(`GET /auth/wallets`) and lets them link/unlink additional wallets:

- **List**: address (6+4 truncated, with a copy button), a source badge (`Privy` for
  wallets ingested via the Privy linked-accounts flow, `Signed` for ones linked via an
  explicit SIWE-style signature), the wallet client type, and a `Primary` badge.
- **Link a wallet**: `useActiveWallet().connect()` (opens Privy's connect-wallet modal if
  no wallet is active) → `POST /auth/wallet/link/nonce` → `useActiveWallet().signMessage(message)`
  (the message must be signed byte-for-byte, verbatim — the backend compares it against
  what it stored) → `POST /auth/wallet/link`. A 409 means the wallet is already linked to a
  *different* Gatewayz account; the UI shows "This wallet is already linked to another
  Gatewayz account."
- **Unlink**: confirmed via an `AlertDialog`. A 400 `last_auth_method` means this is the
  account's only sign-in method — the UI explains that instead of silently failing.

The typed client is `src/lib/auth/wallet-auth-api.ts` (`WalletAuthError {status, code}`,
`describeWalletAuthError()` for the user-facing copy); the react-query hooks are
`src/lib/hooks/use-linked-wallets.ts` (`useLinkedWallets`, `useLinkWallet`, `useUnlinkWallet`).

**Error mapping is by (endpoint, HTTP status), not by parsed body text.** The backend wraps
every error this router raises through `detailed_http_exception_handler`
(`src/utils/error_handlers.py`), whose body is always `{"error": {type, message, detail,
code, status, context, ...}}` — there is no top-level `detail` field, and `error.code` is a
generic code (e.g. every 401 here is `INVALID_API_KEY`, regardless of which of the two
signature-verification failures caused it). 409 in particular carries **no** body signal at
all (no explicit 409 branch in the backend's mapper, falls through to a generic
`internal_error`) — status code is the only checked contract there. Each endpoint's status
codes are otherwise 1:1 with a single meaning (see `wallet-auth-api.ts`'s
`codeForLinkStatus`/`codeForUnlinkStatus`/`codeForNonceStatus`), verified against
`gatewayz-backend`'s own `tests/routes/test_wallet_auth.py` and `src/routes/wallet_auth.py`.
Link's 401 optionally reads a disambiguating hint from `error.detail`'s suffix (where the
backend's raw `invalid_signature`/`signature_address_mismatch` string does leak through) —
never required, defaults to `invalid_signature` if absent.

## Backend base URL

All wallet-auth calls go straight to the backend (`${API_BASE_URL}/auth/wallet/...` via
`makeAuthenticatedRequest`), not through a Next `/api/*` proxy — this matches the dominant
pattern for authenticated settings calls (`src/app/settings/page.tsx`,
`src/app/settings/credits/page.tsx`, `src/lib/wayz/staking-api.ts`); only
`src/app/settings/keys/page.tsx` proxies, because that route already existed as
`/api/user/api-keys`.

## Guest accounts (W3b — gatewayz-backend#2253)

Today, an unauthenticated chat visitor is a hashed-IP daily bucket in Redis
(`src/lib/guest-chat.ts`, `src/lib/guest-rate-limiter.ts`) with no persistent entity — refresh
the tab and history is gone. Privy guest accounts give that visitor a real, persistent Privy
user (with an embedded wallet) with zero login friction, upgradeable in place.

**Feature-flagged and fully killable**: `NEXT_PUBLIC_PRIVY_GUEST_ACCOUNTS=true` (off by
default — see `.env.example`). With it off, behaviour is unchanged from today's anonymous IP
bucket. Also requires **"Guest accounts" enabled in the Privy dashboard** (Settings → Guest
accounts) — this is a manual, per-environment step; the frontend flag alone does nothing if
the dashboard setting is off. `createGuestAccount()` rejecting (dashboard flag off, Privy rate
limit, storage blocked) is treated as expected and falls back silently to the existing
anonymous path — logged once to Sentry at `info` level (`auth_error:
guest_account_unavailable`), never surfaced to the user.

### How it works

1. `useEnsureGuestAccount()` (`src/lib/auth/guest-account.ts`) is mounted in `ChatLayout`
   alongside `useAuthSync()` — the one place in the app that hook already runs. When Privy is
   `ready`, the visitor is `!authenticated`, the flag is on, and we're not on Tauri desktop
   (Privy is never mounted there), it calls `useGuestAccounts().createGuestAccount()` **once
   per tab session** (a `sessionStorage` guard prevents a failing Privy from retry-looping on
   every remount/navigation — an in-memory ref covers the same render's re-runs).
2. Privy flips to `authenticated` with a guest `User` (`isGuest: true`). The **existing** sync
   path (`use-auth-sync.ts` → `buildAuthRequestBody`, unchanged by this work) picks it up like
   any other login and calls `POST /auth` — it already sends `is_guest: privyUser.isGuest`.
   The backend treats this exactly like any other zero-credit signup (spec.md §5: guests are
   just accounts with no payment signal) — **no backend change was needed for W3b.**
3. The account now behaves like any authenticated user with 0 credits: free models work,
   paid models still 402 (no bypass), and chat history persists across refreshes via the
   normal backend-backed session/message flow — not the guest-chat.ts localStorage path,
   which is now unreachable for a guest-account visitor (they have a real `apiKey` +
   `userData`, so `isAuthenticated` is true).

### Upgrading a guest

`GuestUpgradeBanner` (`src/components/chat-v2/guest-upgrade-banner.tsx`) renders in chat only
when `privyUser.isGuest === true`: "You're using a guest account — sign in to keep your
history and unlock paid models," with CTAs to `useLinkAccount().linkEmail()` / `linkGoogle()`
/ `linkWallet()`. **Linking, not `login()`** — `login()` would start a *different* Privy
session; `useLinkAccount`'s methods attach a new login method to the *current* (guest) Privy
user id, so the same backend account (chat history, settings) carries over. A successful link
dispatches `AUTH_REFRESH_EVENT` (the same event `gatewayz-auth-context.tsx` and
`use-auth-sync.ts` already listen for) to force an immediate resync, so `is_guest` flips to
`false` on the next `POST /auth` without waiting for the next natural sync cycle. The banner
dismisses for the rest of the tab session (`sessionStorage`), independent of
`free-models-banner.tsx`'s 24-hour localStorage dismissal — the two banners have different
lifetimes on purpose and weren't merged into one component.

`UserNav` (`src/components/layout/user-nav.tsx`) shows "Guest" instead of falling through to
the generic "User" placeholder, plus a "Sign in to save your account" menu item wired to the
same `linkEmail()` flow. Guests never hit the wallets page's `last_auth_method` lockout copy —
that only fires when `auth_method === 'wallet'`, which a Privy-guest-provisioned account never
has — so there was no separate footgun to hide there.

### Out of scope for W3b

Backend changes (none needed); giving guests credits; letting guests bypass the free-model
gate (still 0-credit accounts, paid models still 402); burner keys in localStorage (rejected
in spec.md as an approach).
