import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * POST /api/chat/share
 * Create a shareable link for a chat session
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's API key
    const { data: userData, error: apiKeyError } = await supabase
      .from('users')
      .select('api_key')
      .eq('id', user.id)
      .single();

    if (apiKeyError || !userData?.api_key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 401 }
      );
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
    const response = await fetch(`${BACKEND_API_URL}/v1/chat/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userData.api_key}`,
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

    // Convert the relative share URL to an absolute URL
    const shareUrl = data.share_url;
    const absoluteShareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${shareUrl}`;

    return NextResponse.json({
      ...data,
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
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's API key
    const { data: userData, error: apiKeyError } = await supabase
      .from('users')
      .select('api_key')
      .eq('id', user.id)
      .single();

    if (apiKeyError || !userData?.api_key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    // Call backend API to get user's share links
    const response = await fetch(
      `${BACKEND_API_URL}/v1/chat/share?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${userData.api_key}`,
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
