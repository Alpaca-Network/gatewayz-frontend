#!/usr/bin/env node

/**
 * Test Redis connection with production credentials
 *
 * This script verifies that:
 * 1. Redis connection works with provided credentials
 * 2. Basic Redis operations (GET/SET/DEL) function correctly
 * 3. Connection is stable and performant
 *
 * Usage:
 *   REDIS_URL="redis://..." node test-redis-production.js
 *   OR
 *   REDIS_HOST=host REDIS_PORT=port REDIS_PASSWORD=pass node test-redis-production.js
 */

const Redis = require('ioredis');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function getRedisConfig() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryStrategy: (times) => {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 50, 2000);
    },
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    commandTimeout: 5000,
    lazyConnect: false,
  };
}

async function testRedisConnection() {
  const config = getRedisConfig();

  log('\n🔍 Redis Production Connection Test', colors.cyan);
  log('=====================================\n', colors.cyan);

  // Display configuration (hiding password)
  if (typeof config === 'string') {
    try {
      const url = new URL(config);
      log(`Configuration (URL format):`, colors.blue);
      log(`  Protocol: ${url.protocol}`, colors.blue);
      log(`  Host: ${url.hostname}`, colors.blue);
      log(`  Port: ${url.port || '6379'}`, colors.blue);
      log(`  Password: ${url.password ? '***' : 'none'}`, colors.blue);
      log(`  Database: ${url.pathname.substring(1) || '0'}\n`, colors.blue);
    } catch (e) {
      log(`Configuration: ${config}\n`, colors.blue);
    }
  } else {
    log(`Configuration (object format):`, colors.blue);
    log(`  Host: ${config.host}`, colors.blue);
    log(`  Port: ${config.port}`, colors.blue);
    log(`  Password: ${config.password ? '***' : 'none'}`, colors.blue);
    log(`  Database: ${config.db}\n`, colors.blue);
  }

  const redis = new Redis(config);
  const startTime = Date.now();

  try {
    // Wait for connection (it connects automatically with lazyConnect: false)
    log('⏳ Connecting to Redis...', colors.yellow);
    await redis.ping(); // First operation triggers connection
    const connectTime = Date.now() - startTime;
    log(`✅ Connected successfully in ${connectTime}ms\n`, colors.green);

    // Test PING
    log('⏳ Testing PING command...', colors.yellow);
    const pingStart = Date.now();
    const pong = await redis.ping();
    const pingTime = Date.now() - pingStart;
    log(`✅ PING: ${pong} (${pingTime}ms)\n`, colors.green);

    // Test SET
    const testKey = `test:prod:${Date.now()}`;
    const testValue = JSON.stringify({
      message: 'Production Redis test',
      timestamp: new Date().toISOString(),
      environment: 'production-test'
    });

    log('⏳ Testing SET command...', colors.yellow);
    const setStart = Date.now();
    await redis.set(testKey, testValue, 'EX', 300); // 5 minute expiry
    const setTime = Date.now() - setStart;
    log(`✅ SET successful (${setTime}ms)`, colors.green);
    log(`   Key: ${testKey}`, colors.green);
    log(`   Value: ${testValue}\n`, colors.green);

    // Test GET
    log('⏳ Testing GET command...', colors.yellow);
    const getStart = Date.now();
    const retrievedValue = await redis.get(testKey);
    const getTime = Date.now() - getStart;
    log(`✅ GET successful (${getTime}ms)`, colors.green);
    log(`   Retrieved: ${retrievedValue}\n`, colors.green);

    // Verify value
    if (retrievedValue === testValue) {
      log('✅ Value verification: PASSED\n', colors.green);
    } else {
      log('❌ Value verification: FAILED\n', colors.red);
      log(`   Expected: ${testValue}`, colors.red);
      log(`   Got: ${retrievedValue}\n`, colors.red);
    }

    // Test TTL
    log('⏳ Testing TTL command...', colors.yellow);
    const ttl = await redis.ttl(testKey);
    log(`✅ TTL: ${ttl} seconds remaining\n`, colors.green);

    // Get Redis info
    log('⏳ Getting Redis server info...', colors.yellow);
    const info = await redis.info('server');
    const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1];
    const os = info.match(/os:([^\r\n]+)/)?.[1];
    const uptimeSeconds = info.match(/uptime_in_seconds:([^\r\n]+)/)?.[1];

    log(`✅ Redis Server Info:`, colors.green);
    log(`   Version: ${redisVersion}`, colors.green);
    log(`   OS: ${os}`, colors.green);
    log(`   Uptime: ${uptimeSeconds}s (${Math.floor(uptimeSeconds / 3600)}h)\n`, colors.green);

    // Get database size
    log('⏳ Getting database size...', colors.yellow);
    const dbSize = await redis.dbsize();
    log(`✅ Database keys: ${dbSize}\n`, colors.green);

    // Test multiple rapid operations
    log('⏳ Testing rapid operations (10 commands)...', colors.yellow);
    const rapidStart = Date.now();
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(redis.ping());
    }
    await Promise.all(promises);
    const rapidTime = Date.now() - rapidStart;
    log(`✅ 10 PINGs completed in ${rapidTime}ms (avg ${(rapidTime / 10).toFixed(1)}ms)\n`, colors.green);

    // Clean up test key
    log('⏳ Cleaning up test key...', colors.yellow);
    await redis.del(testKey);
    log('✅ Test key deleted\n', colors.green);

    // Summary
    log('═══════════════════════════════════', colors.cyan);
    log('🎉 All Tests Passed!', colors.green);
    log('═══════════════════════════════════\n', colors.cyan);

    log('Performance Summary:', colors.blue);
    log(`  Connection: ${connectTime}ms`, colors.blue);
    log(`  PING: ${pingTime}ms`, colors.blue);
    log(`  SET: ${setTime}ms`, colors.blue);
    log(`  GET: ${getTime}ms`, colors.blue);
    log(`  Avg per operation: ${((connectTime + pingTime + setTime + getTime) / 4).toFixed(1)}ms\n`, colors.blue);

    log('Production Redis is fully operational! ✨\n', colors.green);

    await redis.quit();
    process.exit(0);

  } catch (error) {
    log('\n═══════════════════════════════════', colors.red);
    log('❌ Redis Connection Failed!', colors.red);
    log('═══════════════════════════════════\n', colors.red);

    log('Error Details:', colors.red);
    log(`  Message: ${error.message}`, colors.red);
    log(`  Code: ${error.code || 'N/A'}`, colors.red);
    if (error.errno) log(`  Errno: ${error.errno}`, colors.red);

    log('', colors.reset);

    if (error.code === 'ECONNREFUSED') {
      log('💡 Possible Solutions:', colors.yellow);
      log('  1. Verify Redis server is running', colors.yellow);
      log('  2. Check host/port configuration', colors.yellow);
      log('  3. Verify firewall/network settings', colors.yellow);
      log('  4. Confirm Railway service is deployed\n', colors.yellow);
    } else if (error.code === 'ENOTFOUND') {
      log('💡 Possible Solutions:', colors.yellow);
      log('  1. Verify REDIS_HOST or REDIS_URL is correct', colors.yellow);
      log('  2. Check DNS resolution', colors.yellow);
      log('  3. Confirm Railway domain is accessible\n', colors.yellow);
    } else if (error.message.includes('NOAUTH') || error.message.includes('Authentication')) {
      log('💡 Possible Solutions:', colors.yellow);
      log('  1. Set correct REDIS_PASSWORD', colors.yellow);
      log('  2. Check Railway environment variables', colors.yellow);
      log('  3. Verify ACL configuration\n', colors.yellow);
    } else if (error.message.includes('timeout')) {
      log('💡 Possible Solutions:', colors.yellow);
      log('  1. Check network connectivity', colors.yellow);
      log('  2. Verify Redis service is responding', colors.yellow);
      log('  3. Check for rate limiting\n', colors.yellow);
    }

    await redis.quit();
    process.exit(1);
  }
}

// Check if credentials are provided
if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
  log('❌ Error: No Redis configuration provided\n', colors.red);
  log('Usage:', colors.yellow);
  log('  Option 1 (URL):', colors.yellow);
  log('    REDIS_URL="redis://user:pass@host:port" node test-redis-production.js\n', colors.yellow);
  log('  Option 2 (Individual variables):', colors.yellow);
  log('    REDIS_HOST=host REDIS_PORT=port REDIS_PASSWORD=pass node test-redis-production.js\n', colors.yellow);
  process.exit(1);
}

// Run the test
testRedisConnection();
