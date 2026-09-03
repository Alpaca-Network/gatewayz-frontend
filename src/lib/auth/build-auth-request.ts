/**
 * Shared auth-request builder (M2 W3a — gatewayz-backend#2250 #2251).
 *
 * `gatewayz-auth-context.tsx` (the primary sync path) and `integrations/privy/auth-sync.ts`
 * (the cross-domain session-transfer path) previously each carried their own copy of the
 * `POST /auth` request-body logic, which had drifted at least once (see the M2 research doc,
 * §7 "Constraints & landmines"). This module is the single source of truth for both.
 *
 * Behaviour vs. the pre-M2 versions:
 *  - `wallet`/`smart_wallet` linked accounts are now INCLUDED (previously stripped on the
 *    belief the backend only wanted email/oauth accounts — backend W1b now ingests them into
 *    `user_wallets` when the Privy token verifies).
 *  - The vestigial `trial_credits` field is dropped. `PrivyAuthRequest` (src/schemas/auth.py)
 *    has no such field — Pydantic silently discarded it; the backend has hard-coded
 *    `credits=0` on signup since the trial system was removed. Sending it implied a promise
 *    the backend never kept.
 */
import type { LinkedAccountWithMetadata, User } from "@privy-io/react-auth";
import type { UserData } from "@/lib/api";

/** Recursively drops `undefined`/`null` values so we never send explicit nulls to the backend. */
export const stripUndefined = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as unknown as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, stripUndefined(v)]);
    return Object.fromEntries(entries) as unknown as T;
  }

  return value;
};

/** Normalizes a Date / ms-or-s numeric / ISO string into unix seconds. */
export const toUnixSeconds = (value: unknown): number | undefined => {
  if (!value) return undefined;

  if (typeof value === "number") {
    return Math.floor(value);
  }

  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return Math.floor(numeric);
    }
  }

  return undefined;
};

// Privy uses different naming conventions than our backend for a few account types.
const TYPE_NORMALIZATION: Record<string, string> = {
  github_oauth: "github",
  sms: "phone", // Privy sends 'sms' but backend expects 'phone'
  twitter_oauth: "twitter",
  discord_oauth: "discord",
};

/**
 * Maps one Privy `LinkedAccountWithMetadata` to the backend's `PrivyLinkedAccount` shape.
 *
 * Every account type (including `wallet`/`smart_wallet`) is included — the backend
 * (`src/schemas/auth.py`) accepts `"wallet"` as a valid type and W1b ingests verified wallet
 * accounts into `user_wallets`. Field extraction uses a generic property getter rather than
 * per-type destructuring so unrelated fields naturally fall away via `stripUndefined` for
 * account types that don't have them (e.g. `address` for an email account).
 *
 * Note: the installed `@privy-io/react-auth@3.10.2` types (`LinkMetadata` in
 * `types-B4eMcjTQ.d.ts`) only expose `firstVerifiedAt`/`latestVerifiedAt` — there is no
 * singular `verifiedAt` field on real Privy objects. `verified_at` is still read defensively
 * (older mocks/paths may carry it) but will be `undefined`/stripped for real Privy accounts.
 */
export const mapLinkedAccount = (account: LinkedAccountWithMetadata) => {
  const get = (key: string) =>
    Object.prototype.hasOwnProperty.call(account, key)
      ? (account as unknown as Record<string, unknown>)[key]
      : undefined;

  const normalizedType = TYPE_NORMALIZATION[account.type] ?? account.type;

  return stripUndefined({
    type: normalizedType,
    subject: get("subject") as string | undefined,
    email: get("email") as string | undefined,
    name: get("name") as string | undefined,
    phone_number: get("phoneNumber") as string | undefined, // Include phone number for SMS auth
    address: get("address") as string | undefined, // wallet / smart_wallet
    chain_type: get("chainType") as string | undefined, // wallet / smart_wallet
    wallet_client_type: get("walletClientType") as string | undefined, // wallet / smart_wallet
    connector_type: get("connectorType") as string | undefined, // wallet / smart_wallet
    verified_at: toUnixSeconds(get("verifiedAt")),
    first_verified_at: toUnixSeconds(get("firstVerifiedAt")),
    latest_verified_at: toUnixSeconds(get("latestVerifiedAt")),
  });
};

export interface AuthRequestBody {
  user: Record<string, unknown>;
  token: string;
  auto_create_api_key: boolean;
  is_new_user: boolean;
  privy_user_id: string;
}

export interface BuildAuthRequestOptions {
  /** Privy access token — must be non-null; callers should retry (`getPrivyAccessTokenWithRetry`) before building the body. */
  token: string | null;
  /** Existing cached Gatewayz user data, or null for a first-time sync. */
  existingUserData: UserData | null;
}

/**
 * Builds the `POST /auth` request body from a Privy `User` object. Identical output for the
 * same inputs regardless of which sync path calls it (`gatewayz-auth-context.tsx` or
 * `integrations/privy/auth-sync.ts`) — see `build-auth-request.test.ts`.
 */
export function buildAuthRequestBody(
  privyUser: User,
  { token, existingUserData }: BuildAuthRequestOptions
): AuthRequestBody {
  const isNewUser = !existingUserData;
  const hasStoredApiKey = Boolean(existingUserData?.api_key);

  return {
    user: stripUndefined({
      id: privyUser.id,
      created_at: toUnixSeconds(privyUser.createdAt) ?? Math.floor(Date.now() / 1000),
      linked_accounts: (privyUser.linkedAccounts || []).map(mapLinkedAccount).filter(Boolean),
      mfa_methods: privyUser.mfaMethods || [],
      has_accepted_terms: privyUser.hasAcceptedTerms ?? false,
      is_guest: privyUser.isGuest ?? false,
    }),
    token: token ?? "",
    // Only request API key creation for new users or users without stored keys —
    // existing users should get their existing key back to avoid replacing live keys with temp keys.
    auto_create_api_key: isNewUser || !hasStoredApiKey,
    is_new_user: isNewUser,
    privy_user_id: privyUser.id,
  };
}

/**
 * Backoff schedule (ms) between retries of `getAccessToken()`. Three retries after the initial
 * attempt (four calls total) — matches the M2 spec's "retry ×3, surface a hard error instead of
 * syncing without it" (spec.md §2, §6).
 */
export const TOKEN_RETRY_DELAYS_MS = [250, 500, 1000] as const;

/**
 * Calls Privy's `getAccessToken()`, retrying on a null result up to `TOKEN_RETRY_DELAYS_MS.length`
 * additional times with the given backoff. Never throws — a persistent null is a legitimate
 * outcome the caller must handle by refusing to sync (never "continue without a token").
 */
export async function getPrivyAccessTokenWithRetry(
  getAccessToken: () => Promise<string | null>
): Promise<string | null> {
  const attempt = async (): Promise<string | null> => {
    try {
      return await getAccessToken();
    } catch {
      return null;
    }
  };

  let token = await attempt();
  if (token) return token;

  for (const delayMs of TOKEN_RETRY_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    token = await attempt();
    if (token) return token;
  }

  return null;
}
