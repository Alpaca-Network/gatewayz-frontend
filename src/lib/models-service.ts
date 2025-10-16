import { models } from '@/lib/models-data';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

// Transform static models data to backend format
function transformModel(model: any, gateway: string) {
  return {
    id: `${model.developer}/${model.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: model.name,
    description: model.description,
    context_length: model.context * 1000, // Convert K to actual number
    pricing: {
      prompt: model.inputCost.toString(),
      completion: model.outputCost.toString()
    },
    architecture: {
      input_modalities: model.modalities.map((m: string) => m.toLowerCase()),
      output_modalities: ['text'] // Default output modality
    },
    supported_parameters: model.supportedParameters,
    provider_slug: model.developer,
    source_gateway: gateway === 'all' ? 'openrouter' : gateway // Set gateway source for filtering
  };
}

export async function getModelsForGateway(gateway: string, limit?: number) {
  // Validate gateway
  const validGateways = ['openrouter', 'portkey', 'featherless', 'chutes', 'fireworks', 'together', 'groq', 'all'];
  if (!validGateways.includes(gateway)) {
    throw new Error('Invalid gateway');
  }

  const limitParam = limit ? `&limit=${limit}` : '';
  const url = `${API_BASE_URL}/models?gateway=${gateway}${limitParam}`;
  
  console.log(`[Models Service] Fetching from live API: ${url}`);

  // Try live API first (primary source)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      // Use Next.js revalidation instead of no-store for better performance
      next: { revalidate: 60 }, // Cache for 60 seconds
      signal: AbortSignal.timeout(15000) // 15 second timeout for larger requests
    });

    if (response.ok) {
      const data = await response.json();
      
      // Validate response structure and data
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        console.log(`[Models Service] ✓ Live API success: ${data.data.length} models from ${gateway} gateway`);
        return data;
      } else {
        console.warn(`[Models Service] ⚠ API returned empty data array, falling back to static data`);
      }
    } else {
      console.warn(`[Models Service] ⚠ API returned status ${response.status}: ${response.statusText}, falling back to static data`);
    }
  } catch (backendError: any) {
    const errorMsg = backendError?.name === 'TimeoutError'
      ? 'API request timed out after 10s'
      : backendError?.message || 'Unknown error';
    console.warn(`[Models Service] ⚠ API error: ${errorMsg}, falling back to static data`);
  }

  // Fallback to static data (only used if API fails)
  console.log(`[Models Service] Using static fallback data for gateway: ${gateway}`);
  let transformedModels;

  if (gateway === 'all') {
    // Distribute all models across different gateways
    const modelsPerGateway = Math.ceil(models.length / 7);
    const gateways = ['openrouter', 'portkey', 'featherless', 'chutes', 'fireworks', 'together', 'groq'];
    
    transformedModels = models.map((model, index) => {
      const gatewayIndex = Math.floor(index / modelsPerGateway);
      const assignedGateway = gateways[Math.min(gatewayIndex, gateways.length - 1)];
      return transformModel(model, assignedGateway);
    });
  } else {
    // Get models for specific gateway
    const modelsPerGateway = Math.ceil(models.length / 7);
    let gatewayModels;
    
    if (gateway === 'openrouter') {
      gatewayModels = models.slice(0, modelsPerGateway);
    } else if (gateway === 'portkey') {
      gatewayModels = models.slice(modelsPerGateway, modelsPerGateway * 2);
    } else if (gateway === 'featherless') {
      gatewayModels = models.slice(modelsPerGateway * 2, modelsPerGateway * 3);
    } else if (gateway === 'chutes') {
      gatewayModels = models.slice(modelsPerGateway * 3, modelsPerGateway * 4);
    } else if (gateway === 'fireworks') {
      gatewayModels = models.slice(modelsPerGateway * 4, modelsPerGateway * 5);
    } else if (gateway === 'together') {
      gatewayModels = models.slice(modelsPerGateway * 5, modelsPerGateway * 6);
    } else if (gateway === 'groq') {
      gatewayModels = models.slice(modelsPerGateway * 6);
    } else {
      gatewayModels = models; // Default to all models
    }
    
    transformedModels = gatewayModels.map(m => transformModel(m, gateway));
  }

  console.log(`[Models Service] Returning ${transformedModels.length} models from fallback data`);
  
  return {
    data: transformedModels
  };
}
