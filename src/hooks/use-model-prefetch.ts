import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

const CACHE_KEY = 'gatewayz_models_cache_v4_all_gateways';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// In-memory prefetch cache to avoid duplicate requests
const prefetchCache = new Map<string, Promise<any>>();

/**
 * Hook implementing React Router's prefetch pattern for model data.
 * Inspired by React Router's prefetch="intent" - prefetches data on hover/focus.
 *
 * @returns Object with prefetch functions for hover and click handlers
 */
export function useModelPrefetch() {
  const router = useRouter();
  const prefetchTimeoutRef = useRef<NodeJS.Timeout>();

  const prefetchModelData = useCallback(async (modelId: string) => {
    // Check if already prefetching/prefetched
    if (prefetchCache.has(modelId)) {
      return prefetchCache.get(modelId);
    }

    // Check if already in localStorage cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          const foundModel = data.find((m: any) => {
            if (m.id === modelId) return true;
            const modelNamePart = m.id.includes(':') ? m.id.split(':')[1] : m.id;
            return modelNamePart === modelId || m.id.split('/').pop() === modelId;
          });
          if (foundModel) {
            // Already cached, no need to prefetch
            return Promise.resolve(foundModel);
          }
        }
      } catch (e) {
        console.log('Cache check error:', e);
      }
    }

    // Start prefetch
    const prefetchPromise = (async () => {
      try {
        console.log(`[Prefetch] Starting prefetch for model: ${modelId}`);

        const fetchWithTimeout = (url: string, timeout = 10000) => {
          return Promise.race([
            fetch(url),
            new Promise<Response>((_, reject) =>
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);
        };

        // Prefetch from faster gateways first (progressive enhancement)
        // Prioritize gateways known for fast response times
        const fastGateways = [
          'groq',
          'cerebras',
          'openrouter',
          'together',
          'fireworks',
          'xai'
        ];

        const fastFetches = fastGateways.map(gateway =>
          fetchWithTimeout(`/api/models?gateway=${gateway}`).catch(() => null)
        );

        const results = await Promise.allSettled(fastFetches);
        const allData: any[] = [];

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            try {
              const data = await result.value.json();
              if (data.data) {
                allData.push(...data.data);

                // Check if we found the model - if yes, we can stop early
                const foundModel = data.data.find((m: any) => {
                  if (m.id === modelId) return true;
                  const modelNamePart = m.id.includes(':') ? m.id.split(':')[1] : m.id;
                  return modelNamePart === modelId || m.id.split('/').pop() === modelId;
                });

                if (foundModel) {
                  console.log(`[Prefetch] Found model ${modelId} early, caching...`);
                  // Cache partial results
                  try {
                    const existing = localStorage.getItem(CACHE_KEY);
                    let existingData = [];
                    if (existing) {
                      const { data: cachedData, timestamp } = JSON.parse(existing);
                      if (Date.now() - timestamp < CACHE_DURATION) {
                        existingData = cachedData;
                      }
                    }

                    // Merge with existing cache
                    const uniqueModelsMap = new Map();
                    [...existingData, ...allData].forEach((model: any) => {
                      if (!uniqueModelsMap.has(model.id)) {
                        uniqueModelsMap.set(model.id, model);
                      }
                    });
                    const mergedData = Array.from(uniqueModelsMap.values());

                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                      data: mergedData,
                      timestamp: Date.now()
                    }));
                  } catch (e) {
                    console.log('[Prefetch] Cache update skipped');
                  }

                  return foundModel;
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }

        console.log(`[Prefetch] Model ${modelId} not found in fast gateways`);
        return null;
      } catch (error) {
        console.log('[Prefetch] Error:', error);
        return null;
      } finally {
        // Remove from prefetch cache after completion
        setTimeout(() => {
          prefetchCache.delete(modelId);
        }, 5000); // Keep for 5 seconds to avoid duplicate requests
      }
    })();

    prefetchCache.set(modelId, prefetchPromise);
    return prefetchPromise;
  }, []);

  /**
   * Handler for mouse enter - starts prefetch after a short delay
   * (mimics React Router's "intent" prefetch behavior)
   */
  const onMouseEnter = useCallback((modelId: string) => {
    // Clear any existing timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }

    // Wait 100ms before prefetching (user might just be passing over)
    prefetchTimeoutRef.current = setTimeout(() => {
      prefetchModelData(modelId);
      // Also prefetch the route
      router.prefetch(`/models/${encodeURIComponent(modelId)}`);
    }, 100);
  }, [prefetchModelData, router]);

  /**
   * Handler for mouse leave - cancels prefetch if user moves away quickly
   */
  const onMouseLeave = useCallback(() => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }
  }, []);

  /**
   * Handler for focus - prefetches immediately (keyboard navigation)
   */
  const onFocus = useCallback((modelId: string) => {
    prefetchModelData(modelId);
    router.prefetch(`/models/${encodeURIComponent(modelId)}`);
  }, [prefetchModelData, router]);

  return {
    onMouseEnter,
    onMouseLeave,
    onFocus,
    prefetchModelData
  };
}
