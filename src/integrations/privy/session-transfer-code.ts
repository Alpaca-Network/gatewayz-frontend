/**
 * One-time session transfer codes (www.gatewayz.ai -> beta.gatewayz.ai).
 *
 * The marketing site asks the backend for a 60-second, single-use code
 * (POST /auth/transfer-code) and redirects here with `?code=` only. We strip it
 * from the URL immediately and trade it for the API key with
 * POST /auth/transfer-code/redeem. Credentials never travel in the URL.
 *
 * The browser calls the backend directly (like src/lib/auth/wallet-auth-api.ts)
 * so the backend's per-IP rate limit on redeem sees the real client IP rather
 * than a shared server egress address.
 */
import { API_BASE_URL } from '@/lib/config';

export interface RedeemedSession {
  api_key: string;
  user_id: number;
  privy_user_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  auth_method?: string | null;
}

export type RedeemResult =
  | { status: 'ok'; session: RedeemedSession }
  /** Unknown, expired or already-used code (backend gives one answer for all). */
  | { status: 'invalid' }
  /** Endpoint missing (old backend), down, or network error. */
  | { status: 'unavailable' };

const REDEEM_TIMEOUT_MS = 10000;

/** The `code` query parameter, if present. */
export function getSessionTransferCode(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return new URLSearchParams(window.location.search).get('code');
  } catch {
    return null;
  }
}

/** Exchange a transfer code for the session. Never logs the code or the key. */
export async function redeemSessionTransferCode(code: string): Promise<RedeemResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REDEEM_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/auth/transfer-code/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (response.ok) {
      const data = (await response.json()) as Partial<RedeemedSession>;
      if (typeof data.api_key === 'string' && data.api_key && data.user_id != null) {
        return { status: 'ok', session: data as RedeemedSession };
      }
      console.warn('[SessionTransfer] Redeem response was missing fields');
      return { status: 'invalid' };
    }

    if (response.status === 400 || response.status === 422) {
      return { status: 'invalid' };
    }

    console.warn('[SessionTransfer] Transfer-code redeem unavailable', {
      status: response.status,
    });
    return { status: 'unavailable' };
  } catch (error) {
    console.warn('[SessionTransfer] Transfer-code redeem failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Ask the person before signing this browser into an account it did not
 * choose. Uses the native dialog: page content cannot click it, and it blocks
 * until answered. Returns false if the dialog is unavailable.
 */
export function confirmAccountSwitch(message: string): boolean {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return false;
  }
  try {
    return window.confirm(message) === true;
  } catch {
    return false;
  }
}

/** Short human label for an account: email, then name, then id. */
export function accountLabel(
  user: { email?: string | null; display_name?: string | null; user_id?: unknown } | null
): string {
  if (!user) {
    return 'another account';
  }
  return user.email || user.display_name || `user ${String(user.user_id ?? '')}`.trim();
}
