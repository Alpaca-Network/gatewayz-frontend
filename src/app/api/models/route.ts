import { NextRequest, NextResponse } from 'next/server';
import { getModelsForGateway } from '@/lib/models-service';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/models - Get models from specified gateway
export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'GET /api/models',
    },
    async (span) => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const gateway = searchParams.get('gateway');
        const limit = searchParams.get('limit');

        // Add request parameters as span attributes
        span.setAttribute('gateway', gateway || 'none');
        if (limit) {
          span.setAttribute('limit', parseInt(limit));
        }

        if (!gateway) {
          span.setAttribute('error', 'missing_gateway');
          return NextResponse.json(
            { error: 'Gateway parameter required' },
            { status: 400 }
          );
        }

        const result = await getModelsForGateway(gateway, limit ? parseInt(limit) : undefined);

        // Extract the models array from the result
        const models = result.data || [];

        // Add success metrics to span
        span.setAttribute('models_count', Array.isArray(models) ? models.length : 0);
        span.setAttribute('status', 'success');

        return NextResponse.json({ data: models });
      } catch (error) {
        console.error('Error fetching models:', error);

        // Capture exception in Sentry
        Sentry.captureException(error, {
          tags: {
            api_route: '/api/models',
            error_type: 'model_fetch_error',
          },
        });

        span.setAttribute('error', true);
        span.setAttribute('error_message', error instanceof Error ? error.message : 'Unknown error');

        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to fetch models' },
          { status: 500 }
        );
      }
    }
  );
}
