import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { CHAT_HISTORY_API_URL } from '@/lib/config';
import { cacheAside, cacheKey, CACHE_PREFIX, TTL } from '@/lib/cache-strategies';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/chat/search - Search sessions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 20 } = body;

    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Create cache key based on user + query + limit
    // Hash the query for a stable, privacy-preserving cache key
    const userHash = Buffer.from(apiKey).toString('base64').slice(0, 16);
    const queryHash = createHash('sha256').update(query.toLowerCase().trim()).digest('hex').slice(0, 12);
    const cacheKeyStr = cacheKey(CACHE_PREFIX.STATS, 'search', userHash, queryHash, limit);

    // Use cache-aside pattern with 5-minute TTL
    // Search results cache for repeated queries
    const data = await cacheAside(
      cacheKeyStr,
      async () => {
        // Fetch from backend on cache miss
        const url = `${CHAT_HISTORY_API_URL}/v1/chat/search`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query, limit })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.detail || 'Failed to search sessions');
        }

        return await response.json();
      },
      TTL.CHAT_SEARCH, // 5 minutes
      'chat-search' // Metrics category
    );

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Search API');
  }
}
