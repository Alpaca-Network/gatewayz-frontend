import { NextRequest, NextResponse } from 'next/server';
import { modelSyncService } from '@/lib/model-sync-service';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/sync/models - Manual sync trigger
export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'POST /api/sync/models',
    },
    async (span) => {
      try {
        const body = await request.json();
        const { gateway = 'all' } = body;

        span.setAttribute('gateway', gateway);

        console.log(`[Sync] Manual sync triggered for: ${gateway}`);

        let results;
        if (gateway === 'all') {
          results = await modelSyncService.performFullSync();
        } else {
          const result = await modelSyncService.syncGateway(gateway);
          results = [result];
        }

        const summary = {
          totalGateways: results.length,
          totalModels: results.reduce((sum, r) => sum + r.totalModels, 0),
          newModels: results.reduce((sum, r) => sum + r.newModels, 0),
          updatedModels: results.reduce((sum, r) => sum + r.updatedModels, 0),
          removedModels: results.reduce((sum, r) => sum + r.removedModels, 0),
          errors: results.filter(r => r.errors && r.errors.length > 0).length,
          timestamp: Date.now()
        };

        span.setAttribute('total_models', summary.totalModels);
        span.setAttribute('new_models', summary.newModels);
        span.setAttribute('status', 'success');

        console.log(`[Sync] Manual sync complete: ${summary.totalModels} models, ${summary.newModels} new`);

        return NextResponse.json({
          success: true,
          gateway,
          summary,
          details: results
        });

      } catch (error) {
        console.error('Manual sync error:', error);

        span.setAttribute('error', true);
        span.setAttribute('error_message', error instanceof Error ? error.message : 'Unknown error');

        Sentry.captureException(error, {
          tags: {
            api_route: '/api/sync/models',
            error_type: 'manual_sync_error'
          }
        });

        return NextResponse.json(
          { 
            error: error instanceof Error ? error.message : 'Manual sync failed',
            timestamp: Date.now()
          },
          { status: 500 }
        );
      }
    }
  );
}

// GET /api/sync/status - Get sync status
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const gateway = searchParams.get('gateway');

    const status = modelSyncService.getSyncStatus();
    
    if (gateway) {
      const gatewayStatus = status.find(s => s.gateway === gateway);
      return NextResponse.json({
        gateway,
        status: gatewayStatus || null,
        timestamp: Date.now()
      });
    }

    return NextResponse.json({
      gateways: status,
      totalGateways: status.length,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}