import { NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/ranking/models - Proxy to backend ranking models endpoint
export async function GET() {
  try {
    const url = `${API_BASE_URL}/ranking/models`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch ranking models', data: [] },
        { status: response.status }
      );
    }

    // Check content-type to ensure we're receiving JSON, not HTML error pages
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error(
        `[Ranking Models API] Expected JSON but got ${contentType}:`,
        responseText.substring(0, 200)
      );
      return NextResponse.json(
        { success: false, error: 'Backend returned non-JSON response', data: [] },
        { status: 502 }
      );
    }

    // Safely parse JSON response
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        '[Ranking Models API] Failed to parse JSON response:',
        responseText.substring(0, 200)
      );
      return NextResponse.json(
        { success: false, error: 'Invalid JSON response from backend', data: [] },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Ranking Models API');
  }
}
