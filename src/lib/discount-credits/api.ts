// Typed client for an account's discount credits: the balance, lifetime
// totals and the balance history.
//
// The backend serves these as the `discount`, `discount_history` and
// `disclaimer` fields of GET /discount-credits (Bearer). It wraps the body as
// `{success, data}` (a bare body is accepted too) and sends numbers as strings
// (Decimal -> str).
import { makeAuthenticatedRequest } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
const DISCOUNT_CREDITS_PATH = '/discount-credits';

export interface DiscountCreditsBalance {
  /** The account's own switch: nothing renders while this is false. */
  enabled: boolean;
  /** Fraction 0..1 of the list price drawn from the balance per request; null when unusable. */
  discount_percent: number | null;
  balance_usd: number;
  lifetime_granted_usd: number;
  lifetime_used_usd: number;
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
  return parsed <= 100 ? parsed / 100 : null;
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
