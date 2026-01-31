import ModelsClient from './models-client';
import { getModelsForGateway, getUniqueModels } from '@/lib/models-service';
import { models as staticModels } from '@/lib/models-data';
import { transformStaticModel } from '@/lib/model-detail-utils';
import { USE_UNIQUE_MODELS_ENDPOINT } from '@/lib/config';
import type { Model, UniqueModel, adaptLegacyToUniqueModel } from '@/types/models';

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
export const revalidate = 60; // Revalidate every 60 seconds in server mode

// Per-gateway pricing information
interface GatewayPricing {
  prompt: string;
  completion: string;
}

interface Model {
  id: string;
  name: string;
  description: string | null;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  } | null;
  architecture: {
    input_modalities: string[] | null;
    output_modalities: string[] | null;
  } | null;
  supported_parameters: string[] | null;
  provider_slug: string;
  source_gateway?: string; // From API, used to populate source_gateways
  source_gateways: string[]; // Changed from source_gateway to array
  gateway_pricing?: Record<string, GatewayPricing>; // Per-gateway pricing map
  created?: number;
}

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
  try {
    // During static export (desktop builds), use static models only
    // API routes are not available during static export
    const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';
    if (isStaticExport) {
      console.log('[Models Page] Static export mode - using static models');
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
      console.log('[Models Page] CI build detected - using static models to avoid timeout');
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
      return result.data;
    } else {
      // Legacy path: Fetch from /models endpoint and deduplicate on frontend
      console.log('[Models Page] Fetching all models with gateway=all (legacy endpoint)');
      const startTime = Date.now();

      const result = await getModelsForGateway('all');
      const allModels = result.data || [];

      // Deduplicate intelligently using shared function
      const uniqueModels = deduplicateModels(allModels);

      const duration = Date.now() - startTime;
      console.log(`[Models Page] All models fetched (legacy): ${uniqueModels.length} models in ${duration}ms`);

      // Convert legacy Model format to UniqueModel format for consistent rendering
      return transformLegacyToUniqueModels(uniqueModels);
    }
  } catch (error) {
    console.error('[Models Page] Failed to fetch models:', error);
    // Fallback to static models on error
    const legacyModels = staticModels.map((model) => transformStaticModel(model) as unknown as Model);
    return transformLegacyToUniqueModels(legacyModels);
  }
}

/**
 * Transform array of legacy Model format to UniqueModel format
 * Used to ensure consistent rendering regardless of which endpoint is used
 */
function transformLegacyToUniqueModels(legacyModels: Model[]): UniqueModel[] {
  return legacyModels.map(model => {
    // Extract all gateways
    const gateways = model.source_gateways || (model.source_gateway ? [model.source_gateway] : []);
    const gatewayPricing = model.gateway_pricing || {};

    // Convert gateway pricing to Provider array
    const providers = gateways.map(gateway => ({
      slug: gateway,
      name: gateway.charAt(0).toUpperCase() + gateway.slice(1),
      pricing: gatewayPricing[gateway] || model.pricing || { prompt: '0', completion: '0' },
      health_status: 'healthy' as const,
      average_response_time_ms: 1000,
    }));

    // Find cheapest provider
    let cheapestProvider = providers[0]?.slug || '';
    let cheapestPrice = Infinity;
    providers.forEach(p => {
      const price = parseFloat(p.pricing.prompt);
      if (!isNaN(price) && price < cheapestPrice) {
        cheapestPrice = price;
        cheapestProvider = p.slug;
      }
    });

    // Find fastest provider (use first one as default)
    const fastestProvider = providers[0]?.slug || '';
    const fastestResponseTime = providers[0]?.average_response_time_ms || 1000;

    return {
      id: model.id,
      name: model.name,
      description: model.description,
      context_length: model.context_length,
      architecture: model.architecture,
      supported_parameters: model.supported_parameters,
      provider_count: providers.length,
      providers,
      cheapest_provider: cheapestProvider,
      fastest_provider: fastestProvider,
      cheapest_prompt_price: cheapestPrice === Infinity ? 0 : cheapestPrice,
      fastest_response_time: fastestResponseTime,
      created: model.created,
      is_private: model.is_private,
    };
  });
}

export default async function ModelsPage() {
  // Fetch all models from all gateways in a single request
  // This automatically discovers and includes models from any new providers added to the backend
  const models = await getAllModels();

  return <ModelsClient initialModels={models} isLoadingMore={false} />;
}