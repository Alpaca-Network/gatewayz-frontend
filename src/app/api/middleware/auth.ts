import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config';

/**
 * Validates API key from Authorization header
 * @param request - Next.js request object
 * @returns Object containing the API key or an error response
 */
export async function validateApiKey(request: NextRequest): Promise<{
  key: string;
  error?: NextResponse
}> {
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    return {
      key: '',
      error: NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      )
    };
  }

  return { key: apiKey };
}

/**
 * Extracts API key from Authorization header without validation
 * @param request - Next.js request object
 * @returns API key string or null
 */
export function getApiKey(request: NextRequest): string | null {
  return request.headers.get('authorization')?.replace('Bearer ', '') || null;
}

/**
 * Resolves the authenticated caller's email server-side by validating their
 * API key against the backend, rather than trusting a client-supplied email.
 *
 * Use this anywhere an endpoint would otherwise take an `email` field from
 * the request body/query and use it to look up a billing account — without
 * this, any caller can act on any account by simply naming its email.
 *
 * @returns `{ email }` on success, or `{ error }` (a ready-to-return
 * NextResponse) on failure.
 */
export async function resolveAuthenticatedEmail(
  request: NextRequest
): Promise<{ email: string; error?: undefined } | { email?: undefined; error: NextResponse }> {
  const { key: apiKey, error } = await validateApiKey(request);
  if (error) {
    return { error };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        error: NextResponse.json(
          { error: 'Invalid or expired API key' },
          { status: response.status === 404 ? 401 : response.status }
        ),
      };
    }

    const profile = await response.json();
    if (!profile || typeof profile.email !== 'string' || !profile.email) {
      return {
        error: NextResponse.json(
          { error: 'Unable to resolve account email for this API key' },
          { status: 401 }
        ),
      };
    }

    return { email: profile.email };
  } catch (e) {
    console.error('[resolveAuthenticatedEmail] Failed to verify API key:', e);
    return {
      error: NextResponse.json(
        { error: 'Failed to verify authentication' },
        { status: 502 }
      ),
    };
  }
}
