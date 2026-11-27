// Typed client for the backend's Cardano wallet-linking endpoints
// (gatewayz-backend src/routes/wallet_auth_cardano.py):
//   POST /auth/wallet/cardano/nonce    Bearer: message for a stake address to sign
//   POST /auth/wallet/cardano/link     Bearer: CIP-30 signData proof for that address
//   GET  /auth/wallets                 Bearer: linked wallets (Cardano rows only, here)
//   DELETE /auth/wallets/{address}     Bearer: unlink one
//
// A linked stake address becomes a row in GET /auth/wallets (chain_namespace
// "cip34"). Linking is refused with HTTP 451 for the US and Canada: error.type
// "region_restricted", or "attestation_required" when the account has not
// confirmed its eligibility yet. An account without a payment method is refused
// with HTTP 402, error.type "payment_method_required" (step 1.5 of the discount
// credits plan). The backend wraps every body as `{success, data}` (bare bodies
// are accepted too).
import { makeAuthenticatedRequest } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

/** HTTP 451 refusals, from `error.type`. */
export type CardanoLinkRefusal = 'region_restricted' | 'attestation_required';

export interface CardanoLinkNonce {
  nonce: string;
  message: string;
  /** hex(utf8(message)): exactly what the wallet must sign. Null if the backend omits it. */
  payload_hex: string | null;
  expires_at: string | null;
}

/** `data.wallet` of POST /auth/wallet/cardano/link (the new /auth/wallets row). */
export interface CardanoLinkedWallet {
  wallet_address: string;
  /** "cip34" for Cardano; EVM rows carry "eip155". */
  chain_namespace: string;
}

/** Thrown for any non-2xx response from these endpoints. */
export class CardanoLinkApiError extends Error {
  status: number;
  detail: string;
  /** `error.type` from the body, when the backend sent one (e.g. "region_restricted"). */
  code: string | null;

  constructor(status: number, detail: string, code: string | null = null) {
    super(detail);
    this.name = 'CardanoLinkApiError';
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

/** error.type of the 402 sent when the account has no payment method. */
export const PAYMENT_METHOD_REQUIRED = 'payment_method_required';

/** True when linking was refused because the account has no payment method yet. */
export function isPaymentMethodRequired(error: unknown): boolean {
  if (!(error instanceof CardanoLinkApiError)) return false;
  // A 402 from these routes means nothing else; the type is checked too, so a
  // future typed 402 with another meaning is not shown as this one.
  return error.status === 402 && (error.code === null || error.code === PAYMENT_METHOD_REQUIRED);
}

/** Which US / Canada refusal this error is, or null for anything else. */
export function cardanoLinkRefusalOf(error: unknown): CardanoLinkRefusal | null {
  if (!(error instanceof CardanoLinkApiError) || error.status !== 451) return null;
  // An unknown future 451 type is treated as region-restricted.
  return error.code === 'attestation_required' ? 'attestation_required' : 'region_restricted';
}

type Row = Record<string, unknown>;

function asObject(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** `{success, data}` envelope or a bare object: returns the payload either way. */
function unwrap(body: unknown): unknown {
  const b = asObject(body);
  return 'data' in b && b.data && typeof b.data === 'object' ? b.data : body;
}

/**
 * Pulls a user-facing message and the `error.type` out of either error envelope
 * the backend uses (`{detail}` or `{error: {type, message}}`, possibly nested
 * under `detail`).
 */
async function extractErrorDetail(response: Response): Promise<{ message: string; code: string | null }> {
  const fallback = response.statusText || 'Request failed';
  try {
    const body = asObject(await response.json());
    if (typeof body.detail === 'string') return { message: body.detail, code: null };
    const error = body.error ?? asObject(body.detail).error;
    if (typeof error === 'string') return { message: error, code: null };
    const { message, type } = asObject(error);
    return {
      message: (typeof message === 'string' && message) || fallback,
      code: typeof type === 'string' && type ? type : null,
    };
  } catch {
    return { message: fallback, code: null };
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const { message, code } = await extractErrorDetail(response);
    throw new CardanoLinkApiError(response.status, message, code);
  }
  return unwrap(await response.json());
}

/**
 * POST /auth/wallet/cardano/nonce (Bearer): the message the stake key signs.
 * `notUsCaPerson` carries the eligibility confirmation; the backend needs it
 * unless the account already confirmed.
 */
export async function requestCardanoLinkNonce(stakeAddress: string, notUsCaPerson = false): Promise<CardanoLinkNonce> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/auth/wallet/cardano/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stake_address: stakeAddress, not_us_ca_person: notUsCaPerson }),
  });
  const d = asObject(await readJson(response));
  if (typeof d.message !== 'string' || d.message === '') {
    throw new CardanoLinkApiError(500, 'The link message was missing from the response.');
  }
  const payloadHex = typeof d.payload_hex === 'string' && /^[0-9a-f]+$/i.test(d.payload_hex) ? d.payload_hex : null;
  return {
    nonce: String(d.nonce ?? ''),
    message: d.message,
    payload_hex: payloadHex,
    expires_at: toNullableString(d.expires_at),
  };
}

/** POST /auth/wallet/cardano/link (Bearer): CIP-30 signData output (COSE_Sign1 + COSE_Key hex). */
export async function linkCardanoStakeAddress(input: {
  stakeAddress: string;
  signature: string;
  key: string;
  notUsCaPerson?: boolean;
}): Promise<CardanoLinkedWallet> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/auth/wallet/cardano/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stake_address: input.stakeAddress,
      signature: input.signature,
      key: input.key,
      not_us_ca_person: input.notUsCaPerson ?? false,
    }),
  });
  const wallet = asObject(asObject(await readJson(response)).wallet);
  const linked = String(wallet.wallet_address ?? '');
  // The backend must report the address the user connected; anything else is
  // treated as a failed link rather than shown as success.
  if (linked !== input.stakeAddress.toLowerCase()) {
    throw new Error('Linked wallet address does not match the connected wallet');
  }
  return {
    wallet_address: linked,
    chain_namespace: String(wallet.chain_namespace ?? 'cip34'),
  };
}

/** A row of GET /auth/wallets for a linked Cardano stake address. */
export interface LinkedCardanoWallet {
  /** Bech32 stake address, lower case. */
  wallet_address: string;
  verified_at: string | null;
}

/** GET /auth/wallets (Bearer): the account's linked Cardano stake addresses (chain_namespace "cip34"). */
export async function getLinkedCardanoWallets(): Promise<LinkedCardanoWallet[]> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/auth/wallets`);
  const wallets = asObject(await readJson(response)).wallets;
  if (!Array.isArray(wallets)) return [];
  return wallets
    .map(asObject)
    .filter((w) => w.chain_namespace === 'cip34' && typeof w.wallet_address === 'string' && w.wallet_address !== '')
    .map((w) => ({ wallet_address: String(w.wallet_address), verified_at: toNullableString(w.verified_at) }));
}

/** DELETE /auth/wallets/{stake_address} (Bearer): unlinks a stake address from the account. */
export async function unlinkCardanoStakeAddress(stakeAddress: string): Promise<void> {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/auth/wallets/${encodeURIComponent(stakeAddress)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    const { message, code } = await extractErrorDetail(response);
    throw new CardanoLinkApiError(response.status, message, code);
  }
}

const REGION_RESTRICTED_MESSAGE = 'Wallet linking is not available in your region.';
const PAYMENT_METHOD_REQUIRED_MESSAGE =
  'Add a payment method before you link a wallet. Part of each request is always charged to you.';
const ATTESTATION_REQUIRED_MESSAGE =
  'Confirm you are not a resident or citizen of the United States or Canada to continue.';

/** Short, user-facing copy for a failed link. */
export function describeCardanoLinkError(error: unknown): string {
  const refusal = cardanoLinkRefusalOf(error);
  if (refusal === 'region_restricted') return REGION_RESTRICTED_MESSAGE;
  if (refusal === 'attestation_required') return ATTESTATION_REQUIRED_MESSAGE;
  if (isPaymentMethodRequired(error)) return PAYMENT_METHOD_REQUIRED_MESSAGE;
  if (error instanceof CardanoLinkApiError) {
    if (error.status === 400) return 'Your linking session expired. Please try again.';
    if (error.status === 401) return 'The wallet signature could not be verified. Please try again.';
    if (error.status === 403) return 'Sign in to Gatewayz again, then link your wallet. API keys cannot link wallets.';
    if (error.status === 409) return 'This stake address is already linked to another Gatewayz account.';
    if (error.status === 422) {
      return 'This stake address cannot be linked. Use a regular Cardano mainnet wallet (not a script or testnet address).';
    }
    if (error.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (error.status === 503) return 'Linking is temporarily unavailable. Please try again shortly.';
  }
  return 'Something went wrong. Please try again.';
}

/** Short, user-facing copy for a failed unlink. */
export function describeCardanoUnlinkError(error: unknown): string {
  if (error instanceof CardanoLinkApiError) {
    if (error.status === 403) return 'Sign in to Gatewayz again, then unlink your wallet. API keys cannot unlink wallets.';
    if (error.status === 404) return 'This wallet is no longer linked to your account.';
    if (error.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (error.status === 503) return 'Unlinking is temporarily unavailable. Please try again shortly.';
  }
  return 'Something went wrong. Please try again.';
}
