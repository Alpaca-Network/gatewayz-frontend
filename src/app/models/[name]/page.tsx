'use client';

import { useParams } from 'next/navigation';
import { useMemo, useEffect, useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Copy, Check } from 'lucide-react';
import { providerData } from '@/lib/provider-data';
import { cn } from '@/lib/utils';
import { models as staticModels } from '@/lib/models-data';
import { getApiKey } from '@/lib/api';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineChat } from '@/components/models/inline-chat';

// Lazy load heavy components
const ProvidersDisplay = dynamic(() => import('@/components/models/provider-card').then(mod => ({ default: mod.ProvidersDisplay })), {
    ssr: false,
    loading: () => <ProvidersLoading />
});

const ReactMarkdown = dynamic(() => import('react-markdown'), {
    ssr: false,
    loading: () => <Skeleton className="h-20 w-full" />
});

// Lazy load chart components only when needed
const ActivityTab = lazy(() => import('./activity-tab'));
const AppsTab = lazy(() => import('./apps-tab'));

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

type TabType = 'Playground' | 'Use Model' | 'Providers' | 'Activity' | 'Apps';

// Loading skeleton for providers
const ProvidersLoading = () => (
    <div className="space-y-4">
        {[1, 2, 3].map(i => (
            <Card key={i} className="p-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-grow space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(j => (
                            <div key={j} className="space-y-1">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-4 w-12" />
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
        ))}
    </div>
);

// Model page skeleton
const ModelPageSkeleton = () => (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-screen-2xl">
        <header className="mb-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-8 w-96" />
                    <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-20" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
            <Skeleton className="h-20 w-full mt-6" />
        </header>

        <nav className="border-b mb-8">
            <div className="flex gap-6">
                {['Use Model', 'Providers', 'Activity', 'Apps'].map(item => (
                    <Skeleton key={item} className="h-10 w-24" />
                ))}
            </div>
        </nav>

        <main>
            <Skeleton className="h-96 w-full" />
        </main>
    </div>
);

// Optimized transform function - only transform when needed
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

// Create a Map for O(1) lookup performance
const staticModelsMap = new Map<string, typeof staticModels[0]>();
staticModels.forEach(model => {
    const id = `${model.developer}/${model.name}`;
    staticModelsMap.set(id, model);
});

export default function ModelProfilePage() {
    const params = useParams();
    const [model, setModel] = useState<Model | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('Playground');
    const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
    const [apiKey, setApiKey] = useState('YOUR_API_KEY');
    const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'python' | 'openai-python' | 'typescript' | 'openai-typescript'>('curl');

    // Load API key from storage
    useEffect(() => {
        const userApiKey = getApiKey();
        if (userApiKey) {
            setApiKey(userApiKey);
        }
    }, []);

    const modelId = useMemo(() => {
        const id = params.name as string;
        return id ? decodeURIComponent(id) : '';
    }, [params.name]);

    // Code examples moved to separate memo to avoid recalculation
    const codeExamples = useMemo(() => {
        if (!model) return {};
        
        return {
            curl: `curl -X POST https://api.gatewayz.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "${model.id}",
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
    url="https://api.gatewayz.ai/v1/chat/completions",
    headers={
        "Authorization": "Bearer ${apiKey}",
        "Content-Type": "application/json"
    },
    data=json.dumps({
        "model": "${model.id}",
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
    base_url="https://api.gatewayz.ai/v1",
    api_key="${apiKey}"
)

completion = client.chat.completions.create(
    model="${model.id}",
    messages=[
        {"role": "user", "content": "Hello! What can you help me with?"}
    ]
)

print(completion.choices[0].message.content)`,
            typescript: `fetch("https://api.gatewayz.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    "model": "${model.id}",
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
  apiKey: "${apiKey}",
  baseURL: "https://api.gatewayz.ai/v1"
});

const response = await client.chat.completions.create({
  model: "${model.id}",
  messages: [{ role: "user", content: "Hello! What can you help me with?" }]
});

console.log(response.choices[0].message.content);`
        };
    }, [apiKey, model]);

    useEffect(() => {
        if (!modelId) {
            setLoading(false);
            return;
        }

        // Optimized: O(1) lookup instead of O(n) search
        const staticModel = staticModelsMap.get(modelId);

        if (staticModel) {
            // Transform only the model we need
            setModel(transformStaticModel(staticModel));
            setLoading(false);
            return;
        }

        // Only fetch from API if not in static data
        const fetchModelFromAPI = async () => {
        const CACHE_KEY = `gatewayz_model_${modelId}`;
        const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

        try {
            // Check individual model cache first
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                try {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setModel(data);
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.log('Cache parse error:', e);
                }
            }

            // Fetch only from one gateway first (fastest)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            try {
                const response = await fetch(`/api/models?gateway=openrouter`, {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    const models = data.data || [];
                    const foundModel = models.find((m: Model) => m.id === modelId);

                    if (foundModel) {
                        setModel(foundModel);
                        // Cache the individual model
                        try {
                            localStorage.setItem(CACHE_KEY, JSON.stringify({
                                data: foundModel,
                                timestamp: Date.now()
                            }));
                        } catch (e) {
                            // Ignore cache errors
                        }
                    }
                }
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error) {
            console.log('Failed to fetch model:', error);
        } finally {
            setLoading(false);
        }
    };

        fetchModelFromAPI();
    }, [modelId]);

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedStates(prev => ({ ...prev, [id]: true }));
            setTimeout(() => {
                setCopiedStates(prev => ({ ...prev, [id]: false }));
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    if (loading) {
        return <ModelPageSkeleton />;
    }

    if (!model) {
        return (
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
                <h1 className="text-2xl font-bold">Model not found.</h1>
                <p className="text-muted-foreground mt-2">The model "{modelId}" could not be found.</p>
                <Link href="/models">
                    <Button className="mt-4">Browse Models</Button>
                </Link>
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
                        <p className="text-sm text-muted-foreground mb-3">
                            Created Apr 14, 2025 | By <span className="text-blue-600">{model.provider_slug} AI</span>
                        </p>
                        {/* Model ID with copy button */}
                        <div className="flex items-center gap-2 mb-3">
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
                        <div className="flex items-center gap-2 flex-wrap">
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
                    <Suspense fallback={<Skeleton className="h-20 w-full" />}>
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
                    </Suspense>
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
                    <div className="flex flex-col gap-4">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Playground: {model.name}</h2>
                            <p className="text-muted-foreground">
                                Test {model.name} directly in your browser. Messages are not saved to your chat history.
                            </p>
                        </div>
                        <Card className="h-[600px] p-4 overflow-hidden flex flex-col">
                            <InlineChat modelId={model.id} modelName={model.name} />
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

                        {/* Language Selector */}
                        <div className="flex gap-2 mb-4 flex-wrap">
                            {(['curl', 'python', 'openai-python', 'typescript', 'openai-typescript'] as const).map(lang => (
                                <Button
                                    key={lang}
                                    variant={selectedLanguage === lang ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedLanguage(lang)}
                                >
                                    {lang === 'curl' ? 'cURL' :
                                     lang === 'python' ? 'Python' :
                                     lang === 'openai-python' ? 'OpenAI Python' :
                                     lang === 'typescript' ? 'TypeScript' :
                                     'OpenAI TypeScript'}
                                </Button>
                            ))}
                        </div>

                        {/* Code Example */}
                        <div className="mb-6">
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
                                        onClick={() => copyToClipboard(codeExamples[selectedLanguage] || '', selectedLanguage)}
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
                                        <code>{codeExamples[selectedLanguage]}</code>
                                    </pre>
                                </div>
                                {/* Bottom gradient */}
                                <div className="h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
                            </div>
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
                            <h2 className="text-2xl font-bold">Providers for {model.name}</h2>
                            <p className="text-sm text-muted-foreground">
                                {providerData[model.name] ? providerData[model.name].length : 0} Provider{providerData[model.name]?.length !== 1 ? 's' : ''}
                            </p>
                        </div>

                        <Suspense fallback={<ProvidersLoading />}>
                            <ProvidersDisplay modelName={model.name} />
                        </Suspense>
                    </div>
                )}

                {activeTab === 'Activity' && (
                    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                        <ActivityTab modelName={model.name} />
                    </Suspense>
                )}

                {activeTab === 'Apps' && (
                    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                        <AppsTab modelName={model.name} />
                    </Suspense>
                )}

            </main>
        </div>
        </TooltipProvider>
    );
}