import { cache } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { TooltipProvider } from '@/components/ui/tooltip';
import ReactMarkdown from "react-markdown";
import { models as staticModels } from '@/lib/models-data';
import { getModelsForGateway } from '@/lib/models-service';
import { ModelPageClient } from '@/components/models/model-page-client';
import { generateChartData } from '@/lib/data';

interface Model {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture: {
    input_modalities: string[];
  };
  supported_parameters: string[];
  provider_slug: string;
}

// Transform static model to API format
function transformStaticModel(staticModel: typeof staticModels[0]): Model {
    return {
        id: `${staticModel.developer}/${staticModel.name}`,
        name: staticModel.name,
        description: staticModel.description,
        context_length: staticModel.context * 1000,
        pricing: {
            prompt: staticModel.inputCost.toString(),
            completion: staticModel.outputCost.toString()
        },
        architecture: {
            input_modalities: staticModel.modalities.map(m => m.toLowerCase())
        },
        supported_parameters: staticModel.supportedParameters,
        provider_slug: staticModel.developer
    };
}

// Cached function to fetch model data server-side
const fetchModelData = cache(async (modelId: string) => {
    console.log(`[ModelProfilePage] Fetching model data for: ${modelId}`);

    try {
        // Fetch from all gateways in parallel using the existing service
        const result = await getModelsForGateway('all');
        const allModels = result.data || [];

        // Find the specific model
        let foundModel = allModels.find((m: Model) => m.id === modelId);

        // Try alternative matching strategies
        if (!foundModel) {
            foundModel = allModels.find((m: Model) => {
                const modelNamePart = m.id.includes(':') ? m.id.split(':')[1] : m.id;
                return modelNamePart === modelId || m.id.split('/').pop() === modelId;
            });
        }

        // Determine which gateways support this model
        const providers: string[] = [];
        const modelIdLower = modelId.toLowerCase();

        // Check each gateway for the model
        const gatewayChecks = [
            'openrouter', 'portkey', 'featherless', 'chutes', 'fireworks',
            'together', 'groq', 'deepinfra', 'google', 'cerebras', 'nebius',
            'xai', 'novita', 'huggingface', 'aimo', 'near'
        ];

        for (const gateway of gatewayChecks) {
            const hasModel = allModels.some((m: Model) => {
                if (m.id.toLowerCase() === modelIdLower) return true;
                const modelNamePart = m.id.includes(':') ? m.id.split(':')[1].toLowerCase() : m.id.toLowerCase();
                if (modelNamePart === modelIdLower) return true;
                const normalizedModelId = modelIdLower.replace(/[_\-\/]/g, '');
                const normalizedDataId = m.id.toLowerCase().replace(/[_\-\/]/g, '');
                if (normalizedModelId === normalizedDataId) return true;
                if (m.name && foundModel && m.name.toLowerCase() === foundModel.name.toLowerCase()) return true;
                const lastPart = m.id.split('/').pop()?.toLowerCase();
                if (lastPart === modelIdLower) return true;
                return false;
            });

            if (hasModel) providers.push(gateway);
        }

        return {
            model: foundModel,
            allModels,
            providers
        };
    } catch (error) {
        console.error('[ModelProfilePage] Error fetching models:', error);

        // Fallback to static data
        const staticModelsTransformed = staticModels.map(transformStaticModel);
        let staticFoundModel = staticModelsTransformed.find((m: Model) => m.id === modelId);

        if (!staticFoundModel) {
            staticFoundModel = staticModelsTransformed.find((m: Model) => {
                const modelNamePart = m.id.includes(':') ? m.id.split(':')[1] : m.id;
                return modelNamePart === modelId || m.id.split('/').pop() === modelId;
            });
        }

        return {
            model: staticFoundModel,
            allModels: staticModelsTransformed,
            providers: []
        };
    }
});

// Generate static params for popular models (optional - improves build time)
export async function generateStaticParams() {
    // Return empty array to avoid building all model pages at build time
    // Models will be generated on-demand using dynamic rendering
    return [];
}

export default async function ModelProfilePage({
    params
}: {
    params: Promise<{ name: string | string[] }>
}) {
    // Await params in Next.js 15
    const resolvedParams = await params;

    // Handle catch-all route - params.name will be an array like ['x-ai', 'grok-4-fast']
    const nameParam = resolvedParams.name;
    let modelId = Array.isArray(nameParam) ? nameParam.join('/') : nameParam;
    // Decode URL-encoded characters (e.g., %40 -> @)
    modelId = decodeURIComponent(modelId);

    // Fetch model data server-side
    const { model, allModels, providers: modelProviders } = await fetchModelData(modelId);

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

    const relatedModels = allModels.filter(m => m.provider_slug === model.provider_slug && m.id !== model.id).slice(0,3);

    // Provider names and logos mapping
    const providerNames: Record<string, string> = {
        openrouter: 'OpenRouter',
        portkey: 'Portkey',
        featherless: 'Featherless',
        chutes: 'Chutes',
        fireworks: 'Fireworks',
        together: 'Together AI',
        groq: 'Groq',
        deepinfra: 'DeepInfra',
        google: 'Google',
        cerebras: 'Cerebras',
        nebius: 'Nebius',
        xai: 'xAI',
        novita: 'Novita',
        huggingface: 'Hugging Face',
        aimo: 'AIMO Network',
        near: 'NEAR'
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
        near: '/near-logo.svg'
    };

    // Server-rendered sections
    const providersSection = (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Gateways Offering {model.name}</h2>
                <p className="text-sm text-muted-foreground">
                    Available on {modelProviders.length} Gateway{modelProviders.length !== 1 ? 's' : ''}
                </p>
            </div>

            {modelProviders.length > 0 ? (
                <div className="space-y-4">
                    {modelProviders.map(provider => (
                        <Card key={provider} className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center border">
                                    <img
                                        src={providerLogos[provider] || '/OpenAI_Logo-black.svg'}
                                        alt={providerNames[provider]}
                                        className="w-8 h-8 object-contain"
                                        onError={(e) => {
                                            e.currentTarget.src = '/OpenAI_Logo-black.svg';
                                        }}
                                    />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">{providerNames[provider]}</h3>
                                    <p className="text-sm text-muted-foreground">Gateway Provider</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Input Cost</p>
                                    <p className="text-lg font-semibold">
                                        ${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)}/M
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Output Cost</p>
                                    <p className="text-lg font-semibold">
                                        ${(parseFloat(model.pricing.completion) * 1000000).toFixed(2)}/M
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Context Length</p>
                                    <p className="text-lg font-semibold">
                                        {model.context_length > 0 ? `${Math.round(model.context_length / 1000)}K` : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <Badge className="bg-green-500">Available</Badge>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No gateway providers found for this model.</p>
                </Card>
            )}
        </div>
    );

    const activitySection = (
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
    );

    const appsSection = (
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
    );

    return (
      <TooltipProvider>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-screen-2xl">
            <header className="mb-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                        <h1 className="text-3xl lg:text-4xl font-bold mb-2">{model.name}</h1>
                        {/* Model ID with copy button - requires client component */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md border">
                                <code className="text-sm font-mono">{model.id}</code>
                            </div>
                        </div>
                        {/* Pricing and Context Information */}
                        <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                            <span>Created Oct 30, 2025</span>
                            <span>|</span>
                            <span>{model.context_length > 0 ? `${(model.context_length / 1000).toLocaleString()}k` : 'N/A'} context</span>
                            <span>|</span>
                            <span>${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)}/M input tokens</span>
                            <span>|</span>
                            <span>${(parseFloat(model.pricing.completion) * 1000000).toFixed(2)}/M output tokens</span>
                            {model.architecture.input_modalities.includes('audio') && (
                                <>
                                    <span>|</span>
                                    <span>$0.0001/M audio tokens</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-3">
                            <Badge className="bg-black text-white hover:bg-gray-800">Free</Badge>
                            <Badge variant="secondary">Multi-Lingual</Badge>
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

            <ModelPageClient
                model={model}
                modelProviders={modelProviders}
                providersSection={providersSection}
                activitySection={activitySection}
                appsSection={appsSection}
            />
        </div>
        </TooltipProvider>
    );
}
