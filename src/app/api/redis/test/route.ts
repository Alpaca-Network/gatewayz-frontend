import { NextResponse } from 'next/server';
import { getRedisClient, isRedisAvailable, getRedisStatus } from '@/lib/redis-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Test Redis connection and functionality
 * GET /api/redis/test
 */
export async function GET() {
  try {
    // Check if Redis is available
    const available = await isRedisAvailable();

    if (!available) {
      return NextResponse.json({
        success: false,
        error: 'Redis is not available',
        status: getRedisStatus(),
        timestamp: Date.now()
      }, { status: 503 });
    }

    const client = getRedisClient();

    if (!client) {
      return NextResponse.json({
        success: false,
        error: 'Redis client could not be initialized',
        status: getRedisStatus(),
        timestamp: Date.now()
      }, { status: 503 });
    }

    const testKey = 'test:connection:' + Date.now();
    const testValue = 'Hello from Gatewayz!';

    // Test SET operation
    await client.set(testKey, testValue, 'EX', 60); // Expire in 60 seconds

    // Test GET operation
    const retrievedValue = await client.get(testKey);

    // Test DEL operation
    await client.del(testKey);

    // Get Redis info
    const info = await client.info('server');
    const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1] || 'unknown';

    // Get some stats
    const dbSize = await client.dbsize();
    const ping = await client.ping();

    return NextResponse.json({
      success: true,
      message: 'Redis is working correctly',
      tests: {
        ping: ping === 'PONG',
        set: true,
        get: retrievedValue === testValue,
        delete: true,
      },
      status: getRedisStatus(),
      info: {
        version: redisVersion,
        database_size: dbSize,
        test_key: testKey,
        test_value_match: retrievedValue === testValue,
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[Redis Test] Error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: getRedisStatus(),
      timestamp: Date.now()
    }, { status: 500 });
  }
}
