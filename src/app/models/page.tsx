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
  source_gateways: string[]; // Changed from source_gateway to array
  created?: number;
}

async function getModels(): Promise<Model[]> {
  try {
    // During build time, skip API calls if running in CI/build environment
    // This prevents build failures when API is unavailable
    if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI) {
      console.log('[Models Page] Build time detected, skipping API calls');
      return [];
    }

    // Fetch all models from backend without gateway parameter
    // Backend returns all models with source_gateways already populated
    const result = await getModelsForGateway('all');
    const allModels = result.data || [];

    console.log(`[Models Page] Total models fetched: ${allModels.length}`);
    return allModels;
  } catch (error) {
    console.log('Failed to fetch models:', error);
    return [];
  }
}

export default async function ModelsPage() {
  const initialModels = await getModels();

  return <ModelsClient initialModels={initialModels} />;
}