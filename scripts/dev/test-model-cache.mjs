/**
 * Test script to verify Redis model caching
 * Run with: node test-model-cache.mjs
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

async function testModelCache() {
  console.log('🧪 Testing Redis Model Caching\n');

  // Test 1: First request (cache miss expected)
  console.log('Test 1: First request (should hit backend)');
  const start1 = Date.now();
  const response1 = await fetch(`${API_BASE}/api/models?gateway=openrouter&limit=10`);
  const data1 = await response1.json();
  const duration1 = Date.now() - start1;
  console.log(`✅ Response time: ${duration1}ms`);
  console.log(`✅ Models fetched: ${data1.data?.length || 0}\n`);

  // Test 2: Second request (cache hit expected)
  console.log('Test 2: Second request (should hit Redis cache)');
  const start2 = Date.now();
  const response2 = await fetch(`${API_BASE}/api/models?gateway=openrouter&limit=10`);
  const data2 = await response2.json();
  const duration2 = Date.now() - start2;
  console.log(`✅ Response time: ${duration2}ms`);
  console.log(`✅ Models fetched: ${data2.data?.length || 0}\n`);

  // Analysis
  console.log('📊 Analysis:');
  if (duration2 < duration1 / 5) {
    console.log(`✅ Cache is working! Second request was ${Math.round(duration1 / duration2)}x faster`);
    console.log(`✅ First request: ${duration1}ms (backend)`);
    console.log(`✅ Second request: ${duration2}ms (Redis cache)`);
  } else {
    console.log(`⚠️  Cache may not be working. Times are similar:`);
    console.log(`   First: ${duration1}ms, Second: ${duration2}ms`);
  }
}

testModelCache().catch(console.error);
