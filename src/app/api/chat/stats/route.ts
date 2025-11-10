import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { CHAT_HISTORY_API_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/chat/stats - Get session statistics
export async function GET(request: NextRequest) {
  try {
    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    const url = `${CHAT_HISTORY_API_URL}/v1/chat/stats`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to fetch stats' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Stats API');
  }
}
