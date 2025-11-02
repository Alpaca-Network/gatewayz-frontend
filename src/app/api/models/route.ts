import { NextRequest, NextResponse } from 'next/server';
import { getModelsForGateway } from '@/lib/models-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/models - Get models from specified gateway
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const gateway = searchParams.get('gateway');
    const limit = searchParams.get('limit');

    if (!gateway) {
      return NextResponse.json(
        { error: 'Gateway parameter required' },
        { status: 400 }
      );
    }

    const data = await getModelsForGateway(gateway, limit ? parseInt(limit) : undefined);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
