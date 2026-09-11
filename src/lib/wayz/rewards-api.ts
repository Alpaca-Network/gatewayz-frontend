// Typed client for the backend's staking-rewards endpoints (staking rewards
// spec, 2026-09-11 — see scratchpad/staking-rewards/spec.md §API). Staking
// rewards are paid in inference credits (USD-denominated, small decimals),
// NOT WAYZ — unlike everything else in this directory, nothing here is wei
// and nothing is parsed to bigint (matches the convention `staking-api.ts`
// already uses for its non-wei fields, e.g. `parseWholeWayz`).
import { makeAuthenticatedRequest } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export type RewardAccrualStatus = 'paid' | 'pending' | 'skipped';

export interface RewardRateTier {
  min_stake_wayz: number;
  credits_per_1k_wayz_per_day: number;
}

export interface RewardWalletEntry {
  address: string;
  staked_wayz: number;
  estimated_credits_per_day: number;
}

export interface RewardTotals {
  credits_paid_30d: number;
  credits_paid_all: number;
  pending_credits: number;
}

export interface RewardHistoryRow {
  reward_date: string;
  wallet_address: string;
  staked_wayz: number;
  credits: number;
  status: RewardAccrualStatus;
}

export interface StakingRewards {
  enabled: boolean;
  rate_table: RewardRateTier[];
  wallets: RewardWalletEntry[];
  totals: RewardTotals;
  history: RewardHistoryRow[];
}

/** The `rewards` sub-object `GET /staking/wallets/{address}` gains — no auth, no user data. */
export interface WalletRewardsEstimate {
  estimated_credits_per_day: number;
  rate_credits_per_1k: number;
}

/** Thrown for any non-2xx response from a `/staking/rewards*` call. */
export class RewardsApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'RewardsApiError';
    this.status = status;
    this.detail = detail;
  }
}

/** Parses a decimal number that may arrive as a string or number. NaN/empty -> 0. */
function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRateTable(rows: unknown): RewardRateTier[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      min_stake_wayz: toNumber(r.min_stake_wayz as string | number),
      credits_per_1k_wayz_per_day: toNumber(r.credits_per_1k_wayz_per_day as string | number),
    };
  });
}

function parseWallets(rows: unknown): RewardWalletEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      address: r.address as string,
      staked_wayz: toNumber(r.staked_wayz as string | number),
      estimated_credits_per_day: toNumber(r.estimated_credits_per_day as string | number),
    };
  });
}

function parseHistory(rows: unknown): RewardHistoryRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      reward_date: r.reward_date as string,
      wallet_address: r.wallet_address as string,
      staked_wayz: toNumber(r.staked_wayz as string | number),
      credits: toNumber(r.credits as string | number),
      status: r.status as RewardAccrualStatus,
    };
  });
}

/**
 * Extracts a user-facing detail string from the app-wide error envelope
 * (`{error: {message, context: {parameter_value}}}`, no top-level `detail` —
 * see `wallet-auth-api.ts`'s header comment and `provider-api.ts`'s
 * `readErrorParameterValue`). `parameter_value` is checked first since it
 * carries the raw backend reason where present; `message` is the fallback.
 */
async function extractErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; context?: { parameter_value?: string } };
    } | null;
    return body?.error?.context?.parameter_value || body?.error?.message || response.statusText || 'Request failed';
  } catch {
    return response.statusText || 'Request failed';
  }
}

/** GET /staking/rewards (Bearer) — the caller's personalized rewards view. */
export async function getStakingRewards(): Promise<StakingRewards> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/staking/rewards`);
  if (!response.ok) {
    throw new RewardsApiError(response.status, await extractErrorDetail(response));
  }
  const body = (await response.json()) as { success: boolean; data: Record<string, unknown> };
  const data = body.data;
  return {
    enabled: Boolean(data.enabled),
    rate_table: parseRateTable(data.rate_table),
    wallets: parseWallets(data.wallets),
    totals: {
      credits_paid_30d: toNumber((data.totals as Record<string, unknown> | undefined)?.credits_paid_30d as string),
      credits_paid_all: toNumber((data.totals as Record<string, unknown> | undefined)?.credits_paid_all as string),
      pending_credits: toNumber((data.totals as Record<string, unknown> | undefined)?.pending_credits as string),
    },
    history: parseHistory(data.history),
  };
}

/**
 * GET /staking/wallets/{address} (public) — reads just the `rewards` field this endpoint
 * gains, for a connected wallet that isn't linked to the caller's account (so
 * `getStakingRewards`'s authenticated, personalized view isn't available yet). A wallet
 * with no active stake, or before the rate table is configured, may omit `rewards`
 * entirely — treated the same as all-zero.
 */
export async function getWalletRewardsEstimate(address: string): Promise<WalletRewardsEstimate> {
  const response = await fetch(`${API_BASE_URL}/staking/wallets/${address}`);
  if (!response.ok) {
    throw new RewardsApiError(response.status, await extractErrorDetail(response));
  }
  const body = (await response.json()) as { success: boolean; data: Record<string, unknown> };
  const rewards = (body.data.rewards as Record<string, unknown> | undefined) ?? {};
  return {
    estimated_credits_per_day: toNumber(rewards.estimated_credits_per_day as string | number),
    rate_credits_per_1k: toNumber(rewards.rate_credits_per_1k as string | number),
  };
}
