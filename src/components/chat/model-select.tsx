
"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronRight, ChevronsUpDown, Loader2, Star } from "lucide-react"

import { cn } from "@/lib/utils"
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
    huggingfaceMetrics?: {
        downloads?: number;
        likes?: number;
    };
};

interface ModelSelectProps {
    selectedModel: ModelOption | null;
    onSelectModel: (model: ModelOption | null) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

const CACHE_KEY = 'gatewayz_models_cache_v5_optimized';
const FAVORITES_KEY = 'gatewayz_favorite_models';
const CACHE_DURATION = 60 * 60 * 1000; // 60 minutes - extended cache for maximum performance
const INITIAL_MODELS_LIMIT = 50; // Load top 50 models initially for instant loading
const MAX_MODELS_PER_DEVELOPER = 10; // Limit models shown per developer for performance

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

export function ModelSelect({ selectedModel, onSelectModel }: ModelSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [models, setModels] = React.useState<ModelOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set())
  const [expandedDevelopers, setExpandedDevelopers] = React.useState<Set<string>>(new Set(['Favorites']))
  const [searchQuery, setSearchQuery] = React.useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('')
  const [loadAllModels, setLoadAllModels] = React.useState(false)

  // Debounce search query for performance
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce

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
          const { data, timestamp } = JSON.parse(cached);
          // Validate cached data has correct structure
          if (Date.now() - timestamp < CACHE_DURATION && data && data.length > 0 && data[0].value) {
            setModels(data);
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

      // Fetch from all gateways - optimized to load fewer models initially
      setLoading(true);
      try {
        // Only fetch from OpenRouter initially for speed, load others on demand
        const limit = loadAllModels ? undefined : INITIAL_MODELS_LIMIT;
        const limitParam = limit ? `&limit=${limit}` : '';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const openrouterRes = await fetch(`/api/models?gateway=openrouter${limitParam}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        const openrouterData = await openrouterRes.json();

        // Combine models from all gateways
        const allModels = [...(openrouterData.data || [])];

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

          return {
            value: model.id,
            label: model.name,
            category,
            sourceGateway,
            developer,
            huggingfaceMetrics: model.huggingface_metrics ? {
              downloads: model.huggingface_metrics.downloads || 0,
              likes: model.huggingface_metrics.likes || 0,
            } : undefined,
          };
        });
        setModels(modelOptions);

        // Try to cache the results, but don't fail if quota exceeded
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: modelOptions,
            timestamp: Date.now()
          }));
        } catch (e) {
          // Storage quota exceeded, clear old cache
          try {
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem('gatewayz_models_cache');
          } catch (clearError) {
            // Ignore
          }
        }
      } catch (error) {
        // Failed to fetch models
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
  }, [loadAllModels]);

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
          className="w-[250px] justify-between bg-muted/30 hover:bg-muted/50"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
              <span className="truncate">Loading...</span>
            </>
          ) : selectedModel ? (
            <span className="truncate">{selectedModel.label}</span>
          ) : (
            <span className="truncate">Select model...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search model..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>No model found.</CommandEmpty>

            {/* Favorites Section */}
            {filteredFavoriteModels.length > 0 && (
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
                      </CommandItem>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Developer Groups */}
            {Object.entries(filteredModelsByDeveloper).map(([developer, devModels]) => (
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
                      </CommandItem>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Load More Button */}
            {!loadAllModels && !debouncedSearchQuery && (
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
                    `Load all models (${models.length} of 330+)`
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
