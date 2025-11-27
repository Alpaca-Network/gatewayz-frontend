import { NextRequest, NextResponse } from 'next/server';
import { metricsService } from '@/lib/redis-metrics';

/**
 * POST /api/metrics/chat
 *
 * Record chat metrics from client or server
 * Used for tracking performance metrics (TTFT, latency, errors)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.model) {
      return NextResponse.json(
        { error: 'Missing required field: model' },
        { status: 400 }
      );
    }

    // Fire-and-forget metric recording (don't await to avoid blocking)
    metricsService
      .recordRequestComplete({
        model: body.model,
        gateway: body.gateway,
        provider: body.provider,
        session_id: body.session_id,
        ttft_ms: body.ttft_ms,
        total_time_ms: body.total_time_ms,
        network_time_ms: body.network_time_ms,
        backend_time_ms: body.backend_time_ms,
        success: body.success ?? true,
        error_type: body.error_type,
      })
      .catch((error) => {
        console.error('[API /metrics/chat] Failed to record metrics:', error);
      });

    // Return immediately
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /metrics/chat] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
