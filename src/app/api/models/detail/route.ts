import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

import { getModelsForGateway } from '@/lib/models-service';
import {
  findModelByRouteParams,
  getModelGateways,
  getRelatedModels,
  type ModelDetailRecord,
} from '@/lib/model-detail-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/models/detail' },
    async (span) => {
      const searchParams = request.nextUrl.searchParams;
      const modelId = searchParams.get('modelId') || undefined;
      const developer = searchParams.get('developer') || undefined;
      const modelName = searchParams.get('modelName') || undefined;

      if (!modelId && (!developer || !modelName)) {
        span.setAttribute('error', 'missing_params');
        return NextResponse.json(
          { error: 'modelId or developer and modelName are required' },
          { status: 400 }
        );
      }

      const lookupParams = { modelId, developer, modelNameParam: modelName };

      let gatewayModels: ModelDetailRecord[] = [];
      let gatewayFetchFailed = false;

      try {
        const gatewayResult = await getModelsForGateway('all');
        gatewayModels = Array.isArray(gatewayResult?.data) ? gatewayResult.data : [];
        span.setAttribute('models_checked', gatewayModels.length);
      } catch (error) {
        gatewayFetchFailed = true;
        console.warn('[ModelDetail] Failed to fetch gateway models', error);
        Sentry.captureException(error, {
          tags: { api_route: '/api/models/detail', stage: 'gateway_fetch' },
        });
      }

      try {
        const targetModel = gatewayFetchFailed
          ? undefined
          : findModelByRouteParams(gatewayModels, lookupParams);

        if (!targetModel) {
          span.setAttribute('status', gatewayFetchFailed ? 'upstream_error' : 'not_found');
          return NextResponse.json(
            { error: 'Model not found' },
            { status: gatewayFetchFailed ? 502 : 404 }
          );
        }

        const providers = getModelGateways(targetModel);
        const related = getRelatedModels(gatewayModels, targetModel, 12);

        span.setAttribute('status', 'success');
        span.setAttribute('provider_count', providers.length);
        span.setAttribute('data_source', 'gateway');

        return NextResponse.json({
          data: targetModel,
          providers,
          related,
          source: 'gateway',
        });
      } catch (error) {
        console.error('[ModelDetail] Unexpected error resolving model detail:', error);
        Sentry.captureException(error, {
          tags: { api_route: '/api/models/detail', stage: 'resolve' },
        });
        span.setAttribute('error', true);
        span.setAttribute('error_message', error instanceof Error ? error.message : 'Unknown error');

        return NextResponse.json(
          { error: 'Failed to fetch model detail' },
          { status: 500 }
        );
      }
    }
  );
}
