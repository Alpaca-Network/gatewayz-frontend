/**
 * Redis Client Configuration and Connection Management
 *
 * Provides singleton Redis client with:
 * - Automatic reconnection
 * - Error handling
 * - Connection pooling
 * - Environment-based configuration
 */

import type { RedisOptions } from 'ioredis';

// Only import Redis on the server side
let Redis: typeof import('ioredis').default | null = null;
if (typeof window === 'undefined') {
  Redis = require('ioredis');
}

/**
 * Get Redis connection options (shared between URL and object configs)
 */
function getRedisOptions(): Partial<RedisOptions> {
  return {
    // Connection settings
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },

    // Performance settings
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,

    // Timeouts
    connectTimeout: 10000,
    commandTimeout: 5000,

    // Connection pooling
    lazyConnect: false,
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

/**
 * Get or create Redis client singleton
 * Returns null if running in browser environment
 */
export function getRedisClient(): import('ioredis').default | null {
  // Return null if running in browser
  if (typeof window !== 'undefined' || !Redis || !REDIS_CONFIG) {
    return null;
  }

  if (!redisClient) {
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
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Ready to accept commands');
    });

    redisClient.on('error', (error) => {
      console.error('[Redis] Connection error:', error);
    });

    redisClient.on('close', () => {
      console.log('[Redis] Connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log('[Redis] Attempting to reconnect...');
    });
  }

  return redisClient;
}

/**
 * Check if Redis is available and connected
 */
export async function isRedisAvailable(): Promise<boolean> {
  // Return false if running in browser
  if (typeof window !== 'undefined') {
    return false;
  }

  try {
    const client = getRedisClient();
    if (!client) {
      return false;
    }
    await client.ping();
    return true;
  } catch (error) {
    console.error('[Redis] Availability check failed:', error);
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
 * Redis client status information
 */
export function getRedisStatus(): {
  connected: boolean;
  ready: boolean;
  host: string;
  port: number;
} {
  // Return disconnected status if running in browser
  if (typeof window !== 'undefined' || !REDIS_CONFIG) {
    return {
      connected: false,
      ready: false,
      host: 'localhost',
      port: 6379,
    };
  }

  const client = redisClient || getRedisClient();

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
  };
}

export default getRedisClient;
