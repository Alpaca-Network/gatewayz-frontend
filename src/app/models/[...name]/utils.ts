/**
 * Server-side utilities for model page generation
 * Handles static parameter generation and ISR revalidation
 */

import { models as staticModels } from '@/lib/models-data';
import { getModelsForGateway } from '@/lib/models-service';

/**
 * Get the most popular/important models for static generation
 * Static pages will be pre-generated for these models at build time
 * This includes all static models + top models from popular gateways (server mode only)
 */
export async function getPopularModels(limit: number = 50) {
  try {
    // Start with all static models (these are curated and important)
    const topModels = [...staticModels];

    // Skip server fetch for static export (desktop builds)
    // The API routes are excluded during static export, so we can't fetch from them
    const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';
    if (isStaticExport) {
      console.log('[generateStaticParams] Static export mode - using only static models');
      return topModels.slice(0, limit);
    }

    // Try to fetch models from the top gateway (OpenRouter) for additional popular models
    try {
      const data = await getModelsForGateway('openrouter', limit);
      if (data?.data) {
        // Add gateway models, avoiding duplicates
        const staticIds = new Set(staticModels.map(m => m.name.toLowerCase()));
        for (const model of data.data.slice(0, Math.max(0, limit - topModels.length))) {
          if (!staticIds.has(model.name.toLowerCase())) {
            topModels.push(model as any);
            if (topModels.length >= limit) break;
          }
        }
      }
    } catch (error) {
      // If gateway fetch fails, continue with just static models
      console.warn('Failed to fetch models from OpenRouter for static generation:', error);
    }

    return topModels.slice(0, limit);
  } catch (error) {
    console.error('Error getting popular models:', error);
    return staticModels;
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
