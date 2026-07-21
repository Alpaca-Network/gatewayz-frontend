
"use client";

import { useState, useMemo, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Bot } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Link from 'next/link';
import { getModelUrl } from '@/lib/utils';
import { useModels } from '@/lib/hooks/use-catalog';

interface SearchBarProps {
    autoOpenOnFocus?: boolean;
}

export function SearchBar({ autoOpenOnFocus = true }: SearchBarProps) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [shouldFetchModels, setShouldFetchModels] = useState(false);
    const fetchTriggeredRef = useRef(false);

    // DB-backed catalog (North Star) — single call to fetch models from all
    // gateways, cached client-side by react-query (5 min staleTime).
    const { data: allModels = [], isLoading: loading } = useModels(
        { gateway: 'all', limit: 1000 },
        { enabled: shouldFetchModels }
    );

    const enableModelFetch = useCallback(() => {
        if (fetchTriggeredRef.current) {
            return;
        }
        fetchTriggeredRef.current = true;
        setShouldFetchModels(true);
    }, []);

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
            <div className="relative w-full">
                <Input
                    type="search"
                    placeholder="Search Models..."
                    className="pl-3 pr-10 h-[45px] w-full"
                    onFocus={() => {
                        if (autoOpenOnFocus) {
                            setOpen(true);
                        }
                        enableModelFetch();
                    }}
                    onClick={() => {
                        setOpen(true);
                        enableModelFetch();
                    }}
                    value={searchTerm}
                    onChange={(e) => {
                        enableModelFetch();
                        setSearchTerm(e.target.value);
                    }}
                />
                {/* <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> */}
                <img src="/material-symbols_search.svg" alt="Search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" style={{ width: "24px", height: "24px" }} />
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
                                // Generate clean URL in format /models/[developer]/[model]
                                const modelUrl = getModelUrl(model.id, model.provider_slug);

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
