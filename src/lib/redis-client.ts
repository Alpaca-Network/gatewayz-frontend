/**
 * Redis Client Configuration and Connection Management
 *
 * Provides singleton Redis client with:
 * - Automatic reconnection
 * - Error handling
 * - Connection pooling
 * - Environment-based configuration
 */

import Redis, { RedisOptions } from 'ioredis';

// Redis configuration from environment variables
const REDIS_CONFIG: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),

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

// Singleton Redis client instance
let redisClient: Redis | null = null;

/**
 * Get or create Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_CONFIG);

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
  try {
    const client = getRedisClient();
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
  const client = redisClient || getRedisClient();

  return {
    connected: client.status === 'connect' || client.status === 'ready',
    ready: client.status === 'ready',
    host: REDIS_CONFIG.host || 'localhost',
    port: REDIS_CONFIG.port || 6379,
  };
}

export default getRedisClient;
