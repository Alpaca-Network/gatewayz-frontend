import { Suspense } from 'react';
import ModelsClient from './models-client';
import { getModelsForGateway } from '@/lib/models-service';

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
  source_gateways: string[]; // Changed from source_gateway to array
  created?: number;
}

async function getModels(): Promise<Model[]> {
  try {
    // Fetch models from all gateways to build a complete picture
    // Using individual Portkey SDK providers instead of unified gateway for better performance
    const gateways = [
      'openrouter',
      'featherless',
      'groq',
      'together',
      'fireworks',
      'chutes',
      'deepinfra',
      'google',
      'cerebras',
      'nebius',
      'xai',
      'novita',
      'huggingface'
    ];

    // Fetch from all gateways in parallel with timeout
    const gatewayPromises = gateways.map(async (gateway) => {
      try {
        // Add 10 second timeout per gateway
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        // Request up to 50000 models for huggingface to get all models (backend supports up to 50k per page)
        const limit = gateway === 'huggingface' ? 50000 : undefined;
        const result = await getModelsForGateway(gateway, limit);
        console.log(`[Models Page] After getModelsForGateway for ${gateway}: ${result.data?.length || 0} models`);
        clearTimeout(timeoutId);

        return { gateway, models: result.data || [] };
      } catch (error) {
        // Silently fail and return empty models for this gateway
        return { gateway, models: [] };
      }
    });

    const gatewayResults = await Promise.all(gatewayPromises);

    // Log gateway results for debugging
    for (const { gateway, models } of gatewayResults) {
      console.log(`[Models Page] Gateway ${gateway}: ${models.length} models received`);
    }

    // Build a map of models with all their available gateways
    const modelGatewayMap = new Map<string, { model: Model, gateways: Set<string> }>();

    for (const { gateway, models } of gatewayResults) {
      for (const model of models) {
        if (!model.id || model.id.trim() === '') continue;

        const existing = modelGatewayMap.get(model.id);
        if (!existing) {
          // First time seeing this model
          modelGatewayMap.set(model.id, {
            model: {
              ...model,
              source_gateways: [gateway] // Initialize with current gateway
            },
            gateways: new Set([gateway])
          });
        } else {
          // Model already exists, add this gateway
          existing.gateways.add(gateway);

          // Update the model with better data if available
          const currentCompleteness =
            (model.description ? 1 : 0) +
            (model.context_length > 0 ? 1 : 0) +
            (model.pricing ? 1 : 0) +
            (model.architecture ? 1 : 0);

          const existingCompleteness =
            (existing.model.description ? 1 : 0) +
            (existing.model.context_length > 0 ? 1 : 0) +
            (existing.model.pricing ? 1 : 0) +
            (existing.model.architecture ? 1 : 0);

          if (currentCompleteness > existingCompleteness) {
            // Keep the better data but preserve all gateways
            existing.model = {
              ...model,
              source_gateways: Array.from(existing.gateways)
            };
          } else {
            // Just update the gateways list
            existing.model.source_gateways = Array.from(existing.gateways);
          }
        }
      }
    }

    // Convert to array and sort gateways for consistency
    const uniqueModels = Array.from(modelGatewayMap.values()).map(({ model }) => ({
      ...model,
      source_gateways: model.source_gateways.sort()
    }));

    console.log(`[Models Page] Total unique models after deduplication: ${uniqueModels.length}`);
    return uniqueModels;
  } catch (error) {
    console.log('Failed to fetch models:', error);
    return [];
  }
}

export default async function ModelsPage() {
  const initialModels = await getModels();

  return <ModelsClient initialModels={initialModels} />;
}