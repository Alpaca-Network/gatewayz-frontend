"use client";

import { useParams } from 'next/navigation';
import { Building, Bot, BarChart, HardHat, Package, ChevronDown, Link as LinkIcon, Github, Twitter, TrendingUp } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { useMemo, useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { addDays, format, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { stringToColor, getModelUrl } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/config';
import { getSourceGateway, formatPricingForDisplay } from '@/lib/model-pricing-utils';

interface ApiModel {
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
}

interface RankingModel {
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

const ApiModelCard = ({ model }: { model: ApiModel }) => {
  const hasPricing = model.pricing !== null && model.pricing !== undefined;
  // Get source gateway for pricing normalization
  const sourceGateway = getSourceGateway(model);
  const isFree = hasPricing && parseFloat(model.pricing?.prompt || '0') === 0 && parseFloat(model.pricing?.completion || '0') === 0;
  const inputCost = hasPricing ? formatPricingForDisplay(model.pricing?.prompt, sourceGateway) : null;
  const outputCost = hasPricing ? formatPricingForDisplay(model.pricing?.completion, sourceGateway) : null;
  const contextK = model.context_length > 0 ? Math.round(model.context_length / 1000) : 0;

  // Generate clean URL in format /models/[developer]/[model]
  const modelUrl = getModelUrl(model.id, model.provider_slug);

  return (
    <Link href={modelUrl}>
      <Card className="p-6 flex flex-col h-full hover:border-primary transition-colors">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold flex items-center gap-2 flex-wrap mb-2">
              <span className="truncate">{model.name}</span>
              {isFree && <Badge className="text-xs bg-black text-white">Free</Badge>}
              <Badge variant="secondary" className="text-xs">Multi-Lingual</Badge>
            </h3>
          </div>
          <div className="text-sm text-muted-foreground whitespace-nowrap flex-shrink-0 font-medium">{contextK > 0 ? `${contextK}K` : 'Pending'}</div>
        </div>
        <p className="text-muted-foreground text-sm flex-grow line-clamp-2 mb-4">
          {model.description || 'No description available'}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-3 border-t">
          <span className="whitespace-nowrap">{contextK > 0 ? `${contextK}K context` : 'Pending sync'}</span>
          {hasPricing ? (
            <>
              <span className="whitespace-nowrap">${inputCost}/M in</span>
              <span className="whitespace-nowrap">${outputCost}/M out</span>
            </>
          ) : (
            <span className="whitespace-nowrap text-amber-600">Contact for pricing</span>
          )}
        </div>
      </Card>
    </Link>
  );
};

const StatCard = ({ title, value, subtitle }: { title: string, value: string | number, subtitle?: string }) => (
    <Card className="bg-card border rounded-lg p-6">
        <p className="text-sm text-muted-foreground mb-2">{title}</p>
        <p className="text-3xl font-bold mb-1">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </Card>
);

type TimeFrame = 'month' | 'week' | 'today';

const generateChartData = (timeFrame: TimeFrame) => {
    const now = new Date();
    let days;
    switch(timeFrame) {
        case 'week': days = 7; break;
        case 'today': days = 1; break;
        case 'month':
        default: days = 30; break;
    }

    return Array.from({ length: days }, (_, i) => {
        const date = addDays(now, i - days + 1);
        return {
            date: format(date, 'yyyy-MM-dd'),
            tokens: Math.floor(Math.random() * 500 + 100 + (i * 2) * (365/days) )
        };
    });
};

const getTicks = (data: { date: string }[], maxTicks = 8) => {
    if (!data || data.length === 0) return [];

    const tickCount = Math.min(data.length, maxTicks);
    if (tickCount <= 1) return [data[0]?.date];
    const interval = Math.max(1, Math.floor((data.length -1) / (tickCount -1)));

    const ticks = [];
    for (let i = 0; i < data.length; i += interval) {
        ticks.push(data[i].date);
    }
    if (ticks[ticks.length - 1] !== data[data.length - 1].date) {
        if (ticks.length >= maxTicks) {
            ticks[ticks.length -1] = data[data.length - 1].date;
        } else {
            ticks.push(data[data.length - 1].date)
        }
    }

    return ticks;
};


export default function OrganizationPage() {
  const params = useParams();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('month');
  const [apiModels, setApiModels] = useState<ApiModel[]>([]);
  const [rankingModels, setRankingModels] = useState<RankingModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationLogo, setOrganizationLogo] = useState<string>('');

  const organizationName = useMemo(() => {
    const name = params.name as string;
    return name ? decodeURIComponent(name) : '';
  }, [params.name]);

  // Fetch ranking models to get stats
  useEffect(() => {
    const fetchRankingModels = async () => {
        try {
            // Use Next.js API proxy to avoid CORS issues
            const response = await fetch('/api/ranking/models');
            const data = await response.json();

            if (data.success && data.data) {
                // Filter models for this organization
                const orgModels = data.data.filter((m: RankingModel) =>
                    m.author.toLowerCase() === organizationName.toLowerCase()
                );
                setRankingModels(orgModels);

                // Set logo from first model
                if (orgModels.length > 0 && orgModels[0].logo_url) {
                    setOrganizationLogo(orgModels[0].logo_url);
                }
            }
        } catch (error) {
            console.error('Failed to fetch ranking models:', error);
        }
    };

    if (organizationName) {
        fetchRankingModels();
    }
  }, [organizationName]);

  // Fetch models from API catalog
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/models?developer=${encodeURIComponent(organizationName.toLowerCase())}`);
        const data = await response.json();
        const models = data.data || [];

        console.log(`API returned ${models.length} models for ${organizationName} from models endpoint`);

        // Client-side filtering to ensure only models from this organization are shown
        // The model ID typically starts with "org-name/" or the model has a provider_slug matching the org
        const filteredModels = models.filter((model: ApiModel) => {
          const modelIdLower = model.id.toLowerCase();
          const orgNameLower = organizationName.toLowerCase();

          // Check if model ID starts with "organization/"
          if (modelIdLower.startsWith(`${orgNameLower}/`)) {
            return true;
          }

          // Check if provider_slug matches
          if (model.provider_slug && model.provider_slug.toLowerCase() === orgNameLower) {
            return true;
          }

          // Extract author from model ID (format: "author/model-name")
          const modelAuthor = model.id.split('/')[0]?.toLowerCase();
          if (modelAuthor === orgNameLower) {
            return true;
          }

          return false;
        });

        console.log(`After client-side filtering: ${filteredModels.length} models for ${organizationName}`);
        setApiModels(filteredModels);
      } catch (error) {
        console.error('Failed to fetch models:', error);
        setApiModels([]);
      } finally {
        setLoading(false);
      }
    };

    if (organizationName) {
      fetchModels();
    }
  }, [organizationName]);

  // Calculate stats from ranking data
  const stats = useMemo(() => {
    if (rankingModels.length === 0) {
        return {
            totalTokens: '0',
            totalValue: '$0',
            topProvider: organizationName,
            topModel: 'N/A'
        };
    }

    // Calculate total tokens
    const totalTokensNum = rankingModels.reduce((sum, model) => {
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

    // Estimate value (rough estimate based on tokens)
    const estimatedValue = totalTokensNum * 0.00001; // $0.01 per 1000 tokens
    const formatValue = (num: number): string => {
        if (num >= 1000000000) return `$${(num / 1000000000).toFixed(0)}B`;
        if (num >= 1000000) return `$${(num / 1000000).toFixed(0)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
        return `$${num.toFixed(0)}`;
    };

    // Get top model (highest rank = lowest number)
    const topModel = rankingModels.reduce((top, model) =>
        model.rank < top.rank ? model : top
    , rankingModels[0]);

    return {
        totalTokens: formatTokens(totalTokensNum),
        totalValue: formatValue(estimatedValue),
        topProvider: organizationName,
        topModel: topModel.model_name
    };
  }, [rankingModels, organizationName]);

  const chartData = useMemo(() => generateChartData(timeFrame), [timeFrame]);
  const chartTicks = useMemo(() => getTicks(chartData), [chartData]);

  const timeFrameLabels = {
      month: 'Past Month',
      week: 'Past Week',
      today: 'Today'
  };

  if (!organizationName) {
    return <div>Loading...</div>;
  }

  if (!loading && rankingModels.length === 0 && apiModels.length === 0) {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
            <h1 className="text-2xl font-bold">Organization not found.</h1>
        </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-screen-2xl">
        {/* Header */}
        <header className="mb-8">
            <div className="flex items-center gap-4 mb-6">
                {organizationLogo ? (
                    <img
                        src={organizationLogo}
                        alt={`${organizationName} logo`}
                        className="w-16 h-16 rounded-lg object-contain"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                        <Building className="w-8 h-8 text-muted-foreground" />
                    </div>
                )}
                <h1 className="text-4xl font-bold">{organizationName.charAt(0).toUpperCase() + organizationName.slice(1)}</h1>
            </div>
        </header>

        {/* Tokens Generated Chart */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Tokens Generated</h3>
              <Select value={timeFrame} onValueChange={(value) => setTimeFrame(value as TimeFrame)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Past Month</SelectItem>
                  <SelectItem value="week">Past Week</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    ticks={chartTicks}
                    tickFormatter={(str) => {
                      if (!str) return '';
                      const date = new Date(str);
                       if (timeFrame === 'month') {
                        return format(date, 'MMM d');
                      }
                      return format(date, 'MMM d');
                    }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                     contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                      }}
                      formatter={(value: any) => [`${value} tokens`, 'Generated']}
                      labelFormatter={(label) => format(new Date(label), 'PPP')}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="#60a5fa"
                    fillOpacity={1}
                    fill="url(#chartGradient)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
                title="Total Tokens"
                value={stats.totalTokens}
                subtitle="Tokens Generated"
            />
            <StatCard
                title="Total Value"
                value={stats.totalValue}
                subtitle="Estimated Value"
            />
            <StatCard
                title="Top Provider"
                value={stats.topProvider}
                subtitle="Primary Provider"
            />
            <StatCard
                title="Top Model"
                value={stats.topModel}
                subtitle="Most Popular"
            />
        </div>

        {/* Models Section */}
        <main>
            <h2 className="text-2xl font-bold mb-6">
                Models By {organizationName.charAt(0).toUpperCase() + organizationName.slice(1)}
                <span className="text-muted-foreground ml-2">{apiModels.length} Models</span>
            </h2>
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="p-6">
                            <div className="animate-pulse space-y-4">
                                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                <div className="h-16 bg-gray-200 rounded"></div>
                                <div className="h-4 bg-gray-200 rounded w-full"></div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : apiModels.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {apiModels.map(model => (
                        <ApiModelCard key={model.id} model={model} />
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-12">No models found for this organization.</p>
            )}
        </main>
    </div>
  );
}
