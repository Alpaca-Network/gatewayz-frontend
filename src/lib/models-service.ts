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

  // Fetch all models - request a very high limit that should cover most gateways
  const allModels: any[] = [];
  const requestLimit = limit || 50000; // Request up to 50k models per page (backend limit)
  const limitParam = `&limit=${requestLimit}`;
  let offset = 0;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore && pageCount < 10) { // Max 10 pages to prevent infinite loops (50k per page = 500k total)
    pageCount++;
    const offsetParam = offset > 0 ? `&offset=${offset}` : '';
    const fullLimitParam = `${limitParam}${offsetParam}`;

    // Try v1/models endpoint first (newer endpoint), then fall back to /models
    let response;
    let url = `${API_BASE_URL}/v1/models?gateway=${gateway}${fullLimitParam}`;

    // Debug logging for HuggingFace requests
    if (gateway === 'huggingface') {
      console.log(`[Models] Requesting HF models with URL: ${url}`);
    }

    // Try live API first (primary source)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add HF_API_KEY header if available for Hugging Face gateway (for auth and rate limit bypass)
      const hfApiKey = process.env.NEXT_PUBLIC_HF_API_KEY || process.env.HF_API_KEY;
      if (gateway === 'huggingface' && hfApiKey) {
        headers['Authorization'] = `Bearer ${hfApiKey}`;
      }

      response = await fetch(url, {
        method: 'GET',
        headers,
        // Use Next.js revalidation instead of no-store for better performance
        next: { revalidate: 60 }, // Cache for 60 seconds
        signal: AbortSignal.timeout(15000) // 15 second timeout for larger requests
      });

      if (response.ok) {
        const data = await response.json();

        // Validate response structure and data
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          allModels.push(...data.data);
          console.log(`[Models] Fetched ${data.data.length} models for gateway: ${gateway} (offset: ${offset})`);

          // Stop if we got fewer models than requested or if we've reached the limit
          if (data.data.length < requestLimit || (limit && allModels.length >= limit)) {
            hasMore = false;
          } else {
            offset += requestLimit;
          }
        } else {
          hasMore = false;
        }
      } else {
        // If v1/models fails, try the older /models endpoint
        console.log(`[Models] Trying fallback /models endpoint for ${gateway}`);
        url = `${API_BASE_URL}/models?gateway=${gateway}${fullLimitParam}`;

        try {
          const fallbackHeaders: Record<string, string> = {
            'Content-Type': 'application/json'
          };

          // Add HF_API_KEY header if available
          const hfApiKey = process.env.NEXT_PUBLIC_HF_API_KEY || process.env.HF_API_KEY;
          if (gateway === 'huggingface' && hfApiKey) {
            fallbackHeaders['Authorization'] = `Bearer ${hfApiKey}`;
          }

          response = await fetch(url, {
            method: 'GET',
            headers: fallbackHeaders,
            next: { revalidate: 60 },
            signal: AbortSignal.timeout(15000)
          });

          if (response.ok) {
            const data = await response.json();

            // Validate response structure and data
            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
              allModels.push(...data.data);
              console.log(`[Models] Fetched ${data.data.length} models for gateway: ${gateway} (from fallback, offset: ${offset})`);

              // Stop if we got fewer models than requested or if we've reached the limit
              if (data.data.length < requestLimit || (limit && allModels.length >= limit)) {
                hasMore = false;
              } else {
                offset += requestLimit;
              }
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        } catch (backendError: any) {
          // Silently fail and use fallback
          hasMore = false;
        }
      }
    } catch (backendError: any) {
      // If v1/models fails, try the older /models endpoint
      console.log(`[Models] Trying fallback /models endpoint for ${gateway}`);
      url = `${API_BASE_URL}/models?gateway=${gateway}${fullLimitParam}`;

      try {
        const fallbackHeaders2: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        // Add HF_API_KEY header if available
        const hfApiKey = process.env.NEXT_PUBLIC_HF_API_KEY || process.env.HF_API_KEY;
        if (gateway === 'huggingface' && hfApiKey) {
          fallbackHeaders2['Authorization'] = `Bearer ${hfApiKey}`;
        }

        response = await fetch(url, {
          method: 'GET',
          headers: fallbackHeaders2,
          next: { revalidate: 60 },
          signal: AbortSignal.timeout(15000)
        });

        if (response.ok) {
          const data = await response.json();

          // Validate response structure and data
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            allModels.push(...data.data);
            console.log(`[Models] Fetched ${data.data.length} models for gateway: ${gateway} (from fallback, offset: ${offset})`);

            // Stop if we got fewer models than requested or if we've reached the limit
            if (data.data.length < requestLimit || (limit && allModels.length >= limit)) {
              hasMore = false;
            } else {
              offset += requestLimit;
            }
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      } catch (backendError: any) {
        // Silently fail and use fallback
        hasMore = false;
      }
    }
  }

  // If we got models from pagination, return them
  if (allModels.length > 0) {
    console.log(`[Models] Total fetched for gateway ${gateway}: ${allModels.length} models`);
    return { data: allModels };
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
