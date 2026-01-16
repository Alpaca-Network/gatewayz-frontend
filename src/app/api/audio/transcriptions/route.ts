import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy audio transcription requests to the backend Whisper API.
 * This route handles multipart form data containing audio files.
 */
export async function POST(request: NextRequest) {
  try {
    // Get the API key from the Authorization header
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required', detail: 'Authorization header with Bearer token is required' },
        { status: 401 }
      );
    }

    // Get the form data from the request
    const formData = await request.formData();

    // Forward the request to the backend
    const url = `${API_BASE_URL}/v1/audio/transcriptions`;
    console.log('[Audio Transcription API] Forwarding to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    console.log('[Audio Transcription API] Response status:', response.status);

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

      console.error('[Audio Transcription API] Backend error:', {
        status: response.status,
        errorData,
        errorText,
      });

      return NextResponse.json(
        {
          error: `Transcription failed: ${response.status}`,
          detail: errorData?.detail || errorText || 'Unknown error',
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Audio Transcription API] Unexpected error:', error);
    return handleApiError(error, 'Audio Transcription API');
  }
}
