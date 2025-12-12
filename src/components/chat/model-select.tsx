
"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronRight, ChevronsUpDown, Loader2, Star, Sparkles } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"

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

// Virtual list item types for efficient rendering
type VirtualListItem =
  | { type: 'favorites-header'; count: number; isExpanded: boolean }
  | { type: 'category-header'; category: string; count: number; isExpanded: boolean }
  | { type: 'all-models-header' }
  | { type: 'developer-header'; developer: string; count: number; isExpanded: boolean }
  | { type: 'model-item'; model: ModelOption; section: string }
  | { type: 'load-more-button' }
  | { type: 'empty-message' };

interface ModelSelectProps {
    selectedModel: ModelOption | null;
    onSelectModel: (model: ModelOption | null) => void;
}

// Memoized model item component to prevent unnecessary re-renders
interface ModelCommandItemProps {
  model: ModelOption;
  selectedModel: ModelOption | null;
  favorites: Set<string>;
  onSelect: (model: ModelOption) => void;
  onToggleFavorite: (modelId: string, event: React.MouseEvent) => void;
  showSpeedBadge?: boolean;
}

const ModelCommandItem = React.memo(function ModelCommandItem({
  model,
  selectedModel,
  favorites,
  onSelect,
  onToggleFavorite,
  showSpeedBadge = true,
}: ModelCommandItemProps) {
  const handleSelect = React.useCallback(() => {
    onSelect(model);
  }, [model, onSelect]);

  const handleFavoriteClick = React.useCallback((e: React.MouseEvent) => {
    onToggleFavorite(model.value, e);
  }, [model.value, onToggleFavorite]);

  const isFavorite = favorites.has(model.value);
  const isSelected = selectedModel?.value === model.value;

  return (
    <CommandItem
      value={model.label}
      onSelect={handleSelect}
      className="cursor-pointer pl-8 pr-2 group"
    >
      <Star
        className={cn(
          "mr-2 h-4 w-4 flex-shrink-0 cursor-pointer transition-colors",
          isFavorite
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted-foreground/30 hover:text-yellow-400"
        )}
        onClick={handleFavoriteClick}
      />
      <Check
        className={cn(
          "mr-2 h-4 w-4 flex-shrink-0",
          isSelected ? "opacity-100" : "opacity-0"
        )}
      />
      <span className="truncate flex-1">{model.label}</span>
      <div className="flex items-center gap-1">
        {showSpeedBadge && model.speedTier === 'ultra-fast' && (
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">⚡</span>
        )}
        {showSpeedBadge && model.speedTier === 'fast' && (
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">⚡</span>
        )}
        {model.sourceGateway && model.sourceGateway !== 'openrouter' && (
          <span className="ml-1 text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {model.sourceGateway.toUpperCase()}
          </span>
        )}
        {model.category === 'Free' && (
          <span className="ml-1 text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            FREE
          </span>
        )}
      </div>
    </CommandItem>
  );
});

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

const ensureRouterOption = (options: ModelOption[]): ModelOption[] => {
  const hasRouter = options.some((option) => option.value === ROUTER_OPTION.value);
  if (hasRouter) {
    return options.map((option) =>
      option.value === ROUTER_OPTION.value ? { ...ROUTER_OPTION, ...option } : option
    );
  }
  return [{ ...ROUTER_OPTION }, ...options];
};

// Extract developer from model ID (e.g., "openai/gpt-4" -> "OpenAI")
const getDeveloper = (modelId: string): string => {
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
      'x-ai': 'xAI'
    };
    return formatted[dev] || dev.charAt(0).toUpperCase() + dev.slice(1);
  }
  return 'Other';
};

// Determine model speed tier based on gateway and model characteristics
const getModelSpeedTier = (modelId: string, gateway?: string): 'ultra-fast' | 'fast' | 'medium' | 'slow' | undefined => {
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

export function ModelSelect({ selectedModel, onSelectModel }: ModelSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [models, setModels] = React.useState<ModelOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set())
  const [expandedDevelopers, setExpandedDevelopers] = React.useState<Set<string>>(new Set(['Favorites']))
  const [searchQuery, setSearchQuery] = React.useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('')
  const [loadAllModels, setLoadAllModels] = React.useState(false)
  const [totalAvailableModels, setTotalAvailableModels] = React.useState<number | null>(null)

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
    }, 150); // 150ms debounce - faster for better UX

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
          const promptPrice = Number(model.pricing?.prompt ?? 0);
          const completionPrice = Number(model.pricing?.completion ?? 0);
          const isPaid = promptPrice > 0 || completionPrice > 0;
          const category = sourceGateway === 'portkey' ? 'Portkey' : (isPaid ? 'Paid' : 'Free');
          const developer = getDeveloper(model.id);

          // Extract modalities from architecture.input_modalities
          const modalities = model.architecture?.input_modalities?.map((m: string) =>
            m.charAt(0).toUpperCase() + m.slice(1)
          ) || ['Text'];

          // Get speed tier for performance indicators
          const speedTier = getModelSpeedTier(model.id, sourceGateway);

          return {
            value: model.id,
            label: model.name,
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

  // Group models by developer and sort by Hugging Face popularity
  const modelsByDeveloper = React.useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};

    models.forEach(model => {
      const dev = model.developer || 'Other';
      if (!groups[dev]) {
        groups[dev] = [];
      }
      groups[dev].push(model);
    });

    // Calculate popularity score for each developer based on HuggingFace metrics
    const developerScores: Record<string, number> = {};
    Object.entries(groups).forEach(([developer, devModels]) => {
      const totalLikes = devModels.reduce((sum, m) => sum + (m.huggingfaceMetrics?.likes || 0), 0);
      const totalDownloads = devModels.reduce((sum, m) => sum + (m.huggingfaceMetrics?.downloads || 0), 0);
      // Weight likes more heavily than downloads (1 like = 1000 download equivalents)
      // This prioritizes quality/engagement over pure volume
      developerScores[developer] = (totalLikes * 1000) + (totalDownloads / 1000);
    });

    // Define priority order for top organizations
    const priorityOrgs = ['OpenAI', 'Anthropic', 'Google', 'Qwen', 'xAI', 'Meta', 'DeepSeek', 'Mistral AI'];

    // Sort developers: priority orgs first (by their order), then by popularity score, then alphabetically
    return Object.keys(groups)
      .sort((a, b) => {
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
        acc[key] = groups[key];
        return acc;
      }, {} as Record<string, ModelOption[]>);
  }, [models]);

  // Get favorite models
  const favoriteModels = React.useMemo(() => {
    return models.filter(m => favorites.has(m.value));
  }, [models, favorites]);

  // Categorize models by capability/use case
  const categorizeModel = (model: ModelOption): string[] => {
    const categories: string[] = [];
    const modelName = model.label.toLowerCase();
    const modelId = model.value.toLowerCase();

    // Reasoning models
    if (
      modelId.includes('deepseek-reasoner') ||
      modelId.includes('deepseek-r1') ||
      modelId.includes('qwq') ||
      modelId.includes('o1') ||
      modelId.includes('o3') ||
      modelName.includes('reasoning') ||
      modelName.includes('reasoner')
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
  };

  // Group models by category
  const modelsByCategory = React.useMemo(() => {
    const categories: Record<string, ModelOption[]> = {
      'Reasoning': [],
      'Code Generation': [],
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
  }, [models]);

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

  // Filter models based on search query and auto-expand matching sections
  const filteredModelsByDeveloper = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return modelsByDeveloper;
    }

    const query = debouncedSearchQuery.toLowerCase();
    const filtered: Record<string, ModelOption[]> = {};
    const developersToExpand = new Set<string>();

    Object.entries(modelsByDeveloper).forEach(([developer, devModels]) => {
      const matchingModels = devModels.filter(model =>
        model.label.toLowerCase().includes(query) ||
        model.value.toLowerCase().includes(query) ||
        developer.toLowerCase().includes(query)
      );

      if (matchingModels.length > 0) {
        filtered[developer] = matchingModels;
        developersToExpand.add(developer);
      }
    });

    // Auto-expand sections with matches
    setExpandedDevelopers(prev => {
      const next = new Set(prev);
      developersToExpand.forEach(dev => next.add(dev));
      return next;
    });

    return filtered;
  }, [modelsByDeveloper, debouncedSearchQuery]);

  // Filter category models based on search
  const filteredModelsByCategory = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return modelsByCategory;
    }

    const query = debouncedSearchQuery.toLowerCase();
    const filtered: Record<string, ModelOption[]> = {};
    const categoriesToExpand = new Set<string>();

    Object.entries(modelsByCategory).forEach(([category, catModels]) => {
      const matchingModels = catModels.filter(model =>
        model.label.toLowerCase().includes(query) ||
        model.value.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)
      );

      if (matchingModels.length > 0) {
        filtered[category] = matchingModels;
        categoriesToExpand.add(category);
      }
    });

    // Auto-expand sections with matches
    setExpandedDevelopers(prev => {
      const next = new Set(prev);
      categoriesToExpand.forEach(cat => next.add(cat));
      return next;
    });

    return filtered;
  }, [modelsByCategory, debouncedSearchQuery]);

  // Filter favorite models based on search
  const filteredFavoriteModels = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return favoriteModels;
    }

    const query = debouncedSearchQuery.toLowerCase();
    return favoriteModels.filter(model =>
      model.label.toLowerCase().includes(query) ||
      model.value.toLowerCase().includes(query)
    );
  }, [favoriteModels, debouncedSearchQuery]);

  // Create flattened items list for virtualization
  const flattenedItems = React.useMemo((): VirtualListItem[] => {
    const items: VirtualListItem[] = [];

    // Check if there are any visible items at all
    const hasAnyItems = filteredFavoriteModels.length > 0 ||
      Object.values(filteredModelsByCategory).some(models => models.length > 0) ||
      Object.values(filteredModelsByDeveloper).some(models => models.length > 0);

    if (!hasAnyItems) {
      items.push({ type: 'empty-message' });
      return items;
    }

    // Favorites section
    if (filteredFavoriteModels.length > 0) {
      items.push({
        type: 'favorites-header',
        count: filteredFavoriteModels.length,
        isExpanded: expandedDevelopers.has('Favorites')
      });
      if (expandedDevelopers.has('Favorites')) {
        filteredFavoriteModels.forEach(model => {
          items.push({ type: 'model-item', model, section: 'Favorites' });
        });
      }
    }

    // Category sections
    Object.entries(filteredModelsByCategory).forEach(([category, catModels]) => {
      if (catModels.length === 0) return;
      items.push({
        type: 'category-header',
        category,
        count: catModels.length,
        isExpanded: expandedDevelopers.has(category)
      });
      if (expandedDevelopers.has(category)) {
        catModels.forEach(model => {
          items.push({ type: 'model-item', model, section: category });
        });
      }
    });

    // All Models header
    items.push({ type: 'all-models-header' });

    // Developer sections
    Object.entries(filteredModelsByDeveloper).forEach(([developer, devModels]) => {
      if (devModels.length === 0) return;
      items.push({
        type: 'developer-header',
        developer,
        count: devModels.length,
        isExpanded: expandedDevelopers.has(developer)
      });
      if (expandedDevelopers.has(developer)) {
        const modelsToShow = loadAllModels ? devModels : devModels.slice(0, MAX_MODELS_PER_DEVELOPER);
        modelsToShow.forEach(model => {
          items.push({ type: 'model-item', model, section: developer });
        });
      }
    });

    // Load more button
    if (!loadAllModels && !debouncedSearchQuery) {
      items.push({ type: 'load-more-button' });
    }

    return items;
  }, [
    filteredFavoriteModels,
    filteredModelsByCategory,
    filteredModelsByDeveloper,
    expandedDevelopers,
    loadAllModels,
    debouncedSearchQuery
  ]);

  // Ref for virtual list scroll container
  const listRef = React.useRef<HTMLDivElement>(null);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => {
      const item = flattenedItems[index];
      if (item.type === 'all-models-header') return 28;
      if (item.type === 'favorites-header' || item.type === 'category-header' || item.type === 'developer-header') return 36;
      if (item.type === 'load-more-button') return 52;
      if (item.type === 'empty-message') return 40;
      return 40; // model-item
    },
    overscan: 10,
  });

  // Reset scroll position when search changes
  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [debouncedSearchQuery]);

  // Stable callback for model selection
  const handleModelSelect = React.useCallback((model: ModelOption) => {
    onSelectModel(model);
    setOpen(false);
  }, [onSelectModel]);

  // Stable callback for favorite toggle
  const handleToggleFavorite = React.useCallback((modelId: string, event: React.MouseEvent) => {
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
  }, []);

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
              label: model.name,
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
              {loading && <Loader2 className="ml-1 h-3 w-3 animate-spin flex-shrink-0 opacity-50" />}
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
      <PopoverContent className="w-[95vw] sm:w-[400px] max-w-[400px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search model..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          {/* Virtualized list for performance with 330+ models */}
          <div
            ref={listRef}
            className="max-h-[400px] overflow-auto"
            style={{ contain: 'strict' }}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = flattenedItems[virtualRow.index];

                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {item.type === 'empty-message' && (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No model found.
                      </div>
                    )}

                    {item.type === 'favorites-header' && (
                      <div className="border-b">
                        <button
                          onClick={() => toggleDeveloper('Favorites')}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-semibold hover:bg-muted"
                        >
                          {item.isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span>Favorites ({item.count})</span>
                        </button>
                      </div>
                    )}

                    {item.type === 'category-header' && (
                      <div className="border-b">
                        <button
                          onClick={() => toggleDeveloper(item.category)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-semibold hover:bg-muted"
                        >
                          {item.isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span>{item.category} ({item.count})</span>
                        </button>
                      </div>
                    )}

                    {item.type === 'all-models-header' && (
                      <div className="border-b">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          All Models
                        </div>
                      </div>
                    )}

                    {item.type === 'developer-header' && (
                      <div className="border-b">
                        <button
                          onClick={() => toggleDeveloper(item.developer)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-semibold hover:bg-muted"
                        >
                          {item.isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span>{item.developer} ({item.count})</span>
                        </button>
                      </div>
                    )}

                    {item.type === 'model-item' && (
                      <ModelCommandItem
                        model={item.model}
                        selectedModel={selectedModel}
                        favorites={favorites}
                        onSelect={handleModelSelect}
                        onToggleFavorite={handleToggleFavorite}
                        showSpeedBadge={item.section !== 'Favorites'}
                      />
                    )}

                    {item.type === 'load-more-button' && (
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
                  </div>
                );
              })}
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
