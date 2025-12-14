import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache popular models for 5 minutes to reduce API calls
// Note: In serverless environments, each instance has its own cache.
// This is acceptable given the short TTL and graceful fallback behavior.
let cachedPopularModels: PopularModel[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_POPULAR_MODELS = 20; // Always fetch/cache this many models to handle varying limit params

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
// NOTE: Model IDs with sourceGateway should include the gateway prefix for proper backend routing
const FALLBACK_POPULAR_MODELS: PopularModel[] = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', developer: 'Anthropic', category: 'Paid' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', developer: 'OpenAI', category: 'Paid' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', developer: 'OpenAI', category: 'Paid' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', developer: 'Google', category: 'Paid' },
  { id: 'openrouter/deepseek/deepseek-r1', name: 'DeepSeek R1', developer: 'DeepSeek', category: 'Paid', sourceGateway: 'openrouter' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', developer: 'DeepSeek', category: 'Paid' },
  { id: 'openrouter/meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', developer: 'Meta', category: 'Free', sourceGateway: 'openrouter' },
  { id: 'openrouter/qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', developer: 'Qwen', category: 'Free', sourceGateway: 'openrouter' },
  { id: 'x-ai/grok-2-1212', name: 'Grok 2', developer: 'xAI', category: 'Paid' },
  { id: 'mistralai/mistral-large-2411', name: 'Mistral Large', developer: 'Mistral AI', category: 'Paid' },
];

// GET /api/models/popular - Get popular models
export async function GET(request: NextRequest) {
  // Parse limit outside try block so it's accessible in catch
  // Validate to ensure we get a valid number, defaulting to 10 if NaN or invalid
  const searchParams = request.nextUrl.searchParams;
  const parsedLimit = parseInt(searchParams.get('limit') || '10', 10);
  const limit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 10 : Math.min(parsedLimit, MAX_POPULAR_MODELS);

  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'GET /api/models/popular',
    },
    async (span) => {
      try {
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
        // Always fetch MAX_POPULAR_MODELS to ensure cache can serve any limit up to that value
        try {
          // Use AbortController for Node.js compatibility (AbortSignal.timeout requires Node 17.3+)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const response = await fetch(`${API_BASE_URL}/v1/models/popular?limit=${MAX_POPULAR_MODELS}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
              // Cache the full response (up to MAX_POPULAR_MODELS)
              const modelsToCache = data.data.slice(0, MAX_POPULAR_MODELS) as PopularModel[];
              cachedPopularModels = modelsToCache;
              cacheTimestamp = now;
              span.setAttribute('source', 'backend_api');
              span.setAttribute('models_count', modelsToCache.length);
              return NextResponse.json({
                data: modelsToCache.slice(0, limit),
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

        // Always return fallback on error, respecting the limit parameter
        return NextResponse.json({
          data: FALLBACK_POPULAR_MODELS.slice(0, limit),
          source: 'fallback_error'
        });
      }
    }
  );
}
