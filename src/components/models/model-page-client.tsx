"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { InlineChat } from '@/components/models/inline-chat';
import ReactMarkdown from "react-markdown";
import { getApiKey } from '@/lib/api';

type TabType = 'Playground' | 'Use Model' | 'Providers' | 'Activity' | 'Apps';

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

interface ModelPageClientProps {
  model: Model;
  modelProviders: string[];
  providersSection: React.ReactNode;
  activitySection: React.ReactNode;
  appsSection: React.ReactNode;
}

export function ModelPageClient({
  model,
  modelProviders,
  providersSection,
  activitySection,
  appsSection
}: ModelPageClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('Playground');
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [apiKey, setApiKey] = useState('gw_live_YOUR_API_KEY_HERE');
  const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'python' | 'openai-python' | 'typescript' | 'openai-typescript'>('curl');

  // Load API key from storage
  useEffect(() => {
    const userApiKey = getApiKey();
    if (userApiKey) {
      setApiKey(userApiKey);
    } else {
      setApiKey('gw_live_YOUR_API_KEY_HERE');
    }
  }, []);

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

  const codeExamples = {
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

  return (
    <>
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
            <Card className="flex-1 p-4 overflow-hidden flex flex-col">
              <InlineChat
                modelId={model.id}
                modelName={model.name}
                gateway={modelProviders.length > 0 ? modelProviders[0] : undefined}
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
                    onClick={() => copyToClipboard(codeExamples[selectedLanguage], selectedLanguage)}
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

        {activeTab === 'Providers' && providersSection}
        {activeTab === 'Activity' && activitySection}
        {activeTab === 'Apps' && appsSection}
      </main>
    </>
  );
}
