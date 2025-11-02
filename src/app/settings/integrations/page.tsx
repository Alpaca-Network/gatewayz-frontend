
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Info, Pencil, ExternalLink, Terminal, Code2, Zap, Copy } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';

const providers = [
    { name: 'OpenAI', icon: 'openai.svg', docLink: 'https://platform.openai.com/account/api-keys' },
    { name: 'Google', icon: 'google.svg', docLink: 'https://makersuite.google.com/app/apikey' },
    { name: 'Anthropic', icon: 'anthropic.svg', docLink: 'https://console.anthropic.com/settings/keys' },
    { name: 'Mistral', icon: 'mistral.svg', docLink: 'https://console.mistral.ai/api-keys/' },
    { name: 'Cohere', icon: 'cohere.svg', docLink: 'https://dashboard.cohere.com/api-keys' },
    { name: 'Groq', icon: 'groq.svg', docLink: 'https://console.groq.com/keys' },
    { name: 'Perplexity', icon: 'perplexity.svg', docLink: 'https://docs.perplexity.ai/docs/getting-started' },
];

const ProviderRow = ({ provider }: { provider: typeof providers[0] }) => {
  const [apiKey, setApiKey] = useState('');

  return (
    <div className="flex items-center justify-between py-3 border-b">
      <div className="flex items-center gap-4">
        <Image 
            src={`https://placehold.co/24x24.png`}
            alt={`${provider.name} logo`}
            width={24}
            height={24}
            className="rounded-md"
            data-ai-hint={`${provider.name} logo`}
        />
        <span className="font-medium">{provider.name}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Not configured</span>
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Configure {provider.name}</DialogTitle>
                    <DialogDescription>
                        Paste your API key below to start using {provider.name} models.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label htmlFor="api-key">{provider.name} API Key</Label>
                    <Textarea 
                        id="api-key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={`Enter your ${provider.name} API key`}
                    />
                    <Link href={provider.docLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                        Find your API key <ExternalLink className="h-4 w-4" />
                    </Link>
                </div>
                 <DialogFooter>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};


export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Integrations
          <Info className="h-4 w-4 text-muted-foreground" />
        </h1>
        <p className="text-muted-foreground">
          Connect GatewayZ with your development tools and use your own provider API keys.
        </p>
      </div>

      {/* Claude Code Router Integration */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                Claude Code Router
                <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">NEW</span>
              </CardTitle>
              <CardDescription>
                Use GatewayZ with Claude Code for AI-powered development
              </CardDescription>
            </div>
            <Code2 className="h-8 w-8 text-primary/40" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Access multiple AI models through GatewayZ in your terminal with one-command setup for all platforms.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Smart Routing</p>
                  <p className="text-xs text-muted-foreground">Auto-select best model for each task</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                <Terminal className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">10+ Models</p>
                  <p className="text-xs text-muted-foreground">Claude, GPT-4, Gemini, DeepSeek</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                <Code2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Cost Optimized</p>
                  <p className="text-xs text-muted-foreground">Route to cost-effective models</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-sm font-medium">Quick Install:</div>

            <div className="space-y-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Terminal className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Windows (PowerShell)</span>
                </div>
                <div className="bg-slate-950 dark:bg-slate-900 border border-slate-800 rounded-md p-3 font-mono text-xs flex items-center justify-between gap-2 group">
                  <code className="flex-1 overflow-x-auto text-green-400">irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-windows.ps1 | iex</code>
                  <Button
                    size="sm"
                    className="h-8 px-3 flex-shrink-0 bg-white text-black hover:bg-gray-200 border border-gray-300"
                    onClick={() => {
                      navigator.clipboard.writeText('irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-windows.ps1 | iex');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    <span className="text-xs font-medium">Copy</span>
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Terminal className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">macOS</span>
                </div>
                <div className="bg-slate-950 dark:bg-slate-900 border border-slate-800 rounded-md p-3 font-mono text-xs flex items-center justify-between gap-2 group">
                  <code className="flex-1 overflow-x-auto text-green-400">bash &lt;(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-macos.sh)</code>
                  <Button
                    size="sm"
                    className="h-8 px-3 flex-shrink-0 bg-white text-black hover:bg-gray-200 border border-gray-300"
                    onClick={() => {
                      navigator.clipboard.writeText('bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-macos.sh)');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    <span className="text-xs font-medium">Copy</span>
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Terminal className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Linux</span>
                </div>
                <div className="bg-slate-950 dark:bg-slate-900 border border-slate-800 rounded-md p-3 font-mono text-xs flex items-center justify-between gap-2 group">
                  <code className="flex-1 overflow-x-auto text-green-400">bash &lt;(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-linux.sh)</code>
                  <Button
                    size="sm"
                    className="h-8 px-3 flex-shrink-0 bg-white text-black hover:bg-gray-200 border border-gray-300"
                    onClick={() => {
                      navigator.clipboard.writeText('bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-linux.sh)');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    <span className="text-xs font-medium">Copy</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Link
                href="https://github.com/Alpaca-Network/gatewayz-frontend/tree/master/claude-code"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="default" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  View Setup Guide
                </Button>
              </Link>
              <Link
                href="https://github.com/Alpaca-Network/claude-code-router"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <Code2 className="h-4 w-4" />
                  Claude Code Router
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BYOK Providers */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Bring Your Own Keys (BYOK)</h2>
        <p className="text-sm text-muted-foreground">
          Use your own provider API keys for additional flexibility and control.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          {providers.map(provider => (
            <ProviderRow key={provider.name} provider={provider} />
          ))}
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle className="text-lg">Key Priority and Fallback</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
           <p>OpenRouter always prioritizes using your provider keys when available.</p>
           <p>By default, if your key encounters a rate limit or failure, OpenRouter will fall back to using shared OpenRouter credits.</p>
           <p>You can configure individual keys with "Always use this key" to prevent any fallback to OpenRouter credits. When enabled, OpenRouter will only use your key for requests to that provider.</p>
        </CardContent>
      </Card>

    </div>
  );
}
