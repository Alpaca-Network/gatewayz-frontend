
"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronRight, ChevronsUpDown, Loader2, Star, Sparkles, TrendingUp, Shield, Image as ImageIcon, Video } from "lucide-react"

import { cn } from "@/lib/utils"
import { getAdaptiveTimeout } from "@/lib/network-timeouts"
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
};

interface ModelSelectProps {
    selectedModel: ModelOption | null;
    onSelectModel: (model: ModelOption | null) => void;
    isIncognitoMode?: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

const CACHE_KEY = 'gatewayz_models_cache_v6_gateway_fix';
const FAVORITES_KEY = 'gatewayz_favorite_models';
const CACHE_DURATION = 60 * 60 * 1000; // 60 minutes - extended cache for maximum performance
const INITIAL_MODELS_LIMIT = 50; // Load top 50 models initially for instant loading
const CACHE_PERSIST_LIMIT = INITIAL_MODELS_LIMIT;
const MAX_MODELS_PER_DEVELOPER = 10; // Limit models shown per developer for performance

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

export function ModelSelect({ selectedModel, onSelectModel, isIncognitoMode = false }: ModelSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [models, setModels] = React.useState<ModelOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set())
  const [expandedDevelopers, setExpandedDevelopers] = React.useState<Set<string>>(new Set(['Favorites', 'Popular', 'Incognito']))
  const [searchQuery, setSearchQuery] = React.useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('')
  const [loadAllModels, setLoadAllModels] = React.useState(false)
  const [totalAvailableModels, setTotalAvailableModels] = React.useState<number | null>(null)
  const [popularModels, setPopularModels] = React.useState<ModelOption[]>([])
  const [searchResults, setSearchResults] = React.useState<ModelOption[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)

  const persistModelsToCache = React.useCallback((options: ModelOption[], totalCount: number | null) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: options.slice(0, CACHE_PERSIST_LIMIT),
        total: typeof totalCount === 'number' ? totalCount : null,
        timestamp: Date.now()
      }));
    } catch (e) {
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
        const response = await fetch(
          `/api/models?gateway=all&search=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (response.ok) {
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

  // Fetch popular models
  React.useEffect(() => {
    async function fetchPopularModels() {
      try {
        const response = await fetch('/api/models/popular?limit=10');
        if (response.ok) {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            const popularOptions: ModelOption[] = data.data.map((model: any) => {
              const gateway = model.sourceGateway || 'openrouter';
              return {
                value: model.id,
                label: cleanModelName(model.name),
                category: model.category || 'Paid',
                developer: model.developer,
                sourceGateway: gateway,
                modalities: ['Text'],
                speedTier: getModelSpeedTier(model.id, gateway),
              };
            });
            setPopularModels(popularOptions);
          }
        }
      } catch (error) {
        console.log('[ModelSelect] Failed to fetch popular models:', error);
        // Silently fail - popular models are optional
      }
    }
    fetchPopularModels();
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
              if (!loadAllModels) {
                return;
              }
            } else {
              // Clear invalid cache
              localStorage.removeItem(CACHE_KEY);
            }
          } catch (e) {
            // Clear corrupted cache
            localStorage.removeItem(CACHE_KEY);
          }
        }

      // Fetch from all gateways - optimized to load fewer models initially
      setLoading(true);
      try {
        // Fetch from all gateways to ensure all models (including NEAR) are available
        const limit = loadAllModels ? undefined : INITIAL_MODELS_LIMIT;
        const limitParam = limit ? `&limit=${limit}` : '';

          const controller = new AbortController();
          const baseTimeout = loadAllModels ? 12000 : 9000;
          const timeoutMs = getAdaptiveTimeout(baseTimeout, {
            maxMs: loadAllModels ? 25000 : 20000,
            slowNetworkMultiplier: 3,
            mobileMultiplier: 2,
          });
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const allGatewaysRes = await fetch(`/api/models?gateway=all${limitParam}`, { signal: controller.signal });
        clearTimeout(timeoutId);
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
          const sourceGateway = model.source_gateway || 'openrouter';
          // Only OpenRouter models with :free suffix are legitimately free
          // Use is_free field from backend, fallback to checking :free suffix for backwards compatibility
          const isFreeModel = model.is_free === true || (sourceGateway === 'openrouter' && model.id?.endsWith(':free'));
          const category = sourceGateway === 'portkey' ? 'Portkey' : (isFreeModel ? 'Free' : 'Paid');
          const developer = getDeveloper(model.id);

          // Extract modalities from architecture.input_modalities
          const modalities = model.architecture?.input_modalities?.map((m: string) =>
            m.charAt(0).toUpperCase() + m.slice(1)
          ) || ['Text'];

          // Get speed tier for performance indicators
          const speedTier = getModelSpeedTier(model.id, sourceGateway);

          return {
            value: model.id,
            label: cleanModelName(model.name),
            category,
            sourceGateway,
            developer,
            modalities,
            speedTier,
            huggingfaceMetrics: model.huggingface_metrics ? {
              downloads: model.huggingface_metrics.downloads || 0,
              likes: model.huggingface_metrics.likes || 0,
            } : undefined,
          };
        });
        const normalizedOptions = ensureRouterOption(modelOptions);
        setModels(normalizedOptions);
        if (loadAllModels) {
          setTotalAvailableModels(normalizedOptions.length);
        }

        // Try to cache the results, but don't fail if quota exceeded
        persistModelsToCache(normalizedOptions, loadAllModels ? normalizedOptions.length : null);
      } catch (error) {
        // Failed to fetch models
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
    }, [loadAllModels, persistModelsToCache]);

  // Minimum models required for a developer to have their own section
  const MIN_MODELS_FOR_DEVELOPER_SECTION = 3;

  // Group models by developer and sort by Hugging Face popularity
  const modelsByDeveloper = React.useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};

    models.forEach(model => {
      // Models without a developer go directly to a temporary "_no_developer" group
      const dev = model.developer || '_no_developer';
      if (!groups[dev]) {
        groups[dev] = [];
      }
      groups[dev].push(model);
    });

    // Define priority order for top organizations (these always get their own section)
    const priorityOrgs = ['OpenAI', 'Anthropic', 'Google', 'Qwen', 'xAI', 'Meta', 'DeepSeek', 'Mistral AI'];

    // Consolidate developers with few models into "Other" category
    const consolidatedGroups: Record<string, ModelOption[]> = {};
    const otherModels: ModelOption[] = [];

    Object.entries(groups).forEach(([developer, devModels]) => {
      // Models without a developer always go to "Other"
      if (developer === '_no_developer') {
        otherModels.push(...devModels);
        return;
      }

      // Priority orgs always get their own section regardless of model count
      const isPriorityOrg = priorityOrgs.includes(developer);

      if (isPriorityOrg || devModels.length >= MIN_MODELS_FOR_DEVELOPER_SECTION) {
        consolidatedGroups[developer] = devModels;
      } else {
        // Consolidate into "Other"
        otherModels.push(...devModels);
      }
    });

    // Add "Other" category if there are any models
    if (otherModels.length > 0) {
      consolidatedGroups['Other'] = otherModels;
    }

    // Calculate popularity score for each developer based on HuggingFace metrics
    const developerScores: Record<string, number> = {};
    Object.entries(consolidatedGroups).forEach(([developer, devModels]) => {
      const totalLikes = devModels.reduce((sum, m) => sum + (m.huggingfaceMetrics?.likes || 0), 0);
      const totalDownloads = devModels.reduce((sum, m) => sum + (m.huggingfaceMetrics?.downloads || 0), 0);
      // Weight likes more heavily than downloads (1 like = 1000 download equivalents)
      // This prioritizes quality/engagement over pure volume
      developerScores[developer] = (totalLikes * 1000) + (totalDownloads / 1000);
    });

    // Sort developers: priority orgs first (by their order), then by popularity score, then alphabetically
    // "Other" always goes last
    return Object.keys(consolidatedGroups)
      .sort((a, b) => {
        // "Other" always goes last
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;

        const aPriority = priorityOrgs.indexOf(a);
        const bPriority = priorityOrgs.indexOf(b);

        // If both are in priority list, sort by priority order
        if (aPriority !== -1 && bPriority !== -1) {
          return aPriority - bPriority;
        }

        // Priority orgs come first
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;

        // For non-priority orgs, sort by popularity score (descending)
        const scoreDiff = developerScores[b] - developerScores[a];
        if (scoreDiff !== 0) return scoreDiff;

        // Finally, alphabetically
        return a.localeCompare(b);
      })
      .reduce((acc, key) => {
        acc[key] = consolidatedGroups[key];
        return acc;
      }, {} as Record<string, ModelOption[]>);
  }, [models]);

  // Get favorite models
  const favoriteModels = React.useMemo(() => {
    return models.filter(m => favorites.has(m.value));
  }, [models, favorites]);

  // Pre-compiled regex patterns for categorization (outside component for performance)
  const categoryPatterns = React.useMemo(() => ({
    r1: /\br1\b/i,
    o1: /\bo1\b/i,
    o3: /\bo3\b/i,
    o4: /\bo4\b/i,
  }), []);

  // Memoized categorize function to avoid recreating on every render
  const categorizeModel = React.useCallback((model: ModelOption): string[] => {
    const categories: string[] = [];
    const modelName = model.label.toLowerCase();
    const modelId = model.value.toLowerCase();

    // Reasoning models - detection for thinking/reasoning capabilities
    if (
      modelId.includes('deepseek-reasoner') ||
      categoryPatterns.r1.test(modelId) ||
      modelId.includes('qwq') ||
      categoryPatterns.o1.test(modelId) ||
      categoryPatterns.o3.test(modelId) ||
      categoryPatterns.o4.test(modelId) ||
      modelId.includes('thinking') ||
      modelId.includes('reason') ||
      modelName.includes('reasoning') ||
      modelName.includes('reasoner') ||
      modelName.includes('thinking') ||
      categoryPatterns.r1.test(modelName)
    ) {
      categories.push('Reasoning');
    }

    // Code generation models
    if (
      modelId.includes('code') ||
      modelId.includes('codestral') ||
      modelId.includes('codellama') ||
      modelId.includes('starcoder') ||
      modelId.includes('deepseek-coder') ||
      modelId.includes('qwen-coder') ||
      modelName.includes('code') ||
      modelName.includes('coder')
    ) {
      categories.push('Code Generation');
    }

    // Multimodal models (from category or modalities in future)
    if (model.category === 'Multimodal' || modelName.includes('vision') || modelName.includes('multimodal')) {
      categories.push('Multimodal');
    }

    // Image/Video models - check modalities array for image or video support
    // Note: We only use modalities array here, not vision name check, since vision models
    // are already captured in the Multimodal category above
    const modalities = model.modalities || [];
    const hasImageSupport = modalities.some(m => m.toLowerCase() === 'image');
    const hasVideoSupport = modalities.some(m => m.toLowerCase() === 'video');
    if (hasImageSupport || hasVideoSupport) {
      categories.push('Image/Video');
    }

    // Cost Efficient models (free OR paid under $1/M input tokens)
    // Note: Price info not available in ModelOption currently, so we'll use category
    const isFree = model.category === 'Free' || model.category?.toLowerCase().includes('free');
    if (isFree) {
      categories.push('Cost Efficient');
      categories.push('Free');
    } else if (model.category === 'Paid') {
      // For now, add paid models to cost efficient if they're from known efficient providers
      if (modelId.includes('gemini-flash') || modelId.includes('gpt-4o-mini') || modelId.includes('claude-haiku')) {
        categories.push('Cost Efficient');
      }
    }

    return categories;
  }, [categoryPatterns]);

  // Group models by category
  const modelsByCategory = React.useMemo(() => {
    const categories: Record<string, ModelOption[]> = {
      'Reasoning': [],
      'Code Generation': [],
      'Image/Video': [],
      'Multimodal': [],
      'Cost Efficient': [],
      'Free': [],
    };

    models.forEach(model => {
      const modelCategories = categorizeModel(model);
      modelCategories.forEach(cat => {
        if (categories[cat]) {
          categories[cat].push(model);
        }
      });
    });

    return categories;
  }, [models, categorizeModel]);

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
        modelsByDeveloper,
        modelsByCategory,
        favoriteModels,
        popularModels,
        incognitoModels: NEAR_INCOGNITO_MODELS,
      };
    }

    // Pre-compute model match check function
    const matchesQuery = (model: ModelOption) => {
      const labelLower = model.label.toLowerCase();
      const valueLower = model.value.toLowerCase();
      const developerLower = model.developer?.toLowerCase() || '';

      return labelLower.includes(query) ||
        valueLower.includes(query) ||
        developerLower.includes(query);
    };

    // When searching, filter from merged models (cached + server results)
    const modelsToFilter = mergedModelsForSearch;

    // Rebuild developer groups from merged models
    const searchModelsByDeveloper: Record<string, ModelOption[]> = {};
    modelsToFilter.forEach(model => {
      const dev = model.developer || 'Other';
      if (!searchModelsByDeveloper[dev]) {
        searchModelsByDeveloper[dev] = [];
      }
      searchModelsByDeveloper[dev].push(model);
    });

    // Rebuild category groups from merged models
    const searchModelsByCategory: Record<string, ModelOption[]> = {
      'Reasoning': [],
      'Code Generation': [],
      'Image/Video': [],
      'Multimodal': [],
      'Cost Efficient': [],
      'Free': [],
    };
    modelsToFilter.forEach(model => {
      const modelCategories = categorizeModel(model);
      modelCategories.forEach(cat => {
        if (searchModelsByCategory[cat]) {
          searchModelsByCategory[cat].push(model);
        }
      });
    });

    // Filter developer groups
    const filteredByDeveloper: Record<string, ModelOption[]> = {};
    Object.entries(searchModelsByDeveloper).forEach(([developer, devModels]) => {
      const developerLower = developer.toLowerCase();
      const developerMatches = developerLower.includes(query);

      const matchingModels = developerMatches
        ? devModels // If developer name matches, include all models
        : devModels.filter(model => matchesQuery(model));

      if (matchingModels.length > 0) {
        filteredByDeveloper[developer] = matchingModels;
      }
    });

    // Filter category groups
    const filteredByCategory: Record<string, ModelOption[]> = {};
    Object.entries(searchModelsByCategory).forEach(([category, catModels]) => {
      const categoryLower = category.toLowerCase();
      const categoryMatches = categoryLower.includes(query);

      const matchingModels = categoryMatches
        ? catModels // If category name matches, include all models
        : catModels.filter(model => matchesQuery(model));

      if (matchingModels.length > 0) {
        filteredByCategory[category] = matchingModels;
      }
    });

    // Filter other lists from merged models
    const filteredFavorites = modelsToFilter.filter(model =>
      favorites.has(model.value) && matchesQuery(model)
    );
    const filteredPopular = modelsToFilter.filter(model =>
      popularModels.some(p => p.value === model.value) && matchesQuery(model)
    );
    const filteredIncognito = NEAR_INCOGNITO_MODELS.filter(model => matchesQuery(model));

    return {
      modelsByDeveloper: filteredByDeveloper,
      modelsByCategory: filteredByCategory,
      favoriteModels: filteredFavorites,
      popularModels: filteredPopular,
      incognitoModels: filteredIncognito,
    };
  }, [debouncedSearchQuery, modelsByDeveloper, modelsByCategory, favoriteModels, popularModels, mergedModelsForSearch, favorites, categorizeModel]);

  // Destructure for cleaner access in render
  const filteredModelsByDeveloper = filteredData.modelsByDeveloper;
  const filteredModelsByCategory = filteredData.modelsByCategory;
  const filteredFavoriteModels = filteredData.favoriteModels;
  const filteredPopularModels = filteredData.popularModels;
  const filteredIncognitoModels = filteredData.incognitoModels;

  // Memoize keys arrays for stable effect dependencies (avoid join/split which can corrupt names with delimiters)
  const filteredDeveloperKeysArray = React.useMemo(
    () => Object.keys(filteredModelsByDeveloper).sort(),
    [filteredModelsByDeveloper]
  );
  const filteredCategoryKeysArray = React.useMemo(
    () => Object.keys(filteredModelsByCategory).sort(),
    [filteredModelsByCategory]
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

    if (filteredPopularModels.length > 0) {
      sectionsToExpand.push('Popular');
    }

    if (filteredIncognitoModels.length > 0) {
      sectionsToExpand.push('Incognito');
    }

    // Add developer and category sections directly from arrays
    filteredDeveloperKeysArray.forEach(dev => {
      if (dev) sectionsToExpand.push(dev);
    });

    filteredCategoryKeysArray.forEach(cat => {
      if (cat) sectionsToExpand.push(cat);
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
  }, [debouncedSearchQuery, filteredPopularModels.length, filteredIncognitoModels.length, filteredDeveloperKeysArray, filteredCategoryKeysArray]);

  // Prefetch models on hover to improve perceived performance
  const handlePrefetchModels = React.useCallback(() => {
    if (!loadAllModels && models.length === INITIAL_MODELS_LIMIT) {
      // Prefetch remaining models in background when user hovers
      // This makes the "Load all models" action instant
      const prefetchAllModels = async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          const openrouterRes = await fetch(`/api/models?gateway=openrouter`, { signal: controller.signal });
          clearTimeout(timeoutId);
          const openrouterData = await openrouterRes.json();

          // Cache prefetched models for instant access
          const allModels = [...(openrouterData.data || [])];
          const uniqueModelsMap = new Map();
          allModels.forEach((model: any) => {
            if (!uniqueModelsMap.has(model.id)) {
              uniqueModelsMap.set(model.id, model);
            }
          });
          const uniqueModels = Array.from(uniqueModelsMap.values());

          const modelOptions: ModelOption[] = uniqueModels.map((model: any) => {
            const sourceGateway = model.source_gateway || 'openrouter';
            const promptPrice = Number(model.pricing?.prompt ?? 0);
            const completionPrice = Number(model.pricing?.completion ?? 0);
            const isPaid = promptPrice > 0 || completionPrice > 0;
            const category = sourceGateway === 'portkey' ? 'Portkey' : (isPaid ? 'Paid' : 'Free');
            const developer = getDeveloper(model.id);
            const modalities = model.architecture?.input_modalities?.map((m: string) =>
              m.charAt(0).toUpperCase() + m.slice(1)
            ) || ['Text'];

            return {
              value: model.id,
              label: cleanModelName(model.name),
              category,
              sourceGateway,
              developer,
              modalities,
              huggingfaceMetrics: model.huggingface_metrics ? {
                downloads: model.huggingface_metrics.downloads || 0,
                likes: model.huggingface_metrics.likes || 0,
              } : undefined,
            };
          });

            // Update cache for instant access (store only lightweight subset)
            const normalizedPrefetch = ensureRouterOption(modelOptions);
            persistModelsToCache(normalizedPrefetch, null);
        } catch (error) {
          // Prefetch failed, user can still load manually
          console.log('Background model prefetch failed:', error);
        }
      };

      prefetchAllModels();
    }
    }, [loadAllModels, models.length, persistModelsToCache]);

    const totalCountLabel = totalAvailableModels !== null ? totalAvailableModels.toString() : '330+';
    const loadAllButtonLabel = `Load all models (${models.length} of ${totalCountLabel})`;

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
          onMouseEnter={handlePrefetchModels}
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
                    {filteredFavoriteModels.map((model) => (
                      <CommandItem
                        key={model.value}
                        value={model.label}
                        onSelect={(currentValue) => {
                          const selected = models.find(m => m.label.toLowerCase() === currentValue.toLowerCase());
                          onSelectModel(selected || null);
                          setOpen(false);
                        }}
                        className="cursor-pointer pl-8 pr-2"
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
                          {model.category === 'Free' && (
                            <span className="ml-1 text-green-600 dark:text-green-400 flex items-center" title="Free">
                              <Sparkles className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
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

            {/* Popular Models Section - hidden in Incognito mode */}
            {!isIncognitoMode && filteredPopularModels.length > 0 && (
              <div className="border-b">
                <button
                  onClick={() => toggleDeveloper('Popular')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-semibold hover:bg-muted"
                >
                  {expandedDevelopers.has('Popular') ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span>Popular ({filteredPopularModels.length})</span>
                </button>
                {expandedDevelopers.has('Popular') && (
                  <div className="pb-2">
                    {filteredPopularModels.map((model) => (
                      <CommandItem
                        key={`popular-${model.value}`}
                        value={`popular-${model.label}`}
                        onSelect={() => {
                          // First try to find the model in the full models list for complete data
                          const fullModel = models.find(m => m.value === model.value);
                          onSelectModel(fullModel || model);
                          setOpen(false);
                        }}
                        className="cursor-pointer pl-8 pr-2 group"
                      >
                        <Star
                          className={cn(
                            "mr-2 h-4 w-4 flex-shrink-0 cursor-pointer transition-colors",
                            favorites.has(model.value)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30 hover:text-yellow-400"
                          )}
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
                          {model.developer && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              {model.developer}
                            </span>
                          )}
                          {model.category === 'Free' && (
                            <span className="ml-1 text-green-600 dark:text-green-400 flex items-center" title="Free">
                              <Sparkles className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Category Groups - hidden in Incognito mode */}
            {!isIncognitoMode && Object.entries(filteredModelsByCategory).map(([category, catModels]) => {
              // Skip empty categories
              if (catModels.length === 0) return null;

              // Get icon for category
              const getCategoryIcon = (cat: string) => {
                switch (cat) {
                  case 'Image/Video':
                    return (
                      <span className="flex items-center gap-0.5">
                        <ImageIcon className="h-4 w-4 text-pink-500" />
                        <Video className="h-4 w-4 text-pink-500" />
                      </span>
                    );
                  default:
                    return null;
                }
              };

              return (
                <div key={category} className="border-b">
                  <button
                    onClick={() => toggleDeveloper(category)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-semibold hover:bg-muted"
                  >
                    {expandedDevelopers.has(category) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {getCategoryIcon(category)}
                    <span>{category} ({catModels.length})</span>
                  </button>
                  {expandedDevelopers.has(category) && (
                    <div className="pb-2">
                      {catModels.map((model) => (
                        <CommandItem
                          key={`${category}-${model.value}`}
                          value={model.label}
                          onSelect={(currentValue) => {
                            const selected = models.find(m => m.label.toLowerCase() === currentValue.toLowerCase());
                            onSelectModel(selected || null);
                            setOpen(false);
                          }}
                          className="cursor-pointer pl-8 pr-2 group"
                        >
                          <Star
                            className={cn(
                              "mr-2 h-4 w-4 flex-shrink-0 cursor-pointer transition-colors",
                              favorites.has(model.value)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30 hover:text-yellow-400"
                            )}
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
                            {model.sourceGateway && model.sourceGateway !== 'openrouter' && (
                              <span className="ml-1 text-[10px] font-medium text-muted-foreground bg-muted px-1 py-0.5 rounded" title={model.sourceGateway}>
                                {getGatewayAbbrev(model.sourceGateway)}
                              </span>
                            )}
                            {model.category === 'Free' && (
                              <span className="ml-1 text-green-600 dark:text-green-400 flex items-center" title="Free">
                                <Sparkles className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* All Models (by Developer) - hidden in Incognito mode */}
            {!isIncognitoMode && (
              <div className="border-b">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  All Models
                </div>
              </div>
            )}
            {!isIncognitoMode && Object.entries(filteredModelsByDeveloper).map(([developer, devModels]) => (
              <div key={developer} className="border-b last:border-0">
                <button
                  onClick={() => toggleDeveloper(developer)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-semibold hover:bg-muted"
                >
                  {expandedDevelopers.has(developer) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span>{developer} ({devModels.length})</span>
                </button>
                {expandedDevelopers.has(developer) && (
                  <div className="pb-2">
                    {(loadAllModels ? devModels : devModels.slice(0, MAX_MODELS_PER_DEVELOPER)).map((model) => (
                      <CommandItem
                        key={model.value}
                        value={model.label}
                        onSelect={(currentValue) => {
                          const selected = models.find(m => m.label.toLowerCase() === currentValue.toLowerCase());
                          onSelectModel(selected || null);
                          setOpen(false);
                        }}
                        className="cursor-pointer pl-8 pr-2 group"
                      >
                        <Star
                          className={cn(
                            "mr-2 h-4 w-4 flex-shrink-0 cursor-pointer transition-colors",
                            favorites.has(model.value)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30 hover:text-yellow-400"
                          )}
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
                          {model.category === 'Free' && (
                            <span className="ml-1 text-green-600 dark:text-green-400 flex items-center" title="Free">
                              <Sparkles className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Load More Button - hidden in Incognito mode */}
            {!isIncognitoMode && !loadAllModels && !debouncedSearchQuery && (
              <div className="border-t p-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setLoadAllModels(true)}
                  disabled={loading}
                >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading all models...
                      </>
                    ) : (
                      loadAllButtonLabel
                    )}
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
