import { NextRequest, NextResponse } from 'next/server';
import { getAssetSummary, getDemoAssets } from '@/lib/asset-insights-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/insights/assets/[id]
 * Returns detailed summary for a specific asset
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);

    // Get assets (demo data for now, would integrate with real data source)
    const assets = getDemoAssets();
    const asset = assets.find(a => a.id === decodedId);

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    const summary = getAssetSummary(asset);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error fetching asset summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset summary' },
      { status: 500 }
    );
  }
}
