import { models } from '@/lib/models-data';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

// In-memory cache for models to reduce API calls
let modelsCache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Transform static models data to backend format
function transformModel(model: any, gateway: string) {
  const resolvedGateway = gateway === 'all' ? 'openrouter' : gateway;
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
    provider_slugs: [model.developer], // NEW: Track provider as array for consistent display
    source_gateway: resolvedGateway, // Keep for backwards compatibility
    source_gateways: [resolvedGateway], // NEW: Track gateway as array for consistent display
    is_private: model.is_private // Preserve is_private field if present
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
    'fal',
    'vercel-ai-gateway', // Vercel AI Gateway
    'helicone', // Helicone AI Gateway - will be skipped if backend unavailable
    'alpaca', // Alpaca Network
    'all'
  ];
  if (!validGateways.includes(gateway)) {
    throw new Error('Invalid gateway');
  }

  // Special handling for 'all' gateway - fetch from all individual gateways in parallel
  // This ensures models are properly assigned to their respective gateways for filtering
  if (gateway === 'all') {
    console.log('[Models] Fetching from all gateways in parallel');
    try {
      // Fetch from all known gateways (excluding deprecated 'portkey' and 'all' itself)
      const gatewaysToFetch = [
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
        'huggingface',
        'aimo',
        'near',
        'fal',
        'vercel-ai-gateway',
        'helicone',
        'alpaca'
      ];

      const results = await Promise.all(
        gatewaysToFetch.map(gw => fetchModelsFromGateway(gw, limit))
      );

      // Combine and deduplicate models intelligently
      const combinedModels = results.flat();

      // Create a normalized key for deduplication
      // This handles cases where the same model has different IDs from different gateways/providers
      const modelMap = new Map<string, any>();

      for (const model of combinedModels) {
        // Normalize the model name: remove prefixes, lowercase, remove special chars, handle versioning
        let normalizedName = (model.name || '')
          .toLowerCase()
          .replace(/^(google:|openai:|meta:|anthropic:|models\/)/i, '') // Remove provider prefixes
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/[^\w-]/g, ''); // Remove special characters except hyphens

        // Also normalize based on canonical_slug or id if available, as a fallback
        // This handles cases where the model name differs slightly but they're the same model
        // The backend returns inconsistent canonical_slugs (e.g., "gemini-2.5-pro" vs "google/gemini-2.5-pro")
        // We normalize by removing ALL provider prefixes to ensure proper deduplication
        let canonicalSlug = (model.canonical_slug || model.id || '').toLowerCase();

        // Remove provider prefixes (some models have them, others don't)
        canonicalSlug = canonicalSlug
          .replace(/^(aimo\/|google\/|openai\/|meta\/|anthropic\/|models\/|mistralai\/|xai\/)/i, '')
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '');

        // Use canonical slug if it's more specific, otherwise use normalized name
        // Prefer canonical_slug as it's designed to be a unique identifier
        const dedupKey = canonicalSlug || normalizedName;

        // Merge models from multiple gateways AND providers
        if (modelMap.has(dedupKey)) {
          const existing = modelMap.get(dedupKey);

          // Merge source_gateways arrays
          const existingGateways = Array.isArray(existing.source_gateways)
            ? existing.source_gateways
            : (existing.source_gateway ? [existing.source_gateway] : []);

          const newGateways = Array.isArray(model.source_gateways)
            ? model.source_gateways
            : (model.source_gateway ? [model.source_gateway] : []);

          // Combine and deduplicate gateways
          const combinedGateways = Array.from(new Set([...existingGateways, ...newGateways]));

          // NEW: Track multiple providers for the same model
          const existingProviders = Array.isArray(existing.provider_slugs)
            ? existing.provider_slugs
            : (existing.provider_slug ? [existing.provider_slug] : []);

          const newProviders = model.provider_slug ? [model.provider_slug] : [];
          const combinedProviders = Array.from(new Set([...existingProviders, ...newProviders]));

          // Calculate data completeness score (models with more metadata are preferred)
          const existingScore = (existing.description ? 1 : 0) +
                                (existing.pricing?.prompt ? 1 : 0) +
                                (existing.context_length > 0 ? 1 : 0) +
                                (existing.architecture?.input_modalities?.length || 0);

          const newScore = (model.description ? 1 : 0) +
                           (model.pricing?.prompt ? 1 : 0) +
                           (model.context_length > 0 ? 1 : 0) +
                           (model.architecture?.input_modalities?.length || 0);

          // Keep the model with more complete data, but always preserve all gateways and providers
          const mergedModel = newScore > existingScore ? model : existing;
          mergedModel.source_gateways = combinedGateways;
          mergedModel.provider_slugs = combinedProviders;

          modelMap.set(dedupKey, mergedModel);
        } else {
          // First occurrence - ensure source_gateways is an array
          if (!Array.isArray(model.source_gateways) && model.source_gateway) {
            model.source_gateways = [model.source_gateway];
          } else if (!model.source_gateways) {
            model.source_gateways = [];
          }

          // NEW: Initialize provider_slugs array
          model.provider_slugs = model.provider_slug ? [model.provider_slug] : [];

          modelMap.set(dedupKey, model);
        }
      }

      const uniqueModels = Array.from(modelMap.values());

      console.log(`[Models] Combined ${combinedModels.length} total (${uniqueModels.length} unique) from ${gatewaysToFetch.length} gateways`);

      // Cache the result for 'all' gateway
      modelsCache = {
        data: uniqueModels,
        timestamp: Date.now()
      };

      return { data: uniqueModels };
    } catch (error) {
      console.error('[Models] Error fetching from multiple gateways:', error);
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

// Helper function to build request headers
function buildHeaders(gateway: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const hfApiKey = process.env.NEXT_PUBLIC_HF_API_KEY || process.env.HF_API_KEY;
  if (gateway === 'huggingface' && hfApiKey) {
    headers['Authorization'] = `Bearer ${hfApiKey}`;
  }

  const nearApiKey = process.env.NEXT_PUBLIC_NEAR_API_KEY || process.env.NEAR_API_KEY;
  if (gateway === 'near' && nearApiKey) {
    headers['Authorization'] = `Bearer ${nearApiKey}`;
  }

  return headers;
}

// Helper function to normalize model fields for consistent tag display
function normalizeModel(model: any, gateway: string): any {
  return {
    ...model,
    // Ensure source_gateways is always an array
    source_gateways: Array.isArray(model.source_gateways)
      ? model.source_gateways
      : (model.source_gateway ? [model.source_gateway] : [gateway]),
    // Ensure provider_slugs is always an array
    provider_slugs: Array.isArray(model.provider_slugs)
      ? model.provider_slugs
      : (model.provider_slug ? [model.provider_slug] : []),
    // Keep singular fields for backwards compatibility
    source_gateway: model.source_gateway || gateway,
    provider_slug: model.provider_slug || 'unknown'
  };
}

// Helper function to fetch models from a specific gateway
async function fetchModelsFromGateway(gateway: string, limit?: number): Promise<any[]> {
  const allModels: any[] = [];
  const requestLimit = limit || 50000; // Request up to 50k models per page (backend limit)
  const FAST_GATEWAYS = ['openrouter', 'groq', 'together', 'fireworks', 'vercel-ai-gateway'];
  const timeoutMs = FAST_GATEWAYS.includes(gateway) ? 3000 : 5000;

  let offset = 0;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore && pageCount < 10) {
    pageCount++;
    const offsetParam = offset > 0 ? `&offset=${offset}` : '';
    const limitParam = `limit=${requestLimit}${offsetParam}`;

    // Try both v1/models and /models endpoints using Promise.race for fast fallback
    const urls = [
      `${API_BASE_URL}/v1/models?gateway=${gateway}&${limitParam}`,
      `${API_BASE_URL}/models?gateway=${gateway}&${limitParam}`
    ];

    try {
      const headers = buildHeaders(gateway);

      // Try both endpoints in parallel, use first successful response
      const response = await Promise.race(
        urls.map(url =>
fetch(url, {
             method: 'GET',
             headers,
             next: {
               revalidate: 300,
               tags: [`models:gateway:${gateway}`, 'models:all']
             },
             signal: AbortSignal.timeout(timeoutMs)
           })
        )
      );

      if (response.ok) {
        const data = await response.json();

        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          // Normalize each model to ensure provider_slugs and source_gateways are arrays
          const normalizedModels = data.data.map((model: any) => normalizeModel(model, gateway));
          allModels.push(...normalizedModels);
          console.log(`[Models] Fetched ${data.data.length} models for gateway: ${gateway} (offset: ${offset})`);

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
        hasMore = false;
      }
    } catch (error: any) {
      console.error(`[Models] Failed to fetch ${gateway}:`, error.message || error);
      hasMore = false;
    }
  }

  console.log(`[Models] Total fetched for gateway ${gateway}: ${allModels.length} models`);
  return allModels;
}

// Helper function to get static fallback models
function getStaticFallbackModels(gateway: string): any[] {
  console.warn(`[Models] No models fetched from API for ${gateway}, falling back to static data (${models.length} models)`);
  let transformedModels;

  // Map developers to their preferred gateways
  const developerToGateway: Record<string, string> = {
    'alpaca-network': 'alpaca',
    'near': 'near',
    // Add more mappings as needed
  };

  if (gateway === 'all') {
    // Assign models to gateways based on their developer field if possible
    transformedModels = models.map((model) => {
      // Check if this developer has a specific gateway mapping
      const assignedGateway = developerToGateway[model.developer] || 'openrouter';
      return transformModel(model, assignedGateway);
    });
  } else {
    // Get models for specific gateway by filtering by developer field
    // This maps gateway names to their corresponding developer identifiers
    const gatewayToDeveloper: Record<string, string> = {
      'alpaca': 'alpaca-network',
      'near': 'near',
      // Add more mappings as needed for other gateways
    };

    let gatewayModels;

    // If we have a specific developer mapping, filter by developer field
    if (gatewayToDeveloper[gateway]) {
      const developerName = gatewayToDeveloper[gateway];
      gatewayModels = models.filter(m => m.developer === developerName);
    } else {
      // For gateways without specific mappings, distribute models evenly as before
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
        'near',
        'fal',
        'vercel-ai-gateway',
        'helicone',
        'alpaca'
      ];
      const modelsPerGateway = Math.ceil(models.length / allGateways.length);

      const gatewayIndex = allGateways.indexOf(gateway);
      if (gatewayIndex !== -1) {
        const startIndex = gatewayIndex * modelsPerGateway;
        const endIndex = gatewayIndex === allGateways.length - 1 ? models.length : (gatewayIndex + 1) * modelsPerGateway;
        gatewayModels = models.slice(startIndex, endIndex);
      } else {
        gatewayModels = models; // Default to all models for unknown gateways
      }
    }

    transformedModels = gatewayModels.map(m => transformModel(m, gateway));
  }

  return transformedModels;
}
