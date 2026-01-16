import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy search augmentation requests to the backend.
 * This route enables web search functionality for models that don't support native tool calling.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the JSON body
    const body = await request.json();

    // Forward the request to the backend
    const url = `${API_BASE_URL}/v1/tools/search/augment`;
    console.log('[Search Augment API] Forwarding to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('[Search Augment API] Response status:', response.status);

    if (!response.ok) {
      let errorData: Record<string, unknown> | null = null;
      let errorText = '';

      try {
        errorText = await response.text();
        if (errorText) {
          try {
            errorData = JSON.parse(errorText);
          } catch {
            // Not JSON, use text as-is
          }
        }
      } catch {
        errorText = 'Failed to parse error response';
      }

      console.error('[Search Augment API] Backend error:', {
        status: response.status,
        errorData,
        errorText,
      });

      return NextResponse.json(
        {
          success: false,
          error: errorData?.detail || errorText || `Search failed: ${response.status}`,
          context: null,
          results_count: 0,
        },
        { status: 200 } // Return 200 with error in body to match expected response format
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Search Augment API] Unexpected error:', error);

    // Return error in expected format rather than throwing
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        context: null,
        results_count: 0,
      },
      { status: 200 }
    );
  }
}
