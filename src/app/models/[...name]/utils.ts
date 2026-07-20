/**
 * Server-side utilities for model page generation
 * Handles static parameter generation and ISR revalidation
 */

import { getModelsForGateway } from '@/lib/models-service';
import { getModels } from '@/lib/catalog-api';

/**
 * Get the most popular/important models for static generation
 * Static pages will be pre-generated for these models at build time.
 *
 * The DB is the source of truth (North Star) — this reads live catalog data
 * via `@/lib/catalog-api` / `models-service` rather than a hardcoded table.
 */
export async function getPopularModels(limit: number = 50) {
  try {
    // Static export (desktop builds) has no Next API routes at runtime, but
    // `getModels` (catalog-api) already falls back to calling the backend
    // directly whenever there's no `window`/Tauri desktop context, so it
    // remains usable here at build time.
    const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';
    if (isStaticExport) {
      console.log('[generateStaticParams] Static export mode - fetching catalog directly from backend');
      const catalogModels = await getModels({ gateway: 'all', limit });
      return catalogModels.slice(0, limit);
    }

    // Fetch models from the top gateway (OpenRouter) for popular models
    try {
      const data = await getModelsForGateway('openrouter', limit);
      if (data?.data) {
        return data.data.slice(0, limit);
      }
    } catch (error) {
      console.warn('Failed to fetch models from OpenRouter for static generation:', error);
    }

    return [];
  } catch (error) {
    console.error('Error getting popular models:', error);
    return [];
  }
}

/**
 * Convert model data to route parameters
 * Handles both static models and API models
 */
export function modelToRouteParams(model: any) {
  // Normalize model name for URL
  const normalizeForUrl = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const developer = model.developer?.toLowerCase() || model.provider_slug?.toLowerCase() || 'unknown';
  const modelName = normalizeForUrl(model.name || model.id || '');

  if (!modelName) {
    return null;
  }

  return {
    name: [developer, modelName],
  };
}

/**
 * Generate static parameters for popular models
 * Called at build time to pre-generate pages
 */
export async function generateStaticParamsForModels() {
  try {
    const models = await getPopularModels(50);
    const params = models
      .map(modelToRouteParams)
      .filter((param) => param !== null);

    return params;
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

/**
 * Cache tag for model detail pages
 * Used for on-demand ISR invalidation
 */
export function getModelCacheTag(modelId: string): string {
  return `model:${modelId}`;
}

/**
 * Cache tags for general model page invalidation
 */
export const MODEL_CACHE_TAGS = {
  ALL: 'models:all',
  POPULAR: 'models:popular',
  DETAIL: 'models:detail',
  SEARCH: 'models:search',
};
