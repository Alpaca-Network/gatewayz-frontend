#!/usr/bin/env tsx
/**
 * Dev Server Warmup Script
 *
 * This script warms up the Next.js dev server by making requests to critical routes
 * BEFORE Playwright tests run. This prevents ERR_EMPTY_RESPONSE / ERR_CONNECTION_REFUSED
 * errors caused by Next.js cold compilation times (74-76s for root route, 75s for /chat).
 *
 * Usage:
 *   tsx scripts/warmup-dev-server.ts
 *   tsx scripts/warmup-dev-server.ts --url http://localhost:3000 --routes /,/chat,/models
 *
 * Environment Variables:
 *   WARMUP_BASE_URL - Base URL of dev server (default: http://localhost:3000)
 *   WARMUP_ROUTES - Comma-separated routes to warm up (default: /,/chat,/models,/rankings)
 *   WARMUP_MAX_WAIT - Maximum wait time in seconds (default: 180)
 *   WARMUP_RETRY_INTERVAL - Retry interval in seconds (default: 2)
 */

import { setTimeout } from 'timers/promises';

// Configuration
const BASE_URL = process.env.WARMUP_BASE_URL || process.argv.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'http://localhost:3000';
const ROUTES_ARG = process.argv.find(arg => arg.startsWith('--routes='))?.split('=')[1];
const ROUTES = ROUTES_ARG
  ? ROUTES_ARG.split(',')
  : (process.env.WARMUP_ROUTES?.split(',') || ['/', '/chat', '/models', '/rankings']);
const MAX_WAIT_MS = parseInt(process.env.WARMUP_MAX_WAIT || '180') * 1000; // 3 minutes default
const RETRY_INTERVAL_MS = parseInt(process.env.WARMUP_RETRY_INTERVAL || '2') * 1000; // 2 seconds default

interface WarmupResult {
  route: string;
  success: boolean;
  statusCode?: number;
  attempts: number;
  duration: number;
  error?: string;
}

/**
 * Check if server is responding at all
 */
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return response.status > 0;
  } catch {
    return false;
  }
}

/**
 * Warm up a single route by making requests until it returns successfully
 */
async function warmupRoute(route: string): Promise<WarmupResult> {
  const startTime = Date.now();
  let attempts = 0;
  let lastError: string | undefined;

  console.log(`\n🔥 Warming up route: ${route}`);

  while (Date.now() - startTime < MAX_WAIT_MS) {
    attempts++;

    try {
      const attemptStart = Date.now();
      const response = await fetch(`${BASE_URL}${route}`, {
        signal: AbortSignal.timeout(30000), // 30s timeout per request
        headers: {
          'User-Agent': 'Playwright-Warmup-Script',
        }
      });

      const attemptDuration = Date.now() - attemptStart;

      if (response.ok || response.status === 304) {
        const totalDuration = Date.now() - startTime;
        console.log(`✅ Route ${route} ready (status ${response.status}) - ${attempts} attempts, ${(totalDuration / 1000).toFixed(1)}s`);

        return {
          route,
          success: true,
          statusCode: response.status,
          attempts,
          duration: totalDuration
        };
      }

      if (response.status === 500) {
        console.log(`⚠️  Route ${route} returned 500 on attempt ${attempts} (${(attemptDuration / 1000).toFixed(1)}s) - retrying...`);
        lastError = `HTTP ${response.status}`;
      } else if (response.status >= 400) {
        // Client errors (404, 401, etc.) won't improve with retries
        const totalDuration = Date.now() - startTime;
        console.log(`⚠️  Route ${route} returned ${response.status} - may be expected for this route`);
        return {
          route,
          success: true, // Don't fail warmup for client errors
          statusCode: response.status,
          attempts,
          duration: totalDuration
        };
      }

      console.log(`⏳ Attempt ${attempts}: ${route} returned ${response.status} (${(attemptDuration / 1000).toFixed(1)}s) - waiting...`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Connection errors are expected during compilation
      if (errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('fetch failed')) {
        console.log(`⏳ Attempt ${attempts}: Server not ready yet - waiting...`);
        lastError = errorMessage;
      } else if (errorMessage.includes('aborted')) {
        console.log(`⏳ Attempt ${attempts}: Request timeout (compilation in progress) - waiting...`);
        lastError = 'Request timeout';
      } else {
        console.log(`⚠️  Attempt ${attempts}: Unexpected error - ${errorMessage}`);
        lastError = errorMessage;
      }
    }

    // Wait before next attempt
    await setTimeout(RETRY_INTERVAL_MS);
  }

  // Timeout reached
  const totalDuration = Date.now() - startTime;
  console.log(`❌ Route ${route} failed to warm up after ${attempts} attempts (${(totalDuration / 1000).toFixed(1)}s)`);

  return {
    route,
    success: false,
    attempts,
    duration: totalDuration,
    error: lastError || 'Timeout'
  };
}

/**
 * Main warmup routine
 */
async function main() {
  console.log('🚀 Starting dev server warmup...');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`📋 Routes to warm: ${ROUTES.join(', ')}`);
  console.log(`⏱️  Max wait: ${MAX_WAIT_MS / 1000}s per route`);
  console.log(`🔄 Retry interval: ${RETRY_INTERVAL_MS / 1000}s`);

  const overallStart = Date.now();

  // First, wait for server to be reachable at all
  console.log('\n⏳ Waiting for server to start...');
  let serverReady = false;
  const serverWaitStart = Date.now();

  while (Date.now() - serverWaitStart < 30000) { // 30s to start
    if (await checkServerHealth()) {
      serverReady = true;
      console.log('✅ Server is responding');
      break;
    }
    await setTimeout(1000);
  }

  if (!serverReady) {
    console.error('❌ Server did not start within 30 seconds');
    process.exit(1);
  }

  // Warm up each route sequentially
  const results: WarmupResult[] = [];

  for (const route of ROUTES) {
    const result = await warmupRoute(route);
    results.push(result);

    if (!result.success) {
      console.warn(`⚠️  Warning: Route ${route} could not be warmed up`);
    }
  }

  // Summary
  const overallDuration = Date.now() - overallStart;
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  console.log('\n📊 Warmup Summary:');
  console.log(`   Total time: ${(overallDuration / 1000).toFixed(1)}s`);
  console.log(`   Success: ${successCount}/${results.length} routes`);
  console.log(`   Failed: ${failureCount}/${results.length} routes`);

  if (failureCount > 0) {
    console.log('\n❌ Failed routes:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.route}: ${r.error}`);
    });
  }

  console.log('\n✨ Server warmup complete!\n');

  // Exit with error if critical routes failed
  const criticalRoutes = ['/', '/chat'];
  const criticalFailures = results.filter(r => criticalRoutes.includes(r.route) && !r.success);

  if (criticalFailures.length > 0) {
    console.error('❌ Critical routes failed to warm up. Tests may fail.');
    process.exit(1);
  }

  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run
main();
