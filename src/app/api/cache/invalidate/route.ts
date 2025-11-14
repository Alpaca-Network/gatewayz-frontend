import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';

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
      try {
        const body = await request.json();
        const { gateway, modelId, type = 'models' } = body;

        span.setAttribute('cache_type', type);
        span.setAttribute('gateway', gateway || 'none');
        span.setAttribute('model_id', modelId || 'none');

        let invalidatedPaths: string[] = [];
        let invalidatedTags: string[] = [];

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
            } else {
              // Invalidate all model caches
              revalidateTag(CACHE_TAGS.MODELS_ALL);
              invalidatedTags.push(CACHE_TAGS.MODELS_ALL);
              
              // Invalidate main pages
              revalidatePath('/models');
              revalidatePath('/');
              invalidatedPaths.push('/models', '/');
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
            break;

          case 'search':
            revalidateTag(CACHE_TAGS.MODELS_SEARCH);
            invalidatedTags.push(CACHE_TAGS.MODELS_SEARCH);
            break;

          default:
            throw new Error(`Invalid cache type: ${type}`);
        }

        console.log(`[Cache] Invalidated: tags=[${invalidatedTags.join(', ')}] paths=[${invalidatedPaths.join(', ')}]`);

        span.setAttribute('invalidated_tags', invalidatedTags.length);
        span.setAttribute('invalidated_paths', invalidatedPaths.length);
        span.setAttribute('status', 'success');

        return NextResponse.json({
          success: true,
          invalidated: {
            tags: invalidatedTags,
            paths: invalidatedPaths
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

// GET endpoint to check cache status
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const gateway = searchParams.get('gateway');

    // This would typically integrate with your cache storage system
    // For now, return basic status information
    
    const status = {
      cache_type: gateway ? 'gateway' : 'all',
      gateway: gateway || 'all',
      timestamp: Date.now(),
      status: 'active',
      // You could add more detailed cache metrics here
    };

    return NextResponse.json(status);

  } catch (error) {
    console.error('Cache status error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache status' },
      { status: 500 }
    );
  }
}