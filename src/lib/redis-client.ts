/**
 * Redis Client Configuration and Connection Management
 *
 * Provides singleton Redis client with:
 * - Automatic reconnection
 * - Error handling
 * - Connection pooling
 * - Environment-based configuration
 * - Graceful degradation during build time (no Redis required)
 */

import type { RedisOptions } from 'ioredis';

// Only import Redis on the server side
let Redis: typeof import('ioredis').default | null = null;
if (typeof window === 'undefined') {
  Redis = require('ioredis');
}

// Track if Redis connection has permanently failed (e.g., auth errors)
// This prevents repeated connection attempts during build/runtime
let redisConnectionFailed = false;
let redisFailureReason: string | null = null;

/**
 * Check if we're in a build environment where Redis might not be available
 * Only checks NEXT_PHASE to avoid incorrectly disabling retries in production
 * environments other than Vercel/Railway (AWS, GCP, Azure, self-hosted, etc.)
 */
function isBuildTime(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * Get Redis connection options (shared between URL and object configs)
 */
function getRedisOptions(): Partial<RedisOptions> {
  return {
    // Connection settings - use lazyConnect to prevent immediate connection
    // This allows graceful handling when Redis is unavailable at build time
    lazyConnect: true,

    retryStrategy: (times: number) => {
      // During build time, don't retry at all
      if (isBuildTime()) {
        return null; // Stop retrying
      }
      // At runtime, limit retries to avoid infinite loops with bad credentials
      if (times > 3) {
        return null; // Stop retrying after 3 attempts
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },

    // Performance settings
    maxRetriesPerRequest: 1, // Reduced to fail fast on auth errors
    enableReadyCheck: true,

    // Timeouts - shorter for faster failure detection
    connectTimeout: 5000,
    commandTimeout: 3000,
  };
}

/**
 * Parse Redis configuration from environment variables
 * Supports both REDIS_URL and individual REDIS_HOST/PORT/PASSWORD variables
 */
function getRedisConfig(): { url: string; options: RedisOptions } | RedisOptions {
  const options = getRedisOptions();

  // Option 1: Use REDIS_URL if provided (Railway, Heroku format)
  // Format: redis://[username]:[password]@[host]:[port]/[db]
  if (process.env.REDIS_URL) {
    return {
      url: process.env.REDIS_URL,
      options: options as RedisOptions,
    };
  }

  // Option 2: Use individual environment variables
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    ...options,
  };
}

// Redis configuration from environment variables (only on server)
let REDIS_CONFIG: ReturnType<typeof getRedisConfig> | null = null;
if (typeof window === 'undefined') {
  REDIS_CONFIG = getRedisConfig();
}

// Singleton Redis client instance
let redisClient: import('ioredis').default | null = null;
// Flag to prevent concurrent cleanup operations
let isCleaningUp = false;

/**
 * Check if an error is a fatal authentication/configuration error
 * These errors won't be resolved by retrying
 */
function isFatalRedisError(error: Error): boolean {
  const message = error.message || '';
  return (
    message.includes('WRONGPASS') ||
    message.includes('NOAUTH') ||
    message.includes('AUTH failed') ||
    message.includes('invalid username-password') ||
    message.includes('user is disabled') ||
    message.includes('ENOTFOUND') || // DNS resolution failed
    message.includes('ECONNREFUSED') // Connection refused (no server)
  );
}

/**
 * Get or create Redis client singleton
 * Returns null if running in browser environment or if Redis is unavailable
 */
export function getRedisClient(): import('ioredis').default | null {
  // Return null if running in browser
  if (typeof window !== 'undefined' || !Redis || !REDIS_CONFIG) {
    return null;
  }

  // If we've already determined Redis connection has permanently failed, don't retry
  if (redisConnectionFailed) {
    return null;
  }

  if (!redisClient) {
    try {
      // Create Redis client based on config type
      if ('url' in REDIS_CONFIG) {
        // URL format with options
        redisClient = new Redis(REDIS_CONFIG.url, REDIS_CONFIG.options);
      } else {
        // Object format
        redisClient = new Redis(REDIS_CONFIG);
      }

      // Connection event handlers
      redisClient.on('connect', () => {
        console.log('[Redis] Connected successfully');
        // Reset failure state on successful connection
        redisConnectionFailed = false;
        redisFailureReason = null;
      });

      redisClient.on('ready', () => {
        console.log('[Redis] Ready to accept commands');
      });

      redisClient.on('error', (error: Error) => {
        console.error('[Redis] Connection error:', error.message);

        // Mark as permanently failed for fatal errors
        if (isFatalRedisError(error)) {
          redisConnectionFailed = true;
          redisFailureReason = error.message;
          console.warn(`[Redis] Fatal error detected, disabling Redis: ${error.message}`);

          // Clean up the failed client (with guard against concurrent cleanup)
          if (redisClient && !isCleaningUp) {
            isCleaningUp = true;
            const clientToCleanup = redisClient;
            redisClient = null;
            try {
              clientToCleanup.disconnect();
            } catch {
              // Ignore disconnect errors
            } finally {
              isCleaningUp = false;
            }
          }
        }
      });

      redisClient.on('close', () => {
        console.log('[Redis] Connection closed');
      });

      redisClient.on('reconnecting', () => {
        console.log('[Redis] Attempting to reconnect...');
      });
    } catch (error) {
      console.error('[Redis] Failed to create client:', error);
      redisConnectionFailed = true;
      redisFailureReason = error instanceof Error ? error.message : 'Unknown error';
      return null;
    }
  }

  return redisClient;
}

/**
 * Check if Redis is available and connected
 * This function handles connection failures gracefully
 */
export async function isRedisAvailable(): Promise<boolean> {
  // Return false if running in browser
  if (typeof window !== 'undefined') {
    return false;
  }

  // Return false if we've already determined Redis has failed
  if (redisConnectionFailed) {
    return false;
  }

  try {
    const client = getRedisClient();
    if (!client) {
      return false;
    }

    // With lazyConnect, we need to explicitly connect first
    // This will throw on auth errors, which we catch below
    if (client.status === 'wait') {
      await client.connect();
    }

    await client.ping();
    return true;
  } catch (error) {
    const err = error as Error;
    console.error('[Redis] Availability check failed:', err.message);

    // Mark as permanently failed for fatal errors
    if (isFatalRedisError(err)) {
      redisConnectionFailed = true;
      redisFailureReason = err.message;
      console.warn(`[Redis] Fatal error during availability check, disabling Redis: ${err.message}`);

      // Clean up the failed client
      if (redisClient) {
        try {
          redisClient.disconnect();
        } catch {
          // Ignore disconnect errors
        }
        redisClient = null;
      }
    }

    return false;
  }
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Connection closed gracefully');
  }
}

/**
 * Check if Redis has been disabled due to fatal errors
 */
export function isRedisDisabled(): { disabled: boolean; reason: string | null } {
  return {
    disabled: redisConnectionFailed,
    reason: redisFailureReason,
  };
}

/**
 * Redis client status information
 */
export function getRedisStatus(): {
  connected: boolean;
  ready: boolean;
  host: string;
  port: number;
  disabled: boolean;
  disabledReason: string | null;
} {
  // Return disconnected status if running in browser
  if (typeof window !== 'undefined' || !REDIS_CONFIG) {
    return {
      connected: false,
      ready: false,
      host: 'localhost',
      port: 6379,
      disabled: redisConnectionFailed,
      disabledReason: redisFailureReason,
    };
  }

  // Don't try to get client if Redis is disabled
  const client = redisConnectionFailed ? null : (redisClient || getRedisClient());

  // Extract host and port from config
  let host = 'localhost';
  let port = 6379;

  if ('url' in REDIS_CONFIG) {
    // Parse from URL format
    try {
      const url = new URL(REDIS_CONFIG.url);
      host = url.hostname;
      port = parseInt(url.port) || 6379;
    } catch (e) {
      // Fallback to defaults
    }
  } else {
    host = REDIS_CONFIG.host || 'localhost';
    port = REDIS_CONFIG.port || 6379;
  }

  return {
    connected: client ? (client.status === 'connect' || client.status === 'ready') : false,
    ready: client ? client.status === 'ready' : false,
    host,
    port,
    disabled: redisConnectionFailed,
    disabledReason: redisFailureReason,
  };
}

export default getRedisClient;
