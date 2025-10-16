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
  source_gateway?: string;
  created?: number;
}

async function getModels(): Promise<Model[]> {
  try {
    // Fetch all models without limit to get the complete catalog
    const allModelsData = await getModelsForGateway('all');

    const models = allModelsData.data || [];

    // Log total models
    console.log(`Fetched ${models.length} models from API`);

    // Remove duplicates based on model ID (optimized version)
    const uniqueModelsMap = new Map<string, Model>();

    for (const model of models) {
      // Skip models without valid IDs
      if (!model.id || model.id.trim() === '') {
        continue;
      }

      const existing = uniqueModelsMap.get(model.id);
      if (!existing) {
        uniqueModelsMap.set(model.id, model);
      } else {
        // Keep the one with more complete data
        const currentCompleteness = (model.description ? 1 : 0) +
                                   (model.context_length > 0 ? 1 : 0) +
                                   (model.pricing ? 1 : 0) +
                                   (model.architecture ? 1 : 0);
        const existingCompleteness = (existing.description ? 1 : 0) +
                                    (existing.context_length > 0 ? 1 : 0) +
                                    (existing.pricing ? 1 : 0) +
                                    (existing.architecture ? 1 : 0);

        if (currentCompleteness > existingCompleteness) {
          uniqueModelsMap.set(model.id, model);
        }
      }
    }

    const uniqueModels = Array.from(uniqueModelsMap.values());

    // Log final count after deduplication
    console.log(`After deduplication: ${uniqueModels.length} unique models`);

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
