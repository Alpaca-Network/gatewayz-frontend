import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

/**
 * API route proxy for /models/unique endpoint
 *
 * This route proxies requests from the client to the backend /models/unique endpoint.
 * It's needed because client-side fetch requests would otherwise hit CORS issues.
 *
 * Query parameters:
 * - min_providers: Minimum number of providers required
 * - sort_by: Sort field (provider_count, name, cheapest_price, newest)
 * - order: Sort direction (asc, desc)
 * - limit: Results per page
 * - offset: Pagination offset
 * - search: Search query
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Forward all query parameters to backend
    const backendUrl = `${API_BASE_URL}/models/unique?${searchParams.toString()}`;

    console.log(`[API /models/unique] Proxying request to backend: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Use Next.js caching with revalidation
      next: {
        revalidate: 300, // Cache for 5 minutes
        tags: ['models:unique', 'models:all']
      }
    });

    if (!response.ok) {
      console.error(`[API /models/unique] Backend error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log(`[API /models/unique] Successfully fetched ${data.data?.length || 0} unique models`);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error: any) {
    console.error('[API /models/unique] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
