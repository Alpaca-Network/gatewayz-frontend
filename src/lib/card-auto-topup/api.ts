// Typed client for the saved card and card auto top-up (backend
// src/routes/billing_card.py). All calls use the Bearer helper. The backend
// wraps bodies as `{success, data}` (a bare body is accepted too).
//
//   GET    /user/billing/card                 status (card summary, settings, limits)
//   POST   /user/billing/card/setup-session   Stripe Checkout (setup mode) URL
//   POST   /user/billing/card/confirm         store the card after Checkout
//   DELETE /user/billing/card                 stop using the card
//   PUT    /user/billing/auto-topup           on/off, amount, daily limit
//
// Amounts are US cents. Card numbers never pass through the app: Stripe
// Checkout collects them, and the backend only returns brand, last 4 and expiry.
import { makeAuthenticatedRequest } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
const CARD_PATH = '/user/billing/card';
const AUTO_TOPUP_PATH = '/user/billing/auto-topup';

export interface SavedCard {
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
}

export type PausedReason = 'declined' | 'requires_action' | 'card_unusable' | string;

export interface AutoTopUpSettings {
  enabled: boolean;
  amount_cents: number;
  daily_limit_cents: number;
  paused_reason: PausedReason | null;
  charged_today_cents: number;
}

export interface CardAutoTopUpLimits {
  min_amount_cents: number;
  max_amount_cents: number;
  max_daily_limit_cents: number;
  default_amount_cents: number;
}

export interface CardAutoTopUpStatus {
  /** False while the backend's switch is off or does not apply to this account. */
  feature_enabled: boolean;
  card: SavedCard | null;
  auto_topup: AutoTopUpSettings | null;
  limits: CardAutoTopUpLimits;
}

type Row = Record<string, unknown>;

function asObject(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

function unwrap(body: unknown): Row {
  const b = asObject(body);
  return asObject('data' in b && b.data && typeof b.data === 'object' ? b.data : b);
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function toNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Normalizes the status body (already unwrapped). Exported for tests. */
export function parseCardStatus(data: unknown): CardAutoTopUpStatus {
  const d = asObject(data);
  const limits = asObject(d.limits);
  const isRow = (v: unknown) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  const card = isRow(d.card) ? asObject(d.card) : null;
  const auto = isRow(d.auto_topup) ? asObject(d.auto_topup) : null;
  return {
    feature_enabled: d.feature_enabled === true,
    card: card
      ? {
          brand: toNullableString(card.brand),
          last4: toNullableString(card.last4),
          exp_month: toNullableInt(card.exp_month),
          exp_year: toNullableInt(card.exp_year),
        }
      : null,
    auto_topup: auto
      ? {
          enabled: auto.enabled === true,
          amount_cents: toInt(auto.amount_cents),
          daily_limit_cents: toInt(auto.daily_limit_cents),
          paused_reason: toNullableString(auto.paused_reason),
          charged_today_cents: Math.max(0, toInt(auto.charged_today_cents)),
        }
      : null,
    limits: {
      min_amount_cents: toInt(limits.min_amount_cents, 500),
      max_amount_cents: toInt(limits.max_amount_cents, 50000),
      max_daily_limit_cents: toInt(limits.max_daily_limit_cents, 10000),
      default_amount_cents: toInt(limits.default_amount_cents, 2000),
    },
  };
}

/** A refused card or auto top-up call. `code` is the backend's error code when it sent one. */
export class CardAutoTopUpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`Card auto top-up request failed with status ${status}`);
    this.name = 'CardAutoTopUpError';
  }
}

async function call(path: string, init?: RequestInit): Promise<Row> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    let code = 'unknown';
    try {
      const body = asObject(await response.json());
      if (typeof body.detail === 'string') code = body.detail;
    } catch {
      // keep "unknown"
    }
    throw new CardAutoTopUpError(response.status, code);
  }
  return unwrap(await response.json());
}

export async function getCardStatus(): Promise<CardAutoTopUpStatus> {
  return parseCardStatus(await call(CARD_PATH));
}

/** The Stripe Checkout URL to send the customer to. */
export async function createCardSetupSession(): Promise<string> {
  const data = await call(`${CARD_PATH}/setup-session`, { method: 'POST' });
  const url = toNullableString(data.url);
  if (!url) throw new CardAutoTopUpError(502, 'card_service_unavailable');
  return url;
}

export async function confirmCardSetup(sessionId: string): Promise<CardAutoTopUpStatus> {
  return parseCardStatus(
    await call(`${CARD_PATH}/confirm`, { method: 'POST', body: JSON.stringify({ session_id: sessionId }) }),
  );
}

export async function removeSavedCard(): Promise<CardAutoTopUpStatus> {
  return parseCardStatus(await call(CARD_PATH, { method: 'DELETE' }));
}

export interface AutoTopUpChange {
  enabled: boolean;
  amount_cents?: number;
  daily_limit_cents?: number;
}

export async function setAutoTopUp(change: AutoTopUpChange): Promise<CardAutoTopUpStatus> {
  return parseCardStatus(await call(AUTO_TOPUP_PATH, { method: 'PUT', body: JSON.stringify(change) }));
}
