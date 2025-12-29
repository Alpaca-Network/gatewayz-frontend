/**
 * Tests for cache-strategies.ts
 * Tests cache patterns, TTL management, and metrics tracking
 */

import {
  cacheKey,
  cacheAside,
  cacheStaleWhileRevalidate,
  cacheGet,
  cacheSet,
  cacheInvalidate,
  cacheInvalidateMultiple,
  cacheTTL,
  cacheMGet,
  getCacheMetrics,
  resetCacheMetrics,
  warmCache,
  cacheExists,
  cacheKeys,
  TTL,
  CACHE_PREFIX,
} from '../cache-strategies';
import * as redisClient from '../redis-client';

// Mock redis-client
jest.mock('../redis-client', () => ({
  getRedisClient: jest.fn(),
  isRedisAvailable: jest.fn(),
}));

// Mock console methods (suppress output but allow tracking)
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('cache-strategies', () => {
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    mget: jest.fn(),
    exists: jest.fn(),
    keys: jest.fn(),
    pipeline: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient.getRedisClient as jest.Mock).mockReturnValue(mockRedis);
    (redisClient.isRedisAvailable as jest.Mock).mockResolvedValue(true);
    resetCacheMetrics();

    // Setup pipeline mock
    const mockPipelineExec = jest.fn().mockResolvedValue([]);
    mockRedis.pipeline.mockReturnValue({
      del: jest.fn().mockReturnThis(),
      exec: mockPipelineExec,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cacheKey', () => {
    it('should generate cache key with prefix and parts', () => {
      const key = cacheKey('models', 'openrouter', '123');
      expect(key).toBe('models:openrouter:123');
    });

    it('should handle single part', () => {
      const key = cacheKey('user');
      expect(key).toBe('user');
    });

    it('should handle numeric parts', () => {
      const key = cacheKey('session', 12345);
      expect(key).toBe('session:12345');
    });

    it('should handle mixed string and number parts', () => {
      const key = cacheKey('models', 'gateway', 100, 'detail');
      expect(key).toBe('models:gateway:100:detail');
    });
  });

  describe('cacheAside', () => {
    it('should return cached data on cache hit', async () => {
      const cachedData = { id: 1, name: 'Test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const fetchFn = jest.fn();
      const result = await cacheAside('test-key', fetchFn, 300);

      expect(result).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache data on cache miss', async () => {
      const freshData = { id: 2, name: 'Fresh' };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const fetchFn = jest.fn().mockResolvedValue(freshData);
      const result = await cacheAside('test-key', fetchFn, 300);

      expect(result).toEqual(freshData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(fetchFn).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 300, JSON.stringify(freshData));
    });

    it('should bypass cache when Redis is unavailable', async () => {
      (redisClient.isRedisAvailable as jest.Mock).mockResolvedValue(false);

      const freshData = { id: 3, name: 'Bypass' };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await cacheAside('test-key', fetchFn, 300);

      expect(result).toEqual(freshData);
      expect(fetchFn).toHaveBeenCalled();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should bypass cache when Redis client is null', async () => {
      (redisClient.getRedisClient as jest.Mock).mockReturnValue(null);

      const freshData = { id: 4, name: 'No Redis' };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await cacheAside('test-key', fetchFn, 300);

      expect(result).toEqual(freshData);
      expect(fetchFn).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const freshData = { id: 5, name: 'Error Recovery' };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await cacheAside('test-key', fetchFn, 300);

      expect(result).toEqual(freshData);
      // Error is logged but we got the data from fetchFn
    });

    it('should handle JSON parse errors', async () => {
      mockRedis.get.mockResolvedValue('invalid{json');

      const freshData = { id: 6, name: 'Parse Error' };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await cacheAside('test-key', fetchFn, 300);

      expect(result).toEqual(freshData);
      // Parse error is logged but we got fresh data
    });

    it('should track cache metrics', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'hit' }));

      await cacheAside('test-key', jest.fn(), 300, 'test-category');

      const metrics = getCacheMetrics('test-category');
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(0);
    });

    it('should handle availability check errors', async () => {
      (redisClient.isRedisAvailable as jest.Mock).mockRejectedValue(new Error('Check failed'));

      const freshData = { id: 7, name: 'Availability Error' };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await cacheAside('test-key', fetchFn, 300);

      expect(result).toEqual(freshData);
      // Warning is logged but we got fresh data
    });
  });

  describe('cacheStaleWhileRevalidate', () => {
    it('should return fresh cached data immediately', async () => {
      const cachedData = { id: 1, name: 'Fresh' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
      mockRedis.ttl.mockResolvedValue(100); // Still fresh

      const fetchFn = jest.fn();
      const result = await cacheStaleWhileRevalidate('test-key', fetchFn, 300, 600);

      expect(result).toEqual(cachedData);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should return stale data and revalidate in background', async () => {
      const staleData = { id: 2, name: 'Stale' };
      mockRedis.get.mockResolvedValue(JSON.stringify(staleData));
      mockRedis.ttl.mockResolvedValue(-1); // Expired but still in cache

      const fetchFn = jest.fn().mockResolvedValue({ id: 2, name: 'Fresh' });
      const result = await cacheStaleWhileRevalidate('test-key', fetchFn, 300, 600);

      expect(result).toEqual(staleData);

      // Allow background revalidation to complete
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('should fetch and cache on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.ttl.mockResolvedValue(-2); // Key doesn't exist

      const freshData = { id: 3, name: 'New' };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await cacheStaleWhileRevalidate('test-key', fetchFn, 300, 600);

      expect(result).toEqual(freshData);
      expect(fetchFn).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 900, JSON.stringify(freshData));
    });

    it('should bypass cache when Redis is unavailable', async () => {
      (redisClient.isRedisAvailable as jest.Mock).mockResolvedValue(false);

      const freshData = { id: 4, name: 'Bypass' };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await cacheStaleWhileRevalidate('test-key', fetchFn, 300, 600);

      expect(result).toEqual(freshData);
    });

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const freshData = { id: 5, name: 'Error' };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await cacheStaleWhileRevalidate('test-key', fetchFn, 300, 600);

      expect(result).toEqual(freshData);
      // Error is logged internally
    });
  });

  describe('cacheGet', () => {
    it('should get cached value', async () => {
      const cachedData = { id: 1, name: 'Test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await cacheGet('test-key');

      expect(result).toEqual(cachedData);
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheGet('test-key');

      expect(result).toBeNull();
    });

    it('should return null when Redis is unavailable', async () => {
      (redisClient.isRedisAvailable as jest.Mock).mockResolvedValue(false);

      const result = await cacheGet('test-key');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheGet('test-key');

      expect(result).toBeNull();
      // Error is logged internally
    });
  });

  describe('cacheSet', () => {
    it('should set value in cache', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const data = { id: 1, name: 'Test' };
      await cacheSet('test-key', data, 300);

      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 300, JSON.stringify(data));
    });

    it('should do nothing when Redis is unavailable', async () => {
      (redisClient.isRedisAvailable as jest.Mock).mockResolvedValue(false);

      await cacheSet('test-key', { data: 'test' }, 300);

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should handle errors silently', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await cacheSet('test-key', { data: 'test' }, 300);

      // Error is logged internally
    });
  });

  describe('cacheInvalidate', () => {
    it('should delete single key', async () => {
      mockRedis.del.mockResolvedValue(1);

      const deleted = await cacheInvalidate('test-key');

      expect(deleted).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should delete keys by pattern', async () => {
      const keys = ['models:1', 'models:2', 'models:3'];
      mockRedis.keys.mockResolvedValue(keys);

      const deleted = await cacheInvalidate('models:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('models:*');
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it('should return 0 when no keys match pattern', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const deleted = await cacheInvalidate('models:*');

      expect(deleted).toBe(0);
    });

    it('should return 0 when Redis is unavailable', async () => {
      (redisClient.isRedisAvailable as jest.Mock).mockResolvedValue(false);

      const deleted = await cacheInvalidate('test-key');

      expect(deleted).toBe(0);
    });

    it('should handle errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const deleted = await cacheInvalidate('test-key');

      expect(deleted).toBe(0);
      // Error is logged internally
    });
  });

  describe('cacheInvalidateMultiple', () => {
    it('should delete multiple keys', async () => {
      mockRedis.del.mockResolvedValue(3);

      const deleted = await cacheInvalidateMultiple(['key1', 'key2', 'key3']);

      expect(deleted).toBe(3);
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should return 0 for empty array', async () => {
      const deleted = await cacheInvalidateMultiple([]);

      expect(deleted).toBe(0);
    });

    it('should handle errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const deleted = await cacheInvalidateMultiple(['key1', 'key2']);

      expect(deleted).toBe(0);
      // Error is logged internally
    });
  });

  describe('cacheTTL', () => {
    it('should return TTL for existing key', async () => {
      mockRedis.ttl.mockResolvedValue(300);

      const ttl = await cacheTTL('test-key');

      expect(ttl).toBe(300);
    });

    it('should return -1 for key without TTL', async () => {
      mockRedis.ttl.mockResolvedValue(-1);

      const ttl = await cacheTTL('test-key');

      expect(ttl).toBe(-1);
    });

    it('should return -2 for non-existent key', async () => {
      mockRedis.ttl.mockResolvedValue(-2);

      const ttl = await cacheTTL('test-key');

      expect(ttl).toBe(-2);
    });

    it('should handle errors', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis error'));

      const ttl = await cacheTTL('test-key');

      expect(ttl).toBe(-2);
      // Error is logged internally
    });
  });

  describe('cacheMGet', () => {
    it('should get multiple keys', async () => {
      const values = [JSON.stringify({ id: 1 }), JSON.stringify({ id: 2 }), null];
      mockRedis.mget.mockResolvedValue(values);

      const result = await cacheMGet(['key1', 'key2', 'key3']);

      expect(result.size).toBe(3);
      expect(result.get('key1')).toEqual({ id: 1 });
      expect(result.get('key2')).toEqual({ id: 2 });
      expect(result.get('key3')).toBeNull();
    });

    it('should return empty map for empty keys array', async () => {
      const result = await cacheMGet([]);

      expect(result.size).toBe(0);
    });

    it('should handle errors', async () => {
      mockRedis.mget.mockRejectedValue(new Error('Redis error'));

      const result = await cacheMGet(['key1', 'key2']);

      expect(result.get('key1')).toBeNull();
      expect(result.get('key2')).toBeNull();
      // Error is logged internally
    });
  });

  describe('warmCache', () => {
    it('should warm cache with data', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const data = { id: 1, name: 'Warm' };
      await warmCache('test-key', data, 300);

      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 300, JSON.stringify(data));
      // Success is logged internally
    });

    it('should do nothing when Redis is null', async () => {
      (redisClient.getRedisClient as jest.Mock).mockReturnValue(null);

      await warmCache('test-key', { data: 'test' }, 300);

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await warmCache('test-key', { data: 'test' }, 300);

      // Error is logged internally
    });
  });

  describe('cacheExists', () => {
    it('should return true if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const exists = await cacheExists('test-key');

      expect(exists).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const exists = await cacheExists('test-key');

      expect(exists).toBe(false);
    });

    it('should return false when Redis is null', async () => {
      (redisClient.getRedisClient as jest.Mock).mockReturnValue(null);

      const exists = await cacheExists('test-key');

      expect(exists).toBe(false);
    });

    it('should handle errors', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis error'));

      const exists = await cacheExists('test-key');

      expect(exists).toBe(false);
      // Error is logged internally
    });
  });

  describe('cacheKeys', () => {
    it('should return matching keys', async () => {
      const keys = ['models:1', 'models:2', 'models:3'];
      mockRedis.keys.mockResolvedValue(keys);

      const result = await cacheKeys('models:*');

      expect(result).toEqual(keys);
    });

    it('should return empty array when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await cacheKeys('nonexistent:*');

      expect(result).toEqual([]);
    });

    it('should return empty array when Redis is null', async () => {
      (redisClient.getRedisClient as jest.Mock).mockReturnValue(null);

      const result = await cacheKeys('test:*');

      expect(result).toEqual([]);
    });

    it('should handle errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await cacheKeys('test:*');

      expect(result).toEqual([]);
      // Error is logged internally
    });
  });

  describe('Cache Metrics', () => {
    it('should track hits and misses', async () => {
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ data: 'hit' }))
        .mockResolvedValueOnce(null);

      await cacheAside('key1', jest.fn(), 300, 'test');
      await cacheAside('key2', jest.fn().mockResolvedValue({}), 300, 'test');

      const metrics = getCacheMetrics('test');
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBe(0.5);
    });

    it('should track errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      await cacheAside('key1', jest.fn().mockResolvedValue({}), 300, 'test');

      const metrics = getCacheMetrics('test');
      expect(metrics.errors).toBe(1);
    });

    it('should reset metrics by category', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));

      // Execute cacheAside to increment the hit counter
      await cacheAside('key1', jest.fn(), 300, 'category1');

      // Verify metrics were incremented
      const metricsBeforeReset = getCacheMetrics('category1');
      expect(metricsBeforeReset.hits).toBe(1);

      // Reset metrics for this category
      resetCacheMetrics('category1');

      // Verify metrics were reset
      const metricsAfterReset = getCacheMetrics('category1');
      expect(metricsAfterReset.hits).toBe(0);
    });

    it('should reset all metrics', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));

      await cacheAside('key1', jest.fn(), 300, 'cat1');
      await cacheAside('key2', jest.fn(), 300, 'cat2');

      resetCacheMetrics();

      const metrics1 = getCacheMetrics('cat1');
      const metrics2 = getCacheMetrics('cat2');

      expect(metrics1.hits).toBe(0);
      expect(metrics2.hits).toBe(0);
    });
  });

  describe('TTL Constants', () => {
    it('should define model TTLs', () => {
      expect(TTL.MODELS_ALL).toBe(14400);
      expect(TTL.MODELS_GATEWAY).toBe(14400);
      expect(TTL.MODEL_DETAIL).toBe(14400);
    });

    it('should define session TTLs', () => {
      expect(TTL.SESSIONS_LIST).toBe(300);
      expect(TTL.SESSION_DETAIL).toBe(300);
      expect(TTL.CHAT_STATS).toBe(600);
    });

    it('should define user data TTLs', () => {
      expect(TTL.USER_PROFILE).toBe(600);
      expect(TTL.USER_TIER).toBe(600);
      expect(TTL.USER_CREDITS).toBe(300);
    });
  });

  describe('Cache Prefixes', () => {
    it('should define cache prefixes', () => {
      expect(CACHE_PREFIX.MODELS).toBe('models');
      expect(CACHE_PREFIX.SESSIONS).toBe('sessions');
      expect(CACHE_PREFIX.USER).toBe('user');
      expect(CACHE_PREFIX.STATS).toBe('stats');
      expect(CACHE_PREFIX.RANKINGS).toBe('rankings');
    });
  });
});
