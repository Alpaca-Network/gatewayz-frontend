#!/usr/bin/env node

/**
 * Quick test script to check all model provider gateway status
 */

const gateways = [
  "openrouter", "groq", "together", "fireworks", "google",
  "cerebras", "xai", "deepinfra", "featherless", "chutes",
  "nebius", "novita", "aimo", "near", "fal", "alpaca"
];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.gatewayz.ai";

async function testGateway(gateway) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `${API_BASE}/v1/models?gateway=${gateway}&limit=5`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);
    const elapsed = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      const count = data.data?.length || 0;
      return { gateway, status: 'working', count, elapsed };
    } else {
      return { gateway, status: 'error', error: response.status, elapsed };
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    const status = err.name === 'AbortError' ? 'timeout' : 'error';
    return { gateway, status, error: err.message, elapsed };
  }
}

async function main() {
  console.log('=====================================');
  console.log('Model Provider Gateway Status Report');
  console.log('=====================================\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Testing ${gateways.length} gateways...\n`);

  const results = await Promise.all(gateways.map(testGateway));

  // Sort by status
  results.sort((a, b) => {
    const order = { working: 0, error: 1, timeout: 2 };
    return order[a.status] - order[b.status];
  });

  console.log('Gateway Status:');
  console.log('─'.repeat(70));

  results.forEach(r => {
    const emoji = r.status === 'working' ? '✓' :
                  r.status === 'timeout' ? '⏱' : '✗';
    const gw = r.gateway.padEnd(20);

    let info;
    if (r.status === 'working') {
      info = `${r.count} models (${r.elapsed}ms)`;
    } else {
      info = `${r.error} (${r.elapsed}ms)`;
    }

    console.log(`${emoji} ${gw} ${info}`);
  });

  console.log('─'.repeat(70));

  const working = results.filter(r => r.status === 'working').length;
  const timeout = results.filter(r => r.status === 'timeout').length;
  const error = results.filter(r => r.status === 'error').length;

  console.log(`\nSummary:`);
  console.log(`  Working: ${working}/${results.length}`);
  console.log(`  Timeout: ${timeout}/${results.length}`);
  console.log(`  Error:   ${error}/${results.length}`);

  if (working >= results.length / 2) {
    console.log(`\n✓ Majority of gateways are working!`);
  } else {
    console.log(`\n⚠ Less than half of gateways are working`);
  }

  // List working gateways
  const workingGateways = results.filter(r => r.status === 'working').map(r => r.gateway);
  if (workingGateways.length > 0) {
    console.log(`\nWorking gateways: ${workingGateways.join(', ')}`);
  }
}

main().catch(console.error);
