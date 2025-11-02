"use client";

import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink, CheckCircle2 } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiKey } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import posthog from 'posthog-js';
import Link from 'next/link';
import Image from 'next/image';

type OSType = 'windows' | 'macos' | 'linux';

export default function StartClaudeCodePage() {
  const { user, ready, login } = usePrivy();
  const router = useRouter();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [selectedOS, setSelectedOS] = useState<OSType>('windows');

  // Track page view
  useEffect(() => {
    posthog.capture('view_start_claude_code');
  }, []);

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

  const installCommands = {
    windows: 'irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-windows.ps1 | iex',
    macos: 'bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-macos.sh)',
    linux: 'bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/claude-code/setup-linux.sh)'
  };

  const handleCopyInstaller = () => {
    navigator.clipboard.writeText(installCommands[selectedOS]);
    posthog.capture('installer_copied');
    toast({
      title: "Command Copied",
      description: "Paste it in your terminal to get started.",
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      posthog.capture('api_key_copied');
      toast({
        title: "API Key Copied",
        description: "Your API key has been copied to clipboard.",
      });
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 2000);
    }
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
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-4">
              <svg className="w-12 h-12 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="currentColor"/>
              </svg>
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Setup Claude Code with Gatewayz</h1>
          <p className="text-lg text-muted-foreground">
            One command. Access to 1000+ AI models in your IDE.
          </p>
        </div>

        {/* Step 1: Install */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">
              1
            </div>
            <h2 className="text-2xl font-bold">Run the Installer</h2>
          </div>

          {/* OS Selector */}
          <div className="flex gap-2 flex-wrap mb-4">
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
                  {selectedOS === 'windows' && 'PowerShell (Run as Administrator)'}
                  {selectedOS === 'macos' && 'Terminal'}
                  {selectedOS === 'linux' && 'Terminal'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyInstaller}
                className="text-slate-300 hover:text-white"
              >
                {copied ? (
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
              <pre className="text-sm sm:text-base leading-relaxed font-mono text-cyan-400 whitespace-pre-wrap break-all">
                $ {installCommands[selectedOS]}
              </pre>
            </div>

            {/* Bottom gradient */}
            <div className="h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
          </div>

          {/* What it does */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
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
        </div>

        {/* Step 2: Configure */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">
              2
            </div>
            <h2 className="text-2xl font-bold">Add Your Gatewayz API Key</h2>
          </div>

          <div className="bg-card border rounded-lg p-6 shadow-sm space-y-4">
            <p className="text-muted-foreground">
              During setup, when asked for an API key, use your Gatewayz key:
            </p>

            {apiKey ? (
              <div className="rounded-xl overflow-hidden shadow-lg border border-gray-800 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                {/* Terminal Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-950/50 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                    </div>
                    <span className="text-xs text-slate-400 ml-3 font-mono">API Key</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyApiKey}
                    className="text-slate-300 hover:text-white"
                  >
                    {copiedApiKey ? (
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
                {/* API Key Display */}
                <div className="bg-slate-950/80 p-6">
                  <pre className="text-sm leading-relaxed font-mono text-cyan-400 break-all">
                    {apiKey}
                  </pre>
                </div>
                {/* Bottom gradient */}
                <div className="h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm break-all">
                Generate your API key from Settings → Credits
              </div>
            )}

            {!apiKey && (
              <Link href="/settings/credits">
                <Button variant="outline" className="w-full sm:w-auto">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Get Your API Key
                </Button>
              </Link>
            )}

            <p className="text-sm text-muted-foreground">
              💡 <strong>Tip:</strong> Configure the base URL as <code className="bg-muted px-2 py-1 rounded">https://api.gatewayz.ai/v1</code> to use Gatewayz's unified API.
            </p>
          </div>
        </div>

        {/* Step 2: Start Using Claude Code */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">
              2
            </div>
            <h2 className="text-2xl font-bold">Start Using Claude Code</h2>
          </div>

          <p className="text-muted-foreground mb-4">
            After setup completes, start Claude Code:
          </p>

          {/* ccr code command */}
          <div className="rounded-xl overflow-hidden shadow-lg border border-gray-800 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 mb-6">
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
                onClick={() => {
                  navigator.clipboard.writeText('ccr code');
                  toast({ title: "Copied to clipboard" });
                }}
                className="text-slate-300 hover:text-white"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            {/* Code Display */}
            <div className="bg-slate-950/80 p-6">
              <pre className="text-sm sm:text-base leading-relaxed font-mono text-green-400">
                ccr code
              </pre>
            </div>
            {/* Bottom gradient */}
            <div className="h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
          </div>

          <p className="text-muted-foreground mb-4">
            Switch models on-the-fly:
          </p>

          {/* Model switching commands */}
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
            </div>
            {/* Code Display */}
            <div className="bg-slate-950/80 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <pre className="text-sm leading-relaxed font-mono text-green-400 flex-1">
                  /model gatewayz,openai/gpt-5
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText('/model gatewayz,openai/gpt-5');
                    toast({ title: "Copied to clipboard" });
                  }}
                  className="text-slate-300 hover:text-white ml-4"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <pre className="text-sm leading-relaxed font-mono text-green-400 flex-1">
                  /model gatewayz,x-ai/grok-code-fast-1
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText('/model gatewayz,x-ai/grok-code-fast-1');
                    toast({ title: "Copied to clipboard" });
                  }}
                  className="text-slate-300 hover:text-white ml-4"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
            {/* Bottom gradient */}
            <div className="h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="mb-12">
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>⚠️</span>
              Troubleshooting: Concurrency Limits
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              If you see errors about rate limits or concurrency, you may have hit your plan's limit.
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>Trial accounts: Limited to 3 concurrent requests</li>
              <li>Paid accounts: Higher limits based on your plan</li>
              <li>Wait a moment and try again, or upgrade your plan</li>
            </ul>
            <Link href="/settings/credits" className="inline-block mt-4">
              <Button variant="outline" size="sm">
                View Your Plan
              </Button>
            </Link>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-muted/50 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">What's Next?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Explore 1000+ models, switch providers on the fly, and build faster with Gatewayz.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/models">
              <Button variant="outline" size="sm">
                Browse Models
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" size="sm">
                View Docs
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="outline" size="sm">
                Try Web Chat
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
