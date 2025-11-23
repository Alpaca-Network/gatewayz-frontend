import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { validateApiKey } from '@/app/api/middleware/auth';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/user/activity/stats - Get activity statistics
export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/user/activity/stats' },
    async (span) => {
      try {
        const { key: apiKey, error } = await validateApiKey(request);
        if (error) {
          span.setAttribute('error', true);
          span.setAttribute('error_type', 'invalid_api_key');
          return error;
        }

        // Get query parameters
        const searchParams = request.nextUrl.searchParams;
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        span.setAttribute('date_from', from || 'unset');
        span.setAttribute('date_to', to || 'unset');

        const url = new URL(`${API_BASE_URL}/user/activity/stats`);
        if (from) url.searchParams.set('from', from);
        if (to) url.searchParams.set('to', to);

        console.log(`Activity stats API - Calling: ${url.toString()}`);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
        });

        span.setAttribute('backend_status', response.status);
        console.log(`Activity stats API - Response status: ${response.status}`);

        if (!response.ok) {
          span.setAttribute('error', true);
          span.setAttribute('error_type', 'backend_error');
          const error = await response.json().catch(() => ({}));
          console.error(`Activity stats API - Backend error:`, error);
          return NextResponse.json(
            { error: error.detail || 'Failed to fetch activity stats' },
            { status: response.status }
          );
        }

        const data = await response.json();
        span.setStatus('ok' as any);
        span.setAttribute('data_size', JSON.stringify(data).length);
        return NextResponse.json(data);
      } catch (error) {
        span.setStatus('error' as any);
        span.setAttribute('error', true);
        return handleApiError(error, 'Activity Stats API');
      }
    }
  );
}
