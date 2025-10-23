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
import { BookText, Bot, ChevronDown, ChevronUp, FileText, ImageIcon, LayoutGrid, LayoutList, Music, Search, Sliders as SlidersIcon, X, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { stringToColor } from '@/lib/utils';
import ReactMarkdown from "react-markdown";


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
  source_gateways?: string[]; // Updated to array
  source_gateway?: string; // Keep for backwards compatibility
  created?: number;
}

// Gateway display configuration
const GATEWAY_CONFIG: Record<string, { name: string; color: string; icon?: React.ReactNode }> = {
  openrouter: { name: 'OpenRouter', color: 'bg-blue-500' },
  portkey: { name: 'Portkey', color: 'bg-purple-500' },
  featherless: { name: 'Featherless', color: 'bg-green-500' },
  groq: { name: 'Groq', color: 'bg-orange-500', icon: <Zap className="w-3 h-3" /> },
  together: { name: 'Together', color: 'bg-indigo-500' },
  fireworks: { name: 'Fireworks', color: 'bg-red-500' },
  chutes: { name: 'Chutes', color: 'bg-yellow-500' },
  deepinfra: { name: 'DeepInfra', color: 'bg-cyan-500' },
  // New Portkey SDK providers
  google: { name: 'Google', color: 'bg-blue-600' },
  cerebras: { name: 'Cerebras', color: 'bg-amber-600' },
  nebius: { name: 'Nebius', color: 'bg-slate-600' },
  xai: { name: 'xAI', color: 'bg-black' },
  novita: { name: 'Novita', color: 'bg-violet-600' },
  huggingface: { name: 'Hugging Face', color: 'bg-yellow-600' },
  hug: { name: 'Hugging Face', color: 'bg-yellow-600' }, // Backend uses 'hug' abbreviation
  aimo: { name: 'AiMo', color: 'bg-pink-600' },
  near: { name: 'NEAR', color: 'bg-teal-600' }
};

const ModelCard = React.memo(function ModelCard({ model }: { model: Model }) {
  const isFree = parseFloat(model.pricing?.prompt || '0') === 0 && parseFloat(model.pricing?.completion || '0') === 0;
  const inputCost = (parseFloat(model.pricing?.prompt || '0') * 1000000).toFixed(2);
  const outputCost = (parseFloat(model.pricing?.completion || '0') * 1000000).toFixed(2);
  const contextK = model.context_length > 0 ? Math.round(model.context_length / 1000) : 0;

  // Determine if model is multi-lingual (simple heuristic - can be improved)
  const isMultiLingual = model.architecture?.input_modalities?.includes('text') &&
                         (model.name.toLowerCase().includes('multilingual') ||
                          model.description?.toLowerCase().includes('multilingual') ||
                          model.description?.toLowerCase().includes('multi-lingual'));

  // Get gateways - support both old and new format
  const gateways = (model.source_gateways && model.source_gateways.length > 0) ? model.source_gateways : (model.source_gateway ? [model.source_gateway] : []);

  // Generate clean URLs:
  // - For AIMO models (providerId:model-name), extract just the model name after the colon
  // - For regular models with slashes (provider/model-name), keep the slash
  // - Otherwise, use the full ID
  let modelUrl: string;
  if (model.id.includes(':')) {
    // AIMO model - extract model name after the colon
    const modelName = model.id.split(':')[1] || model.id;
    modelUrl = `/models/${encodeURIComponent(modelName)}`;
  } else if (model.id.includes('/')) {
    // Regular provider/model format - preserve the slash
    modelUrl = `/models/${model.id}`;
  } else {
    // Single-part ID - encode it
    modelUrl = `/models/${encodeURIComponent(model.id)}`;
  }

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
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground flex-grow line-clamp-2 mb-4 overflow-hidden break-words">
          {model.description || 'Explore Token Usage Across Models, Labs, And Public Applications.'}
        </p>

        {/* Gateways - New section */}
        {gateways.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {gateways.slice(0, 3).map((gateway) => {
              const config = GATEWAY_CONFIG[gateway.toLowerCase()] || {
                name: gateway,
                color: 'bg-gray-500'
              };
              return (
                <Badge
                  key={gateway}
                  className={`${config.color} text-white text-[10px] px-1.5 py-0 h-5 flex items-center gap-0.5`}
                  variant="secondary"
                >
                  {config.icon}
                  {config.name}
                </Badge>
              );
            })}
            {gateways.length > 3 && (
              <Badge
                className="bg-gray-500 text-white text-[10px] px-1.5 py-0 h-5"
                variant="secondary"
              >
                +{gateways.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Bottom metadata row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t pt-3">
          <span className="flex items-center gap-1">
            By <span className="font-medium text-foreground">{model.provider_slug}</span>
          </span>
          <span className="font-medium">{contextK > 0 ? `${contextK}M Tokens` : '0M Tokens'}</span>
          <span className="font-medium">{contextK > 0 ? `${contextK}K Context` : '0K Context'}</span>
          <span className="font-medium">${inputCost}/M Input</span>
          <span className="font-medium">${outputCost}/M Output</span>
        </div>
      </Card>
    </Link>
  );
});

export default function ModelsClient({ initialModels }: { initialModels: Model[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Client-side model fetching state
  const [models, setModels] = useState<Model[]>(initialModels);
  const [isLoadingModels, setIsLoadingModels] = useState(initialModels.length < 50);

  // Infinite scroll state - Reduced for faster initial load
  const [itemsPerPage] = useState(24); // Load 24 models at a time
  const [visibleCount, setVisibleCount] = useState(24); // Number of items currently visible
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // Fetch models client-side if we only got the fallback static models
  useEffect(() => {
    if (initialModels.length < 50) {
      console.log('[Models] Only got', initialModels.length, 'models from server, fetching from client...');
      setIsLoadingModels(true);

      fetch('/api/models?gateway=all&limit=50000')
        .then(res => res.json())
        .then(data => {
          if (data.data && data.data.length > 0) {
            console.log(`[Models] Fetched ${data.data.length} models from client`);
            setModels(data.data);
          }
        })
        .catch(err => {
          console.error('[Models] Client fetch failed:', err);
        })
        .finally(() => {
          setIsLoadingModels(false);
        });
    }
  }, [initialModels.length]);

  // Additional deduplication as a safety measure
  const deduplicatedModels = useMemo(() => {
    console.log(`Models for deduplication: ${models.length}`);
    const seen = new Set<string>();
    const deduplicated = models.filter(model => {
      if (seen.has(model.id)) {
        console.warn(`Duplicate model ID found: ${model.id}`);
        return false;
      }
      seen.add(model.id);
      return true;
    });
    console.log(`After client-side deduplication: ${deduplicated.length} unique models`);
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
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'tokens-desc');
  const [releaseDateFilter, setReleaseDateFilter] = useState<string>(searchParams.get('releaseDate') || 'all');

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
          }
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

  // Update URL parameters when filters change
  useEffect(() => {
    const params = new URLSearchParams();

    if (searchTerm) params.set('search', searchTerm);
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
    if (sortBy !== 'tokens-desc') params.set('sortBy', sortBy);
    if (releaseDateFilter !== 'all') params.set('releaseDate', releaseDateFilter);

    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : '/models', { scroll: false });
  }, [searchTerm, selectedInputFormats, selectedOutputFormats, contextLengthRange, promptPricingRange, selectedParameters, selectedDevelopers, selectedGateways, selectedModelSeries, pricingFilter, sortBy, releaseDateFilter, router]);

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
    setSortBy('tokens-desc');
    setReleaseDateFilter('all');
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || selectedInputFormats.length > 0 || selectedOutputFormats.length > 0 ||
    contextLengthRange[0] !== 0 || contextLengthRange[1] !== 1024 ||
    promptPricingRange[0] !== 0 || promptPricingRange[1] !== 10 ||
    selectedParameters.length > 0 ||
    selectedDevelopers.length > 0 || selectedGateways.length > 0 || selectedModelSeries.length > 0 || pricingFilter !== 'all' || sortBy !== 'tokens-desc' || releaseDateFilter !== 'all';

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
      const isFree = parseFloat(model.pricing?.prompt || '0') === 0 && parseFloat(model.pricing?.completion || '0') === 0;
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

      return inputFormatMatch && outputFormatMatch && contextMatch && priceMatch && parameterMatch && developerMatch && gatewayMatch && seriesMatch && pricingMatch && releaseDateMatch;
    });

    // Then sort the filtered results
    const sorted = [...filtered];
    sorted.sort((a, b) => {
        switch (sortBy) {
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
  }, [searchFilteredModels, selectedInputFormats, selectedOutputFormats, contextLengthRange, promptPricingRange, selectedParameters, selectedDevelopers, selectedGateways, selectedModelSeries, pricingFilter, sortBy, getModelSeries]);

  // Visible models for infinite scroll
  const visibleModels = useMemo(() => {
    return filteredModels.slice(0, visibleCount);
  }, [filteredModels, visibleCount]);

  const hasMore = visibleCount < filteredModels.length;

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(24);
  }, [searchTerm, selectedInputFormats, selectedOutputFormats, contextLengthRange, promptPricingRange, selectedParameters, selectedDevelopers, selectedGateways, selectedModelSeries, pricingFilter, sortBy, releaseDateFilter]);

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
      const isFree = parseFloat(m.pricing?.prompt || '0') === 0 && parseFloat(m.pricing?.completion || '0') === 0;
      if (isFree) {
        freeCount++;
      } else {
        paidCount++;
      }
    });
    return { free: freeCount, paid: paidCount, all: deduplicatedModels.length };
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

    // Define all known gateways that should appear in the filter
    // This ensures all gateways are visible even if they have 0 models currently
    // Excludes 'portkey' as it's deprecated (use individual Portkey SDK providers instead)
    const allKnownGateways = ['featherless', 'openrouter', 'groq', 'together', 'fireworks', 'chutes', 'deepinfra', 'google', 'cerebras', 'nebius', 'xai', 'novita', 'huggingface', 'aimo', 'near'];

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
      <div className="relative flex w-full h-full justify-center overflow-x-hidden">
        <Sidebar
          variant="sidebar"
          collapsible="offcanvas"
        >
          <SidebarContent className="p-4 pb-20">
            <SidebarGroup>
              <SidebarGroupLabel>Input Formats</SidebarGroupLabel>
              <div className="flex flex-col gap-2">
                {allInputFormatsWithCounts.map((item) => {
                  const icon = item.value.toLowerCase() === 'text' ? <BookText className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'image' ? <ImageIcon className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'file' ? <FileText className="w-4 h-4"/> :
                               item.value.toLowerCase() === 'audio' ? <Music className="w-4 h-4"/> : null;
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
                               item.value.toLowerCase() === 'audio' ? <Music className="w-4 h-4"/> : null;
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

        <SidebarInset className="flex-1 overflow-y-auto overflow-x-hidden h-full flex flex-col">
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-x-hidden">
          <div className="flex flex-col gap-3 mb-6 w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-3">
                  <SidebarTrigger className="lg:hidden" />
                  <h1 className="text-2xl font-bold">Models</h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {`${filteredModels.length} / ${deduplicatedModels.length} models`}
                </span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>Clear All Filters</Button>
                )}
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

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                  placeholder="Filter models"
                  className="pl-9 bg-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="tokens-desc">Tokens (High to Low)</SelectItem>
                  <SelectItem value="tokens-asc">Tokens (Low to High)</SelectItem>
                  <SelectItem value="price-desc">Price (High to Low)</SelectItem>
                  <SelectItem value="price-asc">Price (Low to High)</SelectItem>
              </SelectContent>
              </Select>
              <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
              <Button
                  variant={layout === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setLayout('grid')}
              >
                  <LayoutGrid className="w-5 h-5" />
              </Button>
              <Button
                  variant={layout === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setLayout('list')}
              >
                  <LayoutList className="w-5 h-5" />
              </Button>
              </div>
          </div>

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
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                Showing all {filteredModels.length} models
              </div>
            </div>
          )}
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
