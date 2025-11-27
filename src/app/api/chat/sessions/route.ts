import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { validateApiKey } from '@/app/api/middleware/auth';
import { handleApiError, HttpError } from '@/app/api/middleware/error-handler';
import { CHAT_HISTORY_API_URL } from '@/lib/config';
import { cacheAside, cacheInvalidate, cacheKey, CACHE_PREFIX, TTL } from '@/lib/cache-strategies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/chat/sessions - List all chat sessions (with Redis caching)
export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/chat/sessions' },
    async (span) => {
      try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        span.setAttribute('query_limit', limit);
        span.setAttribute('query_offset', offset);

        const { key: apiKey, error } = await validateApiKey(request);
        if (error) {
          span.setAttribute('error', true);
          span.setAttribute('error_type', 'invalid_api_key');
          return error;
        }

        // Extract user ID from API key for cache key (hash it for privacy)
        const userCacheId = Buffer.from(apiKey).toString('base64').slice(0, 16);
        const sessionsCacheKey = cacheKey(
          CACHE_PREFIX.SESSIONS,
          userCacheId,
          'list',
          `${limit}:${offset}`
        );

        // Use cache-aside pattern with Redis
        const data = await cacheAside(
          sessionsCacheKey,
          async () => {
            // Fetch from backend on cache miss
            const url = `${CHAT_HISTORY_API_URL}/v1/chat/sessions?limit=${limit}&offset=${offset}`;
            console.log(`[Cache MISS] Chat sessions API - Calling: ${url}`);

            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            });

            span.setAttribute('backend_status', response.status);
            console.log(`Chat sessions API - Response status: ${response.status}`);

            if (!response.ok) {
              span.setAttribute('error', true);
              span.setAttribute('error_type', 'backend_error');
              const errorData = await response.json().catch(() => ({}));
              throw new HttpError(
                errorData.detail || 'Failed to fetch sessions',
                response.status,
                errorData
              );
            }

            return await response.json();
          },
          TTL.SESSIONS_LIST,
          'sessions' // Metrics category
        );

        span.setStatus('ok' as any);
        span.setAttribute('sessions_count', Array.isArray(data) ? data.length : 0);
        span.setAttribute('cached', true);
        return NextResponse.json(data);
      } catch (error) {
        span.setStatus('error' as any);
        span.setAttribute('error', true);
        return handleApiError(error, 'Chat Sessions API - GET');
      }
    }
  );
}

// POST /api/chat/sessions - Create a new chat session
export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'POST /api/chat/sessions' },
    async (span) => {
      try {
        const body = await request.json();
        const { title, model } = body;

        span.setAttribute('model', model || 'default');
        span.setAttribute('has_title', !!title);

        const { key: apiKey, error } = await validateApiKey(request);
        if (error) {
          span.setAttribute('error', true);
          span.setAttribute('error_type', 'invalid_api_key');
          return error;
        }

        const url = `${CHAT_HISTORY_API_URL}/v1/chat/sessions`;
        console.log(`Chat sessions API - Creating session at: ${url}`);

        // Create abort controller with 25s timeout (less than frontend 30s timeout)
        // to prevent proxy from hanging indefinitely
        const controller = new AbortController();
        const timeoutMs = 25000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: title || `Chat ${new Date().toLocaleString()}`,
              model: model || 'openai/gpt-3.5-turbo'
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          span.setAttribute('backend_status', response.status);
          console.log(`Chat sessions API - Create response status: ${response.status}`);

          if (!response.ok) {
            span.setAttribute('error', true);
            span.setAttribute('error_type', 'backend_error');
            const error = await response.json().catch(() => ({}));
            return NextResponse.json(
              { error: error.detail || 'Failed to create session' },
              { status: response.status }
            );
          }

          const data = await response.json();
          span.setStatus('ok' as any);
          span.setAttribute('session_id', data?.id?.toString() || 'unknown');

          // Invalidate sessions list cache for this user
          const userCacheId = Buffer.from(apiKey).toString('base64').slice(0, 16);
          const cachePattern = cacheKey(CACHE_PREFIX.SESSIONS, userCacheId, '*');
          await cacheInvalidate(cachePattern).catch((err) => {
            console.warn('[Cache] Failed to invalidate sessions cache:', err);
          });

          return NextResponse.json(data);
        } catch (error) {
          clearTimeout(timeoutId);

          // Handle timeout specifically
          if (error instanceof Error && error.name === 'AbortError') {
            span.setAttribute('error', true);
            span.setAttribute('error_type', 'proxy_timeout');
            console.error(`Chat sessions API - Proxy timeout after ${timeoutMs}ms`);
            return NextResponse.json(
              { error: 'Session creation timed out. Please try again.' },
              { status: 504 }
            );
          }

          throw error;
        }
      } catch (error) {
        span.setStatus('error' as any);
        span.setAttribute('error', true);
        return handleApiError(error, 'Chat Sessions API - POST');
      }
    }
  );
}
