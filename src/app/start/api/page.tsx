"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, ExternalLink, Play } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiKey } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import posthog from 'posthog-js';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/config';
import { CodeHighlighter } from '@/components/code-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ModelData {
  id: number;
  rank: number;
  model_name: string;
  author: string;
  category?: string;
  provider?: string;
  tokens: string;
  trend_percentage: string;
  trend_direction: "up" | "down";
  trend_icon: string;
  trend_color: string;
  model_url: string;
  author_url: string;
  time_period: string;
  scraped_at: string;
  logo_url: string;
}

export default function StartApiPage() {
  const { user, ready, login } = usePrivy();
  const router = useRouter();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'javascript' | 'typescript'>('curl');
  const [copied, setCopied] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4');
  const [rankingModels, setRankingModels] = useState<ModelData[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  // Track page view
  useEffect(() => {
    posthog.capture('view_start_api');
  }, []);

  // Fetch ranking models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoadingModels(true);
        const response = await fetch(`${API_BASE_URL}/ranking/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const result = await response.json();
          // Get top models from "Top this month" period
          const monthlyModels = result.data
            .filter((model: ModelData) => model.time_period === 'Top this month')
            .sort((a: ModelData, b: ModelData) => a.rank - b.rank)
            .slice(0, 7); // Get top 7 models

          setRankingModels(monthlyModels);

          // Set the first model as default if available
          if (monthlyModels.length > 0) {
            const firstModel = monthlyModels[0];
            setSelectedModel(`${firstModel.author}/${firstModel.model_name.toLowerCase().replace(/\s+/g, '-')}`);
          }
        }
      } catch (error) {
        console.error('Failed to fetch ranking models:', error);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchModels();
  }, []);

  // Load API key
  useEffect(() => {
    if (!ready) return;

    if (!user) {
      // Redirect to login if not authenticated
      login();
      return;
    }

    const userApiKey = getApiKey();
    if (userApiKey) {
      setApiKey(userApiKey);
    }
  }, [user, ready, login]);

  const handleCopyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      posthog.capture('copy_api_key');
      toast({
        title: "API Key Copied",
        description: "Your API key has been copied to clipboard.",
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeExamples[activeTab]);
    toast({
      title: "Code copied!",
      description: "The code has been copied to your clipboard.",
    });
  };

  const codeExamples = {
    curl: `curl https://api.gatewayz.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "model": "${selectedModel}",
    "messages": [
      {
        "role": "user",
        "content": "Hello! What can you help me with?"
      }
    ]
  }'`,
    python: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.gatewayz.ai/v1",
    api_key="${apiKey || 'YOUR_API_KEY'}"
)

completion = client.chat.completions.create(
    model="${selectedModel}",  # Format: researcher/model
    messages=[
        {"role": "user", "content": "Hello! What can you help me with?"}
    ]
)

print(completion.choices[0].message.content)`,
    javascript: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: "https://api.gatewayz.ai/v1",
  apiKey: "${apiKey || 'YOUR_API_KEY'}"
});

const completion = await client.chat.completions.create({
  model: "${selectedModel}",
  messages: [
    { role: "user", content: "Hello! What can you help me with?" }
  ]
});

console.log(completion.choices[0].message.content);`,
    typescript: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: "https://api.gatewayz.ai/v1",
  apiKey: "${apiKey || 'YOUR_API_KEY'}"
});

const completion = await client.chat.completions.create({
  model: "${selectedModel}",
  messages: [
    { role: "user", content: "Hello! What can you help me with?" }
  ]
});

console.log(completion.choices[0].message.content);`
  };

  if (!ready || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Make Your First API Call</h1>
          <p className="text-lg text-muted-foreground">
            Copy your API key and run the code below. It works out of the box.
          </p>
        </div>

        {/* Step 1: API Key */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
              1
            </div>
            <h2 className="text-2xl font-bold">Copy Your API Key</h2>
          </div>

          <div className="bg-card border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-sm font-medium">Your API Key</label>
              {!apiKey && (
                <Link href="/settings/credits" className="text-sm text-blue-500 hover:underline">
                  Generate one here →
                </Link>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  className="h-12 pr-12 font-mono text-sm"
                  value={apiKey || 'No API key yet - claim your trial credits first'}
                  type={showApiKey ? "text" : "password"}
                  readOnly
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                >
                  {showApiKey ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <Button
                onClick={handleCopyApiKey}
                disabled={!apiKey}
                className="h-12 px-6"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            {/* Bonus note */}
            <p className="text-sm text-muted-foreground mt-4 text-center">
              💰 <strong>Add $10 → get +$10 bonus</strong> on your first top-up
            </p>
          </div>
        </div>

        {/* Step 2: Select Model */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
              2
            </div>
            <h2 className="text-2xl font-bold">Select a Model</h2>
          </div>

          <div className="bg-card border rounded-lg p-6 shadow-sm">
            <label className="text-sm font-medium mb-3 block">Choose from Top Ranked Models</label>
            {loadingModels ? (
              <div className="h-12 bg-muted animate-pulse rounded-md"></div>
            ) : (
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rankingModels.map((model) => {
                    const modelId = `${model.author}/${model.model_name.toLowerCase().replace(/\s+/g, '-')}`;
                    return (
                      <SelectItem key={model.id} value={modelId}>
                        <div className="flex items-center gap-2">
                          {model.logo_url && (
                            <img
                              src={model.logo_url}
                              alt={model.model_name}
                              className="w-5 h-5 rounded"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium">{model.model_name} ({model.author})</span>
                            <span className="text-xs text-muted-foreground">
                              #{model.rank} • {model.tokens} • {model.category || 'Language'}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              💡 Top models based on monthly rankings. The code below updates automatically with your selection.
            </p>
          </div>
        </div>

        {/* Step 3: Run Code */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
              3
            </div>
            <h2 className="text-2xl font-bold">Run Your First Call</h2>
          </div>

          <div className="rounded-xl overflow-hidden shadow-lg border border-gray-800 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950/50 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <span className="text-xs text-slate-400 ml-3 font-mono">
                  first-call.{activeTab === 'python' ? 'py' : activeTab === 'javascript' ? 'js' : activeTab === 'typescript' ? 'ts' : 'sh'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="text-slate-300 hover:text-white"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>

            {/* Language Tabs */}
            <div className="flex gap-1 px-4 pt-3 bg-slate-950/30 overflow-x-auto">
              <button
                onClick={() => setActiveTab('curl')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                  activeTab === 'curl'
                    ? 'bg-slate-950/80 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🔧 cURL
              </button>
              <button
                onClick={() => setActiveTab('python')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                  activeTab === 'python'
                    ? 'bg-slate-950/80 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🐍 Python
              </button>
              <button
                onClick={() => setActiveTab('javascript')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                  activeTab === 'javascript'
                    ? 'bg-slate-950/80 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                JavaScript
              </button>
              <button
                onClick={() => setActiveTab('typescript')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                  activeTab === 'typescript'
                    ? 'bg-slate-950/80 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                TypeScript
              </button>
            </div>

            {/* Code Display */}
            <div className="bg-slate-950/80 overflow-x-auto">
              <CodeHighlighter
                language={activeTab === 'curl' ? 'bash' : activeTab}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '1.5rem',
                  fontSize: '0.875rem',
                  lineHeight: '1.625',
                  backgroundColor: 'transparent'
                }}
              >
                {codeExamples[activeTab]}
              </CodeHighlighter>
            </div>

            {/* Bottom gradient */}
            <div className="h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
          </div>
        </div>

        {/* Step 4: Next Steps */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
              4
            </div>
            <h2 className="text-2xl font-bold">Explore Models</h2>
          </div>

          <div className="bg-card border rounded-lg p-6 shadow-sm">
            <p className="text-muted-foreground mb-4">
              Want to try other models? We support 1000+ models from OpenAI, Anthropic, Google, Meta, and more using the <code className="bg-muted px-2 py-1 rounded">researcher/model</code> format.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              💰 <strong>Add $10 in credits and get a bonus $10 on your first top-up</strong>
            </p>
            <Link href="/models">
              <Button variant="outline" className="w-full sm:w-auto">
                <ExternalLink className="w-4 h-4 mr-2" />
                Browse All Models
              </Button>
            </Link>
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-muted/50 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Need Help?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Check out our documentation or join our community for support.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/docs">
              <Button variant="outline" size="sm">
                View Docs
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="outline" size="sm">
                Try Chat Interface
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
