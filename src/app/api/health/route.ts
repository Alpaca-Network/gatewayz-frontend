/**
 * Health Check Endpoint
 *
 * Provides a lightweight endpoint to check if the Next.js server is ready.
 * Useful for:
 * - E2E test warmup scripts
 * - Load balancer health checks
 * - Monitoring and alerting
 * - CI/CD readiness checks
 *
 * GET /api/health
 * Returns: { status: "ok", timestamp: ISO8601, uptime: number }
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Basic health check - server is responding
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV || 'unknown',
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    // If we can even get here, server is somewhat functional
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Support HEAD requests for quick checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
