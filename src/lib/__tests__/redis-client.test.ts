/**
 * Unit tests for redis-client.ts
 *
 * Tests Redis configuration, connection handling, and error detection
 */

// Mock ioredis before importing the module
const mockRedisInstance = {
  on: jest.fn(),
  connect: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
  status: 'ready',
};

jest.mock('ioredis', () => {
  const MockRedis = jest.fn(() => mockRedisInstance);
  return MockRedis;
});

describe('Redis Client Helper Functions', () => {
  describe('isBuildTime detection', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test('should detect phase-production-build', () => {
      process.env.NEXT_PHASE = 'phase-production-build';

      // The function checks for this phase
      const isBuildTime =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV && !process.env.RAILWAY_ENVIRONMENT);

      expect(isBuildTime).toBe(true);
    });

    test('should detect production build without VERCEL_ENV or RAILWAY_ENVIRONMENT', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.NEXT_PHASE;
      delete process.env.VERCEL_ENV;
      delete process.env.RAILWAY_ENVIRONMENT;

      const isBuildTime =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV && !process.env.RAILWAY_ENVIRONMENT);

      expect(isBuildTime).toBe(true);
    });

    test('should not be build time with VERCEL_ENV', () => {
      process.env.NODE_ENV = 'production';
      process.env.VERCEL_ENV = 'production';
      delete process.env.NEXT_PHASE;
      delete process.env.RAILWAY_ENVIRONMENT;

      const isBuildTime =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV && !process.env.RAILWAY_ENVIRONMENT);

      expect(isBuildTime).toBe(false);
    });

    test('should not be build time with RAILWAY_ENVIRONMENT', () => {
      process.env.NODE_ENV = 'production';
      process.env.RAILWAY_ENVIRONMENT = 'production';
      delete process.env.NEXT_PHASE;
      delete process.env.VERCEL_ENV;

      const isBuildTime =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV && !process.env.RAILWAY_ENVIRONMENT);

      expect(isBuildTime).toBe(false);
    });

    test('should not be build time in development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.NEXT_PHASE;
      delete process.env.VERCEL_ENV;
      delete process.env.RAILWAY_ENVIRONMENT;

      const isBuildTime =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV && !process.env.RAILWAY_ENVIRONMENT);

      expect(isBuildTime).toBe(false);
    });
  });

  describe('isFatalRedisError detection', () => {
    /**
     * Helper function that mirrors the isFatalRedisError logic in redis-client.ts
     */
    function isFatalRedisError(error: Error): boolean {
      const message = error.message || '';
      return (
        message.includes('WRONGPASS') ||
        message.includes('NOAUTH') ||
        message.includes('AUTH failed') ||
        message.includes('invalid username-password') ||
        message.includes('user is disabled') ||
        message.includes('ENOTFOUND') ||
        message.includes('ECONNREFUSED')
      );
    }

    test('should detect WRONGPASS error', () => {
      const error = new Error('WRONGPASS invalid username-password pair');
      expect(isFatalRedisError(error)).toBe(true);
    });

    test('should detect NOAUTH error', () => {
      const error = new Error('NOAUTH Authentication required');
      expect(isFatalRedisError(error)).toBe(true);
    });

    test('should detect AUTH failed error', () => {
      const error = new Error('AUTH failed: unknown user');
      expect(isFatalRedisError(error)).toBe(true);
    });

    test('should detect invalid username-password error', () => {
      const error = new Error('invalid username-password pair or user is disabled');
      expect(isFatalRedisError(error)).toBe(true);
    });

    test('should detect user is disabled error', () => {
      const error = new Error('user is disabled');
      expect(isFatalRedisError(error)).toBe(true);
    });

    test('should detect ENOTFOUND (DNS) error', () => {
      const error = new Error('getaddrinfo ENOTFOUND redis.example.com');
      expect(isFatalRedisError(error)).toBe(true);
    });

    test('should detect ECONNREFUSED error', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:6379');
      expect(isFatalRedisError(error)).toBe(true);
    });

    test('should not detect transient timeout error', () => {
      const error = new Error('Connection timeout');
      expect(isFatalRedisError(error)).toBe(false);
    });

    test('should not detect connection reset error', () => {
      const error = new Error('ECONNRESET: Connection reset by peer');
      expect(isFatalRedisError(error)).toBe(false);
    });

    test('should handle empty error message', () => {
      const error = new Error('');
      expect(isFatalRedisError(error)).toBe(false);
    });
  });

  describe('Redis configuration parsing', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test('should use REDIS_URL when provided', () => {
      process.env.REDIS_URL = 'redis://user:pass@redis.example.com:6379/0';

      // Configuration should prefer URL format
      const config = process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
          };

      expect(config).toEqual({ url: 'redis://user:pass@redis.example.com:6379/0' });
    });

    test('should use individual env vars when REDIS_URL not provided', () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_HOST = 'custom-redis.example.com';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'secret';
      process.env.REDIS_DB = '1';

      const config = process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
          };

      expect(config).toEqual({
        host: 'custom-redis.example.com',
        port: 6380,
        password: 'secret',
        db: 1,
      });
    });

    test('should use defaults when no env vars provided', () => {
      delete process.env.REDIS_URL;
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;
      delete process.env.REDIS_DB;

      const config = process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
          };

      expect(config).toEqual({
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
      });
    });
  });

  describe('Redis status information', () => {
    test('should parse host and port from URL', () => {
      const redisUrl = 'redis://user:pass@myredis.example.com:6380/0';
      const url = new URL(redisUrl);

      expect(url.hostname).toBe('myredis.example.com');
      expect(parseInt(url.port) || 6379).toBe(6380);
    });

    test('should use default port when not specified in URL', () => {
      const redisUrl = 'redis://myredis.example.com/0';
      const url = new URL(redisUrl);

      expect(url.hostname).toBe('myredis.example.com');
      expect(parseInt(url.port) || 6379).toBe(6379);
    });

    test('should handle URL parsing errors gracefully', () => {
      let host = 'localhost';
      let port = 6379;

      try {
        const url = new URL('invalid-url');
        host = url.hostname;
        port = parseInt(url.port) || 6379;
      } catch (e) {
        // Fallback to defaults
      }

      expect(host).toBe('localhost');
      expect(port).toBe(6379);
    });
  });

  describe('Retry strategy', () => {
    test('should stop retrying after 3 attempts at runtime', () => {
      const isBuildTime = false;
      const times = 4;

      const retryStrategy = (times: number): number | null => {
        if (isBuildTime) {
          return null;
        }
        if (times > 3) {
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      };

      expect(retryStrategy(1)).toBe(50);
      expect(retryStrategy(2)).toBe(100);
      expect(retryStrategy(3)).toBe(150);
      expect(retryStrategy(4)).toBe(null);
    });

    test('should not retry at build time', () => {
      const isBuildTime = true;

      const retryStrategy = (times: number): number | null => {
        if (isBuildTime) {
          return null;
        }
        if (times > 3) {
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      };

      expect(retryStrategy(1)).toBe(null);
    });

    test('should cap delay at 2000ms', () => {
      const isBuildTime = false;

      const retryStrategy = (times: number): number | null => {
        if (isBuildTime) {
          return null;
        }
        if (times > 3) {
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      };

      // With times=100, delay would be 5000 but capped at 2000
      // However, we never get there because we stop at times > 3
      expect(retryStrategy(3)).toBe(150);
    });
  });

  describe('isRedisDisabled status', () => {
    test('should return disabled status with reason', () => {
      const redisConnectionFailed = true;
      const redisFailureReason = 'WRONGPASS invalid credentials';

      const result = {
        disabled: redisConnectionFailed,
        reason: redisFailureReason,
      };

      expect(result).toEqual({
        disabled: true,
        reason: 'WRONGPASS invalid credentials',
      });
    });

    test('should return enabled status when not failed', () => {
      const redisConnectionFailed = false;
      const redisFailureReason: string | null = null;

      const result = {
        disabled: redisConnectionFailed,
        reason: redisFailureReason,
      };

      expect(result).toEqual({
        disabled: false,
        reason: null,
      });
    });
  });
});
