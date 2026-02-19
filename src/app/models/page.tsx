import * as Sentry from '@sentry/nextjs';
import ModelsClient from './models-client';
import { getModelsForGateway } from '@/lib/models-service';
import { models as staticModels } from '@/lib/models-data';
import { transformStaticModel } from '@/lib/model-detail-utils';
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
 * - Server fetches all models from backend, then merges duplicates into UniqueModel format
 * - Client-side fetches additional models if server returns < 50
 *
 * Note: We cannot use `dynamic = 'force-dynamic'` as it's incompatible with
 * static export. Instead, we rely on revalidation and client-side fetching.
 */
export const revalidate = 300; // Revalidate every 5 minutes

async function getAllModels(): Promise<UniqueModel[]> {
  try {
    const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';
    const isCI = process.env.CI === 'true' && !process.env.VERCEL;

    if (isStaticExport || isCI) {
      console.log(`[Models Page] ${isStaticExport ? 'Static export' : 'CI build'} mode - using static models`);
      const legacyModels = staticModels.map((model) => transformStaticModel(model) as unknown as Model);
      return mergeLegacyModelsToUnique(legacyModels);
    }

    // Fetch all models from backend
    // Backend returns legacy format; mergeLegacyModelsToUnique groups by model ID
    // and builds provider arrays for the UI
    console.log('[Models Page] Fetching all models with gateway=all');
    const startTime = Date.now();

    const result = await getModelsForGateway('all');
    const allModels = result.data || [];

    // Merge duplicate models from different providers into UniqueModel format
    const uniqueModels = mergeLegacyModelsToUnique(allModels);

    const duration = Date.now() - startTime;
    console.log(`[Models Page] Fetched ${allModels.length} models, merged to ${uniqueModels.length} unique in ${duration}ms`);

    return uniqueModels;

  } catch (error) {
    console.error('[Models Page] Failed to fetch models, falling back to static:', error);
    Sentry.captureException(error, {
      tags: { component: 'models-page', fallback: 'static' },
      extra: {
        USE_UNIQUE_MODELS_ENDPOINT,
        NEXT_STATIC_EXPORT: process.env.NEXT_STATIC_EXPORT,
        CI: process.env.CI,
        VERCEL: process.env.VERCEL,
      },
    });
    // Fallback to static models on error
    const legacyModels = staticModels.map((model) => transformStaticModel(model) as unknown as Model);
    return mergeLegacyModelsToUnique(legacyModels);
  }
}

export default async function ModelsPage() {
  // Fetch all models from all gateways in a single request
  // This automatically discovers and includes models from any new providers added to the backend
  const models = await getAllModels();

  return <ModelsClient initialModels={models} isLoadingMore={false} />;
}
