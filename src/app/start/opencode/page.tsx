"use client";

import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiKey } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import posthog from 'posthog-js';
import Link from 'next/link';

type OSType = 'windows' | 'macos' | 'linux';

export default function StartOpencodePage() {
  const { user, ready, login } = usePrivy();
  const router = useRouter();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [selectedOS, setSelectedOS] = useState<OSType>('macos');

  // Track page view
  useEffect(() => {
    posthog.capture('view_start_opencode');
  }, []);

  // Detect OS on mount
  useEffect(() => {
    const detectOS = (): OSType => {
      if (typeof window === 'undefined') return 'macos';

      const userAgent = window.navigator.userAgent.toLowerCase();
      if (userAgent.includes('win')) return 'windows';
      if (userAgent.includes('linux')) return 'linux';
      if (userAgent.includes('mac')) return 'macos';

      return 'macos';
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
    windows: 'irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup-windows.ps1 | iex',
    macos: 'bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup-macos.sh)',
    linux: 'bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup-linux.sh)'
  };

  const handleCopyInstaller = async () => {
    try {
      await navigator.clipboard.writeText(installCommands[selectedOS]);
      posthog.capture('opencode_installer_copied');
      toast({
        title: "Command Copied",
        description: "Paste it in your terminal to get started.",
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the command manually.",
        variant: "destructive",
      });
    }
  };

  const handleCopyApiKey = async () => {
    if (apiKey) {
      try {
        await navigator.clipboard.writeText(apiKey);
        posthog.capture('opencode_api_key_copied');
        toast({
          title: "API Key Copied",
          description: "Your API key has been copied to clipboard.",
        });
        setCopiedApiKey(true);
        setTimeout(() => setCopiedApiKey(false), 2000);
      } catch {
        toast({
          title: "Failed to copy API key",
          description: "Please copy the key manually.",
          variant: "destructive",
        });
      }
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
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-4">
              <svg className="w-12 h-12 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 8v8m-4-4h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Setup OpenCode with Gatewayz</h1>
          <p className="text-lg text-muted-foreground">
            One command. Access to 1000+ AI models in your terminal.
          </p>
        </div>

        {/* Step 1: Install */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
              1
            </div>
            <h2 className="text-2xl font-bold">Run the Installer</h2>
          </div>

          {/* OS Selector */}
          <div className="flex gap-2 flex-wrap mb-4">
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
            <Button
              variant={selectedOS === 'windows' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedOS('windows')}
            >
              Windows
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
            <div className="h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
          </div>

          {/* What it does */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-green-900 dark:text-green-100 font-medium mb-2">
              This script will:
            </p>
            <ul className="text-sm text-green-900 dark:text-green-100 list-disc ml-5 space-y-1">
              <li>Install OpenCode CLI</li>
              <li>Configure GatewayZ as your AI provider</li>
              <li>Set up your API key</li>
              <li>Test the connection</li>
            </ul>
          </div>
        </div>

        {/* Step 2: Configure */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
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
                <div className="h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm break-all">
                Generate your API key from Settings &rarr; Keys
              </div>
            )}

            {!apiKey && (
              <Link href="/settings/keys">
                <Button variant="outline" className="w-full sm:w-auto">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Get Your API Key
                </Button>
              </Link>
            )}

            <p className="text-sm text-muted-foreground">
              The setup script will automatically configure OpenCode to use <code className="bg-muted px-2 py-1 rounded">https://api.gatewayz.ai/v1</code> as the inference API.
            </p>
          </div>
        </div>

        {/* Step 3: Start Using OpenCode */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
              3
            </div>
            <h2 className="text-2xl font-bold">Start Using OpenCode</h2>
          </div>

          <p className="text-muted-foreground mb-4">
            After setup completes, start OpenCode:
          </p>

          {/* opencode command */}
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
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText('opencode');
                    posthog.capture('opencode_command_copied');
                    toast({ title: "Copied to clipboard" });
                  } catch {
                    toast({ title: "Failed to copy", variant: "destructive" });
                  }
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
                opencode
              </pre>
            </div>
            {/* Bottom gradient */}
            <div className="h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
          </div>

          <p className="text-muted-foreground mb-4">
            Switch models on-the-fly using the model picker or environment variables:
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
                <span className="text-xs text-slate-400 ml-3 font-mono">Available Models</span>
              </div>
            </div>
            {/* Code Display */}
            <div className="bg-slate-950/80 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <pre className="text-sm leading-relaxed font-mono text-green-400 flex-1">
                  anthropic/claude-sonnet-4.5
                </pre>
                <span className="text-xs text-slate-500 ml-4">Fast & capable</span>
              </div>
              <div className="flex items-center justify-between">
                <pre className="text-sm leading-relaxed font-mono text-green-400 flex-1">
                  openai/gpt-5
                </pre>
                <span className="text-xs text-slate-500 ml-4">Latest GPT</span>
              </div>
              <div className="flex items-center justify-between">
                <pre className="text-sm leading-relaxed font-mono text-green-400 flex-1">
                  google/gemini-2.5-pro
                </pre>
                <span className="text-xs text-slate-500 ml-4">Long context</span>
              </div>
              <div className="flex items-center justify-between">
                <pre className="text-sm leading-relaxed font-mono text-green-400 flex-1">
                  x-ai/grok-3-turbo-preview
                </pre>
                <span className="text-xs text-slate-500 ml-4">Fast reasoning</span>
              </div>
              <div className="flex items-center justify-between">
                <pre className="text-sm leading-relaxed font-mono text-green-400 flex-1">
                  deepseek/deepseek-v3.1
                </pre>
                <span className="text-xs text-slate-500 ml-4">Cost effective</span>
              </div>
            </div>
            {/* Bottom gradient */}
            <div className="h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="mb-12">
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>Need Help?</span>
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              If you encounter any issues during setup:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>Ensure you have curl (macOS/Linux) or PowerShell 5+ (Windows) installed</li>
              <li>Check that your API key is valid in Settings &rarr; Keys</li>
              <li>Try restarting your terminal after installation</li>
              <li>For Windows, run PowerShell as Administrator</li>
            </ul>
            <div className="flex gap-3 mt-4 flex-wrap">
              <Link href="/settings/keys">
                <Button variant="outline" size="sm">
                  View Your API Keys
                </Button>
              </Link>
              <a href="https://opencode.ai/docs" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  OpenCode Docs
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-muted/50 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">What&apos;s Next?</h3>
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
