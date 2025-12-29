"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Terminal, Code2, Zap, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { getApiKey } from "@/lib/api";

type OSType = 'windows' | 'macos' | 'linux';

export default function ClaudeCodePage() {
  const { toast } = useToast();
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const { ready, authenticated, login } = usePrivy();
  const [apiKey, setApiKey] = useState('');
  const [selectedOS, setSelectedOS] = useState<OSType>('windows');

  // Check authentication and redirect if needed
  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      login();
    }
  }, [ready, authenticated, login]);

  // Detect OS on mount
  useEffect(() => {
    const detectOS = (): OSType => {
      if (typeof window === 'undefined') return 'windows';

      const userAgent = window.navigator.userAgent.toLowerCase();
      if (userAgent.includes('win')) return 'windows';
      if (userAgent.includes('linux')) return 'linux';
      if (userAgent.includes('mac')) return 'macos';

      return 'windows';
    };

    setSelectedOS(detectOS());
  }, []);

  // Load API key when authenticated
  useEffect(() => {
    const loadApiKey = () => {
      const userApiKey = getApiKey();
      if (userApiKey) {
        setApiKey(userApiKey);
      }
    };

    loadApiKey();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gatewayz_api_key') {
        loadApiKey();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also poll for changes every second
    const interval = setInterval(loadApiKey, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [authenticated]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates({ ...copiedStates, [id]: true });
      toast({ title: "Copied to clipboard" });
      setTimeout(() => {
        setCopiedStates({ ...copiedStates, [id]: false });
      }, 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <Button
      size="sm"
      className="h-8 px-3 flex-shrink-0 bg-white text-black hover:bg-gray-200 border border-gray-300"
      onClick={() => copyToClipboard(text, id)}
    >
      {copiedStates[id] ? (
        <>
          <Check className="h-4 w-4 mr-1 text-green-600" />
          <span className="text-xs font-medium">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 mr-1" />
          <span className="text-xs font-medium">Copy</span>
        </>
      )}
    </Button>
  );

  const installCommands = {
    windows: 'irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-windows.ps1 | iex',
    macos: 'bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-macos.sh)',
    linux: 'bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-linux.sh)'
  };

  return (
    <div className="container max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Terminal className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold">Claude Code + GatewayZ</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Use Claude Code with GatewayZ for smart AI routing, cost optimization, and access to 10+ models
        </p>
      </div>

      {/* Key Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Smart Routing</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically route to the best model for each task
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Code2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">10+ Models</h3>
                <p className="text-sm text-muted-foreground">
                  Claude, GPT-4, Gemini, DeepSeek, and more
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Terminal className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Cost Optimized</h3>
                <p className="text-sm text-muted-foreground">
                  Save money with intelligent model selection
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* One-Command Setup */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
              1
            </div>
            One-Command Setup
          </CardTitle>
          <CardDescription>
            Choose your platform and run the install command
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OS Selector */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedOS === 'windows' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedOS('windows')}
            >
              Windows
            </Button>
            <Button
              variant={selectedOS === 'macos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedOS('macos')}
            >
              macOS
            </Button>
            <Button
              variant={selectedOS === 'linux' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedOS('linux')}
            >
              Linux
            </Button>
          </div>

          {/* Install Command */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                {selectedOS === 'windows' && 'PowerShell (Run as Administrator)'}
                {selectedOS === 'macos' && 'Terminal'}
                {selectedOS === 'linux' && 'Terminal'}
              </span>
            </div>
            <div className="bg-slate-950 dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-800 rounded-lg p-4 font-mono text-sm flex items-center justify-between gap-4 shadow-lg">
              <code className="flex-1 overflow-x-auto text-green-300 dark:text-green-400">{installCommands[selectedOS]}</code>
              <CopyButton text={installCommands[selectedOS]} id={`install-${selectedOS}`} />
            </div>
          </div>

          {/* What it does */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
              This script will:
            </p>
            <ul className="text-sm text-blue-900 dark:text-blue-100 list-disc ml-5 space-y-1">
              <li>Install Claude Code Router</li>
              <li>Configure your GatewayZ API key</li>
              <li>Set up smart model routing</li>
              <li>Test the connection</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* API Key Display */}
      {apiKey ? (
        <Card className="mb-8 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-green-900 dark:text-green-100">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 font-bold">
                ✓
              </div>
              Your API Key
            </CardTitle>
            <CardDescription>
              Copy this key to use during installation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-950 dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-800 rounded-lg p-4 font-mono text-sm flex items-center justify-between gap-4 shadow-lg">
              <code className="flex-1 overflow-x-auto text-green-300 dark:text-green-400">{apiKey}</code>
              <CopyButton text={apiKey} id="api-key" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-amber-900 dark:text-amber-100">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-bold">
                ⚠
              </div>
              API Key Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-amber-900 dark:text-amber-100 mb-4">
              You'll need a GatewayZ API key to use Claude Code Router. Get one for free:
            </p>
            <Link href="/settings/keys">
              <Button variant="default">
                Get Your API Key
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Start Using */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
              2
            </div>
            Start Using Claude Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            After setup completes, start Claude Code:
          </p>
          <div className="bg-slate-950 dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-800 rounded-lg p-4 font-mono text-sm flex items-center justify-between shadow-lg">
            <code className="text-green-300 dark:text-green-400">ccr code</code>
            <CopyButton text="ccr code" id="start-command" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Switch models on-the-fly:</p>
            <div className="bg-slate-950 dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <code className="text-green-300 dark:text-green-400">/model gatewayz,openai/gpt-5</code>
                <CopyButton text="/model gatewayz,openai/gpt-5" id="model-gpt5" />
              </div>
              <div className="flex items-center justify-between">
                <code className="text-green-300 dark:text-green-400">/model gatewayz,x-ai/grok-code-fast-1</code>
                <CopyButton text="/model gatewayz,x-ai/grok-code-fast-1" id="model-grok" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Models */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle>Available Models</CardTitle>
          <CardDescription>
            Access these models through GatewayZ with smart routing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: 'GPT-5', provider: 'OpenAI' },
              { name: 'Gemini 2.5 Pro', provider: 'Google' },
              { name: 'Grok Code Fast 1', provider: 'x.ai' },
              { name: 'GPT-OSS-20B', provider: 'OpenAI' },
              { name: 'DeepSeek V3.1', provider: 'DeepSeek' },
              { name: 'Gemini 2.5 Flash', provider: 'Google' },
              { name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
              { name: 'Claude Sonnet 4', provider: 'Anthropic' },
              { name: 'Gemma 3 12B', provider: 'Google' },
              { name: 'Gemini 2.0 Flash', provider: 'Google' },
            ].map((model, i) => (
              <div key={i} className="p-3 rounded-lg border bg-card">
                <div className="font-medium text-sm">{model.name}</div>
                <div className="text-xs text-muted-foreground">by {model.provider}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Need Help?</h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="https://github.com/Alpaca-Network/gatewayz-frontend/tree/master/claude-code" target="_blank">
            <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
              <Download className="h-4 w-4" />
              Setup Guide
            </Button>
          </Link>
          <Link href="https://github.com/Alpaca-Network/claude-code-router" target="_blank">
            <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
              <Code2 className="h-4 w-4" />
              Claude Code Router
            </Button>
          </Link>
          <Link href="/settings/integrations">
            <Button size="lg" className="w-full sm:w-auto">
              View All Integrations
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
