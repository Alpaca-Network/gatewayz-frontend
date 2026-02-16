import ModelsClient from './models-client';
import { getModelsForGateway, getUniqueModels } from '@/lib/models-service';
import { models as staticModels } from '@/lib/models-data';
import { transformStaticModel } from '@/lib/model-detail-utils';
import { USE_UNIQUE_MODELS_ENDPOINT } from '@/lib/config';
import { adaptLegacyToUniqueModel } from '@/types/models';
import type { GatewayPricing, Model as LegacyModel, UniqueModel } from '@/types/models';

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

// Shared deduplication logic to avoid code duplication
function deduplicateModels(models: Model[]): Model[] {
  const modelMap = new Map<string, Model>();

  for (const model of models) {
    // Normalize the model name for deduplication
    const normalizedName = (model.name || '')
      .toLowerCase()
      .replace(/^(google:|openai:|meta:|anthropic:|models\/)/i, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');

    const dedupKey = `${normalizedName}:::${model.provider_slug || 'unknown'}`;

    // Get the gateway for this model instance
    const modelGateway = model.source_gateway || (model.source_gateways?.[0]) || 'unknown';

    // Merge models from multiple gateways
    if (modelMap.has(dedupKey)) {
      const existing = modelMap.get(dedupKey)!;

      // Merge source_gateways arrays
      const existingGateways = existing.source_gateways || [];
      const newGateways = model.source_gateways || [];
      const combinedGateways = Array.from(new Set([...existingGateways, ...newGateways]));

      // Merge gateway_pricing - preserve pricing from each gateway
      const existingPricing = existing.gateway_pricing || {};
      const newPricing: Record<string, GatewayPricing> = {};

      // Add pricing from current model's gateway if available
      if (model.pricing && modelGateway) {
        newPricing[modelGateway] = {
          prompt: model.pricing.prompt,
          completion: model.pricing.completion
        };
      }

      const combinedPricing = { ...existingPricing, ...newPricing };

      // Calculate data completeness score
      const existingScore = (existing.description ? 1 : 0) +
                            (existing.pricing?.prompt ? 1 : 0) +
                            (existing.context_length > 0 ? 1 : 0);
      const newScore = (model.description ? 1 : 0) +
                       (model.pricing?.prompt ? 1 : 0) +
                       (model.context_length > 0 ? 1 : 0);

      // Keep model with more complete data but preserve all gateway pricing
      const mergedModel = newScore > existingScore ? { ...model } : { ...existing };
      mergedModel.source_gateways = combinedGateways;
      mergedModel.gateway_pricing = combinedPricing;
      modelMap.set(dedupKey, mergedModel);
    } else {
      // First occurrence - ensure source_gateways is an array and initialize gateway_pricing
      if (!model.source_gateways) {
        model.source_gateways = model.source_gateway ? [model.source_gateway] : [];
      }

      // Initialize gateway_pricing with this model's pricing
      if (model.pricing && modelGateway) {
        model.gateway_pricing = {
          [modelGateway]: {
            prompt: model.pricing.prompt,
            completion: model.pricing.completion
          }
        };
      }

      modelMap.set(dedupKey, model);
    }
  }

  return Array.from(modelMap.values());
}

async function getAllModels(): Promise<UniqueModel[]> {
  console.log('[Models Page] 🔍 getAllModels() started');
  console.log('[Models Page] Environment check:', {
    NEXT_STATIC_EXPORT: process.env.NEXT_STATIC_EXPORT,
    CI: process.env.CI,
    VERCEL: process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV,
    USE_UNIQUE_MODELS_ENDPOINT
  });

  try {
    // During static export (desktop builds), use static models only
    // API routes are not available during static export
    const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';
    if (isStaticExport) {
      console.log('[Models Page] ⚠️ FALLBACK REASON: Static export mode - using static models');
      // Transform static models to UniqueModel format
      const legacyModels = staticModels.map((model) => transformStaticModel(model) as unknown as Model);
      return transformLegacyToUniqueModels(legacyModels);
    }

    // During CI builds, use static models to avoid timeout failures
    // CI environments don't have access to the backend API
    // Note: We check CI env var here because GitHub Actions sets CI=true
    // Vercel builds have access to the backend, so they can fetch real models
    const isCI = process.env.CI === 'true' && !process.env.VERCEL;
    if (isCI) {
      console.log('[Models Page] ⚠️ FALLBACK REASON: CI build detected - using static models to avoid timeout');
      const legacyModels = staticModels.map((model) => transformStaticModel(model) as unknown as Model);
      return transformLegacyToUniqueModels(legacyModels);
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

      if (result.data.length === 0) {
        console.warn('[Models Page] ⚠️ Unique models endpoint returned 0 models - may fallback to static');
      }

      return result.data;
    } else {
      // Legacy path: Fetch from /models endpoint and deduplicate on frontend
      console.log('[Models Page] 📡 Fetching all models with gateway=all (legacy endpoint)');
      const startTime = Date.now();

      console.log('[Models Page] 🔄 Calling getModelsForGateway("all")...');
      const result = await getModelsForGateway('all');
      console.log('[Models Page] 📦 getModelsForGateway returned:', {
        hasData: !!result.data,
        dataLength: result.data?.length || 0,
        dataType: typeof result.data,
        isArray: Array.isArray(result.data)
      });

      const allModels = result.data || [];
      console.log(`[Models Page] 📊 Raw models count: ${allModels.length}`);

      if (allModels.length === 0) {
        console.error('[Models Page] ❌ No models returned from getModelsForGateway - will use static fallback');
      }

      // Deduplicate intelligently using shared function
      console.log('[Models Page] 🔄 Deduplicating models...');
      const uniqueModels = deduplicateModels(allModels);
      console.log(`[Models Page] ✅ After deduplication: ${uniqueModels.length} unique models`);

      const duration = Date.now() - startTime;
      console.log(`[Models Page] ⏱️ Total fetch time: ${duration}ms`);

      // Convert legacy Model format to UniqueModel format for consistent rendering
      console.log('[Models Page] 🔄 Transforming to UniqueModel format...');
      const transformed = transformLegacyToUniqueModels(uniqueModels);
      console.log(`[Models Page] ✅ Transformation complete: ${transformed.length} models ready`);

      return transformed;
    }
  } catch (error) {
    console.error('[Models Page] ❌❌❌ EXCEPTION CAUGHT - FALLING BACK TO STATIC MODELS');
    console.error('[Models Page] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error
    });
    // Fallback to static models on error
    console.log('[Models Page] ⚠️ FALLBACK REASON: Exception thrown during fetch');
    const legacyModels = staticModels.map((model) => transformStaticModel(model) as unknown as Model);
    const fallbackModels = transformLegacyToUniqueModels(legacyModels);
    console.log(`[Models Page] 📦 Returning ${fallbackModels.length} static fallback models`);
    return fallbackModels;
  }
}

/**
 * Transform array of legacy Model format to UniqueModel format
 * Used to ensure consistent rendering regardless of which endpoint is used
 */
function transformLegacyToUniqueModels(legacyModels: Model[]): UniqueModel[] {
  console.log('[transformLegacyToUniqueModels] Transforming', legacyModels.length, 'models');

  // Log first model to see data structure
  if (legacyModels.length > 0) {
    console.log('[transformLegacyToUniqueModels] Sample model:', {
      id: legacyModels[0].id,
      name: legacyModels[0].name,
      pricing: legacyModels[0].pricing,
      source_gateway: legacyModels[0].source_gateway,
      source_gateways: legacyModels[0].source_gateways,
      gateway_pricing: legacyModels[0].gateway_pricing,
    });
  }

  return legacyModels.map(model => {
    const transformed = adaptLegacyToUniqueModel(model);

    if (model.id === legacyModels[0].id) {
      console.log('[transformLegacyToUniqueModels] Transformed sample:', {
        id: transformed.id,
        name: transformed.name,
        provider_count: transformed.provider_count,
        providers: transformed.providers,
        cheapest_provider: transformed.cheapest_provider,
        cheapest_prompt_price: transformed.cheapest_prompt_price,
      });
    }

    return transformed;
  });
}

export default async function ModelsPage() {
  // Fetch all models from all gateways in a single request
  // This automatically discovers and includes models from any new providers added to the backend
  const models = await getAllModels();

  return <ModelsClient initialModels={models} isLoadingMore={false} />;
}
