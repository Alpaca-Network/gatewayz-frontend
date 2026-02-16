import ModelsClient from './models-client';
import { getModelsForGateway, getUniqueModels } from '@/lib/models-service';
import { models as staticModels } from '@/lib/models-data';
import { transformStaticModel } from '@/lib/model-detail-utils';
import { USE_UNIQUE_MODELS_ENDPOINT } from '@/lib/config';
import { mergeLegacyModelsToUnique } from '@/types/models';
import type { Model as LegacyModel, UniqueModel } from '@/types/models';

// Alias LegacyModel as Model for this file's deduplication logic
type Model = LegacyModel;

/**
 * Models page rendering configuration
 *
 * For desktop static export (NEXT_STATIC_EXPORT=true):
 * - Page is pre-rendered with static models only
 * - Client-side fetching is disabled (no API routes available)
 * - Users see curated static models from models-data.ts
 *
 * For server mode (web):
 * - Uses ISR with revalidation to keep models fresh
 * - Server fetches latest models from all gateways
 * - Client-side fetches additional models if server returns < 50
 *
 * Note: We cannot use `dynamic = 'force-dynamic'` as it's incompatible with
 * static export. Instead, we rely on revalidation and client-side fetching.
 */
export const revalidate = 300; // Revalidate every 5 minutes

// Models are now fetched using gateway='all' which:
// 1. Makes a single API call to the backend (more efficient)
// 2. Auto-discovers new gateways from the response
// 3. Automatically includes models from newly added providers

// Redundant deduplication logic removed in favor of mergeLegacyModelsToUnique

async function getAllModels(): Promise<UniqueModel[]> {
  try {
    const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';
    const isCI = process.env.CI === 'true' && !process.env.VERCEL;

    if (isStaticExport || isCI) {
      console.log(`[Models Page] ${isStaticExport ? 'Static export' : 'CI build'} mode - using static models`);
      const legacyModels = staticModels.map((model) => transformStaticModel(model) as unknown as Model);
      return mergeLegacyModelsToUnique(legacyModels);
    }

    // Feature flag: Use new /models/unique endpoint or legacy /models endpoint
    if (USE_UNIQUE_MODELS_ENDPOINT) {
      console.log('[Models Page] 🆕 Fetching from /models/unique endpoint (feature flag enabled)');
      const startTime = Date.now();

      const result = await getUniqueModels({
        sort_by: 'provider_count',
        order: 'desc',
        limit: 1000
      });

      const duration = Date.now() - startTime;
      console.log(`[Models Page] ✅ Unique models fetched: ${result.data.length} models in ${duration}ms`);
      return result.data;
    }

    // Option B: Fetch from /models endpoint and merge on frontend
    console.log('[Models Page] Fetching all models with gateway=all (Option B)');
    const startTime = Date.now();

    const result = await getModelsForGateway('all');
    const allModels = result.data || [];

    // Merge multiple providers for the same model
    const uniqueModels = mergeLegacyModelsToUnique(allModels);

    const duration = Date.now() - startTime;
    console.log(`[Models Page] All models fetched and merged: ${uniqueModels.length} models in ${duration}ms`);

    return uniqueModels;

  } catch (error) {
    console.error('[Models Page] Failed to fetch models:', error);
    // Fallback to static models on error
    const legacyModels = staticModels.map((model) => transformStaticModel(model) as unknown as Model);
    return mergeLegacyModelsToUnique(legacyModels);
  }
}

// Redundant transformLegacyToUniqueModels removed

export default async function ModelsPage() {
  // Fetch all models from all gateways in a single request
  // This automatically discovers and includes models from any new providers added to the backend
  const models = await getAllModels();

  return <ModelsClient initialModels={models} isLoadingMore={false} />;
}
