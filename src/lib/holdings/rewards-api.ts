// Typed client for the backend's holdings-rewards view: GET /holdings/rewards
// (gatewayz-backend src/routes/holdings.py, docs/holdings/REWARDS.md).
//
// Holdings rewards pay inference credits for tokens a user holds in a wallet
// they have linked to their account. The platform takes no custody and reads
// public balances only. Product language here is "holdings rewards"; the
// backend's language guard keeps other financial terms out of this feature, and
// this client and its UI follow the same policy.
//
// The backend sends every number as a string (Decimal -> str). They are parsed
// to plain numbers here; credits are small USD-denominated amounts, not wei.
import { makeAuthenticatedRequest } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export type HoldingsAccrualStatus = 'paid' | 'pending' | string;

export interface HoldingsRateTier {
  min_usd: number;
  credits_per_1k_usd_per_day: number;
}

/** `estimate_daily_credits` on the backend: the estimate at a USD value. */
export interface HoldingsEstimate {
  /** Capped at the daily ceiling: what would actually be paid. */
  estimated_credits_per_day: number;
  /** Before the daily ceiling, so a UI can show the cap biting. */
  uncapped_credits_per_day: number;
  rate_credits_per_1k_usd: number;
  min_usd: number;
}

export interface HoldingsWallet extends HoldingsEstimate {
  address: string;
  /** The LATEST observation. Payouts use the day's LOWEST observation. */
  usd_value: number;
  /** False when no sweep has measured this wallet yet. */
  observed: boolean;
  /** Floor of the tier this value falls in; null when no tier matches. */
  tier_min_usd: number | null;
}

export interface HoldingsTotals {
  credits_paid_30d: number;
  credits_paid_all: number;
  pending_credits: number;
}

export interface HoldingsHistoryRow {
  reward_date: string;
  wallet_address: string;
  usd_basis: number;
  credits: number;
  status: HoldingsAccrualStatus;
}

export interface HoldingsRewards {
  enabled: boolean;
  rate_table: HoldingsRateTier[];
  daily_cap_credits: number;
  total_usd_value: number;
  account_estimate: HoldingsEstimate;
  wallets: HoldingsWallet[];
  totals: HoldingsTotals;
  history: HoldingsHistoryRow[];
}

/** Thrown for any non-2xx response from GET /holdings/rewards. */
export class HoldingsApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'HoldingsApiError';
    this.status = status;
    this.detail = detail;
  }
}

type Row = Record<string, unknown>;

/** Parses a decimal that may arrive as a string or number. NaN/empty -> 0. */
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

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value.filter((v) => v && typeof v === 'object') as Row[]) : [];
}

function parseEstimate(value: unknown): HoldingsEstimate {
  const r = (value && typeof value === 'object' ? value : {}) as Row;
  return {
    estimated_credits_per_day: toNumber(r.estimated_credits_per_day),
    uncapped_credits_per_day: toNumber(r.uncapped_credits_per_day),
    rate_credits_per_1k_usd: toNumber(r.rate_credits_per_1k_usd),
    min_usd: toNumber(r.min_usd),
  };
}

/** Normalizes the `data` object of GET /holdings/rewards. Exported for tests. */
export function parseHoldingsRewards(data: unknown): HoldingsRewards {
  const d = (data && typeof data === 'object' ? data : {}) as Row;
  const totals = (d.totals && typeof d.totals === 'object' ? d.totals : {}) as Row;
  return {
    enabled: d.enabled === true,
    rate_table: asRows(d.rate_table)
      .map((r) => ({
        min_usd: toNumber(r.min_usd),
        credits_per_1k_usd_per_day: toNumber(r.credits_per_1k_usd_per_day),
      }))
      .sort((a, b) => a.min_usd - b.min_usd),
    daily_cap_credits: toNumber(d.daily_cap_credits),
    total_usd_value: toNumber(d.total_usd_value),
    account_estimate: parseEstimate(d.account_estimate),
    wallets: asRows(d.wallets).map((r) => ({
      address: String(r.address ?? ''),
      usd_value: toNumber(r.usd_value),
      observed: r.observed === true,
      tier_min_usd: toNullableNumber(r.tier_min_usd),
      ...parseEstimate(r),
    })),
    totals: {
      credits_paid_30d: toNumber(totals.credits_paid_30d),
      credits_paid_all: toNumber(totals.credits_paid_all),
      pending_credits: toNumber(totals.pending_credits),
    },
    history: asRows(d.history).map((r) => ({
      reward_date: String(r.reward_date ?? ''),
      wallet_address: String(r.wallet_address ?? ''),
      usd_basis: toNumber(r.usd_basis),
      credits: toNumber(r.credits),
      status: String(r.status ?? ''),
    })),
  };
}

/** Pulls a user-facing message out of either error envelope the backend uses. */
async function extractErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      detail?: unknown;
      error?: { message?: string };
    } | null;
    if (typeof body?.detail === 'string') return body.detail;
    const nested = (body?.detail as { error?: { message?: string } } | undefined)?.error?.message;
    return nested || body?.error?.message || response.statusText || 'Request failed';
  } catch {
    return response.statusText || 'Request failed';
  }
}

/** GET /holdings/rewards (Bearer): the caller's own holdings-rewards view. */
export async function getHoldingsRewards(): Promise<HoldingsRewards> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/holdings/rewards`);
  if (!response.ok) {
    throw new HoldingsApiError(response.status, await extractErrorDetail(response));
  }
  const body = (await response.json()) as { success?: boolean; data?: unknown };
  return parseHoldingsRewards(body?.data);
}
