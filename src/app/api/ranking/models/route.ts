import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Default fallback data when backend is unavailable
const FALLBACK_RANKING_MODELS = {
  success: true,
  data: [
    {
      id: 1,
      rank: 1,
      model_name: 'Gemini 2.5 Pro',
      author: 'google',
      tokens: '170.06',
      trend_percentage: '13.06%',
      trend_direction: 'up' as const,
      trend_icon: '↑',
      trend_color: 'green',
      model_url: '/models/google/gemini-2.5-pro',
      author_url: '/models?author=google',
      time_period: 'weekly',
      scraped_at: new Date().toISOString(),
      logo_url: '/Google_Logo-black.svg',
    },
    {
      id: 2,
      rank: 2,
      model_name: 'GPT-4',
      author: 'openai',
      tokens: '20.98',
      trend_percentage: '0%',
      trend_direction: 'up' as const,
      trend_icon: '-',
      trend_color: 'gray',
      model_url: '/models/openai/gpt-4',
      author_url: '/models?author=openai',
      time_period: 'weekly',
      scraped_at: new Date().toISOString(),
      logo_url: '/OpenAI_Logo-black.svg',
    },
    {
      id: 3,
      rank: 3,
      model_name: 'Claude Sonnet 4',
      author: 'anthropic',
      tokens: '585.26',
      trend_percentage: '9.04%',
      trend_direction: 'down' as const,
      trend_icon: '↓',
      trend_color: 'red',
      model_url: '/models/anthropic/claude-sonnet-4',
      author_url: '/models?author=anthropic',
      time_period: 'weekly',
      scraped_at: new Date().toISOString(),
      logo_url: '/anthropic-logo.svg',
    },
  ],
  is_fallback: true,
};

// Request timeout in milliseconds
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Fetch with timeout and abort controller
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, REQUEST_TIMEOUT_MS);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on abort errors (timeout)
      if (lastError.name === 'AbortError') {
        console.warn(`[Ranking Models API] Request timed out (attempt ${attempt + 1}/${maxRetries + 1})`);
      } else {
        console.warn(`[Ranking Models API] Fetch error (attempt ${attempt + 1}/${maxRetries + 1}):`, lastError.message);
      }

      // Wait before retrying (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

// GET /api/ranking/models - Proxy to backend ranking models endpoint
export async function GET() {
  try {
    const url = `${API_BASE_URL}/ranking/models`;

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Ranking Models API] Backend error:', response.status, errorText);
      
      // Return fallback data with 200 status to prevent frontend errors
      // The is_fallback flag indicates this is not live data
      return NextResponse.json(FALLBACK_RANKING_MODELS, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    // Log the error but don't send to Sentry for network issues
    // These are often transient and expected on poor connections
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Ranking Models API] Failed to fetch from backend:', errorMessage);

    // Return fallback data instead of error response
    // This prevents "Failed to fetch" errors on the frontend
    return NextResponse.json(FALLBACK_RANKING_MODELS, { status: 200 });
  }
}
