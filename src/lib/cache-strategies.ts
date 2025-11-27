/**
 * Cache Strategies and Utilities
 *
 * Provides high-level caching patterns and utilities:
 * - Cache-aside pattern
 * - Write-through pattern
 * - Cache invalidation
 * - TTL management
 * - Metrics tracking
 */

import { getRedisClient, isRedisAvailable } from './redis-client';
import type Redis from 'ioredis';

/**
 * Cache metrics for monitoring
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
}

// In-memory metrics tracking
const metrics: Record<string, CacheMetrics> = {};

/**
 * TTL configurations for different data types (in seconds)
 */
export const TTL = {
  // Model data - changes infrequently
  MODELS_ALL: 3600, // 1 hour
  MODELS_GATEWAY: 3600, // 1 hour
  MODEL_DETAIL: 3600, // 1 hour

  // Chat sessions - changes frequently during use
  SESSIONS_LIST: 300, // 5 minutes
  SESSION_DETAIL: 300, // 5 minutes
  CHAT_STATS: 600, // 10 minutes
  CHAT_SEARCH: 300, // 5 minutes

  // User data - semi-static
  USER_PROFILE: 600, // 10 minutes
  USER_TIER: 600, // 10 minutes
  USER_CREDITS: 300, // 5 minutes (shorter due to usage)

  // Analytics - computed periodically
  ACTIVITY_STATS: 1800, // 30 minutes
  ACTIVITY_DAILY: 1800, // 30 minutes
  ACTIVITY_MONTHLY: 3600, // 1 hour

  // Rankings - changes slowly
  RANKINGS_MODELS: 14400, // 4 hours
  RANKINGS_APPS: 14400, // 4 hours
  RANKINGS_CATEGORY: 14400, // 4 hours
} as const;

/**
 * Cache key prefixes for organization
 */
export const CACHE_PREFIX = {
  MODELS: 'models',
  SESSIONS: 'sessions',
  USER: 'user',
  STATS: 'stats',
  RANKINGS: 'rankings',
  ACTIVITY: 'activity',
} as const;

/**
 * Generate cache key with prefix
 */
export function cacheKey(prefix: string, ...parts: (string | number)[]): string {
  return [prefix, ...parts].join(':');
}

/**
 * Cache-aside pattern: Get from cache, or fetch and cache on miss
 *
 * @param key - Cache key
 * @param fetchFn - Function to fetch data on cache miss
 * @param ttl - Time to live in seconds
 * @param category - Metrics category (default: 'general')
 * @returns Cached or fetched data
 */
export async function cacheAside<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  category: string = 'general'
): Promise<T> {
  const redis = getRedisClient();

  try {
    // Check if Redis is available
    const available = await isRedisAvailable();
    if (!available) {
      console.warn('[Cache] Redis unavailable, bypassing cache');
      return await fetchFn();
    }

    // Try to get from cache
    const cached = await redis.get(key);

    if (cached) {
      // Cache hit
      trackMetric(category, 'hit');
      return JSON.parse(cached) as T;
    }

    // Cache miss - fetch data
    trackMetric(category, 'miss');
    const data = await fetchFn();

    // Store in cache (fire-and-forget to avoid blocking)
    redis.setex(key, ttl, JSON.stringify(data)).catch((error) => {
      console.error('[Cache] Failed to set cache:', error);
    });

    return data;
  } catch (error) {
    // Cache error - fallback to direct fetch
    console.error('[Cache] Error in cache-aside:', error);
    trackMetric(category, 'error');
    return await fetchFn();
  }
}

/**
 * Get value from cache only (no fetch on miss)
 *
 * @param key - Cache key
 * @returns Cached value or null
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const available = await isRedisAvailable();

    if (!available) {
      return null;
    }

    const cached = await redis.get(key);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch (error) {
    console.error('[Cache] Error getting from cache:', error);
    return null;
  }
}

/**
 * Set value in cache
 *
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttl - Time to live in seconds
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttl: number
): Promise<void> {
  try {
    const redis = getRedisClient();
    const available = await isRedisAvailable();

    if (!available) {
      return;
    }

    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('[Cache] Error setting cache:', error);
  }
}

/**
 * Invalidate cache by key or pattern
 *
 * @param keyOrPattern - Exact key or pattern (e.g., "models:*")
 */
export async function cacheInvalidate(keyOrPattern: string): Promise<number> {
  try {
    const redis = getRedisClient();
    const available = await isRedisAvailable();

    if (!available) {
      return 0;
    }

    // Check if pattern or exact key
    if (keyOrPattern.includes('*')) {
      // Pattern-based deletion
      const keys = await redis.keys(keyOrPattern);
      if (keys.length === 0) {
        return 0;
      }

      const pipeline = redis.pipeline();
      keys.forEach((key) => pipeline.del(key));
      await pipeline.exec();

      console.log(`[Cache] Invalidated ${keys.length} keys matching: ${keyOrPattern}`);
      return keys.length;
    } else {
      // Single key deletion
      const deleted = await redis.del(keyOrPattern);
      if (deleted > 0) {
        console.log(`[Cache] Invalidated key: ${keyOrPattern}`);
      }
      return deleted;
    }
  } catch (error) {
    console.error('[Cache] Error invalidating cache:', error);
    return 0;
  }
}

/**
 * Invalidate multiple cache keys
 *
 * @param keys - Array of cache keys to invalidate
 */
export async function cacheInvalidateMultiple(keys: string[]): Promise<number> {
  try {
    const redis = getRedisClient();
    const available = await isRedisAvailable();

    if (!available || keys.length === 0) {
      return 0;
    }

    const deleted = await redis.del(...keys);
    console.log(`[Cache] Invalidated ${deleted} keys`);
    return deleted;
  } catch (error) {
    console.error('[Cache] Error invalidating multiple keys:', error);
    return 0;
  }
}

/**
 * Get cache TTL for a key
 *
 * @param key - Cache key
 * @returns TTL in seconds, or -1 if no TTL, or -2 if key doesn't exist
 */
export async function cacheTTL(key: string): Promise<number> {
  try {
    const redis = getRedisClient();
    return await redis.ttl(key);
  } catch (error) {
    console.error('[Cache] Error getting TTL:', error);
    return -2;
  }
}

/**
 * Batch get multiple keys from cache
 *
 * @param keys - Array of cache keys
 * @returns Map of key to value (null if not found)
 */
export async function cacheMGet<T>(keys: string[]): Promise<Map<string, T | null>> {
  const result = new Map<string, T | null>();

  try {
    if (keys.length === 0) {
      return result;
    }

    const redis = getRedisClient();
    const available = await isRedisAvailable();

    if (!available) {
      keys.forEach((key) => result.set(key, null));
      return result;
    }

    const values = await redis.mget(...keys);

    keys.forEach((key, index) => {
      const value = values[index];
      result.set(key, value ? (JSON.parse(value) as T) : null);
    });

    return result;
  } catch (error) {
    console.error('[Cache] Error in batch get:', error);
    keys.forEach((key) => result.set(key, null));
    return result;
  }
}

/**
 * Track cache metrics
 */
function trackMetric(category: string, type: 'hit' | 'miss' | 'error'): void {
  if (!metrics[category]) {
    metrics[category] = { hits: 0, misses: 0, errors: 0, hitRate: 0 };
  }

  const metric = metrics[category];

  if (type === 'hit') {
    metric.hits++;
  } else if (type === 'miss') {
    metric.misses++;
  } else if (type === 'error') {
    metric.errors++;
  }

  // Calculate hit rate
  const total = metric.hits + metric.misses;
  metric.hitRate = total > 0 ? metric.hits / total : 0;
}

/**
 * Get cache metrics for monitoring
 *
 * @param category - Metrics category (optional, returns all if not specified)
 */
export function getCacheMetrics(category?: string): CacheMetrics | Record<string, CacheMetrics> {
  if (category) {
    return metrics[category] || { hits: 0, misses: 0, errors: 0, hitRate: 0 };
  }
  return { ...metrics };
}

/**
 * Reset cache metrics
 */
export function resetCacheMetrics(category?: string): void {
  if (category) {
    delete metrics[category];
  } else {
    Object.keys(metrics).forEach((key) => delete metrics[key]);
  }
}

/**
 * Warm cache with data
 *
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttl - Time to live in seconds
 */
export async function warmCache<T>(
  key: string,
  value: T,
  ttl: number
): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.setex(key, ttl, JSON.stringify(value));
    console.log(`[Cache] Warmed cache for key: ${key}`);
  } catch (error) {
    console.error('[Cache] Error warming cache:', error);
  }
}

/**
 * Check if key exists in cache
 *
 * @param key - Cache key
 * @returns true if key exists, false otherwise
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('[Cache] Error checking existence:', error);
    return false;
  }
}

/**
 * Get all cache keys matching pattern
 *
 * @param pattern - Key pattern (e.g., "models:*")
 * @returns Array of matching keys
 */
export async function cacheKeys(pattern: string): Promise<string[]> {
  try {
    const redis = getRedisClient();
    return await redis.keys(pattern);
  } catch (error) {
    console.error('[Cache] Error getting keys:', error);
    return [];
  }
}
