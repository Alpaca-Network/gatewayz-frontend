import { NextRequest, NextResponse } from 'next/server';
import {
  AssetFilters,
  AssetType,
} from '@/lib/sentry-assets-types';
import {
  getAssetList,
  getDemoAssets,
  mergeWithDemoAssets,
} from '@/lib/asset-insights-service';

/**
 * GET /api/insights/assets
 * Returns paginated list of asset performance data with metrics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const filters: AssetFilters = {
      assetType: (searchParams.get('assetType') as AssetType | 'all') || 'all',
      renderBlocking: searchParams.get('renderBlocking') === 'true'
        ? true
        : searchParams.get('renderBlocking') === 'false'
          ? false
          : 'all',
      page: searchParams.get('pageContext') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: (searchParams.get('sortBy') as AssetFilters['sortBy']) || 'timeSpent',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    // Get assets from client-side storage (passed in body for POST)
    // For GET, we use demo data or any server-side cached data
    const clientAssets = searchParams.get('assets');
    let assets = getDemoAssets();

    if (clientAssets) {
      try {
        const parsedAssets = JSON.parse(clientAssets);
        if (Array.isArray(parsedAssets) && parsedAssets.length > 0) {
          assets = mergeWithDemoAssets(parsedAssets);
        }
      } catch {
        // Use demo assets on parse error
      }
    }

    const result = getAssetList(assets, filters, page, pageSize);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/insights/assets
 * Accepts client-side asset data for processing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assets: clientAssets, filters, page = 1, pageSize = 20 } = body;

    // Merge client assets with demo data
    const assets = clientAssets && Array.isArray(clientAssets) && clientAssets.length > 0
      ? mergeWithDemoAssets(clientAssets)
      : getDemoAssets();

    const result = getAssetList(
      assets,
      filters || {},
      page,
      pageSize
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing assets:', error);
    return NextResponse.json(
      { error: 'Failed to process asset data' },
      { status: 500 }
    );
  }
}
