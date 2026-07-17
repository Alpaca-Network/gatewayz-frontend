const Redis = require('ioredis');

// Redis configuration
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => {
    if (times > 3) {
      return null; // Stop retrying after 3 attempts
    }
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  lazyConnect: true, // Don't connect immediately
};

async function testRedis() {
  console.log('🔍 Testing Redis connection...\n');
  console.log('Configuration:');
  console.log(`  Host: ${REDIS_CONFIG.host}`);
  console.log(`  Port: ${REDIS_CONFIG.port}`);
  console.log(`  Database: ${REDIS_CONFIG.db}`);
  console.log(`  Password: ${REDIS_CONFIG.password ? '***' : 'none'}\n`);

  const redis = new Redis(REDIS_CONFIG);

  try {
    // Try to connect
    console.log('⏳ Connecting to Redis...');
    await redis.connect();
    console.log('✅ Connected to Redis successfully!\n');

    // Test PING
    console.log('⏳ Testing PING command...');
    const pong = await redis.ping();
    console.log(`✅ PING response: ${pong}\n`);

    // Test SET
    const testKey = `test:connection:${Date.now()}`;
    const testValue = 'Hello from Gatewayz!';
    console.log('⏳ Testing SET command...');
    await redis.set(testKey, testValue, 'EX', 60);
    console.log(`✅ SET successful: ${testKey} = "${testValue}"\n`);

    // Test GET
    console.log('⏳ Testing GET command...');
    const retrievedValue = await redis.get(testKey);
    console.log(`✅ GET successful: ${retrievedValue}\n`);

    // Verify value
    if (retrievedValue === testValue) {
      console.log('✅ Value verification: PASSED\n');
    } else {
      console.log('❌ Value verification: FAILED\n');
      console.error(`Expected: ${testValue}`);
      console.error(`Got: ${retrievedValue}\n`);
      await redis.quit();
      process.exit(1);
    }

    // Get Redis info
    console.log('⏳ Getting Redis server info...');
    const info = await redis.info('server');
    const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1];
    console.log(`✅ Redis version: ${redisVersion}\n`);

    // Get database size
    console.log('⏳ Getting database size...');
    const dbSize = await redis.dbsize();
    console.log(`✅ Database keys: ${dbSize}\n`);

    // Clean up test key
    console.log('⏳ Cleaning up test key...');
    await redis.del(testKey);
    console.log('✅ Test key deleted\n');

    console.log('🎉 All tests passed! Redis is working correctly.\n');

    // Close connection
    await redis.quit();
    process.exit(0);

  } catch (error) {
    console.error('❌ Redis connection failed!\n');
    console.error('Error details:');
    console.error(`  Message: ${error.message}`);
    console.error(`  Code: ${error.code || 'N/A'}`);
    console.error(`  Errno: ${error.errno || 'N/A'}\n`);

    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Possible solutions:');
      console.error('  1. Make sure Redis server is running');
      console.error('  2. Check if Redis is running on the correct host/port');
      console.error('  3. Verify firewall settings\n');
    } else if (error.code === 'ENOTFOUND') {
      console.error('💡 Possible solutions:');
      console.error('  1. Check REDIS_HOST environment variable');
      console.error('  2. Verify DNS resolution\n');
    } else if (error.message.includes('NOAUTH')) {
      console.error('💡 Possible solutions:');
      console.error('  1. Set REDIS_PASSWORD environment variable');
      console.error('  2. Check Redis ACL configuration\n');
    }

    await redis.quit();
    process.exit(1);
  }
}

// Run the test
testRedis();
