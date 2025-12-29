import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

/**
 * GET /api/cron/warm-cache - Vercel Cron endpoint for cache warming
 *
 * This endpoint is called by Vercel Cron every 3 hours to warm the cache.
 * It internally calls the /api/cache/warm-models endpoint.
 *
 * Auth: Vercel automatically adds 'x-vercel-cron' header for verification
 */
export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'cron',
      name: 'Cron: Warm Cache',
    },
    async (span) => {
      try {
        // Verify this is a legitimate Vercel Cron request
        // In production, Vercel adds special headers that can be verified
        const authHeader = request.headers.get('authorization');
        const cronHeader = request.headers.get('x-vercel-cron');

        // In development, allow without cron header
        const isDevelopment = process.env.NODE_ENV === 'development';

        if (!isDevelopment && !cronHeader) {
          console.warn('[Cron] Request missing x-vercel-cron header, possible unauthorized access');
          span.setAttribute('error', 'missing_cron_header');

          return NextResponse.json(
            { error: 'Unauthorized - Not a valid cron request' },
            { status: 401 }
          );
        }

        console.log('[Cron] Starting scheduled cache warming...');

        // Get the secret token for the cache warming endpoint
        const cacheWarmingSecret = process.env.CACHE_WARMING_SECRET || 'default-secret-change-me';

        // Call the internal cache warming endpoint
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://beta.gatewayz.ai';
        const warmingUrl = `${baseUrl}/api/cache/warm-models`;

        const response = await fetch(warmingUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cacheWarmingSecret}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Cache warming failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        console.log('[Cron] Cache warming completed successfully:', result);

        // Add metrics to span
        span.setAttribute('total_models', result.total_models || 0);
        span.setAttribute('gateways_success', result.gateways_success || 0);
        span.setAttribute('gateways_failed', result.gateways_failed || 0);
        span.setAttribute('duration_ms', result.duration_ms || 0);

        return NextResponse.json({
          success: true,
          message: 'Cache warming completed',
          timestamp: new Date().toISOString(),
          result
        });
      } catch (error) {
        console.error('[Cron] Cache warming failed:', error);

        // Capture exception in Sentry
        Sentry.captureException(error, {
          tags: {
            cron_job: 'warm-cache',
            error_type: 'cron_execution_error',
          },
        });

        span.setAttribute('error', true);
        span.setAttribute('error_message', error instanceof Error ? error.message : 'Unknown error');

        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Cache warming failed',
            timestamp: new Date().toISOString()
          },
          { status: 500 }
        );
      }
    }
  );
}
