// Typed client for the backend's delegated-staking endpoints
// (gatewayz-backend src/routes/delegation.py):
//   GET  /delegation/status            public: is it on, which vault / pool, rates
//   GET  /delegation/rewards           Bearer: the caller's positions and allowance
//   POST /auth/wallet/cardano/nonce    Bearer: message for a stake address to sign
//   POST /auth/wallet/cardano/link     Bearer: CIP-30 signData proof for that address
//
// The user stakes from their own wallet into a StakeWise vault (ETH) or delegates
// to our pool (ADA). Gatewayz keeps the protocol rewards and gives inference
// credits up to an allowance. Numbers may arrive as strings (Decimal -> str) and
// are parsed here. Both `{success, data}` and bare bodies are accepted.
import { makeAuthenticatedRequest } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export type DelegationAsset = 'ETH' | 'ADA';

export interface DelegationAllowanceRate {
  asset: DelegationAsset | string;
  credits_per_1k_usd_per_day: number;
}

export interface DelegationStatus {
  enabled: boolean;
  eth: { vault_address: string | null; chain_id: number; fee_percent: number | null };
  cardano: { pool_id: string | null };
  allowance_rates: DelegationAllowanceRate[];
  disclaimer: string;
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
  credits: number;
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

export interface DelegationRewards {
  enabled: boolean;
  positions: DelegationPosition[];
  /** Empty when the backend does not list them; the panel then scans events itself. */
  exit_requests: DelegationExitTicket[];
  allowance: { credits_per_day_estimate: number; month_estimate_usd: number };
  totals: { pending: number; paid: number };
  history: DelegationHistoryRow[];
}

export interface CardanoLinkNonce {
  nonce: string;
  message: string;
  expires_at: string | null;
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
    cardano: { pool_id: toNullableString(cardano.pool_id) },
    allowance_rates: asRows(d.allowance_rates).map((r) => ({
      asset: String(r.asset ?? ''),
      credits_per_1k_usd_per_day: toNumber(r.credits_per_1k_usd_per_day),
    })),
    disclaimer: typeof d.disclaimer === 'string' ? d.disclaimer : '',
  };
}

/** Normalizes GET /delegation/rewards. Exported for tests. */
export function parseDelegationRewards(data: unknown): DelegationRewards {
  const d = asObject(data);
  const allowance = asObject(d.allowance);
  const totals = asObject(d.totals);
  return {
    enabled: d.enabled === true,
    positions: asRows(d.positions).map((r) => ({
      asset: String(r.asset ?? ''),
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
    },
    totals: { pending: toNumber(totals.pending), paid: toNumber(totals.paid) },
    history: asRows(d.history).map((r) => ({
      date: String(r.date ?? r.reward_date ?? ''),
      asset: String(r.asset ?? ''),
      credits: toNumber(r.credits),
      status: String(r.status ?? ''),
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
  return { nonce: String(d.nonce ?? ''), message: d.message, expires_at: toNullableString(d.expires_at) };
}

/** POST /auth/wallet/cardano/link (Bearer): CIP-30 signData output (COSE_Sign1 + COSE_Key hex). */
export async function linkCardanoStakeAddress(input: {
  stakeAddress: string;
  signature: string;
  key: string;
}): Promise<void> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/auth/wallet/cardano/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stake_address: input.stakeAddress, signature: input.signature, key: input.key }),
  });
  await readJson(response);
}

/** Short, user-facing copy for a failed link. */
export function describeCardanoLinkError(error: unknown): string {
  if (error instanceof DelegationApiError) {
    if (error.status === 400) return 'Your linking session expired. Please try again.';
    if (error.status === 401) return 'The wallet signature could not be verified. Please try again.';
    if (error.status === 409) return 'This stake address is already linked to another Gatewayz account.';
    if (error.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (error.status === 503) return 'Linking is temporarily unavailable. Please try again shortly.';
  }
  return 'Something went wrong. Please try again.';
}
