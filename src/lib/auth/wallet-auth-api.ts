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

/** Machine-readable error codes this API can return, per spec.md §4.3. */
export type WalletAuthErrorCode =
  | 'nonce_missing_or_expired'
  | 'invalid_signature'
  | 'signature_address_mismatch'
  | 'wallet_linked_to_other_account'
  | 'last_auth_method'
  | (string & {});

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

async function extractErrorCode(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.detail || body?.error || body?.message || response.statusText || 'request_failed';
  } catch {
    return response.statusText || 'request_failed';
  }
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new WalletAuthError(response.status, await extractErrorCode(response));
  }
  return response.json();
}

/** GET /auth/wallets (Bearer) — the caller's linked wallets. */
export async function getLinkedWallets(): Promise<LinkedWallet[]> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/auth/wallets`);
  const body = await parseJsonOrThrow<{ success: boolean; data: { wallets: LinkedWallet[] } }>(response);
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
  const body = await parseJsonOrThrow<{ success: boolean; data: WalletLinkNonce }>(response);
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
  const body = await parseJsonOrThrow<{ success: boolean; data: { wallet: LinkedWallet } }>(response);
  return body.data.wallet;
}

/** DELETE /auth/wallets/{wallet_address} (Bearer). */
export async function unlinkWallet(walletAddress: string): Promise<void> {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/auth/wallets/${encodeURIComponent(walletAddress)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    throw new WalletAuthError(response.status, await extractErrorCode(response));
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
    case 'last_auth_method':
      return "This is your account's only sign-in method — link another wallet or add an email before unlinking it.";
    default:
      if (error.status === 429) {
        return 'Too many attempts. Please wait a moment and try again.';
      }
      return 'Something went wrong. Please try again.';
  }
}
