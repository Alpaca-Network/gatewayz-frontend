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
  const validGateways = ['openrouter', 'portkey', 'featherless', 'chutes', 'fireworks', 'all'];
  if (!validGateways.includes(gateway)) {
    throw new Error('Invalid gateway');
  }

  const limitParam = limit ? `&limit=${limit}` : '';
  console.log(`Models Service - Attempting backend: ${API_BASE_URL}/catalog/models?gateway=${gateway}${limitParam}`);

  // Try backend first
  try {
    const url = `${API_BASE_URL}/catalog/models?gateway=${gateway}${limitParam}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(15000) // 15 second timeout - increased for better reliability
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`Models Service - Backend success: ${data.data?.length || 0} models from ${gateway} gateway`);

      // Validate that we got actual data
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        return data;
      } else {
        console.log(`Models Service - Backend returned empty data, using fallback`);
      }
    } else {
      console.log(`Models Service - Backend returned ${response.status}, using fallback`);
    }
  } catch (backendError) {
    console.log(`Models Service - Backend error:`, backendError);
    console.log(`Models Service - Using static fallback data`);
  }

  // Fallback to static data
  let gatewayModels;

  if (gateway === 'all') {
    // Return all models when gateway is 'all'
    gatewayModels = models;
  } else {
    // Distribute models across gateways for testing
    const modelsPerGateway = Math.ceil(models.length / 5);
    
    if (gateway === 'openrouter') {
      gatewayModels = models.slice(0, modelsPerGateway);
    } else if (gateway === 'portkey') {
      gatewayModels = models.slice(modelsPerGateway, modelsPerGateway * 2);
    } else if (gateway === 'featherless') {
      gatewayModels = models.slice(modelsPerGateway * 2, modelsPerGateway * 3);
    } else if (gateway === 'chutes') {
      gatewayModels = models.slice(modelsPerGateway * 3, modelsPerGateway * 4);
    } else if (gateway === 'fireworks') {
      gatewayModels = models.slice(modelsPerGateway * 4);
    } else {
      gatewayModels = models; // Default to all models
    }
  }

  const transformedModels = gatewayModels.map(m => transformModel(m, gateway));

  return {
    data: transformedModels
  };
}
