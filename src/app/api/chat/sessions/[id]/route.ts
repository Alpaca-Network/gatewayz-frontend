import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { CHAT_HISTORY_API_URL } from '@/lib/config';
import { ChatCacheInvalidation } from '@/lib/chat-cache-invalidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/chat/sessions/[id] - Get specific session with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    const url = `${CHAT_HISTORY_API_URL}/v1/chat/sessions/${id}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to fetch session' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Session API - GET');
  }
}

// PUT /api/chat/sessions/[id] - Update session details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, model } = body;

    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    const url = `${CHAT_HISTORY_API_URL}/v1/chat/sessions/${id}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, model })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to update session' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Invalidate caches when session is updated (title/model changed)
    await ChatCacheInvalidation.onSessionUpdate(apiKey).catch((err) => {
      console.warn('[Cache] Failed to invalidate caches:', err);
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Session API - PUT');
  }
}

// DELETE /api/chat/sessions/[id] - Delete session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    const url = `${CHAT_HISTORY_API_URL}/v1/chat/sessions/${id}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to delete session' },
        { status: response.status }
      );
    }

    // Invalidate caches when session is deleted
    await ChatCacheInvalidation.onSessionDelete(apiKey).catch((err) => {
      console.warn('[Cache] Failed to invalidate caches:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Chat Session API - DELETE');
  }
}
