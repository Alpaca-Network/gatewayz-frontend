import { NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fallback data for when backend is unavailable
const FALLBACK_MODELS = {
  success: true,
  data: [
    { id: 1, rank: 1, model_name: 'Gemini 2.5 Pro', author: 'google', tokens: '170.06', trend_percentage: '13.06%', trend_direction: 'up' as const, trend_icon: '↑', trend_color: 'green', model_url: '', author_url: '', time_period: '24h', scraped_at: new Date().toISOString(), logo_url: '/Google_Logo-black.svg' },
    { id: 2, rank: 2, model_name: 'GPT-4', author: 'openai', tokens: '20.98', trend_percentage: '--', trend_direction: 'up' as const, trend_icon: '', trend_color: 'gray', model_url: '', author_url: '', time_period: '24h', scraped_at: new Date().toISOString(), logo_url: '/OpenAI_Logo-black.svg' },
    { id: 3, rank: 3, model_name: 'Claude Sonnet 4', author: 'anthropic', tokens: '585.26', trend_percentage: '9.04%', trend_direction: 'down' as const, trend_icon: '↓', trend_color: 'red', model_url: '', author_url: '', time_period: '24h', scraped_at: new Date().toISOString(), logo_url: '/anthropic-logo.svg' },
    { id: 4, rank: 4, model_name: 'Claude 3.5 Sonnet', author: 'anthropic', tokens: '420.50', trend_percentage: '5.2%', trend_direction: 'up' as const, trend_icon: '↑', trend_color: 'green', model_url: '', author_url: '', time_period: '24h', scraped_at: new Date().toISOString(), logo_url: '/anthropic-logo.svg' },
    { id: 5, rank: 5, model_name: 'GPT-4o', author: 'openai', tokens: '350.00', trend_percentage: '12.8%', trend_direction: 'up' as const, trend_icon: '↑', trend_color: 'green', model_url: '', author_url: '', time_period: '24h', scraped_at: new Date().toISOString(), logo_url: '/OpenAI_Logo-black.svg' },
  ],
};

// GET /api/ranking/models - Proxy to backend ranking models endpoint
export async function GET() {
  // Response headers that help with WebKit/in-app browser compatibility
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    // Prevent potential issues with response handling in WebKit
    'X-Content-Type-Options': 'nosniff',
  };

  try {
    const url = `${API_BASE_URL}/ranking/models`;

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', response.status, errorText);
      // Return fallback data with a 200 status so the client can use it
      return NextResponse.json(FALLBACK_MODELS, { 
        status: 200, 
        headers: responseHeaders 
      });
    }

    const data = await response.json();
    
    // Validate the response has expected structure
    if (!data || (!data.data && !Array.isArray(data))) {
      console.warn('Ranking models API returned unexpected structure, using fallback');
      return NextResponse.json(FALLBACK_MODELS, { 
        status: 200, 
        headers: responseHeaders 
      });
    }

    return NextResponse.json(data, { headers: responseHeaders });
  } catch (error) {
    // Handle timeout/abort errors gracefully
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Ranking models API request timed out, using fallback');
      return NextResponse.json(FALLBACK_MODELS, { 
        status: 200, 
        headers: responseHeaders 
      });
    }

    // For network errors, return fallback data instead of error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.warn('Network error fetching ranking models, using fallback');
      return NextResponse.json(FALLBACK_MODELS, { 
        status: 200, 
        headers: responseHeaders 
      });
    }

    // Log other errors but still return fallback
    console.error('Error in ranking models API:', error);
    return NextResponse.json(FALLBACK_MODELS, { 
      status: 200, 
      headers: responseHeaders 
    });
  }
}
