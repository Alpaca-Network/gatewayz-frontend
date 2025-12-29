import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config';
import { validateApiKey } from '@/app/api/middleware/auth';

/**
 * GET /api/chat/share/[token]
 * Get a shared chat by its token (public endpoint, no auth required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Call backend API to get shared chat (public endpoint)
    const response = await fetch(
      `${API_BASE_URL}/v1/chat/share/${token}`,
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
    return NextResponse.json({
      success: true,
      data: data,
    });

  } catch (error) {
    console.error('Error fetching shared chat:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/share/[token]
 * Delete a share link by its token (requires authentication)
 *
 * Note: The backend DELETE endpoint accepts either a token or an ID.
 * This route uses the token from the URL path for consistency with GET.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Validate API key using existing middleware
    const { key: apiKey, error } = await validateApiKey(request);
    if (error) {
      return error;
    }

    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Call backend API to delete share link by token
    const response = await fetch(
      `${API_BASE_URL}/v1/chat/share/${token}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: errorData.detail || 'Failed to delete share link' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      message: data.message || 'Share link deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting share link:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
