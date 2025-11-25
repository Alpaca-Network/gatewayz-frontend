/**
 * POST /api/auth/refresh
 *
 * Endpoint to refresh authentication token before expiry
 *
 * Request:
 *   Authorization: Bearer <current_api_key>
 *
 * Response:
 *   {
 *     success: boolean
 *     api_key: string (new token)
 *     expires_at: number (Unix timestamp in milliseconds)
 *     user_data: UserData
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

const BACKEND_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
const BACKEND_TIMEOUT_MS = 15000;

interface RefreshTokenRequest {
  current_api_key?: string;
}

interface RefreshTokenResponse {
  success: boolean;
  api_key: string;
  expires_at?: number;
  user_data?: Record<string, unknown>;
  error?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<RefreshTokenResponse>> {
  try {
    // Get current API key from Authorization header
    const authHeader = req.headers.get('authorization');
    const currentApiKey = authHeader?.replace('Bearer ', '');

    if (!currentApiKey) {
      return NextResponse.json(
        {
          success: false,
          api_key: '',
          error: 'Missing authorization header',
        },
        { status: 401 }
      );
    }

    // Call backend token refresh endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

    try {
      const response = await fetch(`${BACKEND_API_BASE}/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_api_key: currentApiKey,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[token-refresh] Backend refresh failed:', response.status, errorText);

        Sentry.captureException(
          new Error(`Token refresh failed: ${response.status}`),
          {
            tags: { service: 'auth', endpoint: 'refresh' },
            contexts: { http: { status: response.status } },
          }
        );

        return NextResponse.json(
          {
            success: false,
            api_key: '',
            error: 'Failed to refresh token',
          },
          { status: response.status }
        );
      }

      const data = await response.json();

      // Return new token and expiry
      return NextResponse.json({
        success: true,
        api_key: data.api_key || currentApiKey,
        expires_at: data.expires_at,
        user_data: data.user_data,
      });
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[token-refresh] Backend request timeout');
        return NextResponse.json(
          {
            success: false,
            api_key: '',
            error: 'Request timeout',
          },
          { status: 504 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error('[token-refresh] Refresh endpoint error:', error);

    Sentry.captureException(error, {
      tags: { service: 'auth', endpoint: 'refresh' },
    });

    return NextResponse.json(
      {
        success: false,
        api_key: '',
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
