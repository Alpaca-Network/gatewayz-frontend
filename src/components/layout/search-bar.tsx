
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Bot } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Link from 'next/link';
import { models as staticModels } from '@/lib/models-data';

interface Model {
    id: string;
    name: string;
    description?: string;
    provider_slug?: string;
}

export function SearchBar() {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [allModels, setAllModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(false);

    // Transform static models to the format we need
    const staticModelsList = useMemo(() =>
        staticModels.map(m => ({
            id: `${m.developer}/${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name: m.name,
            description: m.description,
            provider_slug: m.developer
        })),
        []
    );

    // Load models from cache or API
    useEffect(() => {
        const CACHE_KEY = 'gatewayz_models_cache_v4_all_gateways';
        const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

        // Start with static models for instant search
        setAllModels(staticModelsList);

        const fetchModels = async () => {
            try {
                // Check cache first
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    try {
                        const { data, timestamp } = JSON.parse(cached);
                        if (Date.now() - timestamp < CACHE_DURATION) {
                            setAllModels(data);
                            return;
                        }
                    } catch (e) {
                        console.log('Cache parse error:', e);
                    }
                }

                // Fetch from API in background
                setLoading(true);
                const [openrouterRes, portkeyRes, featherlessRes] = await Promise.allSettled([
                    fetch(`/api/models?gateway=openrouter`),
                    fetch(`/api/models?gateway=portkey`),
                    fetch(`/api/models?gateway=featherless`)
                ]);

                const getData = async (result: PromiseSettledResult<Response>) => {
                    if (result.status === 'fulfilled') {
                        try {
                            const data = await result.value.json();
                            return data.data || [];
                        } catch (e) {
                            return [];
                        }
                    }
                    return [];
                };

                const [openrouterData, portkeyData, featherlessData] = await Promise.all([
                    getData(openrouterRes),
                    getData(portkeyRes),
                    getData(featherlessRes)
                ]);

                const combinedModels = [...openrouterData, ...portkeyData, ...featherlessData];

                // Deduplicate by ID
                const uniqueModelsMap = new Map();
                combinedModels.forEach((model: any) => {
                    if (!uniqueModelsMap.has(model.id)) {
                        uniqueModelsMap.set(model.id, model);
                    }
                });
                const models = Array.from(uniqueModelsMap.values());

                setAllModels(models);

                // Cache the results
                try {
                    const compactModels = models.map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        description: m.description?.substring(0, 100),
                        provider_slug: m.provider_slug
                    }));
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        data: compactModels,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.log('Failed to cache models');
                }
            } catch (error) {
                console.log('Failed to fetch models:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchModels();
    }, [staticModelsList]);

    const filteredModels = useMemo(() => {
        if (!searchTerm) return allModels.slice(0, 10);

        const term = searchTerm.toLowerCase();
        return allModels.filter(model =>
            model.name.toLowerCase().includes(term) ||
            model.id.toLowerCase().includes(term) ||
            model.provider_slug?.toLowerCase().includes(term)
        ).slice(0, 10);
    }, [searchTerm, allModels]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className="relative w-full max-w-sm">
                <Input
                    type="search"
                    placeholder="Search Models..."
                    className="pl-3 pr-4 h-[45px]"
                    onFocus={() => setOpen(true)}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {/* <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> */}
                <img src="/material-symbols_search.svg" alt="Search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" style={{ width: "24px", height: "24px" }} />
                {/* <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground border rounded-sm px-1.5 py-0.5">/</div> */}
                <PopoverTrigger asChild>
                    <div className="absolute inset-0 pointer-events-none" />
                </PopoverTrigger>
            </div>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-1 max-h-[400px] overflow-y-auto">
                 <div className="flex flex-col">
                    <p className="text-xs font-medium text-muted-foreground px-3 py-2">
                        {searchTerm ? `Search Results (${filteredModels.length})` : 'Popular Models'}
                        {loading && ' • Loading...'}
                    </p>
                    <div className="flex flex-col">
                        {filteredModels.length > 0 ? (
                            filteredModels.map(model => {
                                // Split model ID to preserve literal slash in URL (e.g., "provider/model-name")
                                const modelUrl = model.id.includes('/')
                                    ? `/models/${model.id}`
                                    : `/models/${encodeURIComponent(model.id)}`;
                                
                                return (
                                <Link
                                    key={model.id}
                                    href={modelUrl}
                                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent"
                                    onClick={() => {
                                        setOpen(false);
                                        setSearchTerm('');
                                    }}
                                >
                                    <Bot className="h-5 w-5 flex-shrink-0"/>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-sm font-medium truncate">{model.name}</span>
                                        <span className="text-xs text-muted-foreground truncate">{model.id}</span>
                                    </div>
                                </Link>
                                );
                            })
                        ) : searchTerm ? (
                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                No models found for "{searchTerm}"
                            </div>
                        ) : null}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
