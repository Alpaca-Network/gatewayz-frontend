import { NextRequest, NextResponse } from 'next/server';
import { getModelsForGateway } from '@/lib/models-service';
import * as Sentry from '@sentry/nextjs';
import { getAllActiveGatewayIds } from '@/lib/gateway-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

/**
 * POST /api/cache/warm-models - Warm the cache for all model gateways
 *
 * This endpoint pre-fetches models from all gateways and stores them in Redis cache.
 * Should be called periodically (e.g., every 3-4 hours) to keep cache fresh.
 *
 * Auth: Requires secret token in Authorization header
 */
export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'POST /api/cache/warm-models',
    },
    async (span) => {
      try {
        // Simple auth check - require secret token
        const authHeader = request.headers.get('authorization');
        const expectedToken = process.env.CACHE_WARMING_SECRET || 'default-secret-change-me';

        if (authHeader !== `Bearer ${expectedToken}`) {
          span.setAttribute('error', 'unauthorized');
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        console.log('[Cache Warming] Starting cache warming for all gateways...');
        const startTime = Date.now();

        // Get all gateways including dynamically registered ones
        const allGateways = getAllActiveGatewayIds();

        // Warm cache for all gateways in parallel
        const results = await Promise.allSettled(
          allGateways.map(async (gateway) => {
            try {
              const result = await getModelsForGateway(gateway);
              const count = result.data?.length || 0;
              console.log(`[Cache Warming] ${gateway}: ${count} models cached`);
              return { gateway, count, status: 'success' };
            } catch (error) {
              console.error(`[Cache Warming] ${gateway} failed:`, error);
              return {
                gateway,
                count: 0,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          })
        );

        const duration = Date.now() - startTime;

        // Summarize results
        const summary = results.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            return {
              gateway: allGateways[index],
              count: 0,
              status: 'error',
              error: result.reason?.message || 'Promise rejected'
            };
          }
        });

        const totalModels = summary.reduce((sum, item) => sum + item.count, 0);
        const successCount = summary.filter(item => item.status === 'success').length;
        const errorCount = summary.filter(item => item.status === 'error').length;

        console.log(`[Cache Warming] Completed in ${duration}ms: ${totalModels} total models, ${successCount} success, ${errorCount} errors`);

        // Add metrics to span
        span.setAttribute('total_models', totalModels);
        span.setAttribute('success_count', successCount);
        span.setAttribute('error_count', errorCount);
        span.setAttribute('duration_ms', duration);

        return NextResponse.json({
          success: true,
          duration_ms: duration,
          total_models: totalModels,
          gateways_success: successCount,
          gateways_failed: errorCount,
          details: summary
        });
      } catch (error) {
        console.error('[Cache Warming] Fatal error:', error);

        // Capture exception in Sentry
        Sentry.captureException(error, {
          tags: {
            api_route: '/api/cache/warm-models',
            error_type: 'cache_warming_error',
          },
        });

        span.setAttribute('error', true);
        span.setAttribute('error_message', error instanceof Error ? error.message : 'Unknown error');

        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : 'Cache warming failed',
            success: false
          },
          { status: 500 }
        );
      }
    }
  );
}

/**
 * GET /api/cache/warm-models - Get cache warming status/info
 */
export async function GET(request: NextRequest) {
  const gateways = getAllActiveGatewayIds();
  return NextResponse.json({
    endpoint: '/api/cache/warm-models',
    description: 'Warm the Redis cache for all model gateways',
    method: 'POST',
    auth: 'Bearer token required (CACHE_WARMING_SECRET env var)',
    gateways: gateways,
    total_gateways: gateways.length
  });
}
