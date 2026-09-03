/**
 * Typed client for the backend's wallet-linking endpoints (M2 W1 — gatewayz-backend#2251).
 * Bearer-authenticated via makeAuthenticatedRequest, calling the backend directly
 * (`${API_BASE_URL}/auth/wallet/*`), matching the dominant pattern for authenticated
 * settings calls in this codebase (see src/lib/wayz/staking-api.ts, src/app/settings/page.tsx,
 * src/app/settings/credits/page.tsx — three of the four settings pages call the backend
 * directly rather than through a Next `/api/*` proxy; only src/app/settings/keys/page.tsx
 * proxies, for a route that already existed as `/api/user/api-keys`).
 */
import { makeAuthenticatedRequest } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export type WalletSource = 'privy' | 'siwe';

export interface LinkedWallet {
  wallet_address: string;
  source: WalletSource;
  wallet_client_type: string | null;
  is_primary: boolean;
  verified_at: string | null;
}

export interface WalletLinkNonce {
  message: string;
  expires_in: number;
}

/** Machine-readable error codes this client distinguishes, per spec.md §4.3. */
export type WalletAuthErrorCode =
  | 'nonce_missing_or_expired'
  | 'invalid_signature'
  | 'signature_address_mismatch'
  | 'wallet_linked_to_other_account'
  | 'wallet_not_linked'
  | 'last_auth_method'
  | 'chain_id_not_allowed'
  | 'rate_limited'
  | 'service_unavailable'
  | 'unknown_error';

/** Thrown for any non-2xx response from a `/auth/wallet/*` or `/auth/wallets*` call. */
export class WalletAuthError extends Error {
  status: number;
  code: WalletAuthErrorCode;

  constructor(status: number, code: WalletAuthErrorCode) {
    super(code);
    this.name = 'WalletAuthError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Error-code mapping.
 *
 * The backend wraps EVERY HTTPException raised by this router through
 * `detailed_http_exception_handler` (gatewayz-backend `src/utils/error_handlers.py`), whose
 * body shape is `{"error": {type, message, detail, code, status, context, ...}}` — there is
 * **no top-level `detail` field**, ever. Confirmed against the backend's own tests
 * (`tests/routes/test_wallet_auth.py`) and `src/routes/wallet_auth.py`'s raises directly.
 * The 429 rate-limit path is the one exception to that envelope shape: its `error` field is
 * a bare string ("Rate limit exceeded"), not an object (`_enforce_auth_rate_limit`,
 * `src/routes/wallet_auth.py`) — never assume `body.error` is an object.
 *
 * `error.code` is a GENERIC code (e.g. `ErrorCode.INVALID_API_KEY` for every 401 this router
 * raises, regardless of which of the two signature-verification failures caused it) — it does
 * NOT carry the backend's raw `detail` string ("invalid_signature" vs
 * "signature_address_mismatch"). Each endpoint's status codes are otherwise 1:1 with a single
 * meaning, so mapping is done primarily by (endpoint, status) below — this holds regardless of
 * whether the backend ever changes its body text (409 in particular carries NO body signal at
 * all: `src/utils/error_handlers.py` has no explicit 409 branch, so it falls through to a
 * generic internal_error factory that discards the raw "wallet_linked_to_other_account" detail
 * — status code is the only checked contract there, per the backend's own test comment).
 *
 * The one place the real backend `detail` string *does* leak into the response
 * (`DetailedErrorFactory.invalid_api_key`'s `reason` parameter gets appended as a suffix to
 * `error.detail` — `src/utils/errors.py`) is read as an optional, never-required hint to
 * disambiguate link's two possible 401 causes; if the hint is absent or the backend's error
 * copy changes, this safely defaults to the more common cause instead of throwing.
 */
async function readErrorBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function codeForNonceStatus(status: number): WalletAuthErrorCode {
  if (status === 422) return 'chain_id_not_allowed'; // POST /auth/wallet/link/nonce
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'service_unavailable';
  return 'unknown_error';
}

function codeForLinkStatus(status: number, body: Record<string, unknown> | null): WalletAuthErrorCode {
  if (status === 400) return 'nonce_missing_or_expired'; // POST /auth/wallet/link
  if (status === 401) {
    const errorField = (body as { error?: unknown } | null)?.error;
    const detail =
      errorField && typeof errorField === 'object' && typeof (errorField as { detail?: unknown }).detail === 'string'
        ? ((errorField as { detail: string }).detail)
        : '';
    return detail.includes('signature_address_mismatch') ? 'signature_address_mismatch' : 'invalid_signature';
  }
  if (status === 409) return 'wallet_linked_to_other_account';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'service_unavailable';
  return 'unknown_error';
}

function codeForUnlinkStatus(status: number): WalletAuthErrorCode {
  if (status === 400) return 'last_auth_method'; // DELETE /auth/wallets/{wallet_address}
  if (status === 404) return 'wallet_not_linked';
  return 'unknown_error';
}

/** GET /auth/wallets (Bearer) — the caller's linked wallets. */
export async function getLinkedWallets(): Promise<LinkedWallet[]> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/auth/wallets`);
  if (!response.ok) {
    throw new WalletAuthError(response.status, 'unknown_error');
  }
  const body = (await response.json()) as { success: boolean; data: { wallets: LinkedWallet[] } };
  return body.data.wallets;
}

/** POST /auth/wallet/link/nonce (Bearer) — message to sign verbatim with the wallet. */
export async function requestWalletLinkNonce(
  walletAddress: string,
  chainId?: number
): Promise<WalletLinkNonce> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/auth/wallet/link/nonce`, {
    method: 'POST',
    body: JSON.stringify({ wallet_address: walletAddress, ...(chainId ? { chain_id: chainId } : {}) }),
  });
  if (!response.ok) {
    throw new WalletAuthError(response.status, codeForNonceStatus(response.status));
  }
  const body = (await response.json()) as { success: boolean; data: WalletLinkNonce };
  return body.data;
}

/** POST /auth/wallet/link (Bearer) — links the signed wallet to the caller's account. */
export async function linkWallet(
  walletAddress: string,
  message: string,
  signature: string
): Promise<LinkedWallet> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/auth/wallet/link`, {
    method: 'POST',
    body: JSON.stringify({ wallet_address: walletAddress, message, signature }),
  });
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new WalletAuthError(response.status, codeForLinkStatus(response.status, body));
  }
  const body = (await response.json()) as { success: boolean; data: { wallet: LinkedWallet } };
  return body.data.wallet;
}

/** DELETE /auth/wallets/{wallet_address} (Bearer). */
export async function unlinkWallet(walletAddress: string): Promise<void> {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/auth/wallets/${encodeURIComponent(walletAddress)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    throw new WalletAuthError(response.status, codeForUnlinkStatus(response.status));
  }
}

/** Maps a `WalletAuthError` to short, user-facing copy for the Settings → Wallets flows. */
export function describeWalletAuthError(error: WalletAuthError): string {
  switch (error.code) {
    case 'nonce_missing_or_expired':
      return 'Your linking session expired. Please try again.';
    case 'invalid_signature':
      return 'Wallet signature could not be verified. Please try again.';
    case 'signature_address_mismatch':
      return 'The signature does not match the connected wallet.';
    case 'wallet_linked_to_other_account':
      return 'This wallet is already linked to another Gatewayz account.';
    case 'wallet_not_linked':
      return 'This wallet is not linked to your account.';
    case 'last_auth_method':
      return "This is your account's only sign-in method — link another wallet or add an email before unlinking it.";
    case 'chain_id_not_allowed':
      return 'This network is not supported for wallet linking.';
    case 'rate_limited':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'service_unavailable':
      return 'Wallet linking is temporarily unavailable. Please try again shortly.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
