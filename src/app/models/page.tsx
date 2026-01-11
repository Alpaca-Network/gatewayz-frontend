import ModelsClient from './models-client';
import { getModelsForGateway } from '@/lib/models-service';

// Force dynamic rendering to always fetch latest models
// This ensures models are always fresh and not cached from build time (when there are 0 models)
export const dynamic = 'force-dynamic';

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

    // Merge models from multiple gateways
    if (modelMap.has(dedupKey)) {
      const existing = modelMap.get(dedupKey)!;

      // Merge source_gateways arrays
      const existingGateways = existing.source_gateways || [];
      const newGateways = model.source_gateways || [];
      const combinedGateways = Array.from(new Set([...existingGateways, ...newGateways]));

      // Calculate data completeness score
      const existingScore = (existing.description ? 1 : 0) +
                            (existing.pricing?.prompt ? 1 : 0) +
                            (existing.context_length > 0 ? 1 : 0);
      const newScore = (model.description ? 1 : 0) +
                       (model.pricing?.prompt ? 1 : 0) +
                       (model.context_length > 0 ? 1 : 0);

      // Keep model with more complete data
      const mergedModel = newScore > existingScore ? model : existing;
      mergedModel.source_gateways = combinedGateways;
      modelMap.set(dedupKey, mergedModel);
    } else {
      // First occurrence - ensure source_gateways is an array
      if (!model.source_gateways) {
        model.source_gateways = model.source_gateway ? [model.source_gateway] : [];
      }
      modelMap.set(dedupKey, model);
    }
  }

  return Array.from(modelMap.values());
}

async function getAllModels(): Promise<Model[]> {
  try {
    // During build time, skip API calls if running in CI/build environment
    if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI) {
      console.log('[Models Page] Build time detected, skipping API calls');
      return [];
    }

    console.log('[Models Page] Fetching all models with gateway=all (single request)');
    const startTime = Date.now();

    // Fetch all models from all gateways in a single request
    // This automatically discovers and registers new gateways from the backend response
    const result = await getModelsForGateway('all');
    const allModels = result.data || [];

    // Deduplicate intelligently using shared function
    const uniqueModels = deduplicateModels(allModels);

    const duration = Date.now() - startTime;
    console.log(`[Models Page] All models fetched: ${uniqueModels.length} models in ${duration}ms`);
    return uniqueModels;
  } catch (error) {
    console.error('[Models Page] Failed to fetch models:', error);
    return [];
  }
}

export default async function ModelsPage() {
  // Fetch all models from all gateways in a single request
  // This automatically discovers and includes models from any new providers added to the backend
  const models = await getAllModels();

  return <ModelsClient initialModels={models} isLoadingMore={false} />;
}