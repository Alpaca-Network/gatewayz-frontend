/**
 * Server-only helpers for shared-secret auth on internal API routes
 * (cache warming, cache invalidation, gateway refresh, webhooks).
 *
 * - Fail closed: if the secret env var is unset or empty, every request is
 *   rejected with 503 (misconfiguration), never accepted with a default.
 * - Constant-time comparison: both sides are SHA-256 hashed to equal-length
 *   buffers before crypto.timingSafeEqual, so neither content nor length
 *   leaks through timing.
 */
import crypto from 'crypto';

/** Constant-time string equality (safe for different-length inputs). */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

export type SecretAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/** Read a secret from env; returns null when unset or blank. */
export function getConfiguredSecret(envName: string): string | null {
  const value = process.env[envName];
  return value && value.trim() ? value : null;
}

/**
 * Verify `Authorization: Bearer <secret>` against the env var `envName`.
 */
export function verifyBearerSecret(
  authHeader: string | null | undefined,
  envName: string
): SecretAuthResult {
  const secret = getConfiguredSecret(envName);
  if (!secret) {
    console.error(`[secret-auth] ${envName} is not configured; rejecting request`);
    return { ok: false, status: 503, error: 'Endpoint not configured' };
  }
  if (!authHeader || !safeEqual(authHeader, `Bearer ${secret}`)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true };
}
