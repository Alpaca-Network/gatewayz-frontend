import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getClientIP } from '@/lib/guest-rate-limiter';
import { rateLimitHit } from '@/lib/ip-rate-limiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Critic model prompt for determining if a query needs real-time information.
 *
 * The prompt is designed to be:
 * 1. Concise - minimize token usage
 * 2. Clear - explicit YES/NO criteria
 * 3. Comprehensive - covers common cases where search is needed
 */
/** Max query length sent to the critic model (server-paid tokens). */
const MAX_QUERY_LENGTH = 500;
/** Per-IP request budget for the critic endpoint. */
const RATE_LIMIT_PER_WINDOW = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const CRITIC_PROMPT = `You are a search necessity classifier. Determine if a user query requires current/real-time information that may have changed since your training data.

Answer ONLY "YES" or "NO".

Answer YES if the query:
- Asks about current events, news, or recent happenings
- Asks about current prices, stock values, cryptocurrency, or market data
- Asks about current weather or forecasts
- Asks about current status of services, websites, apps, or systems (e.g., "Is X down?")
- Asks about current leadership, positions, or roles (CEO, president, manager, etc.)
- Asks about current versions, releases, or updates of software/products
- Asks about sports scores, game results, standings, or schedules
- Asks about availability, hours of operation, or locations
- Asks about upcoming or recent events, releases, or announcements
- Asks about current rankings, ratings, or reviews
- Asks about anything that could have changed in the last few months
- References specific recent dates or timeframes

Answer NO if the query:
- Asks about historical facts that don't change (e.g., "When was the Eiffel Tower built?")
- Asks for explanations of concepts, theories, or how things work
- Asks for code, programming help, or technical implementations
- Asks for creative writing, stories, poems, or content generation
- Asks about mathematical or scientific constants/facts
- Asks for general advice or recommendations not tied to current data
- Asks about definitions or meanings of words/concepts

Query: `;

/**
 * POST /api/search/critic
 *
 * Evaluates whether a user query requires real-time information
 * using a fast, cheap critic model (Gemini 2.0 Flash).
 *
 * This enables smarter auto-search detection compared to keyword matching,
 * as the model can understand semantic intent and implicit need for current info.
 */
export async function POST(request: NextRequest) {
  try {
    const rate = await rateLimitHit(
      'search-critic',
      getClientIP(request),
      RATE_LIMIT_PER_WINDOW,
      RATE_LIMIT_WINDOW_MS
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', needsSearch: false },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.max(1, Math.ceil(rate.resetInMs / 1000))) },
        }
      );
    }

    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required', needsSearch: false },
        { status: 400 }
      );
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Query too long (max ${MAX_QUERY_LENGTH} characters)`, needsSearch: false },
        { status: 400 }
      );
    }

    // Skip very short queries - not enough context for meaningful classification
    // Use same minimum (10 chars) as keyword fallback for consistent behavior
    if (query.trim().length < 10) {
      return NextResponse.json({
        needsSearch: false,
        reason: 'Query too short for classification',
        skipped: true,
      });
    }

    // Get API key - prefer dedicated key, fall back to general Google AI key
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      console.warn('[Search Critic] No Google AI API key configured, returning false');
      return NextResponse.json({
        needsSearch: false,
        reason: 'Critic model not configured',
        error: 'missing_api_key',
      });
    }

    const google = createGoogleGenerativeAI({
      apiKey,
    });

    // Use Gemini 2.0 Flash for speed and cost efficiency
    // ~$0.075/1M input tokens, ~$0.30/1M output tokens
    // Response time: typically 100-300ms
    const startTime = Date.now();

    const result = await generateText({
      model: google('gemini-2.0-flash-exp'),
      prompt: CRITIC_PROMPT + query,
      maxOutputTokens: 10, // We only need YES or NO
      temperature: 0, // Deterministic output
    });

    const responseTime = Date.now() - startTime;
    const responseText = result.text.trim().toUpperCase();
    const needsSearch = responseText.startsWith('YES');

    console.log('[Search Critic] Query:', query.substring(0, 100));
    console.log('[Search Critic] Response:', responseText, `(${responseTime}ms)`);
    console.log('[Search Critic] Needs search:', needsSearch);

    return NextResponse.json({
      needsSearch,
      reason: result.text.trim(),
      responseTime,
    });

  } catch (error) {
    console.error('[Search Critic] Error:', error);

    // Return a safe default on error - don't block the user
    // The hook will fall back to keyword detection
    return NextResponse.json({
      needsSearch: false,
      reason: 'Critic model error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
