import { NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Safely parse JSON response, handling cases where backend returns HTML error pages
 * This prevents "Unexpected token '<'" errors when the backend fails
 */
async function safeParseJson(response: Response): Promise<{ success: boolean; data?: any; error?: string }> {
  const contentType = response.headers.get('content-type') || '';
  
  // Check if response is HTML (error page from backend)
  if (contentType.includes('text/html')) {
    const text = await response.text();
    console.error('[Ranking Models API] Backend returned HTML instead of JSON:', text.substring(0, 200));
    return { 
      success: false, 
      error: 'Backend service unavailable - returned HTML error page' 
    };
  }
  
  // Check if response is JSON
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    console.error('[Ranking Models API] Unexpected content-type:', contentType, 'Body:', text.substring(0, 200));
    return { 
      success: false, 
      error: `Unexpected response format: ${contentType}` 
    };
  }
  
  try {
    const data = await response.json();
    return { success: true, data };
  } catch (parseError) {
    console.error('[Ranking Models API] JSON parse error:', parseError);
    return { 
      success: false, 
      error: 'Failed to parse backend response as JSON' 
    };
  }
}

// GET /api/ranking/models - Proxy to backend ranking models endpoint
export async function GET() {
  try {
    const url = `${API_BASE_URL}/ranking/models`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', response.status, errorText.substring(0, 200));
      return NextResponse.json(
        { success: false, error: 'Failed to fetch ranking models', data: [] },
        { status: response.status }
      );
    }

    // Safely parse the JSON response
    const parseResult = await safeParseJson(response);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error, data: [] },
        { status: 502 } // Bad Gateway - backend returned invalid response
      );
    }

    return NextResponse.json(parseResult.data);
  } catch (error) {
    return handleApiError(error, 'Ranking Models API');
  }
}
