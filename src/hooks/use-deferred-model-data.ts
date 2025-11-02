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
}

interface DeferredModelData {
  model: Model | null;
  allModels: Model[];
  modelProviders: string[];
  isLoading: boolean;
  isCriticalDataLoaded: boolean; // Critical data (model info) is loaded
  isDeferredDataLoaded: boolean; // Deferred data (providers, related models) is loaded
}

const CACHE_KEY = 'gatewayz_models_cache_v4_all_gateways';
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
        const fetchWithTimeout = (url: string, timeout = 10000) => {
          return Promise.race([
            fetch(url),
            new Promise<Response>((_, reject) =>
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);
        };

        // Fetch from gateways in parallel (non-blocking for critical render)
        const gatewayFetches = [
          fetchWithTimeout(`/api/models?gateway=openrouter`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=portkey`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=featherless`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=chutes`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=fireworks`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=together`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=groq`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=deepinfra`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=google`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=cerebras`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=nebius`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=xai`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=novita`).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=huggingface`, 70000).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=aimo`, 70000).catch(() => null),
          fetchWithTimeout(`/api/models?gateway=near`, 70000).catch(() => null),
        ];

        const results = await Promise.allSettled(gatewayFetches);

        const getData = async (result: PromiseSettledResult<Response | null>) => {
          if (result.status === 'fulfilled' && result.value) {
            try {
              const data = await result.value.json();
              return data.data || [];
            } catch (e) {
              return [];
            }
          }
          return [];
        };

        const allGatewayData = await Promise.all(results.map(getData));
        const allModelsData = allGatewayData.flat();

        // Deduplicate by ID
        const uniqueModelsMap = new Map();
        allModelsData.forEach((model: any) => {
          if (!uniqueModelsMap.has(model.id)) {
            uniqueModelsMap.set(model.id, model);
          }
        });
        const models = Array.from(uniqueModelsMap.values());

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

          // Determine which gateways support this model
          const providers: string[] = [];
          const modelIdLower = modelId.toLowerCase();

          const hasModel = (data: Model[]) => {
            return data.some((m: Model) => {
              if (m.id.toLowerCase() === modelIdLower) return true;
              const modelNamePart = m.id.includes(':') ? m.id.split(':')[1].toLowerCase() : m.id.toLowerCase();
              if (modelNamePart === modelIdLower) return true;
              const normalizedModelId = modelIdLower.replace(/[_\-\/]/g, '');
              const normalizedDataId = m.id.toLowerCase().replace(/[_\-\/]/g, '');
              if (normalizedModelId === normalizedDataId) return true;
              if (m.name && m.name.toLowerCase() === model?.name?.toLowerCase()) return true;
              const lastPart = m.id.split('/').pop()?.toLowerCase();
              if (lastPart === modelIdLower) return true;
              return false;
            });
          };

          const gatewayNames = [
            'openrouter', 'portkey', 'featherless', 'chutes', 'fireworks',
            'together', 'groq', 'deepinfra', 'google', 'cerebras',
            'nebius', 'xai', 'novita', 'huggingface', 'aimo', 'near'
          ];

          allGatewayData.forEach((data, index) => {
            if (hasModel(data)) {
              providers.push(gatewayNames[index]);
            }
          });

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
