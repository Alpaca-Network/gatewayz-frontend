"use client";

import { useMemo, lazy, Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { format } from 'date-fns';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Maximize, Copy, Check, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { providerData } from '@/lib/provider-data';
import { generateChartData, generateStatsTable } from '@/lib/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ReactMarkdown from "react-markdown";
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/config';
import { models as staticModels } from '@/lib/models-data';
import { getApiKey } from '@/lib/api';
import { InlineChat } from '@/components/models/inline-chat';
import { safeParseJson } from '@/lib/http';
import {
    findModelByRouteParams,
    getModelGateways,
    transformStaticModel,
    type ModelDetailRecord,
} from '@/lib/model-detail-utils';

// Lazy load heavy components
const TopAppsTable = lazy(() => import('@/components/dashboard/top-apps-table'));

type Model = ModelDetailRecord;

const Section = ({ title, description, children, className }: { title: string, description?: string, children: React.ReactNode, className?: string }) => (
    <section className={cn("py-8", className)}>
        <h2 className="text-2xl font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground mt-2">{description}</p>}
        <div className="mt-6">{children}</div>
    </section>
);

const ChartCard = ({ modelName, title, dataKey, yAxisFormatter }: { modelName: string, title: string; dataKey: "throughput" | "latency"; yAxisFormatter: (value: any) => string; }) => {
    const providers = useMemo(() => providerData[modelName] || [], [modelName]);
    const chartData = useMemo(() => generateChartData(providers, dataKey), [providers, dataKey]);
    const statsTable = useMemo(() => generateStatsTable(providers, dataKey), [providers, dataKey]);

    return (
        <Dialog>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base font-medium">{title}</CardTitle>
                    <DialogTrigger asChild>
                         <Button variant="ghost" size="icon" className="w-6 h-6">
                            <Maximize className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </DialogTrigger>
                </CardHeader>
                <CardContent>
                     <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <Tooltip
                                    formatter={(value, name) => [`${value}${dataKey === 'latency' ? 's' : ' tps'}`, name]}
                                    labelFormatter={(label) => format(new Date(label), "PPP")}
                                     contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--border))',
                                      }}
                                />
                                {providers.map((p, i) => (
                                     <Line key={p.name} type="monotone" dataKey={p.name} stroke={`hsl(var(--chart-${(i % 5) + 1}))`} dot={false} strokeWidth={2} />
                                ))}
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={false} />
                                <YAxis tickLine={false} axisLine={false} tickFormatter={yAxisFormatter} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
             <DialogContent className="max-w-4xl h-auto flex flex-col bg-card text-card-foreground">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                     <p className="text-sm text-muted-foreground">Median {title} of the top providers for this model.</p>
                </DialogHeader>
                <div className="flex-grow my-4">
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                             <XAxis dataKey="date" tickFormatter={(label) => format(new Date(label), 'MMM d')} />
                             <YAxis tickFormatter={yAxisFormatter} />
                            <Tooltip
                                formatter={(value, name) => [`${value}${dataKey === 'latency' ? 's' : ' tps'}`, name]}
                                labelFormatter={(label) => format(new Date(label), "PPP")}
                                 contentStyle={{
                                    backgroundColor: 'hsl(var(--background))',
                                    borderColor: 'hsl(var(--border))',
                                  }}
                             />
                            <Legend />
                            {providers.map((p, i) => (
                                <Line key={p.name} type="monotone" dataKey={p.name} stroke={`hsl(var(--chart-${(i % 5) + 1}))`} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Provider</TableHead>
                            <TableHead className="text-right">Min {title}</TableHead>
                            <TableHead className="text-right">Max {title}</TableHead>
                            <TableHead className="text-right">Avg {title}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {statsTable.map(stat => (
                            <TableRow key={stat.provider}>
                                <TableCell className="font-medium">{stat.provider}</TableCell>
                                <TableCell className="text-right">{stat.min.toFixed(2)}{dataKey === 'latency' ? 's' : ' tps'}</TableCell>
                                <TableCell className="text-right">{stat.max.toFixed(2)}{dataKey === 'latency' ? 's' : ' tps'}</TableCell>
                                <TableCell className="text-right">{stat.avg.toFixed(2)}{dataKey === 'latency' ? 's' : ' tps'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </DialogContent>
        </Dialog>
    )
}

type TabType = 'Playground' | 'Use Model' | 'Providers' | 'Activity' | 'Apps';

export default function ModelProfilePage() {
    const params = useParams();
    const router = useRouter();

    // State declarations - must be before any early returns
    const [model, setModel] = useState<Model | null>(null);
    const [allModels, setAllModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingProviders, setLoadingProviders] = useState(true);
    const [modelProviders, setModelProviders] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('Playground');
    const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'python' | 'openai-python' | 'typescript' | 'openai-typescript'>('curl');
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
    const [apiKey, setApiKey] = useState('gw_live_YOUR_API_KEY_HERE');
    const [selectedProvider, setSelectedProvider] = useState<string>('gatewayz');
    const [selectedPlaygroundProvider, setSelectedPlaygroundProvider] = useState<string>('gatewayz');
    const transformedStaticModels = useMemo(() => staticModels.map(transformStaticModel), []);

    // Extract catch-all parameter and parse it
    // For URL /models/near/deepseek-ai/deepseek-v3-1
    // params.name will be ['near', 'deepseek-ai', 'deepseek-v3-1']
    const nameParts = Array.isArray(params.name) ? params.name : (params.name ? [params.name] : []);
    const isInvalidUrl = nameParts.length < 2;

    // Extract developer (first part) and reconstruct model name from remaining parts
    const developer = !isInvalidUrl ? (nameParts[0]?.toLowerCase() || '') : '';
    // Rejoin remaining parts with slashes for NEAR models like "deepseek-ai/deepseek-v3-1"
    const modelNameParam = !isInvalidUrl ? nameParts.slice(1).join('/') : '';

    // Redirect alibaba models to qwen
    useEffect(() => {
        if (developer === 'alibaba') {
            router.replace(`/models/qwen/${modelNameParam}`);
        }
    }, [developer, modelNameParam, router]);

    // Provider configurations for API calls
    const providerConfigs: Record<string, {
        name: string;
        baseUrl: string;
        requiresApiKey: boolean;
        apiKeyPlaceholder: string;
        modelIdFormat?: (modelId: string) => string;
    }> = {
        gatewayz: {
            name: 'Gatewayz (Unified)',
            baseUrl: 'https://api.gatewayz.ai/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: apiKey,
        },
        openrouter: {
            name: 'OpenRouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: 'sk-or-v1-...',
        },
        groq: {
            name: 'Groq',
            baseUrl: 'https://api.groq.com/openai/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: 'gsk_...',
            modelIdFormat: (modelId: string) => {
                // Groq uses the model name without the developer prefix
                // e.g., 'meta/llama-3.3-70b' → 'llama-3.3-70b'
                const parts = modelId.split('/');
                return parts[parts.length - 1];
            }
        },
        together: {
            name: 'Together AI',
            baseUrl: 'https://api.together.xyz/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: '...',
            modelIdFormat: (modelId: string) => {
                // Together AI typically uses the full model ID
                return modelId;
            }
        },
        fireworks: {
            name: 'Fireworks',
            baseUrl: 'https://api.fireworks.ai/inference/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: 'fw_...',
            modelIdFormat: (modelId: string) => {
                // Fireworks uses the full model ID with developer prefix
                return modelId;
            }
        },
        deepinfra: {
            name: 'DeepInfra',
            baseUrl: 'https://api.deepinfra.com/v1/openai',
            requiresApiKey: true,
            apiKeyPlaceholder: '...',
            modelIdFormat: (modelId: string) => {
                // DeepInfra uses the full model ID
                return modelId;
            }
        },
        google: {
            name: 'Google AI',
            baseUrl: 'https://generativelanguage.googleapis.com/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: 'AIza...',
        },
        cerebras: {
            name: 'Cerebras',
            baseUrl: 'https://api.cerebras.ai/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: 'csk-...',
            modelIdFormat: (modelId: string) => {
                // Cerebras uses the model name without the developer prefix
                // e.g., 'cerebras/cpt-llama-3.1-8b' → 'cpt-llama-3.1-8b'
                const parts = modelId.split('/');
                return parts[parts.length - 1];
            }
        },
        xai: {
            name: 'xAI',
            baseUrl: 'https://api.x.ai/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: 'xai-...',
            modelIdFormat: (modelId: string) => {
                // xAI uses the model name without the developer prefix
                // e.g., 'xai/grok-3' → 'grok-3'
                const parts = modelId.split('/');
                return parts[parts.length - 1];
            }
        },
        huggingface: {
            name: 'Hugging Face',
            baseUrl: 'https://api-inference.huggingface.co/models',
            requiresApiKey: true,
            apiKeyPlaceholder: 'hf_...',
            modelIdFormat: (modelId: string) => {
                // Hugging Face uses the full model ID (developer/model)
                return modelId;
            }
        },
        near: {
            name: 'NEAR Protocol',
            baseUrl: 'https://api.near.ai/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: 'near_...',
            modelIdFormat: (modelId: string) => {
                // NEAR Protocol uses the full model ID (including nested paths like near/deepseek-ai/DeepSeek-V3.1)
                return modelId;
            }
        },
        nebius: {
            name: 'Nebius AI Studio',
            baseUrl: 'https://api.studio.nebius.ai/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: '...',
            modelIdFormat: (modelId: string) => {
                // Nebius uses the model name without the developer prefix
                // e.g., 'meta/llama-3.1-70b' → 'llama-3.1-70b'
                const parts = modelId.split('/');
                return parts[parts.length - 1];
            }
        },
        featherless: {
            name: 'Featherless',
            baseUrl: 'https://api.featherless.ai/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: '...',
            modelIdFormat: (modelId: string) => {
                // Featherless uses the full model ID with developer prefix
                return modelId;
            }
        },
        chutes: {
            name: 'Chutes',
            baseUrl: 'https://api.chutes.ai/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: '...',
            modelIdFormat: (modelId: string) => {
                // Chutes uses the full model ID
                return modelId;
            }
        },
        portkey: {
            name: 'Portkey',
            baseUrl: 'https://api.portkey.ai/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: '...',
        },
        novita: {
            name: 'Novita AI',
            baseUrl: 'https://api.novita.ai/v3/openai',
            requiresApiKey: true,
            apiKeyPlaceholder: '...',
            modelIdFormat: (modelId: string) => {
                // Novita uses the model name without the developer prefix
                // e.g., 'meta/llama-3-70b' → 'llama-3-70b'
                const parts = modelId.split('/');
                return parts[parts.length - 1];
            }
        },
        aimo: {
            name: 'AIMO Network',
            baseUrl: 'https://api.aimo.network/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: '...',
            modelIdFormat: (modelId: string) => {
                // AIMO uses the full model ID
                return modelId;
            }
        },
        fal: {
            name: 'FAL AI',
            baseUrl: 'https://fal.run/fal-ai',
            requiresApiKey: true,
            apiKeyPlaceholder: '...',
        },
        alibaba: {
            name: 'Alibaba Cloud',
            baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
            requiresApiKey: true,
            apiKeyPlaceholder: 'sk-...',
            modelIdFormat: (modelId: string) => {
                // Alibaba uses the model name without the developer prefix
                // e.g., 'qwen/qwen-turbo' → 'qwen-turbo'
                const parts = modelId.split('/');
                return parts[parts.length - 1];
            }
        },
    };

    // Store the model ID
    let modelId = `${developer}/${modelNameParam}`;
    // Decode URL-encoded characters (e.g., %40 -> @)
    modelId = decodeURIComponent(modelId);

    // Load API key from storage
    useEffect(() => {
        const key = getApiKey();
        if (key) {
            setApiKey(key);
        }
    }, []);

    // Select default provider based on lowest cost or latency
    useEffect(() => {
        if (modelProviders.length > 0 && model) {
            // For models with provider-specific prefixes (near/, aimo/, etc.),
            // prefer using their native gateway if available
            const modelIdLower = model.id.toLowerCase();
            let preferredGateway: string | null = null;

            if (modelIdLower.startsWith('near/') && modelProviders.includes('near')) {
                preferredGateway = 'near';
            } else if (modelIdLower.startsWith('aimo/') && modelProviders.includes('aimo')) {
                preferredGateway = 'aimo';
            } else if (modelIdLower.startsWith('huggingface/') && modelProviders.includes('huggingface')) {
                preferredGateway = 'huggingface';
            } else if (modelIdLower.startsWith('alibaba/')) {
                // For Alibaba models, prefer alibaba gateway if available, otherwise use openrouter
                if (modelProviders.includes('alibaba')) {
                    preferredGateway = 'alibaba';
                } else if (modelProviders.includes('openrouter')) {
                    preferredGateway = 'openrouter';
                }
            }

            if (preferredGateway) {
                setSelectedProvider(preferredGateway);
                setSelectedPlaygroundProvider(preferredGateway);
                return;
            }

            // Get provider performance data if available
            const modelProviderData = providerData[model.name] || [];

            if (modelProviderData.length > 0) {
                // Find provider with lowest total cost (input + output)
                let bestProvider = modelProviderData[0];
                for (const provider of modelProviderData) {
                    const currentCost = provider.inputCost + provider.outputCost;
                    const bestCost = bestProvider.inputCost + bestProvider.outputCost;

                    // Use cost as primary criteria, latency as tiebreaker
                    if (currentCost < bestCost ||
                        (currentCost === bestCost && provider.latency && bestProvider.latency && provider.latency < bestProvider.latency)) {
                        bestProvider = provider;
                    }
                }

                // Map provider name to gateway slug
                const providerNameToGateway: Record<string, string> = {
                    'DeepInfra': 'deepinfra',
                    'Nebius AI Studio': 'nebius',
                    'Fireworks': 'fireworks',
                    'Together AI': 'together',
                    'Groq': 'groq',
                    'Google': 'google',
                    'Anthropic': 'gatewayz',
                    'AWS Bedrock': 'gatewayz',
                    'OpenRouter': 'openrouter',
                    'Cerebras': 'cerebras',
                    'xAI': 'xai',
                    'Hugging Face': 'huggingface',
                };

                const gateway = providerNameToGateway[bestProvider.name] || modelProviders[0];
                setSelectedProvider(gateway);
                setSelectedPlaygroundProvider(gateway);
            } else {
                // No performance data, default to first available provider
                setSelectedProvider(modelProviders[0]);
                setSelectedPlaygroundProvider(modelProviders[0]);
            }
        }
    }, [modelProviders, model]);

    useEffect(() => {
        let mounted = true;

        const staticFoundModel = findModelByRouteParams(transformedStaticModels, {
            modelId,
            developer,
            modelNameParam
        });

        if (staticFoundModel && mounted) {
            setModel(staticFoundModel);
            setAllModels(transformedStaticModels);
            setLoading(false);
        }

        const fetchModelDetail = async () => {
            try {
                const params = new URLSearchParams();
                if (modelId) params.set('modelId', modelId);
                if (developer) params.set('developer', developer);
                if (modelNameParam) params.set('modelName', modelNameParam);

                const response = await fetch(`/api/models/detail?${params.toString()}`, {
                    signal: AbortSignal.timeout(15000)
                });

                if (!response.ok) {
                    throw new Error(`Model detail request failed (${response.status})`);
                }

                const payload = await safeParseJson<{
                    data?: Model;
                    providers?: string[];
                    related?: Model[];
                }>(response, '[ModelProfilePage] detail fetch');

                if (!mounted) {
                    return;
                }

                if (payload?.data) {
                    setModel(payload.data);
                    setAllModels(payload.related || []);
                    const providerList = payload.providers?.length
                        ? payload.providers
                        : getModelGateways(payload.data);
                    setModelProviders(providerList ?? []);
                    setLoading(false);
                } else if (!staticFoundModel) {
                    setModel(null);
                    setLoading(false);
                }

                setLoadingProviders(false);
            } catch (error) {
                console.error('[ModelProfilePage] Failed to load model detail:', error);
                if (!mounted) {
                    return;
                }
                if (!staticFoundModel) {
                    setModel(null);
                    setLoading(false);
                }
                setLoadingProviders(false);
            }
        };

        fetchModelDetail();

        return () => {
            mounted = false;
        };
    }, [modelId, developer, modelNameParam, transformedStaticModels]);

    const relatedModels = useMemo(() => {
      if(!model) return [];
      return allModels.filter(m => m.provider_slug === model.provider_slug && m.id !== model.id).slice(0,3);
    }, [model, allModels]);

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedStates({ ...copiedStates, [id]: true });
            setTimeout(() => {
                setCopiedStates({ ...copiedStates, [id]: false });
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    // Check for invalid URL after all hooks are declared
    if (isInvalidUrl) {
        return (
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Card className="max-w-2xl mx-auto">
                    <CardContent className="p-8 text-center">
                        <h1 className="text-2xl font-bold mb-4">Invalid Model URL</h1>
                        <p className="text-muted-foreground mb-6">
                            The URL format is invalid. Please use /models/[gateway]/[model-name]
                        </p>
                        <Link href="/models">
                            <Button>Browse Models</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center flex-1">
                <p className="text-muted-foreground">Loading model...</p>
            </div>
        );
    }

    if (!model) {
        return (
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Card className="max-w-2xl mx-auto">
                    <CardContent className="p-8 text-center">
                        <h1 className="text-2xl font-bold mb-4">Model Not Found</h1>
                        <p className="text-muted-foreground mb-6">
                            The model <code className="px-2 py-1 bg-muted rounded text-sm">{modelId}</code> is not available through Gatewayz.
                        </p>
                        <div className="space-y-4 text-left">
                            <div>
                                <h2 className="font-semibold mb-2">Possible reasons:</h2>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                    <li>The model may not be supported by any of our gateway providers</li>
                                    <li>The model ID may be incorrect or misspelled</li>
                                    <li>The model may have been deprecated or removed by the provider</li>
                                </ul>
                            </div>
                            <div>
                                <h2 className="font-semibold mb-2">What you can do:</h2>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                    <li>Browse our <Link href="/models" className="text-primary hover:underline">available models</Link></li>
                                    <li>Check the <Link href="/" className="text-primary hover:underline">homepage</Link> for featured models</li>
                                    <li>Try searching for similar models with different naming formats</li>
                                </ul>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-4 justify-center">
                            <Link href="/models">
                                <Button>Browse Models</Button>
                            </Link>
                            <Link href="/">
                                <Button variant="outline">Go Home</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
      <TooltipProvider>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-screen-2xl">
            <header className="mb-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                        <h1 className="text-3xl lg:text-4xl font-bold mb-2">{model.name}</h1>
                        {/* Model ID with copy button */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md border">
                                <code className="text-sm font-mono">{model.id}</code>
                                <button
                                    onClick={() => copyToClipboard(model.id, 'model-id')}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    title="Copy model ID"
                                >
                                    {copiedStates['model-id'] ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                        {/* Pricing and Context Information */}
                        <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                            <span>Created Oct 30, 2025</span>
                            <span>|</span>
                            <span>{model.context_length && model.context_length > 0 ? `${(model.context_length / 1000).toLocaleString()}k` : 'N/A'} context</span>
                            <span>|</span>
                            <span>${model.pricing && model.pricing.prompt ? (parseFloat(String(model.pricing.prompt)) * 1000000).toFixed(2) : 'N/A'}/M input tokens</span>
                            <span>|</span>
                            <span>${model.pricing && model.pricing.completion ? (parseFloat(String(model.pricing.completion)) * 1000000).toFixed(2) : 'N/A'}/M output tokens</span>
                            {model.architecture && model.architecture.input_modalities && model.architecture.input_modalities.includes('audio') && (
                                <>
                                    <span>|</span>
                                    <span>$0.0001/M audio tokens</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-3">
                            {model.pricing && parseFloat(String(model.pricing.prompt ?? '0')) === 0 && parseFloat(String(model.pricing.completion ?? '0')) === 0 && (
                                <Badge className="bg-black text-white hover:bg-gray-800">Free</Badge>
                            )}
                            {model.is_private && (
                                <Badge className="bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    Private
                                </Badge>
                            )}
                            {model.description && (model.description.toLowerCase().includes('multilingual') || model.description.toLowerCase().includes('multi-lingual')) && (
                                <Badge variant="secondary">Multi-Lingual</Badge>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={`/chat?model=${encodeURIComponent(model.id)}`}>
                            <Button>Chat</Button>
                        </Link>
                        <Button variant="outline">Create API Key</Button>
                    </div>
                </div>
                 <div className="mt-6 text-muted-foreground leading-relaxed">
                    <ReactMarkdown
                        components={{
                        a: ({ children, ...props }) => (
                            <span className="text-blue-600 underline cursor-pointer" {...props}>
                            {children}
                            </span>
                        ),
                        }}
                    >
                        {model.description}
                    </ReactMarkdown>
                </div>
            </header>

            <nav className="border-b overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-8">
                <div className="flex gap-4 lg:gap-6">
                    {(['Playground', 'Use Model', 'Providers', 'Activity', 'Apps'] as TabType[]).map(item => (
                        <Button
                            key={item}
                            variant="ghost"
                            className={cn(
                                "rounded-none border-b-2 whitespace-nowrap flex-shrink-0",
                                activeTab === item
                                    ? "border-primary text-primary"
                                    : "border-transparent hover:border-primary"
                            )}
                            onClick={() => setActiveTab(item)}
                        >
                            {item}
                        </Button>
                    ))}
                </div>
            </nav>

            <main>
                {activeTab === 'Playground' && (
                    <div className="h-[600px] flex flex-col">
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold mb-2">Playground: {model.name}</h2>
                            <p className="text-muted-foreground">
                                Test {model.name} directly in your browser. Messages are not saved to your chat history.
                            </p>
                        </div>

                        {/* Provider Selector */}
                        <div className="mb-4">
                            <label className="text-sm font-medium mb-2 block">Select Gateway</label>
                            <Select value={selectedPlaygroundProvider} onValueChange={setSelectedPlaygroundProvider}>
                                <SelectTrigger className="w-full max-w-md">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gatewayz">Gatewayz (Unified - Recommended)</SelectItem>
                                    {modelProviders.length > 0 && modelProviders.map(provider => {
                                        const config = providerConfigs[provider];
                                        if (!config) return null;
                                        return (
                                            <SelectItem key={provider} value={provider}>
                                                {config.name}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            {selectedPlaygroundProvider !== 'gatewayz' && (
                                <p className="text-sm text-muted-foreground mt-2">
                                    ⚠️ Using {providerConfigs[selectedPlaygroundProvider]?.name} directly. Make sure you have configured your API key.
                                </p>
                            )}
                        </div>

                        <Card className="flex-1 p-4 overflow-hidden flex flex-col">
                            <InlineChat
                                modelId={model.id}
                                modelName={model.name}
                                gateway={selectedPlaygroundProvider !== 'gatewayz' ? selectedPlaygroundProvider : undefined}
                            />
                        </Card>
                    </div>
                )}

                {activeTab === 'Use Model' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold mb-2">Use {model.name}</h2>
                            <p className="text-muted-foreground">
                                Call this model with a few lines of code using the Gatewayz API
                            </p>
                        </div>

                        {/* Gateway Selector */}
                        <div className="mb-4">
                            <label className="text-sm font-medium mb-2 block">Select Gateway</label>
                            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                                <SelectTrigger className="w-full max-w-md">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gatewayz">Gatewayz (Unified - Recommended)</SelectItem>
                                    {modelProviders.length > 0 && modelProviders.map(provider => {
                                        const config = providerConfigs[provider];
                                        if (!config) return null;
                                        return (
                                            <SelectItem key={provider} value={provider}>
                                                {config.name}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            {selectedProvider !== 'gatewayz' && (
                                <p className="text-sm text-muted-foreground mt-2">
                                    ⚠️ Using {providerConfigs[selectedProvider]?.name} directly requires a separate API key from that provider.
                                </p>
                            )}
                        </div>

                        {/* Language Selector */}
                        <div className="flex gap-2 mb-4 flex-wrap">
                            <Button
                                variant={selectedLanguage === 'curl' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedLanguage('curl')}
                            >
                                cURL
                            </Button>
                            <Button
                                variant={selectedLanguage === 'python' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedLanguage('python')}
                            >
                                Python
                            </Button>
                            <Button
                                variant={selectedLanguage === 'openai-python' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedLanguage('openai-python')}
                            >
                                OpenAI Python
                            </Button>
                            <Button
                                variant={selectedLanguage === 'typescript' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedLanguage('typescript')}
                            >
                                TypeScript
                            </Button>
                            <Button
                                variant={selectedLanguage === 'openai-typescript' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedLanguage('openai-typescript')}
                            >
                                OpenAI TypeScript
                            </Button>
                        </div>

                        {/* API Key Status */}
                        {apiKey === 'gw_live_YOUR_API_KEY_HERE' && (
                            <Card className="mb-4 border-amber-500/50 bg-amber-50/10">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 text-amber-600">
                                        <span className="text-sm">⚠️ No API key found. </span>
                                        <Link href="/settings/keys" className="text-sm underline hover:text-amber-700">
                                            Get your API key
                                        </Link>
                                        <span className="text-sm"> to use these examples.</span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Code Example */}
                        <div className="mb-6">
                            {(() => {
                                // Get provider config
                                const providerConfig = providerConfigs[selectedProvider] || providerConfigs.gatewayz;
                                const baseUrl = providerConfig.baseUrl;
                                const currentApiKey = providerConfig.apiKeyPlaceholder;
                                // Format model ID according to provider requirements
                                const formattedModelId = providerConfig.modelIdFormat
                                    ? providerConfig.modelIdFormat(model.id)
                                    : model.id;

                                const codeExamples = {
                                    curl: `curl -X POST ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${currentApiKey}" \\
  -d '{
    "model": "${formattedModelId}",
    "messages": [
      {
        "role": "user",
        "content": "Hello! What can you help me with?"
      }
    ]
  }'`,
                                    python: `import requests
import json

response = requests.post(
    url="${baseUrl}/chat/completions",
    headers={
        "Authorization": "Bearer ${currentApiKey}",
        "Content-Type": "application/json"
    },
    data=json.dumps({
        "model": "${formattedModelId}",
        "messages": [
            {
                "role": "user",
                "content": "Hello! What can you help me with?"
            }
        ]
    })
)

print(response.json())`,
                                    'openai-python': `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${currentApiKey}"
)

completion = client.chat.completions.create(
    model="${formattedModelId}",
    messages=[
        {"role": "user", "content": "Hello! What can you help me with?"}
    ]
)

print(completion.choices[0].message.content)`,
                                    typescript: `fetch("${baseUrl}/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${currentApiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    "model": "${formattedModelId}",
    "messages": [
      {
        "role": "user",
        "content": "Hello! What can you help me with?"
      }
    ]
  })
});`,
                                    'openai-typescript': `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: "${currentApiKey}",
  baseURL: "${baseUrl}"
});

const response = await client.chat.completions.create({
  model: "${formattedModelId}",
  messages: [{ role: "user", content: "Hello! What can you help me with?" }]
});

console.log(response.choices[0].message.content);`
                                };

                                const currentCode = codeExamples[selectedLanguage];

                                return (
                                    <div className="rounded-xl overflow-hidden shadow-lg border border-gray-800 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                                        {/* Terminal Header */}
                                        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/50 border-b border-slate-700">
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1.5">
                                                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                                                </div>
                                                <span className="text-xs text-slate-400 ml-3 font-mono">terminal</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyToClipboard(currentCode, selectedLanguage)}
                                                className="text-slate-300 hover:text-white"
                                            >
                                                {copiedStates[selectedLanguage] ? (
                                                    <>
                                                        <Check className="h-4 w-4 mr-2" />
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-4 w-4 mr-2" />
                                                        Copy
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        {/* Code Display */}
                                        <div className="bg-slate-950/80 p-6">
                                            <pre className="text-sm leading-relaxed font-mono text-cyan-400 overflow-x-auto">
                                                <code>{currentCode}</code>
                                            </pre>
                                        </div>
                                        {/* Bottom gradient */}
                                        <div className="h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Get API Key CTA */}
                        <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">Need an API Key?</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Get your free API key to start using {model.name}
                                        </p>
                                    </div>
                                    <Link href="/settings/keys">
                                        <Button>
                                            Get API Key
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'Providers' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Gateways Offering {model.name}</h2>
                            {!loadingProviders && (
                                <p className="text-sm text-muted-foreground">
                                    Available on {modelProviders.length} Gateway{modelProviders.length !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>

                        {loadingProviders ? (
                            <Card className="p-8 text-center">
                                <p className="text-muted-foreground">Loading gateway availability...</p>
                            </Card>
                        ) : modelProviders.length > 0 ? (
                            <div className="space-y-4">
                                {modelProviders.map(provider => {
                                    const isRecommended = provider === selectedProvider;
                                    const providerNames: Record<string, string> = {
                                        openrouter: 'OpenRouter',
                                        portkey: 'Portkey',
                                        featherless: 'Featherless',
                                        chutes: 'Chutes',
                                        fireworks: 'Fireworks',
                                        together: 'Together AI',
                                        groq: 'Groq',
                                        deepinfra: 'DeepInfra',
                                        google: 'Google AI',
                                        cerebras: 'Cerebras',
                                        nebius: 'Nebius AI Studio',
                                        xai: 'xAI',
                                        novita: 'Novita AI',
                                        huggingface: 'Hugging Face',
                                        aimo: 'AIMO Network',
                                        near: 'NEAR Protocol',
                                        fal: 'FAL AI'
                                    };
                                    const providerLogos: Record<string, string> = {
                                        openrouter: '/openrouter-logo.svg',
                                        portkey: '/portkey-logo.svg',
                                        featherless: '/featherless-logo.svg',
                                        chutes: '/chutes-logo.svg',
                                        fireworks: '/fireworks-logo.svg',
                                        together: '/together-logo.svg',
                                        groq: '/groq-logo.svg',
                                        deepinfra: '/deepinfra-logo.svg',
                                        google: '/google-logo.svg',
                                        cerebras: '/cerebras-logo.svg',
                                        nebius: '/nebius-logo.svg',
                                        xai: '/xai-logo.svg',
                                        novita: '/novita-logo.svg',
                                        huggingface: '/huggingface-logo.svg',
                                        aimo: '/aimo-logo.svg',
                                        near: '/near-logo.svg',
                                        fal: '/fal-logo.svg'
                                    };

                                    return (
                                        <Card key={provider} className={`p-6 ${isRecommended ? 'ring-2 ring-primary' : ''}`}>
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center border">
                                                    <img
                                                        src={providerLogos[provider] || '/OpenAI_Logo-black.svg'}
                                                        alt={providerNames[provider]}
                                                        className="w-8 h-8 object-contain"
                                                        onError={(e) => {
                                                            // Fallback to a default icon if logo doesn't exist
                                                            e.currentTarget.src = '/OpenAI_Logo-black.svg';
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-lg font-semibold">{providerNames[provider]}</h3>
                                                        {isRecommended && (
                                                            <Badge className="bg-primary text-primary-foreground">
                                                                Recommended
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {isRecommended ? 'Lowest cost/latency option' : 'Gateway Provider'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Input Cost</p>
                                                    <p className="text-lg font-semibold">
                                                        ${model.pricing && model.pricing.prompt ? (parseFloat(String(model.pricing.prompt)) * 1000000).toFixed(2) : 'N/A'}/M
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Output Cost</p>
                                                    <p className="text-lg font-semibold">
                                                        ${model.pricing && model.pricing.completion ? (parseFloat(String(model.pricing.completion)) * 1000000).toFixed(2) : 'N/A'}/M
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Context Length</p>
                                                    <p className="text-lg font-semibold">
                                                        {model.context_length && model.context_length > 0 ? `${Math.round(model.context_length / 1000)}K` : 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Status</p>
                                                    <Badge className="bg-green-500">Available</Badge>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <Card className="p-8 text-center">
                                <p className="text-muted-foreground">No gateway providers found for this model.</p>
                            </Card>
                        )}
                    </div>
                )}

                {activeTab === 'Activity' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Recent Activity Of {model.name}</h2>
                        </div>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm text-muted-foreground">Total usage per day on Gatewayz</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={generateChartData([], 'throughput').slice(0,90)}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(label) => format(new Date(label), 'MMM d')}
                                                tick={{ fontSize: 12 }}
                                            />
                                            <YAxis
                                                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                                                tick={{ fontSize: 12 }}
                                            />
                                            <Tooltip
                                                formatter={(value: any) => [`${(value / 1000000).toFixed(2)}M`, "Usage"]}
                                                labelFormatter={(label) => format(new Date(label), "PPP")}
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--background))',
                                                    borderColor: 'hsl(var(--border))',
                                                }}
                                            />
                                            <Legend />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                name="Prompt Tokens"
                                                stroke="#3b82f6"
                                                fill="#3b82f6"
                                                fillOpacity={0.6}
                                                strokeWidth={2}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value2"
                                                name="Completion Tokens"
                                                stroke="#9ca3af"
                                                fill="#9ca3af"
                                                fillOpacity={0.3}
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'Apps' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Top Apps Using {model.name}</h2>
                            <div className="flex items-center gap-4">
                                <select className="border rounded px-3 py-2 text-sm">
                                    <option>Top This Year</option>
                                    <option>Top This Month</option>
                                    <option>Top This Week</option>
                                </select>
                                <select className="border rounded px-3 py-2 text-sm">
                                    <option>Sort By: All</option>
                                    <option>Sort By: Tokens</option>
                                    <option>Sort By: Growth</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[1,2,3,4,5,6,7,8].map((i) => (
                                <Card key={i} className="hover:shadow-lg transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border">
                                                    <img src="/Google_Logo-black.svg" alt="Google" className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold">Google</h3>
                                                    <span className="text-xs text-muted-foreground">#{i}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                                            Autonomous Coding Agent That Is...
                                        </p>
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-2xl font-bold">21.7B</span>
                                                <p className="text-xs text-muted-foreground">Tokens Generated</p>
                                            </div>
                                            <div className="text-green-600 font-semibold text-sm">
                                                +13.06%
                                                <span className="text-xs text-muted-foreground ml-1">Weekly Growth</span>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm" className="w-full mt-4">
                                            View App →
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <div className="text-center mt-8">
                            <Button variant="outline">Load More</Button>
                        </div>
                    </div>
                )}

            </main>
        </div>
        </TooltipProvider>
    );
}
