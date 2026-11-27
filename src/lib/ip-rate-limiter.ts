/**
 * Fixed-window per-key rate limiter for server routes.
 *
 * Uses Redis (INCR + PEXPIRE) when available so the limit is shared across
 * instances, and falls back to a per-instance in-memory window otherwise
 * (same approach as guest-rate-limiter.ts). Keys live under `ratelimit:`,
 * which is deliberately NOT one of the cache prefixes the cache admin
 * endpoint may invalidate.
 */
import { getRedisClient } from '@/lib/redis-client';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
  limit: number;
}

interface Entry {
  count: number;
  windowStart: number;
}

const memoryStore = new Map<string, Entry>();
let lastCleanup = Date.now();

function memoryHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (now - lastCleanup > windowMs) {
    lastCleanup = now;
    for (const [k, e] of memoryStore.entries()) {
      if (now - e.windowStart >= windowMs) memoryStore.delete(k);
    }
  }

  let entry = memoryStore.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 0, windowStart: now };
  }
  entry.count++;
  memoryStore.set(key, entry);

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetInMs: entry.windowStart + windowMs - now,
    limit,
  };
}

/**
 * Record one hit for `key` and report whether it is within `limit` per `windowMs`.
 */
export async function rateLimitHit(
  scope: string,
  id: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = `ratelimit:${scope}:${id}`;

  const redis = getRedisClient();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }
      const ttl = await redis.pttl(key);
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetInMs: ttl > 0 ? ttl : windowMs,
        limit,
      };
    } catch (error) {
      console.warn('[RateLimit] Redis unavailable, using in-memory limiter:', error instanceof Error ? error.message : error);
    }
  }

  return memoryHit(key, limit, windowMs);
}

/** Testing only. */
export function clearRateLimitsForTesting(): void {
  memoryStore.clear();
}
