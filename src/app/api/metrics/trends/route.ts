import { NextRequest, NextResponse } from 'next/server';
import { metricsService } from '@/lib/redis-metrics';
import { cacheAside, TTL } from '@/lib/cache-strategies';

/**
 * GET /api/metrics/trends
 *
 * Get time-series trend data for a model
 *
 * Query params:
 * - model: model ID (e.g., 'anthropic/claude-3.5-sonnet')
 * - metric: 'ttft' | 'requests' | 'success_rate'
 * - hours: number of hours to look back (default: 6, max: 24)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const model = searchParams.get('model');
    const metric = searchParams.get('metric');
    const hours = parseInt(searchParams.get('hours') || '6');

    // Validate required parameters
    if (!model) {
      return NextResponse.json(
        { error: 'Missing required parameter: model' },
        { status: 400 }
      );
    }

    if (!metric) {
      return NextResponse.json(
        { error: 'Missing required parameter: metric' },
        { status: 400 }
      );
    }

    if (!['ttft', 'requests', 'success_rate'].includes(metric)) {
      return NextResponse.json(
        { error: 'Invalid metric. Must be: ttft, requests, or success_rate' },
        { status: 400 }
      );
    }

    if (isNaN(hours) || hours < 1 || hours > 24) {
      return NextResponse.json(
        { error: 'Invalid hours. Must be between 1 and 24' },
        { status: 400 }
      );
    }

    // Cache key for trends
    const cacheKey = `metrics:trends:${model}:${metric}:${hours}`;

    // Use cache-aside pattern with 60-second cache
    const trendData = await cacheAside(
      cacheKey,
      async () => {
        return await metricsService.getTrendData(
          model,
          metric as 'ttft' | 'requests' | 'success_rate',
          hours
        );
      },
      TTL.METRICS_DASHBOARD,
      'metrics_trends'
    );

    return NextResponse.json({
      model,
      metric,
      hours,
      data_points: trendData,
    });
  } catch (error) {
    console.error('[API /metrics/trends] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
