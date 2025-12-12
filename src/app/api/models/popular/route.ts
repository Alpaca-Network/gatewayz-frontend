import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache popular models for 5 minutes to reduce API calls
let cachedPopularModels: PopularModel[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface PopularModel {
  id: string;
  name: string;
  developer: string;
  usage_count?: number;
  category?: string;
  sourceGateway?: string;
}

// Fallback popular models based on industry trends and community usage
// This list is updated periodically to reflect current popularity
const FALLBACK_POPULAR_MODELS: PopularModel[] = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', developer: 'Anthropic', category: 'Paid' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', developer: 'OpenAI', category: 'Paid' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', developer: 'OpenAI', category: 'Paid' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', developer: 'Google', category: 'Paid' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', developer: 'DeepSeek', category: 'Paid', sourceGateway: 'openrouter' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', developer: 'DeepSeek', category: 'Paid' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', developer: 'Meta', category: 'Free', sourceGateway: 'openrouter' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', developer: 'Qwen', category: 'Free', sourceGateway: 'openrouter' },
  { id: 'x-ai/grok-2-1212', name: 'Grok 2', developer: 'xAI', category: 'Paid' },
  { id: 'mistralai/mistral-large-2411', name: 'Mistral Large', developer: 'Mistral AI', category: 'Paid' },
];

// GET /api/models/popular - Get popular models
export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'GET /api/models/popular',
    },
    async (span) => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '10', 10);

        span.setAttribute('limit', limit);

        // Check cache first
        const now = Date.now();
        if (cachedPopularModels && (now - cacheTimestamp) < CACHE_DURATION) {
          span.setAttribute('cache_hit', true);
          return NextResponse.json({
            data: cachedPopularModels.slice(0, limit),
            source: 'cache',
            cached_at: cacheTimestamp
          });
        }

        // Try to fetch from backend API (if it supports popular models endpoint)
        try {
          const response = await fetch(`${API_BASE_URL}/v1/models/popular?limit=${limit}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            // Short timeout - we have a fallback
            signal: AbortSignal.timeout(3000),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
              cachedPopularModels = data.data;
              cacheTimestamp = now;
              span.setAttribute('source', 'backend_api');
              span.setAttribute('models_count', data.data.length);
              return NextResponse.json({
                data: data.data.slice(0, limit),
                source: 'api'
              });
            }
          }
        } catch (apiError) {
          // Backend API doesn't support popular models or failed
          // Fall through to use fallback
          console.log('[Popular Models] Backend API unavailable, using fallback:', apiError);
        }

        // Use fallback popular models
        cachedPopularModels = FALLBACK_POPULAR_MODELS;
        cacheTimestamp = now;

        span.setAttribute('source', 'fallback');
        span.setAttribute('models_count', FALLBACK_POPULAR_MODELS.length);

        return NextResponse.json({
          data: FALLBACK_POPULAR_MODELS.slice(0, limit),
          source: 'curated'
        });
      } catch (error) {
        console.error('Error fetching popular models:', error);

        Sentry.captureException(error, {
          tags: {
            api_route: '/api/models/popular',
            error_type: 'popular_models_fetch_error',
          },
        });

        span.setAttribute('error', true);
        span.setAttribute('error_message', error instanceof Error ? error.message : 'Unknown error');

        // Always return fallback on error
        return NextResponse.json({
          data: FALLBACK_POPULAR_MODELS,
          source: 'fallback_error'
        });
      }
    }
  );
}
