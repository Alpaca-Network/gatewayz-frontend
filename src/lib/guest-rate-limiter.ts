/**
 * Guest Rate Limiter
 * Server-side rate limiting for guest (unauthenticated) chat requests
 * Limits guests to 3 chat messages per 24-hour period per IP address
 */

const GUEST_DAILY_LIMIT = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory store for rate limiting
// In production, consider using Redis for distributed rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();

  // Only run cleanup periodically
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanup = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart >= WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get the client's IP address from the request
 * Handles various proxy headers and edge cases
 */
export function getClientIP(request: Request): string {
  // Check common proxy headers in order of precedence
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'x-client-ip',
    'x-cluster-client-ip',
    'true-client-ip',
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs; take the first one (client)
      const ip = value.split(',')[0].trim();
      if (ip && ip !== 'unknown') {
        return ip;
      }
    }
  }

  // Fallback to a generic identifier if no IP found
  // This shouldn't happen in production but handles edge cases
  return 'unknown-client';
}

/**
 * Check if a guest IP has exceeded their daily rate limit
 * Returns the current usage info without incrementing the counter
 */
export function checkGuestRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
  limit: number;
} {
  cleanupExpiredEntries();

  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // No entry or window expired - guest has full limit available
    return {
      allowed: true,
      remaining: GUEST_DAILY_LIMIT,
      resetInMs: WINDOW_MS,
      limit: GUEST_DAILY_LIMIT,
    };
  }

  const remaining = Math.max(0, GUEST_DAILY_LIMIT - entry.count);
  const resetInMs = entry.windowStart + WINDOW_MS - now;

  return {
    allowed: entry.count < GUEST_DAILY_LIMIT,
    remaining,
    resetInMs,
    limit: GUEST_DAILY_LIMIT,
  };
}

/**
 * Increment the guest rate limit counter for an IP
 * Returns the updated usage info
 */
export function incrementGuestRateLimit(ip: string): {
  success: boolean;
  remaining: number;
  resetInMs: number;
  limit: number;
} {
  cleanupExpiredEntries();

  const now = Date.now();
  let entry = rateLimitStore.get(ip);

  // If no entry or window expired, start a new window
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    entry = {
      count: 0,
      windowStart: now,
    };
  }

  // Check if limit would be exceeded
  if (entry.count >= GUEST_DAILY_LIMIT) {
    const resetInMs = entry.windowStart + WINDOW_MS - now;
    return {
      success: false,
      remaining: 0,
      resetInMs,
      limit: GUEST_DAILY_LIMIT,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(ip, entry);

  const remaining = Math.max(0, GUEST_DAILY_LIMIT - entry.count);
  const resetInMs = entry.windowStart + WINDOW_MS - now;

  return {
    success: true,
    remaining,
    resetInMs,
    limit: GUEST_DAILY_LIMIT,
  };
}

/**
 * Get human-readable time until rate limit reset
 */
export function formatResetTime(resetInMs: number): string {
  const hours = Math.floor(resetInMs / (60 * 60 * 1000));
  const minutes = Math.floor((resetInMs % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Reset rate limit for testing purposes
 * DO NOT use in production
 */
export function resetRateLimitForTesting(ip: string): void {
  rateLimitStore.delete(ip);
}

/**
 * Clear all rate limits for testing purposes
 * DO NOT use in production
 */
export function clearAllRateLimitsForTesting(): void {
  rateLimitStore.clear();
}

/**
 * Get the guest daily limit constant
 */
export function getGuestDailyLimit(): number {
  return GUEST_DAILY_LIMIT;
}
