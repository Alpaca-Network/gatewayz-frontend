import { useEffect, useRef } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
const PRELOAD_CACHE_KEY = 'gatewayz_models_preload_state';

export function useEagerModelPreload() {
  const preloadAttemptedRef = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (preloadAttemptedRef.current) {
      return;
    }
    preloadAttemptedRef.current = true;

    // Check if we've already preloaded recently (avoid hammering API)
    const stored = localStorage.getItem(PRELOAD_CACHE_KEY);
    if (stored) {
      try {
        const { timestamp } = JSON.parse(stored);
        // If preloaded within last 55 minutes, skip (cache is 60 minutes)
        if (Date.now() - timestamp < 55 * 60 * 1000) {
          console.log('[Preload] Models cached recently, skipping preload');
          return;
        }
      } catch (e) {
        // Invalid data, proceed with preload
      }
    }

    // Start preload in background without blocking UI
    // Use requestIdleCallback if available, otherwise setTimeout
    const startPreload = () => {
      preloadModels().catch(err => {
        console.warn('[Preload] Background preload failed:', err.message);
      });
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(startPreload, { timeout: 2000 });
    } else {
      setTimeout(startPreload, 100);
    }
  }, []);

  return null;
}

async function preloadModels() {
  try {
    console.log('[Preload] Starting eager model preload in background...');
    const startTime = performance.now();

    const controller = new AbortController();
    // Reduced from 8s to 5s for faster background preload
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `/api/models?gateway=all&limit=50`,
      {
        signal: controller.signal,
        // Low priority - don't block other requests
        priority: 'low' as any
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Preload] API returned non-OK status:', response.status);
      return;
    }

    const data = await response.json();
    const duration = performance.now() - startTime;

    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      console.warn('[Preload] No models returned from API');
      return;
    }

    // Convert to ModelOption format and cache
    const modelOptions = data.data.map((model: any) => {
      const sourceGateway = model.source_gateway || 'openrouter';
      const promptPrice = Number(model.pricing?.prompt ?? 0);
      const completionPrice = Number(model.pricing?.completion ?? 0);
      const isPaid = promptPrice > 0 || completionPrice > 0;
      const category = sourceGateway === 'portkey' ? 'Portkey' : (isPaid ? 'Paid' : 'Free');

      return {
        value: model.id,
        label: model.name,
        category,
        sourceGateway,
        developer: model.provider_slug || 'Unknown',
        modalities: model.architecture?.input_modalities?.map((m: string) =>
          m.charAt(0).toUpperCase() + m.slice(1)
        ) || ['Text'],
        speedTier: undefined,
        huggingfaceMetrics: model.huggingface_metrics ? {
          downloads: model.huggingface_metrics.downloads || 0,
          likes: model.huggingface_metrics.likes || 0,
        } : undefined,
      };
    });

    // Try to cache the results
    const CACHE_KEY = 'gatewayz_models_cache_v5_optimized';
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: modelOptions,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Storage quota exceeded, try to clear old cache
      try {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem('gatewayz_models_cache');
      } catch (clearError) {
        // Ignore
      }
    }

    // Mark preload as completed
    localStorage.setItem(PRELOAD_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      modelCount: modelOptions.length
    }));

    console.log(
      `[Preload] ✓ Successfully preloaded ${modelOptions.length} models in ${duration.toFixed(0)}ms`
    );
  } catch (error: any) {
    // Silent fail for background preload - don't spam console
    if (error.name !== 'AbortError') {
      console.warn('[Preload] Background preload failed:', error.message);
    }
  }
}
