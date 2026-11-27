import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import {
  cacheInvalidate,
  cacheKeys,
  getCacheMetrics,
  resetCacheMetrics,
  CACHE_PREFIX,
  isAllowedCachePattern,
} from '@/lib/cache-strategies';
import { invalidateModelsCache } from '@/lib/models-service';
import { verifyBearerSecret } from '@/lib/secret-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache tags for different types of data
const CACHE_TAGS = {
  MODELS_ALL: 'models:all',
  MODELS_GATEWAY: (gateway: string) => `models:gateway:${gateway}`,
  MODEL_DETAIL: (modelId: string) => `model:${modelId}`,
  MODELS_SEARCH: 'models:search',
  RANKINGS: 'rankings'
};

export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'POST /api/cache/invalidate',
    },
    async (span) => {
      // Admin endpoint: same shared secret as the cache-warming routes.
      // Fails closed (503) when CACHE_WARMING_SECRET is not configured.
      const auth = verifyBearerSecret(
        request.headers.get('authorization'),
        'CACHE_WARMING_SECRET'
      );
      if (!auth.ok) {
        span.setAttribute('error', auth.status === 503 ? 'not_configured' : 'unauthorized');
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }

      try {
        const body = await request.json();
        const { gateway, modelId, type = 'models', category, pattern } = body;

        if (pattern !== undefined && pattern !== null && !isAllowedCachePattern(pattern)) {
          return NextResponse.json(
            {
              error: `Invalid pattern: must start with one of ${Object.values(CACHE_PREFIX)
                .map((p) => `${p}:`)
                .join(', ')}`,
              timestamp: Date.now(),
            },
            { status: 400 }
          );
        }

        span.setAttribute('cache_type', type);
        span.setAttribute('gateway', gateway || 'none');
        span.setAttribute('model_id', modelId || 'none');
        span.setAttribute('category', category || 'none');

        let invalidatedPaths: string[] = [];
        let invalidatedTags: string[] = [];
        let redisDeleted = 0;

        // Handle Redis cache invalidation by category
        if (category) {
          switch (category) {
            case 'models':
              redisDeleted = await invalidateModelsCache(gateway);
              break;
            case 'sessions':
              redisDeleted = await cacheInvalidate(`${CACHE_PREFIX.SESSIONS}:*`);
              break;
            case 'user':
              redisDeleted = await cacheInvalidate(`${CACHE_PREFIX.USER}:*`);
              break;
            case 'stats':
              redisDeleted = await cacheInvalidate(`${CACHE_PREFIX.STATS}:*`);
              break;
            case 'rankings':
              redisDeleted = await cacheInvalidate(`${CACHE_PREFIX.RANKINGS}:*`);
              break;
            case 'activity':
              redisDeleted = await cacheInvalidate(`${CACHE_PREFIX.ACTIVITY}:*`);
              break;
            case 'all':
              const results = await Promise.all([
                invalidateModelsCache(),
                cacheInvalidate(`${CACHE_PREFIX.SESSIONS}:*`),
                cacheInvalidate(`${CACHE_PREFIX.USER}:*`),
                cacheInvalidate(`${CACHE_PREFIX.STATS}:*`),
                cacheInvalidate(`${CACHE_PREFIX.RANKINGS}:*`),
                cacheInvalidate(`${CACHE_PREFIX.ACTIVITY}:*`),
              ]);
              redisDeleted = results.reduce((sum, count) => sum + count, 0);
              break;
          }
          span.setAttribute('redis_deleted', redisDeleted);
        }

        // Handle custom pattern
        if (pattern) {
          redisDeleted = await cacheInvalidate(pattern);
          span.setAttribute('redis_deleted', redisDeleted);
        }

        // Handle Next.js cache tags (existing logic)
        switch (type) {
          case 'models':
            if (gateway) {
              // Invalidate specific gateway
              const tag = CACHE_TAGS.MODELS_GATEWAY(gateway);
              revalidateTag(tag);
              invalidatedTags.push(tag);

              // Also invalidate the main models page
              revalidatePath('/models');
              invalidatedPaths.push('/models');

              // Invalidate Redis cache for this gateway
              if (!category && !pattern) {
                redisDeleted += await invalidateModelsCache(gateway);
              }
            } else {
              // Invalidate all model caches
              revalidateTag(CACHE_TAGS.MODELS_ALL);
              invalidatedTags.push(CACHE_TAGS.MODELS_ALL);

              // Invalidate main pages
              revalidatePath('/models');
              revalidatePath('/');
              invalidatedPaths.push('/models', '/');

              // Invalidate all Redis models cache
              if (!category && !pattern) {
                redisDeleted += await invalidateModelsCache();
              }
            }
            break;

          case 'model-detail':
            if (modelId) {
              const tag = CACHE_TAGS.MODEL_DETAIL(modelId);
              revalidateTag(tag);
              invalidatedTags.push(tag);

              revalidatePath(`/models/${modelId}`);
              invalidatedPaths.push(`/models/${modelId}`);
            }
            break;

          case 'rankings':
            revalidateTag(CACHE_TAGS.RANKINGS);
            revalidatePath('/rankings');
            invalidatedTags.push('/rankings');

            // Invalidate Redis rankings cache
            if (!category && !pattern) {
              redisDeleted += await cacheInvalidate(`${CACHE_PREFIX.RANKINGS}:*`);
            }
            break;

          case 'search':
            revalidateTag(CACHE_TAGS.MODELS_SEARCH);
            invalidatedTags.push(CACHE_TAGS.MODELS_SEARCH);
            break;

          default:
            if (!category && !pattern) {
              throw new Error(`Invalid cache type: ${type}`);
            }
        }

        console.log(`[Cache] Invalidated: tags=[${invalidatedTags.join(', ')}] paths=[${invalidatedPaths.join(', ')}] redis=${redisDeleted}`);

        span.setAttribute('invalidated_tags', invalidatedTags.length);
        span.setAttribute('invalidated_paths', invalidatedPaths.length);
        span.setAttribute('redis_deleted', redisDeleted);
        span.setAttribute('status', 'success');

        return NextResponse.json({
          success: true,
          invalidated: {
            tags: invalidatedTags,
            paths: invalidatedPaths,
            redis_entries: redisDeleted
          },
          timestamp: Date.now()
        });

      } catch (error) {
        console.error('Cache invalidation error:', error);

        span.setAttribute('error', true);
        span.setAttribute('error_message', error instanceof Error ? error.message : 'Unknown error');

        Sentry.captureException(error, {
          tags: {
            api_route: '/api/cache/invalidate',
            error_type: 'cache_invalidation_error'
          }
        });

        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : 'Cache invalidation failed',
            timestamp: Date.now()
          },
          { status: 500 }
        );
      }
    }
  );
}

// GET endpoint to check cache status and metrics
export async function GET(request: NextRequest) {
  const auth = verifyBearerSecret(
    request.headers.get('authorization'),
    'CACHE_WARMING_SECRET'
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const gateway = searchParams.get('gateway');
    const pattern = searchParams.get('pattern') || `${CACHE_PREFIX.MODELS}:*`;

    if (!isAllowedCachePattern(pattern)) {
      return NextResponse.json({ error: 'Invalid pattern' }, { status: 400 });
    }
    const includeMetrics = searchParams.get('metrics') === 'true';

    // Get Redis cache keys matching pattern
    const keys = await cacheKeys(pattern);

    const status: any = {
      cache_type: gateway ? 'gateway' : 'all',
      gateway: gateway || 'all',
      timestamp: Date.now(),
      status: 'active',
      redis: {
        total_keys: keys.length,
        pattern,
      },
    };

    // Optionally include sample keys (first 100)
    if (keys.length <= 100) {
      status.redis.keys = keys;
    } else {
      status.redis.keys = keys.slice(0, 100);
      status.redis.note = `Showing first 100 of ${keys.length} keys`;
    }

    // Include cache metrics if requested
    if (includeMetrics) {
      status.metrics = getCacheMetrics();
    }

    return NextResponse.json(status);

  } catch (error) {
    console.error('Cache status error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache status' },
      { status: 500 }
    );
  }
}