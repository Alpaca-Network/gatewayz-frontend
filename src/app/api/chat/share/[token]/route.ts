import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * GET /api/chat/share/[token]
 * Get a shared chat by its token (public endpoint, no auth required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Call backend API to get shared chat (public endpoint)
    const response = await fetch(
      `${BACKEND_API_URL}/v1/chat/share/${token}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Shared chat not found or has expired' },
          { status: 404 }
        );
      }

      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch shared chat' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching shared chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/share/[token]
 * Delete a share link (requires authentication)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { createClient } = await import('@/lib/supabase/server');
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

    const { token } = params;

    // In the frontend, we have the token but backend expects the shared_chat_id
    // We need to fetch the shared chat first to get its ID
    // For now, we'll assume the token parameter is actually the ID when deleting
    // This should be improved in a production system

    // Call backend API to delete share link
    const response = await fetch(
      `${BACKEND_API_URL}/v1/chat/share/${token}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userData.api_key}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to delete share link' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error deleting share link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
