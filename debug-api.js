#!/usr/bin/env node

/**
 * Debug script to test API connectivity
 * Run: node debug-api.js
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

console.log('=== Gatewayz API Diagnostics ===\n');
console.log('Environment:', {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});
console.log('\nTesting API endpoints...\n');

async function testEndpoint(url, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`Testing: ${url}`);
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    console.log(`  ✅ Status: ${response.status} ${response.statusText}`);
    console.log(`  ⏱️  Duration: ${duration}ms`);
    console.log(`  📦 Content-Type: ${response.headers.get('content-type')}`);

    if (response.ok) {
      const data = await response.json();
      const modelCount = data.data?.length || 0;
      console.log(`  📊 Models returned: ${modelCount}`);

      if (modelCount > 0) {
        console.log(`  🎯 First model: ${data.data[0].name || data.data[0].id}`);
      }
    } else {
      const text = await response.text();
      console.log(`  ❌ Error response: ${text.substring(0, 200)}`);
    }

    console.log('');
    return { success: true, status: response.status, duration };
  } catch (error) {
    clearTimeout(timeoutId);
    console.log(`  ❌ Error: ${error.message}`);

    if (error.name === 'AbortError') {
      console.log(`  ⏱️  Request timed out after ${timeout}ms`);
    }

    console.log('');
    return { success: false, error: error.message };
  }
}

async function runDiagnostics() {
  // Test endpoints
  const endpoints = [
    { url: `${API_BASE_URL}/v1/models?gateway=all&limit=10`, name: 'v1/models (all, limit 10)' },
    { url: `${API_BASE_URL}/models?gateway=all&limit=10`, name: 'models (all, limit 10)' },
    { url: `${API_BASE_URL}/v1/models?gateway=openrouter&limit=10`, name: 'v1/models (openrouter)' },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n--- Testing: ${endpoint.name} ---`);
    await testEndpoint(endpoint.url, 30000); // 30 second timeout
  }

  console.log('\n=== Diagnostics Complete ===');
  console.log('\nIf you see errors above, common issues include:');
  console.log('1. CORS: Backend not allowing requests from your origin');
  console.log('2. Network: Firewall blocking the API domain');
  console.log('3. Timeout: Backend taking too long to respond');
  console.log('4. SSL: Certificate validation issues');
  console.log('\nTo fix CORS, requests should go through /api/models in Next.js');
}

runDiagnostics().catch(console.error);
