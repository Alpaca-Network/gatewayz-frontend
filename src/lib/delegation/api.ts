// Typed client for the backend's delegated-staking endpoints
// (gatewayz-backend src/routes/delegation.py, src/routes/wallet_auth_cardano.py):
//   GET  /delegation/status            public: is it on, which vault / pool, rates
//   GET  /delegation/rewards           Bearer: the caller's positions and allowance
//   POST /auth/wallet/cardano/nonce    Bearer: message for a stake address to sign
//   POST /auth/wallet/cardano/link     Bearer: CIP-30 signData proof for that address
//
// The user stakes from their own wallet into a StakeWise vault (ETH) or delegates
// to our pool (ADA). Gatewayz receives the protocol rewards and gives back either
// inference credits up to an allowance (payout_model "allowance", v2) or a share
// of the rewards that user's stake earned as an inference discount balance
// (payout_model "reward_share", v3). The v3 fields are optional on the wire:
// an older backend omits them and the discount UI stays hidden. The backend wraps every body as `{success, data}`
// (bare bodies are accepted too), sends numbers as strings (Decimal -> str,
// e.g. fee_percent "99.00") and lowercase asset ids ("eth", "ada"); all of that
// is normalized here, assets to "ETH" / "ADA".
import { makeAuthenticatedRequest } from '@/lib/api';
import { toCardanoNetwork, type CardanoNetwork } from './cardano-network';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export type DelegationAsset = 'ETH' | 'ADA';

export interface DelegationAllowanceRate {
  asset: DelegationAsset | string;
  credits_per_1k_usd_per_day: number;
}

export type DelegationPayoutModel = 'allowance' | 'reward_share';

export interface DelegationStatus {
  enabled: boolean;
  eth: { vault_address: string | null; chain_id: number; fee_percent: number | null };
  /** `network` is "preprod" only on a testnet-demo backend; absent means mainnet. */
  cardano: { pool_id: string | null; network?: CardanoNetwork };
  allowance_rates: DelegationAllowanceRate[];
  disclaimer: string;
  /** v3 fields; absent (undefined / null) from a backend that predates them. */
  payout_model?: DelegationPayoutModel | null;
  /** Fraction 0..1 of the rewards a stake earned Gatewayz that comes back as discount. */
  reward_share?: number | null;
  /** Fraction 0..1 of the list price drawn from the discount balance per request. */
  discount_percent?: number | null;
  discount_enabled?: boolean;
}

export interface DelegationPosition {
  asset: DelegationAsset | string;
  wallet_address: string;
  amount: number;
  usd_value: number;
  measured_at: string | null;
}

export interface DelegationHistoryRow {
  date: string;
  asset: string;
  wallet_address: string;
  usd_basis: number;
  credits: number;
  /** pending | claimed (payment in flight) | paid */
  status: string;
}

/** An ETH vault exit request the backend has seen on chain (optional field). */
export interface DelegationExitTicket {
  wallet_address: string;
  position_ticket: string;
  /** Unix seconds of the enterExitQueue block. */
  timestamp: number;
  shares: string;
}

export interface DelegationLinkedWallet {
  asset: DelegationAsset | string;
  wallet_address: string;
}

/** `discount` of GET /delegation/rewards: the account's inference discount balance. */
export interface DelegationDiscount {
  enabled: boolean;
  discount_percent: number | null;
  reward_share: number | null;
  balance_usd: number;
  lifetime_granted_usd: number;
  lifetime_used_usd: number;
}

/** One wallet/period: the share of Gatewayz's staking rewards that stake earned, and the discount it gave. */
export interface DelegationAttribution {
  asset: string;
  period_key: string;
  stake_native: number;
  attributed_usd: number;
  discount_usd: number;
  /** pending | granted | void */
  status: string;
  granted_at: string | null;
}

export interface DelegationDiscountEntry {
  created_at: string | null;
  /** grant | use | adjust | reverse */
  kind: string;
  /** Signed: grants positive, uses negative. */
  amount_usd: number;
  balance_after: number | null;
  ref: string | null;
}

export interface DelegationRewards {
  enabled: boolean;
  /** Linked immediately on link; positions only appear after the next measurement. */
  linked_wallets: DelegationLinkedWallet[];
  positions: DelegationPosition[];
  /** Empty when the backend does not list them; the panel then scans events itself. */
  exit_requests: DelegationExitTicket[];
  allowance: { credits_per_day_estimate: number; month_estimate_usd: number; daily_cap_credits: number };
  totals: { pending: number; paid: number };
  history: DelegationHistoryRow[];
  disclaimer: string;
  /** Null when the backend omits it (pre-v3) or sends something unusable. */
  discount: DelegationDiscount | null;
  attributions: DelegationAttribution[];
  discount_history: DelegationDiscountEntry[];
}

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
export class DelegationApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'DelegationApiError';
    this.status = status;
    this.detail = detail;
  }
}

type Row = Record<string, unknown>;

function asObject(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value.filter((v) => v && typeof v === 'object') as Row[]) : [];
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** The backend sends lowercase assets ("eth", "ada"); the UI uses "ETH" / "ADA". */
function assetOf(value: unknown): string {
  return String(value ?? '').toUpperCase();
}

/**
 * A 0..1 fraction. Tolerates a percent ("99.00", like fee_percent) by scaling
 * values in (1, 100]; anything else unusable is null so the UI hides it.
 */
function toFraction(value: unknown): number | null {
  const parsed = toNullableNumber(value);
  if (parsed === null || parsed < 0) return null;
  if (parsed <= 1) return parsed;
  return parsed <= 100 ? parsed / 100 : null;
}

function toPayoutModel(value: unknown): DelegationPayoutModel | null {
  return value === 'allowance' || value === 'reward_share' ? value : null;
}

function parseDiscount(value: unknown): DelegationDiscount | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const d = value as Row;
  return {
    enabled: d.enabled === true,
    discount_percent: toFraction(d.discount_percent),
    reward_share: toFraction(d.reward_share),
    balance_usd: Math.max(0, toNumber(d.balance_usd)),
    lifetime_granted_usd: toNumber(d.lifetime_granted_usd),
    lifetime_used_usd: toNumber(d.lifetime_used_usd),
  };
}

/** `{success, data}` envelope or a bare object: returns the payload either way. */
function unwrap(body: unknown): unknown {
  const b = asObject(body);
  return 'data' in b && b.data && typeof b.data === 'object' ? b.data : body;
}

/** Normalizes GET /delegation/status. Exported for tests. */
export function parseDelegationStatus(data: unknown): DelegationStatus {
  const d = asObject(data);
  const eth = asObject(d.eth);
  const cardano = asObject(d.cardano);
  return {
    enabled: d.enabled === true,
    eth: {
      vault_address: toNullableString(eth.vault_address),
      chain_id: toNumber(eth.chain_id) || 1,
      fee_percent: toNullableNumber(eth.fee_percent),
    },
    cardano: { pool_id: toNullableString(cardano.pool_id), network: toCardanoNetwork(cardano.network) },
    allowance_rates: asRows(d.allowance_rates).map((r) => ({
      asset: assetOf(r.asset),
      credits_per_1k_usd_per_day: toNumber(r.credits_per_1k_usd_per_day),
    })),
    disclaimer: typeof d.disclaimer === 'string' ? d.disclaimer : '',
    payout_model: toPayoutModel(d.payout_model),
    reward_share: toFraction(d.reward_share),
    discount_percent: toFraction(d.discount_percent),
    discount_enabled: d.discount_enabled === true,
  };
}

/** Normalizes GET /delegation/rewards. Exported for tests. */
export function parseDelegationRewards(data: unknown): DelegationRewards {
  const d = asObject(data);
  const allowance = asObject(d.allowance);
  const totals = asObject(d.totals);
  return {
    enabled: d.enabled === true,
    linked_wallets: asRows(d.linked_wallets)
      .map((r) => ({ asset: assetOf(r.asset), wallet_address: String(r.wallet_address ?? '') }))
      .filter((w) => w.wallet_address !== ''),
    positions: asRows(d.positions).map((r) => ({
      asset: assetOf(r.asset),
      wallet_address: String(r.wallet_address ?? ''),
      amount: toNumber(r.amount),
      usd_value: toNumber(r.usd_value),
      measured_at: toNullableString(r.measured_at),
    })),
    exit_requests: asRows(d.exit_requests)
      .map((r) => ({
        wallet_address: String(r.wallet_address ?? ''),
        position_ticket: String(r.position_ticket ?? ''),
        timestamp: toNumber(r.timestamp),
        shares: String(r.shares ?? '0'),
      }))
      .filter((r) => /^\d+$/.test(r.position_ticket) && r.timestamp > 0 && /^\d+$/.test(r.shares)),
    allowance: {
      credits_per_day_estimate: toNumber(allowance.credits_per_day_estimate),
      month_estimate_usd: toNumber(allowance.month_estimate_usd),
      daily_cap_credits: toNumber(allowance.daily_cap_credits),
    },
    totals: { pending: toNumber(totals.pending), paid: toNumber(totals.paid) },
    history: asRows(d.history).map((r) => ({
      date: String(r.date ?? r.reward_date ?? ''),
      asset: assetOf(r.asset),
      wallet_address: String(r.wallet_address ?? ''),
      usd_basis: toNumber(r.usd_basis),
      credits: toNumber(r.credits),
      status: String(r.status ?? ''),
    })),
    disclaimer: typeof d.disclaimer === 'string' ? d.disclaimer : '',
    discount: parseDiscount(d.discount),
    attributions: asRows(d.attributions)
      .map((r) => ({
        asset: assetOf(r.asset),
        period_key: String(r.period_key ?? ''),
        stake_native: toNumber(r.stake_native),
        attributed_usd: toNumber(r.attributed_usd),
        discount_usd: toNumber(r.discount_usd),
        status: String(r.status ?? ''),
        granted_at: toNullableString(r.granted_at),
      }))
      .filter((r) => r.period_key !== ''),
    discount_history: asRows(d.discount_history).map((r) => ({
      created_at: toNullableString(r.created_at),
      kind: String(r.kind ?? ''),
      amount_usd: toNumber(r.amount_usd),
      balance_after: toNullableNumber(r.balance_after),
      ref: toNullableString(r.ref),
    })),
  };
}

/** Pulls a user-facing message out of either error envelope the backend uses. */
async function extractErrorDetail(response: Response): Promise<string> {
  try {
    const body = asObject(await response.json());
    if (typeof body.detail === 'string') return body.detail;
    const error = body.error;
    if (typeof error === 'string') return error;
    const message = asObject(error).message;
    return (typeof message === 'string' && message) || response.statusText || 'Request failed';
  } catch {
    return response.statusText || 'Request failed';
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new DelegationApiError(response.status, await extractErrorDetail(response));
  }
  return unwrap(await response.json());
}

/** GET /delegation/status (public). */
export async function getDelegationStatus(): Promise<DelegationStatus> {
  const response = await fetch(`${API_BASE_URL}/delegation/status`, { headers: { Accept: 'application/json' } });
  return parseDelegationStatus(await readJson(response));
}

/** GET /delegation/rewards (Bearer): the caller's own positions and allowance. */
export async function getDelegationRewards(): Promise<DelegationRewards> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/delegation/rewards`);
  return parseDelegationRewards(await readJson(response));
}

/** POST /auth/wallet/cardano/nonce (Bearer): the message the stake key signs. */
export async function requestCardanoLinkNonce(stakeAddress: string): Promise<CardanoLinkNonce> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/auth/wallet/cardano/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stake_address: stakeAddress }),
  });
  const d = asObject(await readJson(response));
  if (typeof d.message !== 'string' || d.message === '') {
    throw new DelegationApiError(500, 'The link message was missing from the response.');
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
}): Promise<CardanoLinkedWallet> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/auth/wallet/cardano/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stake_address: input.stakeAddress, signature: input.signature, key: input.key }),
  });
  const wallet = asObject(asObject(await readJson(response)).wallet);
  return {
    wallet_address: String(wallet.wallet_address ?? input.stakeAddress),
    chain_namespace: String(wallet.chain_namespace ?? 'cip34'),
  };
}

/** Short, user-facing copy for a failed link. */
export function describeCardanoLinkError(error: unknown): string {
  if (error instanceof DelegationApiError) {
    if (error.status === 400) return 'Your linking session expired. Please try again.';
    if (error.status === 401) return 'The wallet signature could not be verified. Please try again.';
    if (error.status === 409) return 'This stake address is already linked to another Gatewayz account.';
    if (error.status === 422) {
      return 'This stake address cannot be linked. Use a regular Cardano mainnet wallet (not a script or testnet address).';
    }
    if (error.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (error.status === 503) return 'Linking is temporarily unavailable. Please try again shortly.';
  }
  return 'Something went wrong. Please try again.';
}
