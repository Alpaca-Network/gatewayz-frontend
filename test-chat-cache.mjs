/**
 * Test script to verify Redis chat caching improvements
 * Run with: node test-chat-cache.mjs
 *
 * Tests:
 * 1. Chat stats caching (10-minute TTL)
 * 2. Chat search caching (5-minute TTL)
 * 3. Cache invalidation on session create/update/delete
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.TEST_API_KEY || 'your-api-key-here';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testStatsCache() {
  log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('cyan', '🧪 TEST 1: Chat Stats Caching');
  log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // First request (cache miss)
  log('blue', '📊 Request 1: Fetching stats (should hit backend)...');
  const start1 = Date.now();
  const response1 = await fetch(`${API_BASE}/api/chat/stats`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const data1 = await response1.json();
  const duration1 = Date.now() - start1;
  log('green', `✅ Response time: ${duration1}ms`);
  log('green', `✅ Stats: ${JSON.stringify(data1)}\n`);

  // Second request (cache hit)
  log('blue', '📊 Request 2: Fetching stats again (should hit Redis cache)...');
  const start2 = Date.now();
  const response2 = await fetch(`${API_BASE}/api/chat/stats`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const data2 = await response2.json();
  const duration2 = Date.now() - start2;
  log('green', `✅ Response time: ${duration2}ms`);
  log('green', `✅ Stats: ${JSON.stringify(data2)}\n`);

  // Analysis
  log('yellow', '📈 Analysis:');
  if (duration2 < duration1 / 3) {
    log('green', `✅ Cache is working! Second request was ${Math.round(duration1 / duration2)}x faster`);
    log('green', `   • First request: ${duration1}ms (backend)`);
    log('green', `   • Second request: ${duration2}ms (Redis cache)`);
    log('green', `   • Speed improvement: ${Math.round((1 - duration2 / duration1) * 100)}%`);
  } else {
    log('red', `⚠️  Cache may not be working. Times are similar:`);
    log('red', `   • First: ${duration1}ms, Second: ${duration2}ms`);
  }
}

async function testSearchCache() {
  log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('cyan', '🧪 TEST 2: Chat Search Caching');
  log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const searchQuery = 'test';

  // First search (cache miss)
  log('blue', `🔍 Search 1: "${searchQuery}" (should hit backend)...`);
  const start1 = Date.now();
  const response1 = await fetch(`${API_BASE}/api/chat/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: searchQuery, limit: 20 })
  });
  const data1 = await response1.json();
  const duration1 = Date.now() - start1;
  log('green', `✅ Response time: ${duration1}ms`);
  log('green', `✅ Results: ${Array.isArray(data1) ? data1.length : 0} sessions\n`);

  // Second search (cache hit)
  log('blue', `🔍 Search 2: "${searchQuery}" (should hit Redis cache)...`);
  const start2 = Date.now();
  const response2 = await fetch(`${API_BASE}/api/chat/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: searchQuery, limit: 20 })
  });
  const data2 = await response2.json();
  const duration2 = Date.now() - start2;
  log('green', `✅ Response time: ${duration2}ms`);
  log('green', `✅ Results: ${Array.isArray(data2) ? data2.length : 0} sessions\n`);

  // Analysis
  log('yellow', '📈 Analysis:');
  if (duration2 < duration1 / 3) {
    log('green', `✅ Cache is working! Second search was ${Math.round(duration1 / duration2)}x faster`);
    log('green', `   • First search: ${duration1}ms (backend)`);
    log('green', `   • Second search: ${duration2}ms (Redis cache)`);
    log('green', `   • Speed improvement: ${Math.round((1 - duration2 / duration1) * 100)}%`);
  } else {
    log('red', `⚠️  Cache may not be working. Times are similar:`);
    log('red', `   • First: ${duration1}ms, Second: ${duration2}ms`);
  }
}

async function testCacheInvalidation() {
  log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('cyan', '🧪 TEST 3: Cache Invalidation');
  log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fetch stats (should be cached)
  log('blue', '📊 Fetching stats (warming cache)...');
  await fetch(`${API_BASE}/api/chat/stats`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  log('green', '✅ Stats cached\n');

  // Create a new session (should invalidate stats cache)
  log('blue', '➕ Creating new session (should invalidate stats cache)...');
  const createResponse = await fetch(`${API_BASE}/api/chat/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Test Session',
      model: 'openai/gpt-3.5-turbo'
    })
  });

  if (createResponse.ok) {
    const newSession = await createResponse.json();
    log('green', `✅ Session created: ${newSession.id}\n`);

    // Fetch stats again (should be fresh from backend due to invalidation)
    log('blue', '📊 Fetching stats again (cache should be invalidated)...');
    const start = Date.now();
    const statsResponse = await fetch(`${API_BASE}/api/chat/stats`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const duration = Date.now() - start;
    const stats = await statsResponse.json();

    log('green', `✅ Response time: ${duration}ms`);
    log('green', `✅ Stats: ${JSON.stringify(stats)}\n`);

    if (duration > 50) {
      log('green', '✅ Cache invalidation is working! Stats were fetched from backend.');
    } else {
      log('yellow', '⚠️  Cache may not have been invalidated (very fast response).');
    }

    // Clean up: delete the test session
    log('blue', '🧹 Cleaning up test session...');
    await fetch(`${API_BASE}/api/chat/sessions/${newSession.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    log('green', '✅ Test session deleted\n');
  } else {
    log('red', '❌ Failed to create session for testing');
  }
}

async function runTests() {
  log('cyan', '\n╔═══════════════════════════════════════════════════════╗');
  log('cyan', '║  Redis Chat Caching Performance Test Suite           ║');
  log('cyan', '╚═══════════════════════════════════════════════════════╝\n');

  if (API_KEY === 'your-api-key-here') {
    log('red', '❌ Error: Please set TEST_API_KEY environment variable');
    log('yellow', '   Usage: TEST_API_KEY=your-key node test-chat-cache.mjs\n');
    process.exit(1);
  }

  try {
    await testStatsCache();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests

    await testSearchCache();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests

    await testCacheInvalidation();

    log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('green', '✅ All tests completed!');
    log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    log('red', `\n❌ Test error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

runTests();
