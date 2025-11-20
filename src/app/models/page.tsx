import { Suspense } from 'react';
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

// Fast-loading gateways (typically under 1s with new timeout)
const PRIORITY_GATEWAYS = ['openrouter', 'groq', 'together', 'fireworks', 'vercel-ai-gateway'];

// Slower gateways that can be deferred
const DEFERRED_GATEWAYS = [
  'featherless', 'chutes', 'deepinfra', 'google', 'cerebras',
  'nebius', 'xai', 'novita', 'huggingface', 'aimo', 'near', 'fal', 'helicone', 'alpaca', 'alibaba', 'clarifai'
];

async function getPriorityModels(): Promise<Model[]> {
  try {
    // During build time, skip API calls if running in CI/build environment
    if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI) {
      console.log('[Models Page] Build time detected, skipping API calls');
      return [];
    }

    console.log('[Models Page] Fetching priority models from fast gateways:', PRIORITY_GATEWAYS);
    const startTime = Date.now();

    // Fetch from priority gateways in parallel with timeout for fast failure
    const promises = PRIORITY_GATEWAYS.map(gateway =>
      Promise.race([
        getModelsForGateway(gateway),
        new Promise(resolve => setTimeout(() => resolve({ data: [] }), 3000)) // 3s timeout
      ])
    );

    const results = await Promise.all(promises);

    const allModels = results.flatMap((result: unknown) => {
      const typedResult = result as { data?: Model[] };
      return typedResult.data || [];
    });

    // Deduplicate intelligently by normalized name + provider slug
    const modelMap = new Map<string, Model>();
    for (const model of allModels) {
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

    const uniqueModels = Array.from(modelMap.values());

    const duration = Date.now() - startTime;
    console.log(`[Models Page] Priority models fetched: ${uniqueModels.length} models in ${duration}ms`);
    return uniqueModels;
  } catch (error) {
    console.error('[Models Page] Failed to fetch priority models:', error);
    return [];
  }
}

async function getDeferredModels(): Promise<Model[]> {
  try {
    console.log('[Models Page] Fetching deferred models from slower gateways:', DEFERRED_GATEWAYS);
    const startTime = Date.now();

    // Fetch from deferred gateways in parallel
    const results = await Promise.all(
      DEFERRED_GATEWAYS.map(gateway => getModelsForGateway(gateway))
    );

    const allModels = results.flatMap(result => result.data || []);

    // Deduplicate intelligently by normalized name + provider slug
    const modelMap = new Map<string, Model>();
    for (const model of allModels) {
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

    const uniqueModels = Array.from(modelMap.values());

    const duration = Date.now() - startTime;
    console.log(`[Models Page] Deferred models fetched: ${uniqueModels.length} models in ${duration}ms`);
    return uniqueModels;
  } catch (error) {
    console.error('[Models Page] Failed to fetch deferred models:', error);
    return [];
  }
}

// Suspense boundary component for deferred models
async function DeferredModelsLoader({
  priorityModels,
  deferredModelsPromise
}: {
  priorityModels: Model[],
  deferredModelsPromise: Promise<Model[]>
}) {
  // This will stream in after priority models are rendered
  const deferredModels = await deferredModelsPromise;

  // Combine and deduplicate intelligently by normalized name + provider slug
  const allModels = [...priorityModels, ...deferredModels];
  const modelMap = new Map<string, Model>();

  for (const model of allModels) {
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
        model.source_gateways = [];
      }
      modelMap.set(dedupKey, model);
    }
  }

  const uniqueModels = Array.from(modelMap.values());

  console.log(`[Models Page] Total combined models: ${uniqueModels.length}`);
  return <ModelsClient initialModels={uniqueModels} isLoadingMore={false} />;
}

export default async function ModelsPage() {
  // Fetch priority models immediately (blocks initial render)
  const priorityModels = await getPriorityModels();

  // Start fetching deferred models but DON'T await (streams in background)
  const deferredModelsPromise = getDeferredModels();

  return (
    <Suspense fallback={<ModelsClient initialModels={priorityModels} isLoadingMore={true} />}>
      <DeferredModelsLoader
        priorityModels={priorityModels}
        deferredModelsPromise={deferredModelsPromise}
      />
    </Suspense>
  );
}