
"use client"

import { useMemo, useState, useEffect } from 'react';
import { models, type Model } from "@/lib/models-data";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, Search, ArrowRight, Package, BarChart, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type RankingModel = {
    id: number;
    rank: number;
    model_name: string;
    author: string;
    tokens: string;
    trend_percentage: string;
    trend_direction: 'up' | 'down';
    trend_icon: string;
    trend_color: string;
    model_url: string;
    author_url: string;
    time_period: string;
    scraped_at: string;
    logo_url: string;
}

type Organization = {
    id: string;
    name: string;
    author: string;
    modelCount: number;
    totalTokens: string;
    topModel: string;
    performanceChange: number;
    models: RankingModel[];
    logoUrl?: string;
}

const OrganizationCard = ({ org }: { org: Organization }) => {
    const avgTrendPercentage = org.performanceChange;
    const trendColor = avgTrendPercentage >= 0 ? 'text-green-600' : 'text-red-600';
    const trendSign = avgTrendPercentage >= 0 ? '+' : '';

    // Map author names to logo file names
    const getLogoUrl = (author: string): string | null => {
        const logoMap: Record<string, string> = {
            'openai': '/openai-logo.svg',
            'google': '/google-logo.svg',
            'anthropic': '/anthropic-logo.svg',
            'meta': '/Meta_Logo-black.svg',
            'deepseek': '/deepseek-logo.svg',
            'mistralai': '/Meta_Logo-black.svg', // Fallback until Mistral logo is added
            'x-ai': '/xai-logo.svg',
            'x ai': '/xai-logo.svg',
            'openrouter': '/OpenAI_Logo-black.svg', // Fallback until OpenRouter logo is added
        };
        return logoMap[author.toLowerCase()] || null;
    };

    const logoUrl = org.logoUrl || getLogoUrl(org.author);

    return (
        <Card className="flex flex-col bg-card border rounded-lg">
            <CardContent className="p-6 pb-2 flex-grow">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-background border overflow-hidden">
                        {logoUrl ? (
                            <img src={logoUrl} alt={org.name} className="w-10 h-10 object-contain" />
                        ) : (
                            <Bot className="w-6 h-6 text-muted-foreground" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">{org.name}</h3>
                        <p className="text-sm text-muted-foreground">{org.modelCount} Models</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold">{org.totalTokens}</p>
                            <p className="text-xs text-muted-foreground">Tokens Generated</p>
                        </div>
                        <div className="text-right">
                            <p className={`text-lg font-bold ${trendColor}`}>
                                {trendSign}{avgTrendPercentage.toFixed(2)}%
                            </p>
                            <p className="text-xs text-muted-foreground">Avg Growth</p>
                        </div>
                    </div>
                    <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">Top Model</p>
                        <p className="text-sm font-medium truncate">{org.topModel}</p>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-6 pt-4">
                <Link href={`/organizations/${encodeURIComponent(org.author)}`} className="w-full">
                    <Button variant="outline" className="w-full">
                        View Profile <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    );
};


export default function DevelopersPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<'top' | 'trending'>('top');
    const [timeFrame, setTimeFrame] = useState<'month' | 'week' | 'today'>('month');
    const [rankingModels, setRankingModels] = useState<RankingModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [organizationLogos, setOrganizationLogos] = useState<Map<string, string>>(new Map());

    const timeFrameLabels: Record<typeof timeFrame, string> = {
        month: 'Past Month',
        week: 'Past Week',
        today: 'Today',
    };

    const timeFrameMapping: Record<typeof timeFrame, string> = {
        month: 'Top this month',
        week: 'Top this week',
        today: 'Top today',
    };

    useEffect(() => {
        const fetchRankingModels = async () => {
            try {
                setLoading(true);
                const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
                const url = `${apiBaseUrl}/ranking/models`;
                console.log('Fetching ranking models from:', url);

                const response = await fetch(url);
                console.log('Response status:', response.status);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.log('Received data:', data.success, 'models count:', data.data?.length);

                if (data.success && data.data) {
                    setRankingModels(data.data);
                    console.log('Set ranking models:', data.data.length);
                }
            } catch (error) {
                console.log('Failed to fetch ranking models:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRankingModels();
    }, []);

    // Build organization logos from API response
    useEffect(() => {
        const logoMap = new Map<string, string>();
        
        // Use logo_url from the API response for each model
        rankingModels.forEach(model => {
            if (model.logo_url) {
                logoMap.set(model.author, model.logo_url);
            }
        });

        setOrganizationLogos(logoMap);
    }, [rankingModels]);

    const organizations: Organization[] = useMemo(() => {
        console.log('Processing organizations, rankingModels count:', rankingModels.length);
        console.log('Active tab:', activeTab, 'Time frame:', timeFrame);

        // Filter models by time period and tab
        const timePeriod = timeFrameMapping[timeFrame];
        console.log('Looking for time period:', timePeriod);

        const filteredModels = rankingModels.filter(model => {
            if (activeTab === 'trending') {
                return model.time_period.toLowerCase() === 'trending';
            } else {
                return model.time_period.toLowerCase() === timePeriod.toLowerCase();
            }
        });

        console.log('Filtered models count:', filteredModels.length);

        // List of gateways/providers that should not be shown as developers
        const excludedProviders = [
          'openrouter',
          'portkey',
          'featherless',
          'together',
          'fireworks',
          'chutes',
          'groq',
          'deepinfra',
          // New Portkey SDK providers
          'cerebras',
          'nebius',
          'novita',
          'huggingface'
        ];

        // Group models by author, excluding gateways
        const orgMap = new Map<string, RankingModel[]>();
        filteredModels.forEach(model => {
            const authorLower = model.author.toLowerCase();

            // Skip if this is a gateway/provider, not a model developer
            if (excludedProviders.includes(authorLower)) {
                return;
            }

            if (!orgMap.has(model.author)) {
                orgMap.set(model.author, []);
            }
            orgMap.get(model.author)!.push(model);
        });

        // Convert to Organization objects
        return Array.from(orgMap.entries()).map(([author, models]) => {
            // Parse tokens and sum them up
            const totalTokensNum = models.reduce((sum, model) => {
                const tokensStr = model.tokens.replace(/[^0-9.]/g, '');
                const multiplier = model.tokens.includes('T') ? 1000000000000 :
                                  model.tokens.includes('B') ? 1000000000 :
                                  model.tokens.includes('M') ? 1000000 : 1;
                return sum + (parseFloat(tokensStr) || 0) * multiplier;
            }, 0);

            // Format total tokens
            const formatTokens = (num: number): string => {
                if (num >= 1000000000000) return (num / 1000000000000).toFixed(1) + 'T';
                if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
                if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
                return num.toString();
            };

            // Calculate average trend percentage
            const avgTrend = models.reduce((sum, model) => {
                const trendNum = parseFloat(model.trend_percentage.replace('%', ''));
                return sum + (isNaN(trendNum) ? 0 : trendNum);
            }, 0) / models.length;

            // Get top model (highest rank, which means lowest rank number)
            const topModel = models.reduce((top, model) =>
                model.rank < top.rank ? model : top
            , models[0]);

            // Format author name for display
            const formatAuthorName = (author: string): string => {
                const formatted: Record<string, string> = {
                    'openai': 'OpenAI',
                    'anthropic': 'Anthropic',
                    'google': 'Google',
                    'qwen': 'Qwen',
                    'x-ai': 'xAI',
                    'xai': 'xAI',
                    'meta-llama': 'Meta',
                    'deepseek': 'DeepSeek',
                    'mistralai': 'Mistral AI',
                    'meta': 'Meta',
                    'cohere': 'Cohere',
                    'amazon': 'Amazon',
                    'microsoft': 'Microsoft',
                    'arcee-ai': 'Arcee AI',
                    'bytedance': 'ByteDance',
                    'cognitivecomputations': 'Cognitive Computations',
                    'nousresearch': 'Nous Research',
                    'thudm': 'THUDM',
                    'tngtech': 'TNG Technology',
                    'z-ai': 'Z.AI'
                };
                return formatted[author.toLowerCase()] || author.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            };

            return {
                id: author,
                name: formatAuthorName(author),
                author: author,
                modelCount: models.length,
                totalTokens: formatTokens(totalTokensNum),
                topModel: topModel.model_name,
                performanceChange: avgTrend,
                models: models,
                logoUrl: organizationLogos.get(author),
            };
        }).sort((a, b) => {
            // For "Top" tab, sort by total tokens generated in the time period (descending)
            if (activeTab === 'top') {
                const aTokensStr = a.totalTokens.replace(/[^0-9.]/g, '');
                const bTokensStr = b.totalTokens.replace(/[^0-9.]/g, '');

                const aMultiplier = a.totalTokens.includes('T') ? 1000000000000 :
                                   a.totalTokens.includes('B') ? 1000000000 :
                                   a.totalTokens.includes('M') ? 1000000 : 1;
                const bMultiplier = b.totalTokens.includes('T') ? 1000000000000 :
                                   b.totalTokens.includes('B') ? 1000000000 :
                                   b.totalTokens.includes('M') ? 1000000 : 1;

                const aTokens = parseFloat(aTokensStr) * aMultiplier;
                const bTokens = parseFloat(bTokensStr) * bMultiplier;

                return bTokens - aTokens;
            }

            // For "Trending" tab, use priority order matching model dropdown
            const priorityOrgs = ['OpenAI', 'Anthropic', 'Google', 'Qwen', 'xAI', 'Meta', 'DeepSeek', 'Mistral AI'];

            const aPriority = priorityOrgs.indexOf(a.name);
            const bPriority = priorityOrgs.indexOf(b.name);

            // If both are in priority list, sort by priority order
            if (aPriority !== -1 && bPriority !== -1) {
                return aPriority - bPriority;
            }

            // Priority orgs come first
            if (aPriority !== -1) return -1;
            if (bPriority !== -1) return 1;

            // For non-priority orgs, sort by total tokens (descending)
            const aTokens = parseFloat(a.totalTokens.replace(/[^0-9.]/g, ''));
            const bTokens = parseFloat(b.totalTokens.replace(/[^0-9.]/g, ''));
            return bTokens - aTokens;
        });
    }, [rankingModels, timeFrame, activeTab, organizationLogos]);

    const filteredOrgs = useMemo(() => {
        return organizations.filter(org =>
            org.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [organizations, searchTerm, activeTab]);


    return (
        <div className="min-h-[calc(100vh-130px)] bg-background pb-32">
            <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-8">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold tracking-tight">Developers</h1>
                    <p className="mt-2 text-lg text-muted-foreground">
                        Discover The Organisations Building The Future Of AI
                    </p>
                </header>
                
                <div className="max-w-xl mx-auto mb-6">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search Organisation..."
                            className="pr-9 border"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-2">
                        <Button
                            variant={activeTab === 'top' ? 'default' : 'ghost'}
                            onClick={() => setActiveTab('top')}
                            className={activeTab === 'top' ? 'bg-muted text-foreground' : ''}
                        >
                            Top
                        </Button>
                        <Button
                            variant={activeTab === 'trending' ? 'default' : 'ghost'}
                            onClick={() => setActiveTab('trending')}
                            className={activeTab === 'trending' ? 'bg-muted text-foreground' : ''}
                        >
                            Trending
                        </Button>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-[160px] justify-between">
                            {timeFrameLabels[timeFrame]} <ChevronDown className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                            <DropdownMenuItem onSelect={() => setTimeFrame('month')}>Past Month</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setTimeFrame('week')}>Past Week</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setTimeFrame('today')}>Today</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <main>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <Card key={i} className="flex flex-col bg-card border rounded-lg">
                                    <CardContent className="p-6">
                                        <div className="animate-pulse space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                                                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : filteredOrgs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredOrgs.map(org => (
                                <OrganizationCard key={org.id} org={org} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground mt-12">
                            {searchTerm ? 'No developers found matching your search.' : 'No developers found for this time period.'}
                        </p>
                    )}
                </main>
            </div>
        </div>
    );
}
