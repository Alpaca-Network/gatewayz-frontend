import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { CHAT_HISTORY_API_URL } from '@/lib/config';
import { cacheAside, cacheKey, CACHE_PREFIX, TTL } from '@/lib/cache-strategies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/chat/stats - Get session statistics
export async function GET(request: NextRequest) {
  try {
    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    // Extract user ID from API key for cache key (hash it for privacy)
    const userHash = Buffer.from(apiKey).toString('base64').slice(0, 16);
    const cacheKeyStr = cacheKey(CACHE_PREFIX.STATS, 'chat', userHash);

    // Use cache-aside pattern with 10-minute TTL
    // Stats change infrequently (only on new sessions/messages)
    const data = await cacheAside(
      cacheKeyStr,
      async () => {
        // Fetch from backend on cache miss
        const url = `${CHAT_HISTORY_API_URL}/v1/chat/stats`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.detail || 'Failed to fetch stats');
        }

        return await response.json();
      },
      TTL.CHAT_STATS, // 10 minutes
      'chat-stats' // Metrics category
    );

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Stats API');
  }
}
