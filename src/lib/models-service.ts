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
  // Note: 'portkey' is deprecated; use individual providers instead (google, cerebras, nebius, xai, novita, huggingface)
  const validGateways = [
    'openrouter',
    'portkey', // Kept for backward compatibility
    'featherless',
    'chutes',
    'fireworks',
    'together',
    'groq',
    'deepinfra',
    // New Portkey SDK providers
    'google',
    'cerebras',
    'nebius',
    'xai',
    'novita',
    'huggingface',
    'all'
  ];
  if (!validGateways.includes(gateway)) {
    throw new Error('Invalid gateway');
  }

  const limitParam = limit ? `&limit=${limit}` : '';

  // Try /v1/catalog/models endpoint first (newer endpoint with Hugging Face support)
  let url = `${API_BASE_URL}/v1/catalog/models?gateway=${gateway}${limitParam}`;

  if (gateway === 'huggingface') {
    // Special handling for Hugging Face - backend may use 'hug' param
    url = `${API_BASE_URL}/v1/catalog/models?gateway=hug${limitParam}`;
  }

  // Try live API first (primary source)
  let response;
  try {
    response = await fetch(url, {
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
        return data;
      }
    }
  } catch (backendError: any) {
    // If /v1/catalog/models fails, try the older /models endpoint
    console.log(`[Models] /v1/catalog/models endpoint unavailable for ${gateway}, falling back to /models`);
  }

  // Fallback to older /models endpoint if /v1/catalog/models isn't available
  url = `${API_BASE_URL}/models?gateway=${gateway}${limitParam}`;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(15000)
    });

    if (response.ok) {
      const data = await response.json();

      // Validate response structure and data
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        return data;
      }
    }
  } catch (backendError: any) {
    // Silently fail and use fallback
  }

  // Fallback to static data (only used if API fails)
  let transformedModels;

  if (gateway === 'all') {
    // Distribute all models across different gateways
    const allGateways = [
      'openrouter',
      'portkey',
      'featherless',
      'chutes',
      'fireworks',
      'together',
      'groq',
      'deepinfra',
      'google',
      'cerebras',
      'nebius',
      'xai',
      'novita',
      'huggingface'
    ];
    const modelsPerGateway = Math.ceil(models.length / allGateways.length);

    transformedModels = models.map((model, index) => {
      const gatewayIndex = Math.floor(index / modelsPerGateway);
      const assignedGateway = allGateways[Math.min(gatewayIndex, allGateways.length - 1)];
      return transformModel(model, assignedGateway);
    });
  } else {
    // Get models for specific gateway
    const allGateways = [
      'openrouter',
      'portkey',
      'featherless',
      'chutes',
      'fireworks',
      'together',
      'groq',
      'deepinfra',
      'google',
      'cerebras',
      'nebius',
      'xai',
      'novita',
      'huggingface'
    ];
    const modelsPerGateway = Math.ceil(models.length / allGateways.length);
    let gatewayModels;

    const gatewayIndex = allGateways.indexOf(gateway);
    if (gatewayIndex !== -1) {
      const startIndex = gatewayIndex * modelsPerGateway;
      const endIndex = gatewayIndex === allGateways.length - 1 ? models.length : (gatewayIndex + 1) * modelsPerGateway;
      gatewayModels = models.slice(startIndex, endIndex);
    } else {
      gatewayModels = models; // Default to all models for unknown gateways
    }

    transformedModels = gatewayModels.map(m => transformModel(m, gateway));
  }

  return {
    data: transformedModels
  };
}
