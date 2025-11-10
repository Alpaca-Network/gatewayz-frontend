import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { CHAT_HISTORY_API_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/chat/search - Search sessions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 20 } = body;

    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const url = `${CHAT_HISTORY_API_URL}/v1/chat/search`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, limit })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to search sessions' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Search API');
  }
}
