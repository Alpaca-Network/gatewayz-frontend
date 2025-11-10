import { NextRequest, NextResponse } from 'next/server';

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
