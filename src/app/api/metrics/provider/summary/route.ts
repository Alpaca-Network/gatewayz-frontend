import { NextRequest, NextResponse } from 'next/server';
import { metricsService } from '@/lib/redis-metrics';
import { cacheAside, TTL } from '@/lib/cache-strategies';

/**
 * GET /api/metrics/provider/summary
 *
 * Get aggregated metrics for all models of a provider
 *
 * Query params:
 * - provider: provider name (e.g., 'anthropic', 'google', 'openai')
 * - time_bucket: optional time bucket (defaults to current hour)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider');
    const timeBucket = searchParams.get('time_bucket') || undefined;

    // Validate required parameters
    if (!provider) {
      return NextResponse.json(
        { error: 'Missing required parameter: provider' },
        { status: 400 }
      );
    }

    const bucket = timeBucket || metricsService.getTimeBucket();

    // Cache key for provider summary
    const cacheKey = `metrics:provider:summary:${provider}:${bucket}`;

    // Use cache-aside pattern with 60-second cache
    const summary = await cacheAside(
      cacheKey,
      async () => {
        return await metricsService.getProviderSummary(provider, bucket);
      },
      TTL.METRICS_DASHBOARD,
      'metrics_provider_summary'
    );

    if (!summary) {
      return NextResponse.json(
        { error: 'No metrics found for the specified provider' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      provider,
      data: summary,
    });
  } catch (error) {
    console.error('[API /metrics/provider/summary] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
