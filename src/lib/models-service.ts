import { models } from '@/lib/models-data';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

// In-memory cache for models to reduce API calls
let modelsCache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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
  // Check cache first
  if (modelsCache && gateway === 'all') {
    const now = Date.now();
    if (now - modelsCache.timestamp < CACHE_DURATION) {
      console.log(`[Models] Returning cached models (${modelsCache.data.length} models)`);
      return { data: modelsCache.data };
    }
  }

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
    'aimo',
    'near',
    'all'
  ];
  if (!validGateways.includes(gateway)) {
    throw new Error('Invalid gateway');
  }

  // Special handling for 'all' gateway - use the backend's gateway=all endpoint directly
  // This is more efficient than fetching from each gateway individually
  if (gateway === 'all') {
    console.log('[Models] Fetching from gateway=all endpoint');
    try {
      // Fetch directly from the backend's gateway=all endpoint
      const models = await fetchModelsFromGateway('all', limit);

      console.log(`[Models] Fetched ${models.length} models from gateway=all endpoint`);

      // Cache the result for 'all' gateway
      if (models.length > 0) {
        modelsCache = {
          data: models,
          timestamp: Date.now()
        };
        return { data: models };
      }
    } catch (error) {
      console.error('[Models] Error fetching from gateway=all:', error);
      // Fall through to static fallback
    }
  }

  // For specific gateways, use the existing fetch logic
  const models = await fetchModelsFromGateway(gateway, limit);
  if (models.length > 0) {
    return { data: models };
  }

  // Fallback to static data (only used if API fails)
  return { data: getStaticFallbackModels(gateway) };
}

// Helper function to fetch models from a specific gateway
async function fetchModelsFromGateway(gateway: string, limit?: number): Promise<any[]> {
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

    // Debug logging for HuggingFace, Google, AiMo, and NEAR requests
    if (gateway === 'huggingface' || gateway === 'google' || gateway === 'aimo' || gateway === 'near') {
      console.log(`[Models] Requesting ${gateway} models with URL: ${url}`);
    }

    // Use longer timeout for 'all', 'huggingface', 'google', 'aimo', and 'near' gateways (they have many models)
    const timeoutMs = (gateway === 'all' || gateway === 'huggingface' || gateway === 'google' || gateway === 'aimo' || gateway === 'near') ? 90000 : 15000;

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

      // Add NEAR_API_KEY header if available for NEAR gateway (for auth and rate limit bypass)
      const nearApiKey = process.env.NEXT_PUBLIC_NEAR_API_KEY || process.env.NEAR_API_KEY;
      if (gateway === 'near' && nearApiKey) {
        headers['Authorization'] = `Bearer ${nearApiKey}`;
      }

      response = await fetch(url, {
        method: 'GET',
        headers,
        // Cache aggressively for better performance (5 minutes)
        next: { revalidate: 300 }, // Cache for 5 minutes
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (response.ok) {
        const data = await response.json();

        // Validate response structure and data
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          allModels.push(...data.data);
          console.log(`[Models] Fetched ${data.data.length} models for gateway: ${gateway} (offset: ${offset})`);

          // For HuggingFace, continue pagination even if we got 500 models (backend's old cap)
          // For other gateways, stop if we got fewer than requested
          const isFiveHundred = data.data.length === 500 && gateway === 'huggingface';
          const hasReachedLimit = limit && allModels.length >= limit;
          const gotFewerThanRequested = data.data.length < requestLimit && !isFiveHundred;

          if (gotFewerThanRequested || hasReachedLimit) {
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

          // Add NEAR_API_KEY header if available
          const nearApiKey = process.env.NEXT_PUBLIC_NEAR_API_KEY || process.env.NEAR_API_KEY;
          if (gateway === 'near' && nearApiKey) {
            fallbackHeaders['Authorization'] = `Bearer ${nearApiKey}`;
          }

          response = await fetch(url, {
            method: 'GET',
            headers: fallbackHeaders,
            next: { revalidate: 300 },
            signal: AbortSignal.timeout(timeoutMs)
          });

          if (response.ok) {
            const data = await response.json();

            // Validate response structure and data
            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
              allModels.push(...data.data);
              console.log(`[Models] Fetched ${data.data.length} models for gateway: ${gateway} (from fallback, offset: ${offset})`);

              // For HuggingFace, continue pagination even if we got 500 models (backend's old cap)
              // For other gateways, stop if we got fewer than requested
              const isFiveHundred1 = data.data.length === 500 && gateway === 'huggingface';
              const hasReachedLimit1 = limit && allModels.length >= limit;
              const gotFewerThanRequested1 = data.data.length < requestLimit && !isFiveHundred1;

              if (gotFewerThanRequested1 || hasReachedLimit1) {
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
          console.error(`[Models] Nested fallback endpoint failed for ${gateway}:`, backendError.message || backendError);
          hasMore = false;
        }
      }
    } catch (backendError: any) {
      // If v1/models fails, try the older /models endpoint
      console.error(`[Models] v1/models endpoint failed for ${gateway}:`, backendError.message || backendError);
      console.log(`[Models] Trying fallback /models endpoint for ${gateway}`);
      url = `${API_BASE_URL}/models?gateway=${gateway}${fullLimitParam}`;

      try{
        const fallbackHeaders2: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        // Add HF_API_KEY header if available
        const hfApiKey = process.env.NEXT_PUBLIC_HF_API_KEY || process.env.HF_API_KEY;
        if (gateway === 'huggingface' && hfApiKey) {
          fallbackHeaders2['Authorization'] = `Bearer ${hfApiKey}`;
        }

        // Add NEAR_API_KEY header if available
        const nearApiKey = process.env.NEXT_PUBLIC_NEAR_API_KEY || process.env.NEAR_API_KEY;
        if (gateway === 'near' && nearApiKey) {
          fallbackHeaders2['Authorization'] = `Bearer ${nearApiKey}`;
        }

        response = await fetch(url, {
          method: 'GET',
          headers: fallbackHeaders2,
          next: { revalidate: 300 },
          signal: AbortSignal.timeout(timeoutMs)
        });

        if (response.ok) {
          const data = await response.json();

          // Validate response structure and data
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            allModels.push(...data.data);
            console.log(`[Models] Fetched ${data.data.length} models for gateway: ${gateway} (from fallback, offset: ${offset})`);

            // For HuggingFace, continue pagination even if we got 500 models (backend's old cap)
            // For other gateways, stop if we got fewer than requested
            const isFiveHundred2 = data.data.length === 500 && gateway === 'huggingface';
            const hasReachedLimit2 = limit && allModels.length >= limit;
            const gotFewerThanRequested2 = data.data.length < requestLimit && !isFiveHundred2;

            if (gotFewerThanRequested2 || hasReachedLimit2) {
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
        console.error(`[Models] Fallback endpoint failed for ${gateway}:`, backendError.message || backendError);
        hasMore = false;
      }
    }
  }

  // Return fetched models
  console.log(`[Models] Total fetched for gateway ${gateway}: ${allModels.length} models`);
  return allModels;
}

// Helper function to get static fallback models
function getStaticFallbackModels(gateway: string): any[] {
  console.warn(`[Models] No models fetched from API for ${gateway}, falling back to static data (${models.length} models)`);
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
      'huggingface',
      'aimo',
      'near'
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
      'huggingface',
      'aimo',
      'near'
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

  return transformedModels;
}
