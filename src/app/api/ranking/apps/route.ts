import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fallback data when backend is unavailable
const FALLBACK_RANKING_APPS = {
  success: true,
  data: [],
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
      
      if (lastError.name === 'AbortError') {
        console.warn(`[Ranking Apps API] Request timed out (attempt ${attempt + 1}/${maxRetries + 1})`);
      } else {
        console.warn(`[Ranking Apps API] Fetch error (attempt ${attempt + 1}/${maxRetries + 1}):`, lastError.message);
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

// GET /api/ranking/apps - Proxy to backend ranking apps endpoint
export async function GET() {
  try {
    const url = `${API_BASE_URL}/ranking/apps`;

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Ranking Apps API] Backend error:', response.status, errorText);
      return NextResponse.json(FALLBACK_RANKING_APPS, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Ranking Apps API] Failed to fetch from backend:', errorMessage);
    return NextResponse.json(FALLBACK_RANKING_APPS, { status: 200 });
  }
}
