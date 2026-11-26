// Typed client for an account's discount credits: the balance, lifetime
// totals and the balance history.
//
// The backend serves these as the `discount`, `discount_history` and
// `disclaimer` fields of GET /discount-credits (Bearer). It wraps the body as
// `{success, data}` (a bare body is accepted too) and sends numbers as strings
// (Decimal -> str).
//
// `discount.daily_cap` (the daily limit) is optional: a backend that does not
// send it yet leaves `daily_cap` null and the UI shows no daily limit section.
// PUT /discount-credits/daily-cap changes the limit, with the same Bearer helper.
import { makeAuthenticatedRequest } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
const DISCOUNT_CREDITS_PATH = '/discount-credits';
const DAILY_CAP_PATH = `${DISCOUNT_CREDITS_PATH}/daily-cap`;

/** The daily limit accepts 0 (nothing is drawn from the balance) up to this amount, with up to 6 decimals. */
export const DAILY_CAP_MAX_USD = 1_000_000;

/** How much of the balance can be used per UTC calendar day. */
export interface DiscountCreditsDailyCap {
  daily_cap_usd: number;
  used_today_usd: number;
  left_today_usd: number;
  /** ISO time of the next reset (00:00 UTC). */
  resets_at: string | null;
  /** A higher limit that is waiting to apply (24 hours after it was asked for); null when none is pending. */
  next_daily_cap_usd: number | null;
  /** UTC date (YYYY-MM-DD) the pending limit starts on. */
  next_daily_cap_from: string | null;
  /** ISO time a pending raise applies (24 hours after it was asked for); null when none or from an older backend. */
  next_daily_cap_at: string | null;
}

export interface DiscountCreditsBalance {
  /** True when the backend applies discount credits to this account. */
  enabled: boolean;
  /**
   * Share of the list price drawn from the balance per request, as a fraction
   * (0.99 means 99%). May be null when not enabled, or when the value is unusable.
   */
  discount_percent: number | null;
  balance_usd: number;
  lifetime_granted_usd: number;
  lifetime_used_usd: number;
  /** Null when the backend does not send a daily limit (or sends one with no amount). */
  daily_cap: DiscountCreditsDailyCap | null;
}

export interface DiscountCreditsEntry {
  created_at: string | null;
  /** grant | use | adjust | reverse */
  kind: string;
  /** Signed: grants positive, uses negative. */
  amount_usd: number;
  balance_after: number | null;
  ref: string | null;
}

export interface DiscountCredits {
  /** Null when the backend omits it or sends something unusable. */
  balance: DiscountCreditsBalance | null;
  /** Newest first, as the backend sends it. */
  history: DiscountCreditsEntry[];
  disclaimer: string;
}

type Row = Record<string, unknown>;

function asObject(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
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

/**
 * A 0..1 fraction. Tolerates a percent ("99.00") by scaling values in
 * (1, 100]; anything else unusable is null so the UI hides it.
 */
function toFraction(value: unknown): number | null {
  const parsed = toNullableNumber(value);
  if (parsed === null || parsed < 0) return null;
  if (parsed <= 1) return parsed;
  // Defensive only: the backend sends a fraction, never a value above 1.
  return parsed <= 100 ? parsed / 100 : null;
}

/** Exported for tests. Null when the key is absent, malformed, or has no `daily_cap_usd`. */
export function parseDailyCap(value: unknown): DiscountCreditsDailyCap | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const c = value as Row;
  const cap = toNullableNumber(c.daily_cap_usd);
  if (cap === null || cap < 0) return null;
  const used = Math.max(0, toNumber(c.used_today_usd));
  const left = toNullableNumber(c.left_today_usd);
  return {
    daily_cap_usd: cap,
    used_today_usd: used,
    left_today_usd: Math.max(0, left ?? cap - used),
    resets_at: toNullableString(c.resets_at),
    next_daily_cap_usd: toNullableNumber(c.next_daily_cap_usd),
    next_daily_cap_from: toNullableString(c.next_daily_cap_from),
    next_daily_cap_at: toNullableString(c.next_daily_cap_at),
  };
}

function parseBalance(value: unknown): DiscountCreditsBalance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const d = value as Row;
  return {
    enabled: d.enabled === true,
    discount_percent: toFraction(d.discount_percent),
    balance_usd: Math.max(0, toNumber(d.balance_usd)),
    lifetime_granted_usd: toNumber(d.lifetime_granted_usd),
    lifetime_used_usd: toNumber(d.lifetime_used_usd),
    daily_cap: parseDailyCap(d.daily_cap),
  };
}

/** Normalizes the response body (already unwrapped). Exported for tests. */
export function parseDiscountCredits(data: unknown): DiscountCredits {
  const d = asObject(data);
  const history = Array.isArray(d.discount_history) ? d.discount_history : [];
  return {
    balance: parseBalance(d.discount),
    history: history
      .filter((r) => r && typeof r === 'object')
      .map((r: Row) => ({
        created_at: toNullableString(r.created_at),
        kind: String(r.kind ?? ''),
        amount_usd: toNumber(r.amount_usd),
        balance_after: toNullableNumber(r.balance_after),
        ref: toNullableString(r.ref),
      })),
    disclaimer: typeof d.disclaimer === 'string' ? d.disclaimer : '',
  };
}

/** The signed-in account's discount credits (Bearer). Throws on any non-2xx response. */
export async function getDiscountCredits(): Promise<DiscountCredits> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}${DISCOUNT_CREDITS_PATH}`);
  if (!response.ok) throw new Error(`Discount credits request failed with status ${response.status}`);
  const body = asObject(await response.json());
  return parseDiscountCredits('data' in body && body.data && typeof body.data === 'object' ? body.data : body);
}

export type DailyCapErrorCode = 'invalid_value' | 'discount_credits_not_enabled' | 'discount_credits_unavailable' | 'unknown';

const DAILY_CAP_ERROR_CODES: Record<number, DailyCapErrorCode> = {
  422: 'invalid_value',
  404: 'discount_credits_not_enabled',
  503: 'discount_credits_unavailable',
};

/** A refused daily limit change. `code` follows the HTTP status: 422, 404, 503, anything else `unknown`. */
export class DiscountCreditsDailyCapError extends Error {
  constructor(
    readonly status: number,
    readonly code: DailyCapErrorCode,
  ) {
    super(`Discount credits daily limit request failed with status ${status}`);
    this.name = 'DiscountCreditsDailyCapError';
  }
}

export interface DiscountCreditsDailyCapResult {
  /** `set`: applies now (the limit was lowered or kept). `scheduled`: a higher limit starts on the next UTC day. */
  status: 'set' | 'scheduled';
  daily_cap: DiscountCreditsDailyCap | null;
}

/** "20", never "2e-7": the backend reads a decimal string with up to 6 decimals. */
function capToString(capUsd: string | number): string {
  if (typeof capUsd === 'string') return capUsd.trim();
  return capUsd.toFixed(6).replace(/\.?0+$/, '');
}

/**
 * Changes the signed-in account's daily limit (Bearer, same helper as the read).
 * Throws DiscountCreditsDailyCapError on any non-2xx response.
 */
export async function setDiscountCreditsDailyCap(capUsd: string | number): Promise<DiscountCreditsDailyCapResult> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}${DAILY_CAP_PATH}`, {
    method: 'PUT',
    body: JSON.stringify({ daily_cap_usd: capToString(capUsd) }),
  });
  if (!response.ok) {
    throw new DiscountCreditsDailyCapError(response.status, DAILY_CAP_ERROR_CODES[response.status] ?? 'unknown');
  }
  const body = asObject(await response.json());
  const data = asObject('data' in body && body.data && typeof body.data === 'object' ? body.data : body);
  return {
    status: data.status === 'scheduled' ? 'scheduled' : 'set',
    daily_cap: parseDailyCap(data.daily_cap),
  };
}
