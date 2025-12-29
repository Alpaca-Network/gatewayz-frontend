import { NextRequest, NextResponse } from 'next/server';
import { metricsService } from '@/lib/redis-metrics';
import { cacheAside, TTL } from '@/lib/cache-strategies';

/**
 * GET /api/metrics/health/leaderboard
 *
 * Get top or bottom models by health score
 *
 * Query params:
 * - order: 'asc' | 'desc' (default: 'desc' for healthiest first)
 * - limit: number (default: 10)
 * - time_bucket: optional time bucket (defaults to current hour)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';
    const limit = parseInt(searchParams.get('limit') || '10');
    const timeBucket = searchParams.get('time_bucket') || undefined;

    // Validate parameters
    if (!['asc', 'desc'].includes(order)) {
      return NextResponse.json(
        { error: 'Invalid order. Must be: asc or desc' },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid limit. Must be between 1 and 100' },
        { status: 400 }
      );
    }

    const bucket = timeBucket || metricsService.getTimeBucket();

    // Cache key for leaderboard
    const cacheKey = `metrics:leaderboard:${order}:${limit}:${bucket}`;

    // Use cache-aside pattern with 60-second cache
    const leaderboard = await cacheAside(
      cacheKey,
      async () => {
        return await metricsService.getHealthLeaderboard(limit, order, bucket);
      },
      TTL.METRICS_DASHBOARD,
      'metrics_leaderboard'
    );

    return NextResponse.json({
      time_bucket: bucket,
      order,
      limit,
      models: leaderboard,
    });
  } catch (error) {
    console.error('[API /metrics/health/leaderboard] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
