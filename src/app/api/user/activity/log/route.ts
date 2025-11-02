import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/user/activity/log - Get activity log
export async function GET(request: NextRequest) {
  try {
    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';

    const url = new URL(`${API_BASE_URL}/user/activity/log`);
    if (from) url.searchParams.set('from', from);
    if (to) url.searchParams.set('to', to);
    url.searchParams.set('page', page);
    url.searchParams.set('limit', limit);

    console.log(`Activity log API - Calling: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
    });

    console.log(`Activity log API - Response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`Activity log API - Backend error:`, error);
      return NextResponse.json(
        { error: error.detail || 'Failed to fetch activity log' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Activity Log API');
  }
}
