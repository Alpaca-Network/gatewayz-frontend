import * as Sentry from '@sentry/nextjs';
import ModelsClient from './models-client';
import { getModelsForGateway } from '@/lib/models-service';
import { getModels } from '@/lib/catalog-api';
import { mergeLegacyModelsToUnique } from '@/types/models';
import type { Model as LegacyModel, UniqueModel } from '@/types/models';

// Alias LegacyModel as Model for this file's deduplication logic
type Model = LegacyModel;

/**
 * Models page rendering configuration
 *
 * The DB is the source of truth for the catalog (North Star) — there is no
 * hardcoded model table backing this page anymore.
 *
 * For desktop static export (NEXT_STATIC_EXPORT=true) and CI builds:
 * - No Next API routes are available (static export) / no live backend is
 *   assumed reachable (CI), so we still call the backend directly via
 *   `@/lib/catalog-api` (it targets the backend URL directly when there's no
 *   `window`/Tauri desktop context) rather than embedding stale sample data.
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
      console.log(`[Models Page] ${isStaticExport ? 'Static export' : 'CI build'} mode - fetching catalog directly from backend`);
      const catalogModels = await getModels({ gateway: 'all' });
      return mergeLegacyModelsToUnique(catalogModels as unknown as Model[]);
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
    console.error('[Models Page] Failed to fetch models:', error);
    Sentry.captureException(error, {
      tags: { component: 'models-page', fallback: 'empty' },
      extra: {
        NEXT_STATIC_EXPORT: process.env.NEXT_STATIC_EXPORT,
        CI: process.env.CI,
        VERCEL: process.env.VERCEL,
      },
    });
    // The DB-backed catalog is the source of truth — there is no hardcoded
    // model table to fall back to. Render an empty catalog rather than
    // stale/deleted-provider data when the backend is fully unreachable.
    return [];
  }
}

export default async function ModelsPage() {
  // Fetch all models from all gateways in a single request
  // This automatically discovers and includes models from any new providers added to the backend
  const models = await getAllModels();

  return <ModelsClient initialModels={models} isLoadingMore={false} />;
}
