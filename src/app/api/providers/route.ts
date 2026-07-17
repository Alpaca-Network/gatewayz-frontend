import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/providers - Proxy to the backend PUBLIC provider catalog.
 *
 * Uses backend `GET /v1/provider` (public, wrapped `{ data, total, ... }`).
 * The `/providers*` router on the backend is admin-gated (require_admin_or_env_key),
 * so the public frontend must NOT call it — this proxy targets `/v1/provider`.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params = new URLSearchParams();
    const gateway = searchParams.get('gateway');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    if (gateway) params.set('gateway', gateway);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);

    const qs = params.toString();
    const url = `${API_BASE_URL}/v1/provider${qs ? `?${qs}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Providers API] Backend error:', response.status, errorText.substring(0, 200));
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers', data: [] },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error(`[Providers API] Expected JSON but got ${contentType}:`, responseText.substring(0, 200));
      return NextResponse.json(
        { success: false, error: 'Backend returned non-JSON response', data: [] },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Providers API');
  }
}
