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

## Backend base URL

All wallet-auth calls go straight to the backend (`${API_BASE_URL}/auth/wallet/...` via
`makeAuthenticatedRequest`), not through a Next `/api/*` proxy — this matches the dominant
pattern for authenticated settings calls (`src/app/settings/page.tsx`,
`src/app/settings/credits/page.tsx`, `src/lib/wayz/staking-api.ts`); only
`src/app/settings/keys/page.tsx` proxies, because that route already existed as
`/api/user/api-keys`.

## Not in scope for W3a

Privy **guest accounts** (W3b, gatewayz-backend#2253) — creating a persistent, upgradeable
identity for signed-out chat users — ships after this merges. Nothing here depends on it.
