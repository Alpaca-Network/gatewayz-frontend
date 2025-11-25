/**
 * POST /api/auth/invalidate
 *
 * Endpoint to invalidate sessions on critical account changes
 * This is called after password changes, email changes, etc.
 *
 * Request:
 *   Authorization: Bearer <api_key>
 *   {
 *     reason: 'password_changed' | 'email_changed' | 'mfa_changed' | 'manual'
 *     logout_other_sessions: boolean (default: true)
 *   }
 *
 * Response:
 *   {
 *     success: boolean
 *     session_invalidation_id: string (new invalidation ID)
 *     message: string
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

const BACKEND_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
const BACKEND_TIMEOUT_MS = 15000;

interface InvalidateSessionRequest {
  reason: 'password_changed' | 'email_changed' | 'mfa_changed' | 'manual';
  logout_other_sessions?: boolean;
}

interface InvalidateSessionResponse {
  success: boolean;
  session_invalidation_id?: string;
  message?: string;
  error?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<InvalidateSessionResponse>> {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing authorization header',
        },
        { status: 401 }
      );
    }

    const body = await req.json() as InvalidateSessionRequest;

    if (!body.reason) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing reason parameter',
        },
        { status: 400 }
      );
    }

    // Call backend to invalidate sessions
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

    try {
      const response = await fetch(`${BACKEND_API_BASE}/v1/auth/invalidate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: body.reason,
          logout_other_sessions: body.logout_other_sessions ?? true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[session-invalidation] Backend invalidation failed:', response.status, errorText);

        Sentry.captureException(
          new Error(`Session invalidation failed: ${response.status}`),
          {
            tags: { service: 'auth', endpoint: 'invalidate' },
            contexts: { http: { status: response.status } },
          }
        );

        return NextResponse.json(
          {
            success: false,
            error: 'Failed to invalidate session',
          },
          { status: response.status }
        );
      }

      const data = await response.json();

      Sentry.addBreadcrumb({
        category: 'auth',
        message: `Sessions invalidated: ${body.reason}`,
        level: 'info',
        data: {
          reason: body.reason,
          logout_other_sessions: body.logout_other_sessions,
        },
      });

      return NextResponse.json({
        success: true,
        session_invalidation_id: data.session_invalidation_id,
        message: data.message,
      });
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[session-invalidation] Backend request timeout');
        return NextResponse.json(
          {
            success: false,
            error: 'Request timeout',
          },
          { status: 504 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error('[session-invalidation] Invalidation endpoint error:', error);

    Sentry.captureException(error, {
      tags: { service: 'auth', endpoint: 'invalidate' },
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
