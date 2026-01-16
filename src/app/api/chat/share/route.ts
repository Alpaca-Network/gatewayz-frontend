import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config';
import { validateApiKey } from '@/app/api/middleware/auth';

/**
 * POST /api/chat/share
 * Create a shareable link for a chat session
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key using existing middleware
    const { key: apiKey, error } = await validateApiKey(request);
    if (error) {
      return error;
    }

    // Get request body
    const body = await request.json();
    const { session_id, expires_at } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    // Call backend API to create share link
    const response = await fetch(`${API_BASE_URL}/v1/chat/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        session_id,
        expires_at: expires_at || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to create share link' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Backend returns share_token, construct the absolute share URL
    if (!data.share_token) {
      return NextResponse.json(
        { success: false, error: 'Backend did not return a share_token' },
        { status: 500 }
      );
    }

    // Construct base URL with proper protocol
    // Always use the production URL for share links to ensure they work correctly
    // Fall back to NEXT_PUBLIC_APP_URL or localhost for development
    const baseUrl = process.env.NEXT_PUBLIC_SHARE_BASE_URL ||
                    process.env.NEXT_PUBLIC_APP_URL ||
                    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://beta.gatewayz.ai');
    const absoluteShareUrl = `${baseUrl}/share/${data.share_token}`;

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        session_id: data.session_id,
        share_token: data.share_token,
        created_by_user_id: data.created_by_user_id,
        created_at: data.created_at,
        expires_at: data.expires_at,
        view_count: data.view_count,
        last_viewed_at: data.last_viewed_at,
        is_active: data.is_active,
      },
      share_url: absoluteShareUrl,
    });

  } catch (error) {
    console.error('Error creating share link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/share
 * Get all share links created by the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Validate API key using existing middleware
    const { key: apiKey, error } = await validateApiKey(request);
    if (error) {
      return error;
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    // Call backend API to get user's share links
    const response = await fetch(
      `${API_BASE_URL}/v1/chat/share?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch share links' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching share links:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
