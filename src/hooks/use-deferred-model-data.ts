import { useState, useEffect } from 'react';

interface Model {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture: {
    input_modalities: string[];
  };
  supported_parameters: string[];
  provider_slug: string;
  is_private?: boolean; // Indicates if model is on a private network (e.g., NEAR)
}

interface DeferredModelData {
  model: Model | null;
  allModels: Model[];
  modelProviders: string[];
  isLoading: boolean;
  isCriticalDataLoaded: boolean; // Critical data (model info) is loaded
  isDeferredDataLoaded: boolean; // Deferred data (providers, related models) is loaded
}

const CACHE_KEY = 'gatewayz_models_cache_v6_gateway_fix';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Custom hook implementing React Router's defer pattern for deferred data loading.
 * Critical data (model info) loads immediately while non-critical data (providers, related models)
 * is deferred and loaded in the background.
 */
export function useDeferredModelData(modelId: string, staticModels: Model[]): DeferredModelData {
  const [model, setModel] = useState<Model | null>(null);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [modelProviders, setModelProviders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCriticalDataLoaded, setIsCriticalDataLoaded] = useState(false);
  const [isDeferredDataLoaded, setIsDeferredDataLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    // PHASE 1: Immediately load critical data from static/cache (defer pattern)
    const loadCriticalData = () => {
      // Try static data first
      let foundModel = staticModels.find((m: Model) => m.id === modelId);
      if (!foundModel) {
        foundModel = staticModels.find((m: Model) => {
          const modelNamePart = m.id.includes(':') ? m.id.split(':')[1] : m.id;
          return modelNamePart === modelId || m.id.split('/').pop() === modelId;
        });
      }

      // Try cache
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached && !foundModel) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            const cachedModel = data.find((m: Model) => {
              if (m.id === modelId) return true;
              const modelNamePart = m.id.includes(':') ? m.id.split(':')[1] : m.id;
              return modelNamePart === modelId || m.id.split('/').pop() === modelId;
            });
            if (cachedModel) {
              foundModel = cachedModel;
              setAllModels(data);
            }
          }
        } catch (e) {
          console.log('Cache parse error:', e);
        }
      }

      if (foundModel && mounted) {
        setModel(foundModel);
        setIsCriticalDataLoaded(true);
        setIsLoading(false);
      }

      return foundModel;
    };

    const staticFoundModel = loadCriticalData();

    // PHASE 2: Defer non-critical data (providers, full model list) - load in background
    const loadDeferredData = async () => {
      try {
        const fetchWithTimeout = (url: string, timeout = 30000) => {
          return Promise.race([
            fetch(url),
            new Promise<Response>((_, reject) =>
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);
        };

        // Use single gateway=all endpoint instead of N+1 individual gateway calls
        // This significantly reduces API calls and improves performance
        let models: Model[] = [];

        try {
          const response = await fetchWithTimeout(`/api/models?gateway=all`, 60000);
          if (response.ok) {
            const data = await response.json();
            models = data.data || [];
          }
        } catch (e) {
          console.log('Failed to fetch all models, will use cache:', e);
        }

        // If gateway=all failed or returned empty, try to use cached data
        if (models.length === 0) {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            try {
              const { data } = JSON.parse(cached);
              if (Array.isArray(data)) {
                models = data;
              }
            } catch (e) {
              console.log('Cache parse error:', e);
            }
          }
        }

        // Cache the results
        try {
          const compactModels = models.map((m: Model) => ({
            id: m.id,
            name: m.name,
            description: m.description.substring(0, 200),
            context_length: m.context_length,
            pricing: m.pricing,
            architecture: m.architecture,
            supported_parameters: m.supported_parameters,
            provider_slug: m.provider_slug
          }));

          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: compactModels,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.log('Cache skipped (storage quota)');
        }

        if (mounted) {
          setAllModels(models);

          // Find the specific model
          let foundModel = models.find((m: Model) => m.id === modelId);
          if (!foundModel) {
            foundModel = models.find((m: Model) => {
              const modelNamePart = m.id.includes(':') ? m.id.split(':')[1] : m.id;
              return modelNamePart === modelId || m.id.split('/').pop() === modelId;
            });
          }

          if (foundModel) {
            setModel(foundModel);
            setIsCriticalDataLoaded(true);
          } else if (!staticFoundModel) {
            setModel(null);
          }
          setIsLoading(false);

          // Determine which gateways support this model from the model's source_gateways array
          // The gateway=all endpoint returns models with source_gateways populated
          let providers: string[] = [];

          if (foundModel) {
            // Models from gateway=all endpoint have source_gateways array
            const modelWithGateways = foundModel as Model & {
              source_gateways?: string[];
              source_gateway?: string;
            };

            if (Array.isArray(modelWithGateways.source_gateways) && modelWithGateways.source_gateways.length > 0) {
              providers = [...modelWithGateways.source_gateways];
            } else if (modelWithGateways.source_gateway) {
              // Fallback to single source_gateway if source_gateways not available
              providers = [modelWithGateways.source_gateway];
            }
          }

          setModelProviders(providers);
          setIsDeferredDataLoaded(true);
        }
      } catch (error) {
        console.log('Failed to load deferred data:', error);
        if (mounted) {
          if (!staticFoundModel) {
            setIsLoading(false);
          }
          setIsDeferredDataLoaded(true);
        }
      }
    };

    // Start deferred data loading in background
    loadDeferredData();

    return () => {
      mounted = false;
    };
  }, [modelId, staticModels]);

  return {
    model,
    allModels,
    modelProviders,
    isLoading,
    isCriticalDataLoaded,
    isDeferredDataLoaded
  };
}
