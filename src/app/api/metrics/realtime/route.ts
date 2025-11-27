import { NextRequest, NextResponse } from 'next/server';
import { metricsService } from '@/lib/redis-metrics';
import { cacheAside, TTL } from '@/lib/cache-strategies';

/**
 * GET /api/metrics/realtime
 *
 * Retrieve real-time metrics for models, providers, or gateways
 *
 * Query params:
 * - type: 'model' | 'provider' | 'gateway'
 * - id: identifier (e.g., 'anthropic/claude-3.5-sonnet')
 * - time_bucket: optional time bucket (defaults to current hour)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const timeBucket = searchParams.get('time_bucket') || undefined;

    // Validate required parameters
    if (!type || !id) {
      return NextResponse.json(
        { error: 'Missing required parameters: type, id' },
        { status: 400 }
      );
    }

    if (!['model', 'provider', 'gateway'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: model, provider, or gateway' },
        { status: 400 }
      );
    }

    // Cache key for dashboard
    const cacheKey = `metrics:dashboard:${type}:${id}:${timeBucket || metricsService.getTimeBucket()}`;

    // Use cache-aside pattern with 60-second cache
    const metrics = await cacheAside(
      cacheKey,
      async () => {
        if (type === 'model') {
          return await metricsService.getModelMetrics(id, timeBucket);
        } else if (type === 'provider') {
          return await metricsService.getProviderSummary(id, timeBucket);
        }
        // Gateway metrics would be implemented here if needed
        return null;
      },
      TTL.METRICS_DASHBOARD,
      'metrics_dashboard'
    );

    if (!metrics) {
      return NextResponse.json(
        { error: 'No metrics found for the specified parameters' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      type,
      id,
      data: metrics,
    });
  } catch (error) {
    console.error('[API /metrics/realtime] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
