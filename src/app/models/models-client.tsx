"use client"

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Slider } from "@/components/ui/slider";
import { BookText, Bot, Box, ChevronDown, ChevronUp, FileText, ImageIcon, LayoutGrid, LayoutList, Lock, Music, Search, Sliders as SlidersIcon, Video, X, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { stringToColor, getModelUrl } from '@/lib/utils';
import { safeParseJson } from '@/lib/http';
import { GATEWAY_CONFIG as REGISTRY_GATEWAY_CONFIG, getAllActiveGatewayIds } from '@/lib/gateway-registry';
import { isFreeModel as checkIsFreeModel, getSourceGateway } from '@/lib/model-pricing-utils';


interface Model {
  id: string;
  name: string;
  description: string | null;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  } | null;
  architecture: {
    input_modalities: string[] | null;
    output_modalities: string[] | null;
  } | null;
  supported_parameters: string[] | null;
  provider_slug: string;
  provider_slugs?: string[]; // NEW: Array of all providers offering this model
  source_gateways?: string[]; // Array of all gateways offering this model
  source_gateway?: string; // Keep for backwards compatibility
  created?: number;
  is_private?: boolean; // Indicates if model is on a private network (e.g., NEAR)
  is_free?: boolean; // Only true for OpenRouter models with :free suffix
}

// Gateway display configuration - now uses centralized gateway registry
// To add a new gateway, simply add it to src/lib/gateway-registry.ts
// Icon components need to be resolved here since the registry stores string identifiers
const GATEWAY_CONFIG: Record<string, { name: string; color: string; icon?: React.ReactNode }> = Object.fromEntries(
  Object.entries(REGISTRY_GATEWAY_CONFIG).map(([id, config]) => [
    id,
    {
      name: config.name,
      color: config.color,
      icon: config.icon === 'zap' ? <Zap className="w-3 h-3" /> : undefined,
    },
  ])
);

// Provider display configuration (for providers that differ from gateway names)
const PROVIDER_CONFIG: Record<string, { name: string; color: string }> = {
  openai: { name: 'OpenAI', color: 'bg-green-600' },
  anthropic: { name: 'Anthropic', color: 'bg-orange-600' },
  google: { name: 'Google', color: 'bg-blue-600' },
  meta: { name: 'Meta', color: 'bg-blue-700' },
  cohere: { name: 'Cohere', color: 'bg-purple-600' },
  mistral: { name: 'Mistral', color: 'bg-orange-500' },
  'mistralai': { name: 'Mistral AI', color: 'bg-orange-500' },
  qwen: { name: 'Qwen', color: 'bg-red-600' },
  deepseek: { name: 'DeepSeek', color: 'bg-cyan-600' },
  alibaba: { name: 'Alibaba', color: 'bg-orange-700' },
  '01-ai': { name: '01.AI', color: 'bg-indigo-600' },
  '01ai': { name: '01.AI', color: 'bg-indigo-600' },
  nvidia: { name: 'NVIDIA', color: 'bg-green-700' },
  microsoft: { name: 'Microsoft', color: 'bg-blue-800' },
  xai: { name: 'xAI', color: 'bg-black' },
  perplexity: { name: 'Perplexity', color: 'bg-teal-700' },
  'alpaca-network': { name: 'Alpaca Network', color: 'bg-green-700' },
  alpaca: { name: 'Alpaca Network', color: 'bg-green-700' },
  // Add more providers as needed
};

const ModelCard = React.memo(function ModelCard({ model }: { model: Model }) {
  const hasPricing = model.pricing !== null && model.pricing !== undefined;
  // Only OpenRouter models with :free suffix are legitimately free
  const isFree = checkIsFreeModel(model);
  const inputCost = hasPricing ? (parseFloat(model.pricing?.prompt || '0') * 1000000).toFixed(2) : null;
  const outputCost = hasPricing ? (parseFloat(model.pricing?.completion || '0') * 1000000).toFixed(2) : null;
  const contextK = model.context_length > 0 ? Math.round(model.context_length / 1000) : 0;

  // Determine if model is multi-lingual (simple heuristic - can be improved)
  const isMultiLingual = model.architecture?.input_modalities?.includes('text') &&
                         (model.name.toLowerCase().includes('multilingual') ||
                          model.description?.toLowerCase().includes('multilingual') ||
                          model.description?.toLowerCase().includes('multi-lingual'));

  // Get gateways - support both old and new format
  const sourceGateway = getSourceGateway(model);
  const gateways = (model.source_gateways && model.source_gateways.length > 0) ? model.source_gateways : (sourceGateway ? [sourceGateway] : []);

  // NEW: Get providers - support both old and new format
  const providers = (model.provider_slugs && model.provider_slugs.length > 0) ? model.provider_slugs : (model.provider_slug ? [model.provider_slug] : []);

  // NEW: Deduplicate and combine providers that are also gateways
  // Deduplicate by display name to avoid showing "Alpaca Network" twice (once from provider, once from gateway)
  const allSourcesRaw = [...new Set([...providers, ...gateways])];
  const sourcesByName = new Map<string, string>();
  allSourcesRaw.forEach(source => {
    // Normalize source: remove @ prefix and handle both singular and configured names
    let normalizedSource = source.replace(/^@/, '').toLowerCase();

    const providerConfig = PROVIDER_CONFIG[normalizedSource];
    const gatewayConfig = GATEWAY_CONFIG[normalizedSource];
    const config = providerConfig || gatewayConfig;
    const displayName = config?.name || source.replace(/^@/, '');
    // Only keep first occurrence of each display name
    if (!sourcesByName.has(displayName)) {
      sourcesByName.set(displayName, normalizedSource);
    }
  });
  const allSources = Array.from(sourcesByName.values());

  // Generate clean URLs in format /models/[developer]/[model]
  const modelUrl = getModelUrl(model.id, model.provider_slug);

  return (
    <Link href={modelUrl} className="h-full block">
      <Card className="p-6 flex flex-col h-full hover:border-primary transition-colors overflow-hidden">
        {/* Model name and badges */}
        <div className="flex items-start gap-2 mb-3 min-w-0">
          <h3 className="text-lg font-bold flex-1 min-w-0 truncate">
            {model.name}
          </h3>
          <div className="flex gap-2 flex-shrink-0">
            {isFree && (
              <Badge className="bg-black text-white hover:bg-black/90 text-xs px-2 py-0.5">
                Free
              </Badge>
            )}
            {isMultiLingual && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                Multi-Lingual
              </Badge>
            )}
            {model.is_private && (
              <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-xs px-2 py-0.5 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Private
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground flex-grow line-clamp-2 mb-4 overflow-hidden break-words">
          {model.description || 'Explore Token Usage Across Models, Labs, And Public Applications.'}
        </p>

        {/* Providers & Gateways - Combined section */}
        {allSources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {allSources.slice(0, 4).map((source) => {
              // Normalize source by removing @ prefix
              const normalizedSource = source.replace(/^@/, '').toLowerCase();
              // Check if it's a provider or gateway, prefer provider config
              const providerConfig = PROVIDER_CONFIG[normalizedSource];
              const gatewayConfig = GATEWAY_CONFIG[normalizedSource];
              const config = providerConfig || gatewayConfig || {
                name: normalizedSource,
                color: 'bg-gray-500'
              };
              return (
                <Badge
                  key={source}
                  className={`${config.color} text-white text-[10px] px-1.5 py-0 h-5 flex items-center gap-0.5`}
                  variant="secondary"
                >
                  {gatewayConfig?.icon}
                  {config.name}
                </Badge>
              );
            })}
            {allSources.length > 4 && (
              <Badge
                className="bg-gray-500 text-white text-[10px] px-1.5 py-0 h-5"
                variant="secondary"
              >
                +{allSources.length - 4} more
              </Badge>
            )}
          </div>
        )}

        {/* Bottom metadata row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t pt-3">
          <span className="flex items-center gap-1">
            By <span className="font-medium text-foreground">{model.provider_slug?.replace(/^@/, '') || 'Unknown'}</span>
          </span>
          <span className="font-medium">{contextK > 0 ? `${contextK}M Tokens` : '0M Tokens'}</span>
          <span className="font-medium">{contextK > 0 ? `${contextK}K Context` : '0K Context'}</span>
          {hasPricing ? (
            <>
              <span className="font-medium">${inputCost}/M Input</span>
              <span className="font-medium">${outputCost}/M Output</span>
            </>
          ) : (
            <span className="font-medium text-amber-600">Contact for pricing</span>
          )}
        </div>
      </Card>
    </Link>
  );
});

export default function ModelsClient({
  initialModels,
  isLoadingMore = false
}: {
  initialModels: Model[];
  isLoadingMore?: boolean;
}) {
  // Initialize CSS variable for header positioning and update when banner visibility changes
  React.useEffect(() => {
    const updateHeaderPosition = () => {
      const bannerElement = document.querySelector('[data-onboarding-banner]');
      const spacer = document.querySelector('[data-header-spacer]');
      const container = document.querySelector('[data-models-container]');
      
      if (bannerElement) {
        const bannerHeight = bannerElement.getBoundingClientRect().height;
        const headerTop = 65 + bannerHeight;
        document.documentElement.style.setProperty('--models-header-top', `${headerTop}px`);
        
        // Update header element directly
        const header = document.querySelector('[data-models-header]');
        if (header) {
          (header as HTMLElement).style.top = `${headerTop}px`;
        }
        
        // Update container margin
        if (container) {
          (container as HTMLElement).style.marginTop = `-${headerTop}px`;
        }
        
        // Update models list margin - add more space when banner is visible
        const modelsList = document.querySelector('[data-models-list]');
        if (modelsList) {
          (modelsList as HTMLElement).style.marginTop = '140px';
        }
        
        // Update spacer
        if (spacer) {
          (spacer as HTMLElement).style.height = `${headerTop}px`;
        }
      } else {
        document.documentElement.style.setProperty('--models-header-top', '65px');
        
        // Update header element directly
        const header = document.querySelector('[data-models-header]');
        if (header) {
          (header as HTMLElement).style.top = '65px';
        }
        
        // Update container margin - use negative margin to pull content up but keep header visible
        if (container) {
          (container as HTMLElement).style.marginTop = '-50px';
        }
        
        // Update models list margin - keep normal spacing when banner is closed
        const modelsList = document.querySelector('[data-models-list]');
        if (modelsList) {
          (modelsList as HTMLElement).style.marginTop = '80px';
        }
        
        // Update spacer
        if (spacer) {
          (spacer as HTMLElement).style.height = '65px';
        }
      }
    };

    // Initial update with delay to ensure banner is rendered
    setTimeout(updateHeaderPosition, 50);

    // Watch for banner visibility changes
    const observer = new MutationObserver(() => {
      setTimeout(updateHeaderPosition, 50);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Also check periodically in case banner renders after initial check
    const interval = setInterval(updateHeaderPosition, 200);
    
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastSyncedQueryRef = React.useRef<string>(searchParams.toString());

  // Client-side model fetching state
  const [models, setModels] = useState<Model[]>(initialModels);
  const [isLoadingModels, setIsLoadingModels] = useState(initialModels.length < 50 && !isLoadingMore);

  // Infinite scroll state - Reduced for faster initial load
  const [itemsPerPage] = useState(24); // Load 24 models at a time
  const [visibleCount, setVisibleCount] = useState(24); // Number of items currently visible
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // Update models when initialModels changes (e.g., when deferred models finish loading)
  useEffect(() => {
    if (initialModels.length > 0 && initialModels.length !== models.length) {
      console.log(`[Models] Updating models from ${models.length} to ${initialModels.length}`);
      setModels(initialModels);
    }
  }, [initialModels, models.length]);

  // Fetch models client-side if we only got the fallback static models
  useEffect(() => {
    if (initialModels.length < 50) {
      console.log('[Models] Only got', initialModels.length, 'models from server, fetching from client...');
      const controller = new AbortController();
      let isActive = true;

      const fetchAllModels = async () => {
        setIsLoadingModels(true);
        try {
          const response = await fetch('/api/models?gateway=all&limit=50000', {
            signal: controller.signal
          });
          const payload = await safeParseJson<{ data?: Model[] }>(
            response,
            '[Models] client bootstrap'
          );
          if (isActive && payload?.data && payload.data.length > 0) {
            console.log(`[Models] Fetched ${payload.data.length} models from client`);
            setModels(payload.data);
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            console.error('[Models] Client fetch failed:', err);
          }
        } finally {
          if (isActive) {
            setIsLoadingModels(false);
          }
        }
      };

      fetchAllModels();

      return () => {
        isActive = false;
        controller.abort();
      };
    }
  }, [initialModels.length]);

  // Additional deduplication as a safety measure
  const deduplicatedModels = useMemo(() => {
    console.log(`Models for deduplication: ${models.length}`);
    const seen = new Set<string>();
    const deduplicated = models.filter(model => {
      // Filter out malformed models from backend (e.g., Cerebras parsing errors)
      // These have names like "('Data', [Data(Id=..." or "('Object', 'List')"
      const isMalformed = model.name && (
        model.name.startsWith("('Data',") ||
        model.name.startsWith("('Object',") ||
        model.name.includes("Data(Id=") ||
        model.name.includes("Data(id=")
      );

      if (isMalformed) {
        console.warn(`Filtering out malformed model: ${model.name} (ID: ${model.id})`);
        return false;
      }

      if (seen.has(model.id)) {
        return false;
      }
      seen.add(model.id);
      return true;
    });
    console.log(`After client-side deduplication and validation: ${deduplicated.length} unique models`);
    return deduplicated;
  }, [models]);

  const [layout, setLayout] = useState("list");
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || "");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchParams.get('search') || "");
  const [selectedInputFormats, setSelectedInputFormats] = useState<string[]>(searchParams.get('inputFormats')?.split(',').filter(Boolean) || []);
  const [selectedOutputFormats, setSelectedOutputFormats] = useState<string[]>(searchParams.get('outputFormats')?.split(',').filter(Boolean) || []);
  const [contextLengthRange, setContextLengthRange] = useState<[number, number]>([
    parseInt(searchParams.get('contextLengthMin') || '0'),
    parseInt(searchParams.get('contextLengthMax') || '1024')
  ]);
  const [promptPricingRange, setPromptPricingRange] = useState<[number, number]>([
    parseFloat(searchParams.get('promptPricingMin') || '0'),
    parseFloat(searchParams.get('promptPricingMax') || '10')
  ]);
  const [selectedParameters, setSelectedParameters] = useState<string[]>(searchParams.get('parameters')?.split(',').filter(Boolean) || []);
  const [selectedDevelopers, setSelectedDevelopers] = useState<string[]>(searchParams.get('developers')?.split(',').filter(Boolean) || []);
  const [selectedGateways, setSelectedGateways] = useState<string[]>(searchParams.get('gateways')?.split(',').filter(Boolean) || []);
  const [selectedModelSeries, setSelectedModelSeries] = useState<string[]>(searchParams.get('modelSeries')?.split(',').filter(Boolean) || []);
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'paid'>(searchParams.get('pricing') as 'all' | 'free' | 'paid' || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'popular');
  const [releaseDateFilter, setReleaseDateFilter] = useState<string>(searchParams.get('releaseDate') || 'all');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'private' | 'public'>(searchParams.get('privacy') as 'all' | 'private' | 'public' || 'all');

  // Mark explore task as complete in onboarding when page loads
  useEffect(() => {
    // Only run on client side to prevent hydration errors
    if (typeof window !== 'undefined') {
      try {
        const savedTasks = localStorage.getItem('gatewayz_onboarding_tasks');
        if (savedTasks) {
          const taskState = JSON.parse(savedTasks);
          if (!taskState.explore) {
            taskState.explore = true;
            localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify(taskState));
            console.log('Onboarding - Explore task marked as complete');

            // Dispatch custom event to notify the banner
            window.dispatchEvent(new Event('onboarding-task-updated'));
          }
        } else {
          // Initialize task state if it doesn't exist and mark explore as complete
          const taskState = { explore: true };
          localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify(taskState));
          console.log('Onboarding - Explore task initialized and marked as complete');

          // Dispatch custom event to notify the banner
          window.dispatchEvent(new Event('onboarding-task-updated'));
        }
      } catch (error) {
        console.error('Failed to update onboarding task:', error);
      }
    }
  }, []); // Run once on mount

  // Debounce search input - reduced from 150ms to 100ms for faster response
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 100);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Update URL parameters when filters change (debounced to avoid excessive router fetches)
  useEffect(() => {
    const params = new URLSearchParams();

    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
    if (selectedInputFormats.length > 0) params.set('inputFormats', selectedInputFormats.join(','));
    if (selectedOutputFormats.length > 0) params.set('outputFormats', selectedOutputFormats.join(','));
    if (contextLengthRange[0] !== 0) params.set('contextLengthMin', contextLengthRange[0].toString());
    if (contextLengthRange[1] !== 1024) params.set('contextLengthMax', contextLengthRange[1].toString());
    if (promptPricingRange[0] !== 0) params.set('promptPricingMin', promptPricingRange[0].toString());
    if (promptPricingRange[1] !== 10) params.set('promptPricingMax', promptPricingRange[1].toString());
    if (selectedParameters.length > 0) params.set('parameters', selectedParameters.join(','));
    if (selectedDevelopers.length > 0) params.set('developers', selectedDevelopers.join(','));
    if (selectedGateways.length > 0) params.set('gateways', selectedGateways.join(','));
    if (selectedModelSeries.length > 0) params.set('modelSeries', selectedModelSeries.join(','));
    if (pricingFilter !== 'all') params.set('pricing', pricingFilter);
    if (privacyFilter !== 'all') params.set('privacy', privacyFilter);
    if (sortBy !== 'popular') params.set('sortBy', sortBy);
    if (releaseDateFilter !== 'all') params.set('releaseDate', releaseDateFilter);

    const queryString = params.toString();
    if (queryString === lastSyncedQueryRef.current) {
      return;
    }
    lastSyncedQueryRef.current = queryString;

    const target = queryString ? `/models?${queryString}` : '/models';

    // Avoid triggering a new RSC fetch if the user is offline or Navigator API reports no connectivity.
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
      window.history.replaceState(window.history.state ?? null, '', target);
      return;
    }

    try {
      router.replace(queryString ? `?${queryString}` : '/models', { scroll: false });
    } catch (error) {
      console.warn('[Models] router.replace failed, falling back to history.replaceState', error);
      if (typeof window !== 'undefined') {
        window.history.replaceState(window.history.state ?? null, '', target);
      }
    }
  }, [
    debouncedSearchTerm,
    selectedInputFormats,
    selectedOutputFormats,
    contextLengthRange,
    promptPricingRange,
    selectedParameters,
    selectedDevelopers,
    selectedGateways,
    selectedModelSeries,
    pricingFilter,
    privacyFilter,
    sortBy,
    releaseDateFilter,
    router,
  ]);

  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string, checked: boolean) => {
    setter(prev => checked ? [...prev, value] : prev.filter(v => v !== value));
  };

  // Extract model series from model name (e.g., "GPT-4", "Claude", "Gemini")
  // Memoized to avoid recreating on every render
  const getModelSeries = useCallback((model: Model): string => {
    const name = model.name.toLowerCase();
    if (name.includes('gpt-4')) return 'GPT-4';
    if (name.includes('gpt-3')) return 'GPT-3';
    if (name.includes('claude')) return 'Claude';
    if (name.includes('gemini')) return 'Gemini';
    if (name.includes('llama')) return 'Llama';
    if (name.includes('mistral')) return 'Mistral';
    if (name.includes('deepseek')) return 'DeepSeek';
    if (name.includes('qwen')) return 'Qwen';
    if (name.includes('glm')) return 'GLM';
    if (name.includes('phi')) return 'Phi';
    return 'Other';
  }, []);

  const resetFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setSelectedInputFormats([]);
    setSelectedOutputFormats([]);
    setContextLengthRange([0, 1024]);
    setPromptPricingRange([0, 10]);
    setSelectedParameters([]);
    setSelectedDevelopers([]);
    setSelectedGateways([]);
    setSelectedModelSeries([]);
    setPricingFilter('all');
    setPrivacyFilter('all');
    setSortBy('popular');
    setReleaseDateFilter('all');
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || selectedInputFormats.length > 0 || selectedOutputFormats.length > 0 ||
    contextLengthRange[0] !== 0 || contextLengthRange[1] !== 1024 ||
    promptPricingRange[0] !== 0 || promptPricingRange[1] !== 10 ||
    selectedParameters.length > 0 ||
    selectedDevelopers.length > 0 || selectedGateways.length > 0 || selectedModelSeries.length > 0 || pricingFilter !== 'all' || privacyFilter !== 'all' || sortBy !== 'popular' || releaseDateFilter !== 'all';

  // Calculate search matches separately from other filters
  const searchFilteredModels = useMemo(() => {
    if (!debouncedSearchTerm) return deduplicatedModels;

    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return deduplicatedModels.filter((model) => {
      return (model.name || '').toLowerCase().includes(lowerSearch) ||
        (model.description || '').toLowerCase().includes(lowerSearch) ||
        (model.id || '').toLowerCase().includes(lowerSearch) ||
        (model.provider_slug || '').toLowerCase().includes(lowerSearch);
    });
  }, [deduplicatedModels, debouncedSearchTerm]);

  // Memoize the filtering logic separately for better performance
  const filteredModels = useMemo(() => {
    const startTime = performance.now();
    // First filter, then sort
    const filtered = searchFilteredModels.filter((model) => {
      const inputFormatMatch = selectedInputFormats.length === 0 || selectedInputFormats.every(m =>
        model.architecture?.input_modalities?.some(im => im.toLowerCase() === m.toLowerCase())
      );
      const outputFormatMatch = selectedOutputFormats.length === 0 || selectedOutputFormats.every(m =>
        model.architecture?.output_modalities?.some(om => om.toLowerCase() === m.toLowerCase())
      );
      // Include models with context_length of 0 (pending metadata sync) or within range
      const contextMatch = model.context_length === 0 ||
        (contextLengthRange[0] === 0 && contextLengthRange[1] === 1024) || // No filter applied
        (model.context_length >= contextLengthRange[0] * 1000 && model.context_length <= contextLengthRange[1] * 1000);
      // Only OpenRouter models with :free suffix are legitimately free
      const isFree = checkIsFreeModel(model);
      const avgPrice = (parseFloat(model.pricing?.prompt || '0') + parseFloat(model.pricing?.completion || '0')) / 2;
      const priceMatch = (promptPricingRange[0] === 0 && promptPricingRange[1] === 10) || // No filter applied
        isFree ||
        (avgPrice >= promptPricingRange[0] / 1000000 && avgPrice <= promptPricingRange[1] / 1000000);
      const parameterMatch = selectedParameters.length === 0 || selectedParameters.every(p => (model.supported_parameters || []).includes(p));
      const developerMatch = selectedDevelopers.length === 0 || selectedDevelopers.includes(model.provider_slug);

      // Updated gateway matching to support multiple gateways
      const modelGateways = (model.source_gateways && model.source_gateways.length > 0) ? model.source_gateways : (model.source_gateway ? [model.source_gateway] : []);
      // Normalize 'hug' to 'huggingface' for filtering
      const normalizedModelGateways = modelGateways.map(g => g === 'hug' ? 'huggingface' : g);
      const gatewayMatch = selectedGateways.length === 0 ||
        selectedGateways.some(g => normalizedModelGateways.includes(g));

      const seriesMatch = selectedModelSeries.length === 0 || selectedModelSeries.includes(getModelSeries(model));
      const pricingMatch = pricingFilter === 'all' || (pricingFilter === 'free' && isFree) || (pricingFilter === 'paid' && !isFree);

      // Privacy filter
      const privacyMatch = privacyFilter === 'all' ||
        (privacyFilter === 'private' && model.is_private === true) ||
        (privacyFilter === 'public' && (model.is_private === false || model.is_private === undefined));

      // Release date filter
      const now = Date.now() / 1000; // Convert to Unix timestamp
      const created = model.created || 0;
      let releaseDateMatch = true;
      if (releaseDateFilter === 'last-30-days') {
        releaseDateMatch = created > 0 && created >= now - (30 * 24 * 60 * 60);
      } else if (releaseDateFilter === 'last-90-days') {
        releaseDateMatch = created > 0 && created >= now - (90 * 24 * 60 * 60);
      } else if (releaseDateFilter === 'last-6-months') {
        releaseDateMatch = created > 0 && created >= now - (180 * 24 * 60 * 60);
      } else if (releaseDateFilter === 'last-year') {
        releaseDateMatch = created > 0 && created >= now - (365 * 24 * 60 * 60);
      }

      return inputFormatMatch && outputFormatMatch && contextMatch && priceMatch && parameterMatch && developerMatch && gatewayMatch && seriesMatch && pricingMatch && privacyMatch && releaseDateMatch;
    });

    // Then sort the filtered results
    const sorted = [...filtered];
    sorted.sort((a, b) => {
        switch (sortBy) {
            case 'popular':
                // Sort by number of gateways (more gateways = more popular)
                const aGateways = (a.source_gateways && a.source_gateways.length > 0) ? a.source_gateways.length : (a.source_gateway ? 1 : 0);
                const bGateways = (b.source_gateways && b.source_gateways.length > 0) ? b.source_gateways.length : (b.source_gateway ? 1 : 0);
                return bGateways - aGateways;
            case 'newest':
                // Sort by creation date (newest first)
                return (b.created || 0) - (a.created || 0);
            case 'tokens-desc':
                return b.context_length - a.context_length;
            case 'tokens-asc':
                return a.context_length - b.context_length;
            case 'price-desc':
                return (parseFloat(b.pricing?.prompt || '0') + parseFloat(b.pricing?.completion || '0')) - (parseFloat(a.pricing?.prompt || '0') + parseFloat(a.pricing?.completion || '0'));
            case 'price-asc':
                return (parseFloat(a.pricing?.prompt || '0') + parseFloat(a.pricing?.completion || '0')) - (parseFloat(b.pricing?.prompt || '0') + parseFloat(b.pricing?.completion || '0'));
            default:
                return 0;
        }
    });

    const endTime = performance.now();
    console.log(`[Models] Filtering took ${(endTime - startTime).toFixed(2)}ms (${sorted.length} results)`);
    return sorted;
  }, [searchFilteredModels, selectedInputFormats, selectedOutputFormats, contextLengthRange, promptPricingRange, selectedParameters, selectedDevelopers, selectedGateways, selectedModelSeries, pricingFilter, privacyFilter, sortBy, releaseDateFilter, getModelSeries]);

  // Visible models for infinite scroll
  const visibleModels = useMemo(() => {
    return filteredModels.slice(0, visibleCount);
  }, [filteredModels, visibleCount]);

  const hasMore = visibleCount < filteredModels.length;

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(24);
  }, [searchTerm, selectedInputFormats, selectedOutputFormats, contextLengthRange, promptPricingRange, selectedParameters, selectedDevelopers, selectedGateways, selectedModelSeries, pricingFilter, privacyFilter, sortBy, releaseDateFilter]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount(prev => Math.min(prev + itemsPerPage, filteredModels.length));
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, filteredModels.length, itemsPerPage]);

  const allInputFormatsWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    deduplicatedModels.forEach(m => {
      (m.architecture?.input_modalities || []).forEach(format => {
        if (format) counts[format] = (counts[format] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([format, count]) => ({ value: format, count }));
  }, [deduplicatedModels]);

  const allOutputFormatsWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    deduplicatedModels.forEach(m => {
      (m.architecture?.output_modalities || []).forEach(format => {
        if (format) counts[format] = (counts[format] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([format, count]) => ({ value: format, count }));
  }, [deduplicatedModels]);

  const pricingCounts = useMemo(() => {
    let freeCount = 0;
    let paidCount = 0;
    deduplicatedModels.forEach(m => {
      // Only OpenRouter models with :free suffix are legitimately free
      if (checkIsFreeModel(m)) {
        freeCount++;
      } else {
        paidCount++;
      }
    });
    return { free: freeCount, paid: paidCount, all: deduplicatedModels.length };
  }, [deduplicatedModels]);

  const privacyCounts = useMemo(() => {
    let privateCount = 0;
    let publicCount = 0;
    deduplicatedModels.forEach(m => {
      if (m.is_private === true) {
        privateCount++;
      } else {
        publicCount++;
      }
    });
    return { private: privateCount, public: publicCount, all: deduplicatedModels.length };
  }, [deduplicatedModels]);

  const allParametersWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    deduplicatedModels.forEach(m => {
      (m.supported_parameters || []).forEach(p => {
        counts[p] = (counts[p] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([param, count]) => ({ value: param, count }));
  }, [deduplicatedModels]);

  const allDevelopersWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    deduplicatedModels.forEach(m => {
      if (m.provider_slug) {
        counts[m.provider_slug] = (counts[m.provider_slug] || 0) + 1;
      }
    });

    // Filter out nonsensical alphanumeric AIMO provider IDs (e.g., "vTdFo728T1zRvBUGMYGfvvVBgewzvZDbpdXekVBMi7N")
    // These are long base58-encoded strings that aren't human-readable researcher names
    // We keep entries that:
    // 1. Are not purely alphanumeric (contain hyphens, underscores, etc.)
    // 2. OR are short (less than 30 chars - most real provider slugs are short)
    // 3. OR contain common patterns like slashes, dots, or spaces
    const filteredEntries = Object.entries(counts).filter(([dev]) => {
      // If it contains non-alphanumeric characters (hyphens, slashes, etc.), keep it
      if (/[^a-zA-Z0-9]/.test(dev)) {
        return true;
      }
      // If it's short, it's probably a real slug
      if (dev.length < 30) {
        return true;
      }
      // Otherwise, it's likely a nonsensical base58 AIMO ID
      return false;
    });

    return filteredEntries
      .sort((a, b) => b[1] - a[1])
      .map(([dev, count]) => ({ value: dev, count }));
  }, [deduplicatedModels]);

  const allGatewaysWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    deduplicatedModels.forEach(m => {
      const gateways = (m.source_gateways && m.source_gateways.length > 0) ? m.source_gateways : (m.source_gateway ? [m.source_gateway] : []);
      gateways.forEach(gateway => {
        if (gateway) {
          // Normalize 'hug' to 'huggingface' for consistent grouping
          const normalizedGateway = gateway === 'hug' ? 'huggingface' : gateway;
          counts[normalizedGateway] = (counts[normalizedGateway] || 0) + 1;
        }
      });
    });

    // Use getAllActiveGatewayIds() to include dynamically registered gateways
    // To add a new gateway, simply add it to src/lib/gateway-registry.ts
    const allKnownGateways = getAllActiveGatewayIds();

    // Log gateway counts for debugging
    const gatewayStats = allKnownGateways.map(g => ({
      gateway: g,
      modelCount: counts[g] || 0
    }));
    console.log('📊 All Gateway Model Counts:', gatewayStats);
    const emptyGateways = gatewayStats.filter(s => s.modelCount === 0).map(s => s.gateway);
    if (emptyGateways.length > 0) {
      console.warn('⚠️ Gateways with 0 models (may need backend fixes):', emptyGateways);
    }

    // Include all known gateways, even if they have 0 models
    // This ensures users can see all available gateways and understand the complete picture
    const allGatewaysWithCounts = allKnownGateways.map(gateway => ({
      value: gateway,
      count: counts[gateway] || 0
    }));

    // Sort by count descending, but keep gateways with 0 models at the end
    return allGatewaysWithCounts.sort((a, b) => {
      // If both have models or both don't, sort by count
      if ((a.count > 0 && b.count > 0) || (a.count === 0 && b.count === 0)) {
        return b.count - a.count;
      }
      // Put gateways with models before those without
      return a.count > 0 ? -1 : 1;
    });
  }, [deduplicatedModels]);

  const allModelSeriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    deduplicatedModels.forEach(m => {
      const series = getModelSeries(m);
      counts[series] = (counts[series] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([series, count]) => ({ value: series, count }));
  }, [deduplicatedModels, getModelSeries]);


  return (
    <SidebarProvider>
      <div className="relative flex w-full justify-center">
        <Sidebar
          variant="sidebar"
          collapsible="offcanvas"
        >
          <SidebarContent className="p-4 pb-20 overflow-y-auto">
            <SidebarGroup>
              <SidebarGroupLabel>Input Formats</SidebarGroupLabel>
              <div className="flex flex-col gap-2">
                {allInputFormatsWithCounts.map((item) => {
                  const icon = item.value.toLowerCase() === 'text' ? <BookText className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'image' ? <ImageIcon className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'file' ? <FileText className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'audio' ? <Music className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'video' ? <Video className="w-4 h-4"/> :
                               item.value.toLowerCase() === '3d' ? <Box className="w-4 h-4"/> : null;
                  return (
                    <div key={item.value} className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <Checkbox
                          id={`input-${item.value.toLowerCase()}`}
                          checked={selectedInputFormats.includes(item.value)}
                          onCheckedChange={(c) => handleCheckboxChange(setSelectedInputFormats)(item.value, !!c)}
                        />
                        <Label htmlFor={`input-${item.value.toLowerCase()}`} className="flex items-center gap-2 font-normal capitalize cursor-pointer">
                          {icon}{item.value}
                        </Label>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">({item.count})</span>
                    </div>
                  );
                })}
              </div>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Output Formats</SidebarGroupLabel>
              <div className="flex flex-col gap-2">
                {allOutputFormatsWithCounts.map((item) => {
                  const icon = item.value.toLowerCase() === 'text' ? <BookText className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'image' ? <ImageIcon className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'file' ? <FileText className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'audio' ? <Music className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'video' ? <Video className="w-4 h-4"/> :
                               item.value.toLowerCase() === '3d' ? <Box className="w-4 h-4"/> : null;
                  return (
                    <div key={item.value} className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <Checkbox
                          id={`output-${item.value.toLowerCase()}`}
                          checked={selectedOutputFormats.includes(item.value)}
                          onCheckedChange={(c) => handleCheckboxChange(setSelectedOutputFormats)(item.value, !!c)}
                        />
                        <Label htmlFor={`output-${item.value.toLowerCase()}`} className="flex items-center gap-2 font-normal capitalize cursor-pointer">
                          {icon}{item.value}
                        </Label>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">({item.count})</span>
                    </div>
                  );
                })}
              </div>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Pricing</SidebarGroupLabel>
              <Select value={pricingFilter} onValueChange={(value: 'all' | 'free' | 'paid') => setPricingFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All models ({pricingCounts.all})</SelectItem>
                  <SelectItem value="free">Free only ({pricingCounts.free})</SelectItem>
                  <SelectItem value="paid">Paid only ({pricingCounts.paid})</SelectItem>
                </SelectContent>
              </Select>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Privacy</SidebarGroupLabel>
              <Select value={privacyFilter} onValueChange={(value: 'all' | 'private' | 'public') => setPrivacyFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All models ({privacyCounts.all})</SelectItem>
                  <SelectItem value="private">Private only ({privacyCounts.private})</SelectItem>
                  <SelectItem value="public">Public only ({privacyCounts.public})</SelectItem>
                </SelectContent>
              </Select>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Release Date</SidebarGroupLabel>
              <Select value={releaseDateFilter} onValueChange={setReleaseDateFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="last-30-days">Last 30 days</SelectItem>
                  <SelectItem value="last-90-days">Last 90 days</SelectItem>
                  <SelectItem value="last-6-months">Last 6 months</SelectItem>
                  <SelectItem value="last-year">Last year</SelectItem>
                </SelectContent>
              </Select>
            </SidebarGroup>

            <FilterRangeSlider label="Context Length" value={contextLengthRange} onValueChange={setContextLengthRange} min={4} max={1024} step={4} unit="K" />
            <FilterRangeSlider label="Prompt Pricing" value={promptPricingRange} onValueChange={setPromptPricingRange} min={0} max={10} step={0.1} unit="$" />

            <FilterDropdown
              label="Parameters"
              items={allParametersWithCounts}
              selectedItems={selectedParameters}
              onSelectionChange={handleCheckboxChange(setSelectedParameters)}
              icon={<SlidersIcon className="w-4 h-4"/>}
            />
            <FilterDropdown
              label="Model Series"
              items={allModelSeriesWithCounts}
              selectedItems={selectedModelSeries}
              onSelectionChange={handleCheckboxChange(setSelectedModelSeries)}
              icon={<Bot className="w-4 h-4"/>}
            />
            <FilterDropdown
              label="Researcher"
              items={allDevelopersWithCounts}
              selectedItems={selectedDevelopers}
              onSelectionChange={handleCheckboxChange(setSelectedDevelopers)}
              icon={<Bot className="w-4 h-4"/>}
            />
            <FilterDropdown
              label="Gateway"
              items={allGatewaysWithCounts}
              selectedItems={selectedGateways}
              onSelectionChange={handleCheckboxChange(setSelectedGateways)}
              icon={<Bot className="w-4 h-4"/>}
            />
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="flex-1 overflow-x-hidden flex flex-col">
          <div data-models-container className="w-full pb-24 overflow-x-hidden -mt-[115px] has-onboarding-banner:-mt-[115px]">
          <div data-models-header className="sticky z-25 bg-background border-b flex flex-col gap-3 w-full px-4 sm:px-6 lg:px-8 pt-3 pb-3 top-[65px] has-onboarding-banner:top-[125px]" style={{ transition: 'top 0.3s ease' }}>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-3 flex-1 min-w-0 w-full lg:w-auto">
                <SidebarTrigger className="lg:hidden" />
                <h1 className="text-2xl font-bold whitespace-nowrap">Models</h1>
                {isLoadingMore && (
                  <Badge variant="secondary" className="text-xs animate-pulse">
                    Loading more...
                  </Badge>
                )}
                <div className="relative flex-1 max-w-md ml-auto lg:ml-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter models"
                    className="pl-9 bg-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 w-full lg:w-auto justify-between lg:justify-end">
                <span className={`text-sm whitespace-nowrap ${isLoadingModels || isLoadingMore ? 'shimmer-text' : 'text-muted-foreground'}`}>
                  {isLoadingModels || isLoadingMore
                    ? `${deduplicatedModels.length} models available,  loading...`
                    : `${filteredModels.length} / ${deduplicatedModels.length} models`
                  }
                </span>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="whitespace-nowrap">Clear All Filters</Button>
                  )}
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popular">Popular</SelectItem>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="tokens-desc">Tokens (High to Low)</SelectItem>
                      <SelectItem value="tokens-asc">Tokens (Low to High)</SelectItem>
                      <SelectItem value="price-desc">Price (High to Low)</SelectItem>
                      <SelectItem value="price-asc">Price (Low to High)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="hidden lg:flex items-center gap-1 bg-muted p-1 rounded-md">
                    <Button
                      variant={layout === 'grid' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setLayout('grid')}
                      className="h-8 w-8"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={layout === 'list' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setLayout('list')}
                      className="h-8 w-8"
                    >
                      <LayoutList className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Filters */}
            <div className="flex flex-wrap gap-2">
              {selectedInputFormats.map(format => (
                <Badge key={`input-${format}`} variant="secondary" className="gap-1">
                  Input: {format}
                  <button onClick={() => setSelectedInputFormats(prev => prev.filter(f => f !== format))} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedOutputFormats.map(format => (
                <Badge key={`output-${format}`} variant="secondary" className="gap-1">
                  Output: {format}
                  <button onClick={() => setSelectedOutputFormats(prev => prev.filter(f => f !== format))} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {pricingFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {pricingFilter === 'free' ? 'Free only' : 'Paid only'}
                  <button onClick={() => setPricingFilter('all')} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {privacyFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {privacyFilter === 'private' ? 'Private only' : 'Public only'}
                  <button onClick={() => setPrivacyFilter('all')} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {releaseDateFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {releaseDateFilter === 'last-30-days' && 'Last 30 days'}
                  {releaseDateFilter === 'last-90-days' && 'Last 90 days'}
                  {releaseDateFilter === 'last-6-months' && 'Last 6 months'}
                  {releaseDateFilter === 'last-year' && 'Last year'}
                  <button onClick={() => setReleaseDateFilter('all')} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {(contextLengthRange[0] !== 0 || contextLengthRange[1] !== 1024) && (
                <Badge variant="secondary" className="gap-1">
                  Context: {contextLengthRange[0]}K-{contextLengthRange[1]}K tokens
                  <button onClick={() => setContextLengthRange([0, 1024])} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {(promptPricingRange[0] !== 0 || promptPricingRange[1] !== 10) && (
                <Badge variant="secondary" className="gap-1">
                  Price: ${promptPricingRange[0]}-${promptPricingRange[1]}/M tokens
                  <button onClick={() => setPromptPricingRange([0, 10])} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedParameters.map(param => (
                <Badge key={param} variant="secondary" className="gap-1">
                  {param}
                  <button onClick={() => setSelectedParameters(prev => prev.filter(p => p !== param))} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedModelSeries.map(series => (
                <Badge key={series} variant="secondary" className="gap-1">
                  {series}
                  <button onClick={() => setSelectedModelSeries(prev => prev.filter(s => s !== series))} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedDevelopers.map(developer => (
                <Badge key={developer} variant="secondary" className="gap-1">
                  Researcher: {developer}
                  <button onClick={() => setSelectedDevelopers(prev => prev.filter(d => d !== developer))} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedGateways.map(gateway => (
                <Badge key={gateway} variant="secondary" className="gap-1">
                  Gateway: {gateway}
                  <button onClick={() => setSelectedGateways(prev => prev.filter(g => g !== gateway))} className="ml-1 hover:bg-muted rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div data-models-list className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mt-20 has-onboarding-banner:mt-40" style={{ transition: 'margin-top 0.3s ease' }}>
          <div
            className={
              layout === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 overflow-x-hidden'
                : 'flex flex-col gap-4 lg:gap-6 overflow-x-hidden'
            }
            key={`models-${filteredModels.length}-${debouncedSearchTerm}`}
          >
            {visibleModels.map((model, key) => (
              <ModelCard key={key} model={model} />
            ))}
          </div>

          {/* No results message */}
          {filteredModels.length === 0 && !isLoadingModels && !isLoadingMore && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="text-center max-w-md">
                <h3 className="text-lg font-semibold mb-2">No models found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedGateways.includes('cerebras') ? (
                    <>
                      The Cerebras gateway is experiencing data issues. Please try selecting a different gateway or <button onClick={resetFilters} className="text-primary hover:underline">clear all filters</button>.
                    </>
                  ) : (
                    <>
                      Try adjusting your filters or <button onClick={resetFilters} className="text-primary hover:underline">clearing all filters</button> to see more models.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Infinite Scroll Trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                Loading more models... ({visibleCount} of {filteredModels.length})
              </div>
            </div>
          )}

          {/* End of results */}
          {!hasMore && filteredModels.length > 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="text-sm text-muted-foreground">
                Showing all {filteredModels.length} models
              </div>
              <Link href="/releases" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                What's new
              </Link>
            </div>
          )}
          </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

const FilterSlider = ({ label, value, onValueChange, min, max, step, unit }: { label: string, value: number, onValueChange: (value: number) => void, min: number, max: number, step: number, unit: string }) => {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onValueChange(v[0])} />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{min}{unit}</span>
                <span>{value}{unit}</span>
                <span>{max}{unit}+</span>
            </div>
        </SidebarGroup>
    );
};

const FilterRangeSlider = React.memo(function FilterRangeSlider({ label, value, onValueChange, min, max, step, unit }: { label: string, value: [number, number], onValueChange: (value: [number, number]) => void, min: number, max: number, step: number, unit: string }) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <Slider value={value} min={min} max={max} step={step} onValueChange={onValueChange} />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{value[0]}{unit}</span>
                <span>to</span>
                <span>{value[1]}{unit}{value[1] === max ? '+' : ''}</span>
            </div>
        </SidebarGroup>
    );
});

const FilterDropdown = ({ label, items, icon, selectedItems, onSelectionChange }: { label: string, items: { value: string, count: number }[], icon: React.ReactNode, selectedItems: string[], onSelectionChange: (value: string, checked: boolean) => void }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = items.filter(item =>
    item.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedItems = showAll ? filteredItems : filteredItems.slice(0, 5);
  const hasMore = filteredItems.length > 5;

  return (
    <SidebarGroup>
      <button onClick={() => setIsOpen(!isOpen)} className="w-full">
        <SidebarGroupLabel className="flex justify-between items-center cursor-pointer">
            <span className="flex items-center gap-2">{icon} {label}</span>
            {isOpen ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </SidebarGroupLabel>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-2 mt-2">
          {items.length > 5 && (
            <Input
              placeholder={`Search ${label.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm"
            />
          )}
          {displayedItems.map((item) => (
            <div key={item.value} className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <Checkbox id={item.value.toLowerCase()} checked={selectedItems.includes(item.value)} onCheckedChange={(c) => onSelectionChange(item.value, !!c)} />
                <Label htmlFor={item.value.toLowerCase()} className="font-normal truncate cursor-pointer">{item.value}</Label>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">({item.count})</span>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div className="text-sm text-muted-foreground py-2">No matches found</div>
          )}
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
            >
              {showAll ? 'Show less...' : `Show ${filteredItems.length - 5} more...`}
            </button>
          )}
        </div>
      )}
    </SidebarGroup>
  );
};
