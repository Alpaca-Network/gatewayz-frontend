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

/** The signed-in account behind an API key, as the backend reports it. */
export interface AuthenticatedAccount {
  email: string;
  userId: string;
  /** Present only once the backend includes it in GET /user/profile. */
  stripeCustomerId: string | null;
}

/**
 * Resolves the authenticated caller's account (email, user id and, when the
 * backend provides it, Stripe customer id) server-side by validating their API
 * key against the backend, rather than trusting anything client-supplied.
 *
 * @returns `{ account }` on success, or `{ error }` (a ready-to-return
 * NextResponse) on failure.
 */
export async function resolveAuthenticatedAccount(
  request: NextRequest
): Promise<{ account: AuthenticatedAccount; error?: undefined } | { account?: undefined; error: NextResponse }> {
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
    const userId = profile?.user_id;
    if (
      !profile ||
      typeof profile.email !== 'string' ||
      !profile.email ||
      (typeof userId !== 'number' && typeof userId !== 'string') ||
      String(userId) === ''
    ) {
      return {
        error: NextResponse.json(
          { error: 'Unable to resolve account for this API key' },
          { status: 401 }
        ),
      };
    }

    const stripeCustomerId =
      typeof profile.stripe_customer_id === 'string' && profile.stripe_customer_id.startsWith('cus_')
        ? profile.stripe_customer_id
        : null;

    return { account: { email: profile.email, userId: String(userId), stripeCustomerId } };
  } catch (e) {
    console.error('[resolveAuthenticatedAccount] Failed to verify API key:', e instanceof Error ? e.name : 'unknown');
    return {
      error: NextResponse.json(
        { error: 'Failed to verify authentication' },
        { status: 502 }
      ),
    };
  }
}
