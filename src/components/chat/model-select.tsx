
"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronRight, ChevronsUpDown, Loader2, Star, Sparkles, Shield, Lock, ArrowDownAZ, Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { getAdaptiveTimeout } from "@/lib/network-timeouts"
import { isFreeModel, getModelPricingCategory } from "@/lib/model-pricing-utils"
import { isTauriDesktop } from "@/lib/browser-detection"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { NEAR_INCOGNITO_MODELS } from "@/lib/store/chat-ui-store"
import { useAuth } from "@/hooks/use-auth"
import { useAuthStore } from "@/lib/store/auth-store"

export type ModelOption = {
    value: string;
    label: string;
    category: string;
    sourceGateway?: string;
    developer?: string;
    modalities?: string[];
    huggingfaceMetrics?: {
        downloads?: number;
        likes?: number;
    };
    speedTier?: 'ultra-fast' | 'fast' | 'medium' | 'slow';
    avgLatencyMs?: number;
    supportsTools?: boolean; // Whether model supports function calling/tools
};

interface ModelSelectProps {
    selectedModel: ModelOption | null;
    onSelectModel: (model: ModelOption | null) => void;
    isIncognitoMode?: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

const CACHE_KEY = 'gatewayz_models_cache_v9_by_gateway';
const FAVORITES_KEY = 'gatewayz_favorite_models';
const CACHE_DURATION = 60 * 60 * 1000; // 60 minutes - extended cache for maximum performance
// All models are now fetched up-front and displayed without per-group caps.
// The cache stores the complete list (subject only to localStorage quota).

const ROUTER_OPTION: ModelOption = {
  value: 'openrouter/auto',
  label: 'Gatewayz Router',
  category: 'Router',
  sourceGateway: 'openrouter',
  developer: 'Alpaca',
  modalities: ['Text', 'Image', 'File', 'Audio', 'Video'] // Router supports all modalities
};

export const ensureRouterOption = (options: ModelOption[]): ModelOption[] => {
  const hasRouter = options.some((option) => option.value === ROUTER_OPTION.value);
  if (hasRouter) {
    return options.map((option) =>
      option.value === ROUTER_OPTION.value ? { ...ROUTER_OPTION, ...option } : option
    );
  }
  return [{ ...ROUTER_OPTION }, ...options];
};

// Clean model name by removing redundant suffixes like "(Free)" since we show icons
export const cleanModelName = (name: string): string => {
  return name.replace(/\s*\(free\)\s*/gi, '').trim();
};

// Abbreviate gateway names for compact display
export const getGatewayAbbrev = (gateway: string): string => {
  const abbrevs: Record<string, string> = {
    'cerebras': 'CRB',
    'groq': 'GRQ',
    'fireworks': 'FW',
    'together': 'TGR',
    'deepinfra': 'DI',
    'featherless': 'FL',
    'novita': 'NVT',
    'chutes': 'CHT',
    'nebius': 'NEB',
    'huggingface': 'HF',
    'near': 'NEAR',
    'onerouter': '1R',
  };
  return abbrevs[gateway.toLowerCase()] || gateway.slice(0, 3).toUpperCase();
};

// Extract developer from model ID (e.g., "openai/gpt-4" -> "OpenAI")
export const getDeveloper = (modelId: string): string => {
  const parts = modelId.split('/');
  if (parts.length > 1) {
    const dev = parts[0];
    // Capitalize and format common developers
    const formatted: Record<string, string> = {
      'openai': 'OpenAI',
      'anthropic': 'Anthropic',
      'google': 'Google',
      'meta-llama': 'Meta',
      'mistralai': 'Mistral AI',
      'cohere': 'Cohere',
      'amazon': 'Amazon',
      'microsoft': 'Microsoft',
      'deepseek': 'DeepSeek',
      'qwen': 'Qwen',
      'x-ai': 'xAI',
      'onerouter': 'OneRouter'
    };
    return formatted[dev] || dev.charAt(0).toUpperCase() + dev.slice(1);
  }
  return 'Other';
};

// Determine model speed tier based on gateway and model characteristics
export const getModelSpeedTier = (modelId: string, gateway?: string): 'ultra-fast' | 'fast' | 'medium' | 'slow' | undefined => {
  const id = modelId.toLowerCase();

  // Ultra-fast providers (Cerebras, Groq) - known for extreme speed
  if (gateway === 'cerebras' || id.includes('@cerebras/')) {
    return 'ultra-fast'; // 1000+ tokens/sec
  }
  if (gateway === 'groq' || id.includes('groq/')) {
    return 'ultra-fast'; // 500+ tokens/sec
  }

  // Fast providers and models
  if (gateway === 'fireworks' || id.includes('fireworks/')) {
    return 'fast'; // 200-500 tokens/sec
  }
  if (id.includes('gemini-flash') || id.includes('gpt-4o-mini') || id.includes('claude-haiku')) {
    return 'fast';
  }

  // Medium speed - most standard models
  if (id.includes('gpt-4') || id.includes('claude-sonnet') || id.includes('llama-3')) {
    return 'medium';
  }

  // Slow - very large models or reasoning models
  if (id.includes('o1') || id.includes('o3') || id.includes('deepseek-reasoner') || id.includes('qwq')) {
    return 'slow'; // Reasoning models take longer
  }

  return undefined; // Unknown speed
};

// Check if model supports tool calling/function calling
// Based on model architecture and known capabilities
export const checkModelToolSupport = (modelId: string, supportedParams?: string[]): boolean => {
  const id = modelId.toLowerCase();

  // If we have explicit supported_parameters from the API, check for 'tools'
  if (supportedParams && supportedParams.length > 0) {
    return supportedParams.includes('tools') || supportedParams.includes('tool_choice');
  }

  // Pattern-based detection for known tool-capable model families
  // GPT-4 and GPT-3.5 support tools
  if (id.includes('gpt-4') || id.includes('gpt-3.5')) {
    return true;
  }

  // Claude 3.x models support tools
  if (id.includes('claude-3') || id.includes('claude-3.5') || id.includes('claude-sonnet') || id.includes('claude-opus') || id.includes('claude-haiku')) {
    return true;
  }

  // Gemini models support tools
  if (id.includes('gemini-pro') || id.includes('gemini-flash') || id.includes('gemini-2')) {
    return true;
  }

  // Llama 3.x instruct models support tools
  if ((id.includes('llama-3') || id.includes('llama3')) && id.includes('instruct')) {
    return true;
  }

  // Qwen 2.x models support tools
  if (id.includes('qwen2') || id.includes('qwen-2') || id.includes('qwen3') || id.includes('qwen-3')) {
    return true;
  }

  // Mistral and Mixtral support tools
  if (id.includes('mistral') || id.includes('mixtral')) {
    return true;
  }

  // DeepSeek V3 supports tools
  if (id.includes('deepseek-v3') || id.includes('deepseek-chat')) {
    return true;
  }

  // Command R models support tools
  if (id.includes('command-r')) {
    return true;
  }

  // Default to false for unknown models
  return false
};

export function ModelSelect({ selectedModel, onSelectModel, isIncognitoMode = false }: ModelSelectProps) {
  const { isAuthenticated } = useAuth()
  const { userData } = useAuthStore()
  const _subAllowance = userData?.subscription_allowance ?? 0
  const _purchased = userData?.purchased_credits ?? 0
  const _legacy = userData?.credits ?? 0
  const userCredits = userData?.total_credits ?? (_subAllowance + _purchased + _legacy)
  const hasNoCredits = isAuthenticated && userCredits <= 0
  const [open, setOpen] = React.useState(false)
  const [models, setModels] = React.useState<ModelOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set())
  const [expandedDevelopers, setExpandedDevelopers] = React.useState<Set<string>>(new Set(['Favorites', 'Incognito']))
  const [defaultModelSet, setDefaultModelSet] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('')
  const [totalAvailableModels, setTotalAvailableModels] = React.useState<number | null>(null)
  const [searchResults, setSearchResults] = React.useState<ModelOption[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  type SortMode = 'gateway' | 'az' | 'free-first' | 'speed'
  const [sortMode, setSortMode] = React.useState<SortMode>('gateway')

  const persistModelsToCache = React.useCallback((options: ModelOption[], totalCount: number | null) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: options,
        total: typeof totalCount === 'number' ? totalCount : null,
        timestamp: Date.now()
      }));
    } catch (e) {
      // localStorage quota exceeded — clear old cache so next load can refetch fresh
      try {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem('gatewayz_models_cache');
      } catch {
        // Ignore
      }
    }
  }, [])

  // Debounce search query for performance
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200); // 200ms debounce - balanced for performance

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Perform server-side search when user types
  React.useEffect(() => {
    async function performServerSearch() {
      const query = debouncedSearchQuery.trim();

      // Clear search results if query is empty
      if (!query) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      // Start loading
      setSearchLoading(true);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for search

        // Perform server-side search with gateway=all to search across all models
        // In desktop mode, use backend API directly since API routes don't exist
        const isDesktop = typeof window !== 'undefined' && isTauriDesktop();
        const searchUrl = isDesktop
          ? `${API_BASE_URL}/v1/models?gateway=all&search=${encodeURIComponent(query)}`
          : `/api/models?gateway=all&search=${encodeURIComponent(query)}`;

        const response = await fetch(searchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          // Verify JSON response
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.error('[ModelSelect] Search API returned non-JSON response (content-type:', contentType, ')');
            return;
          }
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            const searchOptions: ModelOption[] = data.data.map((model: any) => {
              const gateway = model.source_gateway || 'openrouter';
              return {
                value: model.id,
                label: cleanModelName(model.name),
                category: model.category || 'Paid',
                developer: getDeveloper(model.id),
                sourceGateway: gateway,
                modalities: ['Text'],
                speedTier: getModelSpeedTier(model.id, gateway),
                huggingfaceMetrics: model.huggingface_metrics ? {
                  downloads: model.huggingface_metrics.downloads || 0,
                  likes: model.huggingface_metrics.likes || 0,
                } : undefined,
              };
            });
            setSearchResults(searchOptions);
          }
        }
      } catch (error) {
        console.error('[ModelSelect] Server search failed:', error);
        // Keep previous results on error
      } finally {
        setSearchLoading(false);
      }
    }

    performServerSearch();
  }, [debouncedSearchQuery]);

  // Load favorites from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      try {
        setFavorites(new Set(JSON.parse(stored)));
      } catch (e) {
        // Failed to load favorites, ignore
      }
    }
  }, []);

  // Save favorites to localStorage
  const toggleFavorite = (modelId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  React.useEffect(() => {
    async function fetchModels() {
        // Check cache first
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const { data, timestamp, total } = JSON.parse(cached);
            // Validate cached data has correct structure
            if (Date.now() - timestamp < CACHE_DURATION && Array.isArray(data) && data.length > 0 && data[0].value) {
              const hydrated = ensureRouterOption(data as ModelOption[]);
              setModels(hydrated);
              setTotalAvailableModels(typeof total === 'number' ? total : null);
              return;
            } else {
              // Clear invalid cache
              localStorage.removeItem(CACHE_KEY);
            }
          } catch (e) {
            // Clear corrupted cache
            localStorage.removeItem(CACHE_KEY);
          }
        }

      // Always fetch all models — no artificial cap
      setLoading(true);
      try {
          const controller = new AbortController();
          const timeoutMs = getAdaptiveTimeout(12000, {
            maxMs: 25000,
            slowNetworkMultiplier: 3,
            mobileMultiplier: 2,
          });
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // In desktop mode, API routes don't exist (static export), so fetch directly from backend
        const isDesktop = typeof window !== 'undefined' && isTauriDesktop();
        const modelsUrl = isDesktop
          ? `${API_BASE_URL}/v1/models?gateway=all`
          : `/api/models?gateway=all`;

        const allGatewaysRes = await fetch(modelsUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        // Verify we got JSON response (in case static export returns HTML)
        const contentType = allGatewaysRes.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('[ModelSelect] Models API returned non-JSON response (content-type:', contentType, ')');
          throw new Error('Non-JSON response from models API');
        }

        const allGatewaysData = await allGatewaysRes.json();

        // Combine models from all gateways
        const allModels = [...(allGatewaysData.data || [])];

        // Deduplicate models by ID - keep the first occurrence
        const uniqueModelsMap = new Map();
        allModels.forEach((model: any) => {
          if (!uniqueModelsMap.has(model.id)) {
            uniqueModelsMap.set(model.id, model);
          }
        });
        const uniqueModels = Array.from(uniqueModelsMap.values());

        const modelOptions: ModelOption[] = uniqueModels.map((model: any) => {
          const sourceGateway = model.source_gateway || model.source_gateways?.[0] || '';
          // Only OpenRouter models with :free suffix are legitimately free
          const category = getModelPricingCategory(model);
          const developer = getDeveloper(model.id);

          // Extract modalities from architecture.input_modalities
          const modalities = model.architecture?.input_modalities?.map((m: string) =>
            m.charAt(0).toUpperCase() + m.slice(1)
          ) || ['Text'];

          // Get speed tier for performance indicators
          const speedTier = getModelSpeedTier(model.id, sourceGateway);

          // Check if model supports tool calling
          const supportsTools = checkModelToolSupport(model.id, model.supported_parameters);

          return {
            value: model.id,
            label: cleanModelName(model.name),
            category,
            sourceGateway,
            developer,
            modalities,
            speedTier,
            supportsTools,
            huggingfaceMetrics: model.huggingface_metrics ? {
              downloads: model.huggingface_metrics.downloads || 0,
              likes: model.huggingface_metrics.likes || 0,
            } : undefined,
          };
        });
        // Filter to routable models only — a model without a sourceGateway
        // cannot be routed by the gateway layer, so it is not actually available.
        const availableOptions = modelOptions.filter(m => m.sourceGateway);
        const normalizedOptions = ensureRouterOption(availableOptions);
        setModels(normalizedOptions);
        setTotalAvailableModels(normalizedOptions.length);

        // Try to cache the results, but don't fail if quota exceeded
        persistModelsToCache(normalizedOptions, normalizedOptions.length);
      } catch (error) {
        // Failed to fetch models
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
    }, [persistModelsToCache]);

  // Group models by source gateway (infrastructure provider) and sort by priority/size
  const modelsByGateway = React.useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};

    models.forEach(model => {
      // Models without a sourceGateway go to "_no_gateway" (will be relabeled "Other")
      const gw = (model.sourceGateway || '_no_gateway').toLowerCase();
      if (!groups[gw]) {
        groups[gw] = [];
      }
      groups[gw].push(model);
    });

    // Display-name mapping for gateway slugs
    const gatewayDisplayNames: Record<string, string> = {
      'openrouter': 'OpenRouter',
      'groq': 'Groq',
      'cerebras': 'Cerebras',
      'fireworks': 'Fireworks',
      'together': 'Together',
      'deepinfra': 'DeepInfra',
      'nebius': 'Nebius',
      'novita': 'Novita',
      'chutes': 'Chutes',
      'featherless': 'Featherless',
      'huggingface': 'HuggingFace',
      'near': 'NEAR',
      'onerouter': 'OneRouter',
      'anthropic': 'Anthropic',
      'openai': 'OpenAI',
      'google-vertex': 'Google Vertex',
      'cohere': 'Cohere',
      'mistral': 'Mistral',
      'xai': 'xAI',
      'cloudflare': 'Cloudflare Workers AI',
      'alibaba': 'Alibaba Cloud',
      'morpheus': 'Morpheus',
      'simplismart': 'Simplismart',
      'modelz': 'Modelz',
      'helicone': 'Helicone',
      'sybil': 'Sybil',
      'aimo': 'AIMO',
      'aihubmix': 'AIHubMix',
      'anannas': 'Anannas',
      'canopywave': 'CanopyWave',
      'clarifai': 'Clarifai',
      'fal': 'Fal',
      '_no_gateway': 'Other',
    };

    // Priority order — ultra-fast / primary gateways first
    const priorityGateways = ['cerebras', 'groq', 'fireworks', 'openrouter'];

    // Build display-keyed groups
    const renamed: Record<string, ModelOption[]> = {};
    Object.entries(groups).forEach(([slug, gwModels]) => {
      const displayName = gatewayDisplayNames[slug]
        || slug.charAt(0).toUpperCase() + slug.slice(1);
      renamed[displayName] = gwModels;
    });

    // Reverse map for sort lookup
    const displayToSlug: Record<string, string> = {};
    Object.entries(gatewayDisplayNames).forEach(([slug, name]) => {
      displayToSlug[name] = slug;
    });

    return Object.keys(renamed)
      .sort((a, b) => {
        // "Other" always goes last
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;

        const slugA = displayToSlug[a] ?? a.toLowerCase();
        const slugB = displayToSlug[b] ?? b.toLowerCase();
        const aP = priorityGateways.indexOf(slugA);
        const bP = priorityGateways.indexOf(slugB);

        // Both in priority list → sort by priority order
        if (aP !== -1 && bP !== -1) return aP - bP;
        // Priority gateway first
        if (aP !== -1) return -1;
        if (bP !== -1) return 1;

        // Otherwise: larger groups first, then alphabetically
        const sizeDiff = renamed[b].length - renamed[a].length;
        if (sizeDiff !== 0) return sizeDiff;
        return a.localeCompare(b);
      })
      .reduce((acc, key) => {
        acc[key] = renamed[key];
        return acc;
      }, {} as Record<string, ModelOption[]>);
  }, [models]);

  // Auto-expand all gateway sections as soon as models are loaded.
  // Without this, every gateway section is collapsed on first open and
  // cmdk's CommandEmpty fires because no CommandItem elements are rendered.
  React.useEffect(() => {
    const keys = Object.keys(modelsByGateway);
    if (keys.length === 0) return;
    setExpandedDevelopers(prev => {
      const next = new Set(prev);
      let changed = false;
      keys.forEach(k => {
        if (!next.has(k)) { next.add(k); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [modelsByGateway]);

  // Set a sensible default model once the catalog has loaded.
  // Priority: claude-3.5-sonnet → gpt-4o → gemini-flash → first non-router priced model → first model.
  // Only fires once and only when the current default is the hardcoded placeholder that
  // doesn't exist in the catalog (cerebras/qwen-3-32b).
  React.useEffect(() => {
    if (defaultModelSet || models.length === 0) return;
    // Only override if the currently selected model isn't in the fetched catalog
    const isInCatalog = models.some(m => m.value === selectedModel?.value);
    if (isInCatalog) {
      setDefaultModelSet(true);
      return;
    }

    // Ranked preference list of model IDs — ordered by quality/availability
    const preferenceList = [
      'anthropic/claude-sonnet-4.6',
      'anthropic/claude-sonnet-4.5',
      'anthropic/claude-sonnet-4',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3.7-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001',
      'google/gemini-flash-1.5',
      'anthropic/claude-3.5-haiku',
      'anthropic/claude-3-haiku',
    ];

    // Try preference list first
    for (const id of preferenceList) {
      const found = models.find(m => m.value === id);
      if (found) {
        onSelectModel(found);
        setDefaultModelSet(true);
        return;
      }
    }

    // Fallback: first non-router model with a sourceGateway (skip ROUTER_OPTION)
    const first = models.find(m => m.value !== 'openrouter/auto' && m.sourceGateway);
    if (first) {
      onSelectModel(first);
    }
    setDefaultModelSet(true);
  }, [models, selectedModel, defaultModelSet, onSelectModel]);

  // Get favorite models
  const favoriteModels = React.useMemo(() => {
    return models.filter(m => favorites.has(m.value));
  }, [models, favorites]);

  const toggleDeveloper = (developer: string) => {
    setExpandedDevelopers(prev => {
      const next = new Set(prev);
      if (next.has(developer)) {
        next.delete(developer);
      } else {
        next.add(developer);
      }
      return next;
    });
  };

  // Merge server search results with locally cached models when searching
  // This ensures users see both preloaded models AND models from server search
  const mergedModelsForSearch = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return models; // No search, just use cached models
    }

    const modelMap = new Map<string, ModelOption>();

    // Add all locally cached models first
    models.forEach(model => modelMap.set(model.value, model));

    // Add or update with server search results (server results take precedence)
    searchResults.forEach(model => modelMap.set(model.value, model));

    return Array.from(modelMap.values());
  }, [models, searchResults, debouncedSearchQuery]);

  // Combined filter computation in a single pass for better performance
  // This avoids multiple separate filter operations that each iterate through all models
  const filteredData = React.useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();

    // If no search query, return unfiltered data
    if (!query) {
      return {
        modelsByGateway,
        favoriteModels,
        incognitoModels: NEAR_INCOGNITO_MODELS,
      };
    }

    // Pre-compute model match check function
    const matchesQuery = (model: ModelOption) => {
      const labelLower = model.label.toLowerCase();
      const valueLower = model.value.toLowerCase();
      const developerLower = model.developer?.toLowerCase() || '';
      const gatewayLower = model.sourceGateway?.toLowerCase() || '';

      return labelLower.includes(query) ||
        valueLower.includes(query) ||
        developerLower.includes(query) ||
        gatewayLower.includes(query);
    };

    // When searching, filter from merged models (cached + server results)
    const modelsToFilter = mergedModelsForSearch;

    // Rebuild gateway groups from merged models
    const searchModelsByGateway: Record<string, ModelOption[]> = {};
    modelsToFilter.forEach(model => {
      const gw = model.sourceGateway || 'Other';
      if (!searchModelsByGateway[gw]) {
        searchModelsByGateway[gw] = [];
      }
      searchModelsByGateway[gw].push(model);
    });

    // Filter gateway groups
    const filteredByGateway: Record<string, ModelOption[]> = {};
    Object.entries(searchModelsByGateway).forEach(([gateway, gwModels]) => {
      const gatewayLower = gateway.toLowerCase();
      const gatewayMatches = gatewayLower.includes(query);

      const matchingModels = gatewayMatches
        ? gwModels // If gateway name matches, include all models
        : gwModels.filter(model => matchesQuery(model));

      if (matchingModels.length > 0) {
        filteredByGateway[gateway] = matchingModels;
      }
    });

    // Filter other lists from merged models
    const filteredFavorites = modelsToFilter.filter(model =>
      favorites.has(model.value) && matchesQuery(model)
    );
    const filteredIncognito = NEAR_INCOGNITO_MODELS.filter(model => matchesQuery(model));

    return {
      modelsByGateway: filteredByGateway,
      favoriteModels: filteredFavorites,
      incognitoModels: filteredIncognito,
    };
  }, [debouncedSearchQuery, modelsByGateway, favoriteModels, mergedModelsForSearch, favorites]);

  // Destructure for cleaner access in render
  const filteredModelsByGateway = filteredData.modelsByGateway;
  const filteredFavoriteModels = filteredData.favoriteModels;
  const filteredIncognitoModels = filteredData.incognitoModels;

  // Memoize keys array for stable effect dependencies
  const filteredGatewayKeysArray = React.useMemo(
    () => Object.keys(filteredModelsByGateway).sort(),
    [filteredModelsByGateway]
  );

  // Track sections that were auto-expanded by search (to reset on clear)
  const autoExpandedSectionsRef = React.useRef<Set<string>>(new Set());

  // Auto-expand sections with search matches
  React.useEffect(() => {
    const query = debouncedSearchQuery.trim();

    // Reset auto-expanded sections when query is cleared
    if (!query) {
      if (autoExpandedSectionsRef.current.size > 0) {
        setExpandedDevelopers(prev => {
          const next = new Set(prev);
          autoExpandedSectionsRef.current.forEach(section => next.delete(section));
          return next;
        });
        autoExpandedSectionsRef.current.clear();
      }
      return;
    }

    // Collect all sections that have matches
    const sectionsToExpand: string[] = [];

    if (filteredIncognitoModels.length > 0) {
      sectionsToExpand.push('Incognito');
    }

    // Add gateway sections directly from the keys array
    filteredGatewayKeysArray.forEach(gw => {
      if (gw) sectionsToExpand.push(gw);
    });

    if (sectionsToExpand.length > 0) {
      setExpandedDevelopers(prev => {
        // Check if any section actually needs to be added
        const needsUpdate = sectionsToExpand.some(section => !prev.has(section));
        if (!needsUpdate) return prev;

        const next = new Set(prev);
        sectionsToExpand.forEach(section => {
          if (!prev.has(section)) {
            // Track that this section was auto-expanded
            autoExpandedSectionsRef.current.add(section);
          }
          next.add(section);
        });
        return next;
      });
    }
  }, [debouncedSearchQuery, filteredIncognitoModels.length, filteredGatewayKeysArray]);

    // Total count is now resolved up-front from the initial fetch; no manual
    // "load all" flow is needed because we fetch the complete list by default.
    void totalAvailableModels;

  // Flat sorted list used when sortMode !== 'gateway'
  const sortedFlatModels = React.useMemo(() => {
    if (sortMode === 'gateway') return null; // not used in gateway mode

    // Collect all models from filtered gateway groups (respects active search)
    const all: ModelOption[] = [];
    Object.values(filteredModelsByGateway).forEach(gwModels => all.push(...gwModels));

    if (sortMode === 'az') {
      return [...all].sort((a, b) => a.label.localeCompare(b.label));
    }
    if (sortMode === 'free-first') {
      return [...all].sort((a, b) => {
        const aFree = a.category === 'Free' ? 0 : 1;
        const bFree = b.category === 'Free' ? 0 : 1;
        if (aFree !== bFree) return aFree - bFree;
        return a.label.localeCompare(b.label);
      });
    }
    if (sortMode === 'speed') {
      const speedOrder: Record<string, number> = { 'ultra-fast': 0, 'fast': 1, 'medium': 2, 'slow': 3 };
      return [...all].sort((a, b) => {
        const aS = speedOrder[a.speedTier ?? 'medium'] ?? 2;
        const bS = speedOrder[b.speedTier ?? 'medium'] ?? 2;
        if (aS !== bS) return aS - bS;
        return a.label.localeCompare(b.label);
      });
    }
    return all;
  }, [sortMode, filteredModelsByGateway]);

    return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        // Clear search when closing
        setSearchQuery('');
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full sm:w-[250px] justify-between bg-muted/30 hover:bg-muted/50 touch-manipulation"
        >
          {selectedModel ? (
            <>
              <span className="truncate text-sm sm:text-base">{selectedModel.label}</span>
              {(loading || searchLoading) && <Loader2 className="ml-1 h-3 w-3 animate-spin flex-shrink-0 opacity-50" />}
            </>
          ) : loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
              <span className="truncate">Loading...</span>
            </>
          ) : (
            <span className="truncate text-sm sm:text-base">Select model...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[95vw] sm:w-[450px] max-w-[450px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search model..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          {/* Sort controls */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b text-xs text-muted-foreground">
            <span className="mr-1 shrink-0">Sort:</span>
            {(
              [
                { mode: 'gateway' as const, label: 'Gateway' },
                { mode: 'az' as const, label: 'A–Z', icon: <ArrowDownAZ className="h-3 w-3" /> },
                { mode: 'free-first' as const, label: 'Free', icon: <Sparkles className="h-3 w-3" /> },
                { mode: 'speed' as const, label: 'Speed', icon: <Zap className="h-3 w-3" /> },
              ] as const
            ).map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={cn(
                  "flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-colors",
                  sortMode === mode
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted"
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <CommandList className="max-h-[400px]">
            <CommandEmpty>No model found.</CommandEmpty>

            {/* Favorites Section - hidden in Incognito mode */}
            {!isIncognitoMode && filteredFavoriteModels.length > 0 && (
              <div className="border-b">
                <button
                  onClick={() => toggleDeveloper('Favorites')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-semibold hover:bg-muted"
                >
                  {expandedDevelopers.has('Favorites') ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>Favorites ({filteredFavoriteModels.length})</span>
                </button>
                {expandedDevelopers.has('Favorites') && (
                  <div className="pb-2">
                    {filteredFavoriteModels.map((model) => {
                      const isPaid = model.category !== 'Free' && model.category !== 'Router';
                      const locked = isPaid && (!isAuthenticated || hasNoCredits);
                      return (
                        <CommandItem
                          key={model.value}
                          value={model.value}
                          onSelect={(currentValue) => {
                            if (locked) return;
                            const selected = models.find(m => m.value === currentValue);
                            onSelectModel(selected || null);
                            setOpen(false);
                          }}
                          className={cn("pl-8 pr-2", locked ? "cursor-default opacity-50" : "cursor-pointer")}
                        >
                          <Star
                            className="mr-2 h-4 w-4 fill-yellow-400 text-yellow-400 flex-shrink-0 cursor-pointer"
                            onClick={(e) => toggleFavorite(model.value, e)}
                          />
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 flex-shrink-0",
                              selectedModel?.value === model.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate flex-1">{model.label}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {model.speedTier === 'ultra-fast' && (
                              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">⚡</span>
                            )}
                            {model.speedTier === 'fast' && (
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">⚡</span>
                            )}
                            {model.sourceGateway && model.sourceGateway !== 'openrouter' && (
                              <span className="ml-1 text-[10px] font-medium text-muted-foreground bg-muted px-1 py-0.5 rounded" title={model.sourceGateway}>
                                {getGatewayAbbrev(model.sourceGateway)}
                              </span>
                            )}
                            {locked ? (
                              <span className="ml-1 text-muted-foreground flex items-center" title={hasNoCredits ? "Insufficient credits — add credits to use paid models" : "Sign in to use paid models"}>
                                <Lock className="h-3.5 w-3.5" />
                              </span>
                            ) : model.category === 'Free' ? (
                              <span className="ml-1 text-green-600 dark:text-green-400 flex items-center" title="Free">
                                <Sparkles className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Incognito Models Section - shown when in Incognito mode */}
            {isIncognitoMode && filteredIncognitoModels.length > 0 && (
              <div className="border-b">
                <button
                  onClick={() => toggleDeveloper('Incognito')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-semibold hover:bg-muted"
                >
                  {expandedDevelopers.has('Incognito') ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Shield className="h-4 w-4 text-purple-500" />
                  <span>Incognito Models ({filteredIncognitoModels.length})</span>
                </button>
                {expandedDevelopers.has('Incognito') && (
                  <div className="pb-2">
                    {filteredIncognitoModels.map((model) => (
                      <CommandItem
                        key={`incognito-${model.value}`}
                        value={`incognito-${model.label}`}
                        onSelect={() => {
                          onSelectModel(model);
                          setOpen(false);
                        }}
                        className="cursor-pointer pl-8 pr-2 group"
                      >
                        <Shield
                          className="mr-2 h-4 w-4 flex-shrink-0 text-purple-500"
                        />
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 flex-shrink-0",
                            selectedModel?.value === model.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate flex-1">{model.label}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {model.developer && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              {model.developer}
                            </span>
                          )}
                          <span className="ml-1 text-[10px] font-medium text-purple-500 bg-purple-500/10 px-1 py-0.5 rounded">
                            NEAR
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Flat sorted list — used when sortMode !== 'gateway' */}
            {!isIncognitoMode && sortMode !== 'gateway' && sortedFlatModels && sortedFlatModels.map((model) => {
              const isPaid = model.category !== 'Free' && model.category !== 'Router';
              const locked = isPaid && (!isAuthenticated || hasNoCredits);
              return (
                <CommandItem
                  key={model.value}
                  value={model.value}
                  onSelect={(currentValue) => {
                    if (locked) return;
                    const selected = models.find(m => m.value === currentValue);
                    onSelectModel(selected || null);
                    setOpen(false);
                  }}
                  className={cn("pl-3 pr-2 group", locked ? "cursor-default opacity-50" : "cursor-pointer")}
                >
                  <Star
                    className={cn(
                      "mr-2 h-4 w-4 flex-shrink-0 cursor-pointer transition-colors",
                      favorites.has(model.value)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30 hover:text-yellow-400"
                    )}
                    onClick={(e) => { if (!locked) toggleFavorite(model.value, e); }}
                  />
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 flex-shrink-0",
                      selectedModel?.value === model.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate flex-1">{model.label}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {model.speedTier === 'ultra-fast' && (
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400">⚡</span>
                    )}
                    {model.speedTier === 'fast' && (
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">⚡</span>
                    )}
                    {model.sourceGateway && model.sourceGateway !== 'openrouter' && (
                      <span className="ml-1 text-[10px] font-medium text-muted-foreground bg-muted px-1 py-0.5 rounded" title={model.sourceGateway}>
                        {getGatewayAbbrev(model.sourceGateway)}
                      </span>
                    )}
                    {locked ? (
                      <span className="ml-1 text-muted-foreground flex items-center" title="Sign in to use paid models">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    ) : model.category === 'Free' ? (
                      <span className="ml-1 text-green-600 dark:text-green-400 flex items-center" title="Free">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              );
            })}

            {/* Provider (gateway) sections — hidden in Incognito mode */}
            {!isIncognitoMode && sortMode === 'gateway' && Object.entries(filteredModelsByGateway).map(([gateway, gwModels]) => (
              <div key={gateway} className="border-b last:border-0">
                <button
                  onClick={() => toggleDeveloper(gateway)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-semibold hover:bg-muted"
                >
                  {expandedDevelopers.has(gateway) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span>{gateway} ({gwModels.length})</span>
                </button>
                {expandedDevelopers.has(gateway) && (
                  <div className="pb-2">
                    {gwModels.map((model) => {
                      const isPaid = model.category !== 'Free' && model.category !== 'Router';
                      const locked = isPaid && (!isAuthenticated || hasNoCredits);
                      return (
                        <CommandItem
                          key={model.value}
                          value={model.value}
                          onSelect={(currentValue) => {
                            if (locked) return;
                            const selected = models.find(m => m.value === currentValue);
                            onSelectModel(selected || null);
                            setOpen(false);
                          }}
                          className={cn("pl-8 pr-2 group", locked ? "cursor-default opacity-50" : "cursor-pointer")}
                        >
                          <Star
                            className={cn(
                              "mr-2 h-4 w-4 flex-shrink-0 cursor-pointer transition-colors",
                              favorites.has(model.value)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30 hover:text-yellow-400"
                            )}
                            onClick={(e) => { if (!locked) toggleFavorite(model.value, e); }}
                          />
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 flex-shrink-0",
                              selectedModel?.value === model.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate flex-1">{model.label}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {model.speedTier === 'ultra-fast' && (
                              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">⚡</span>
                            )}
                            {model.speedTier === 'fast' && (
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">⚡</span>
                            )}
                            {model.sourceGateway && model.sourceGateway !== 'openrouter' && (
                              <span className="ml-1 text-[10px] font-medium text-muted-foreground bg-muted px-1 py-0.5 rounded" title={model.sourceGateway}>
                                {getGatewayAbbrev(model.sourceGateway)}
                              </span>
                            )}
                            {locked ? (
                              <span className="ml-1 text-muted-foreground flex items-center" title={hasNoCredits ? "Insufficient credits — add credits to use paid models" : "Sign in to use paid models"}>
                                <Lock className="h-3.5 w-3.5" />
                              </span>
                            ) : model.category === 'Free' ? (
                              <span className="ml-1 text-green-600 dark:text-green-400 flex items-center" title="Free">
                                <Sparkles className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

          </CommandList>
          {(!isAuthenticated || hasNoCredits) && (
            <div className="border-t px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30">
              <Lock className="h-3.5 w-3.5 flex-shrink-0" />
              {!isAuthenticated ? (
                <span>
                  <a href="/auth/login" className="text-primary underline underline-offset-2 hover:opacity-80">Sign in</a>
                  {' '}to unlock paid models and use credits
                </span>
              ) : (
                <span>
                  <a href="/settings/credits" className="text-primary underline underline-offset-2 hover:opacity-80">Add credits</a>
                  {' '}to use paid models
                </span>
              )}
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
