
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Pencil, ExternalLink, Terminal, Code2, Zap, Copy, Check, Globe } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

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

const WebSnippetCard = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState({
    autocapture: true,
    sessionRecording: true,
    personProfiles: 'identified_only' as 'identified_only' | 'always',
    apiDefaults: '2025-05-24',
  });

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_iz1i6TdtphwFCtQfK2tWxsoythvgLNcxJJO9zpNmxZf';
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  const generateSnippet = () => {
    const initConfig = [
      `api_host: '${posthogHost}'`,
      `defaults: '${config.apiDefaults}'`,
      `person_profiles: '${config.personProfiles}'`,
    ];

    if (!config.autocapture) {
      initConfig.push('autocapture: false');
    }

    if (!config.sessionRecording) {
      initConfig.push('session_recording: { enabled: false }');
    }

    return `<script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init Rr Mr fi Cr Ar ci Tr Fr capture Mi calculateEventProperties Lr register register_once register_for_session unregister unregister_for_session Hr getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Ur jr createPersonProfile zr kr Br opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Dr debug M Nr getPageViewId captureTraceFeedback captureTraceMetric $r".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('${posthogKey}', {
        ${initConfig.join(',\n        ')}
    })
</script>`;
  };

  const handleCopy = async () => {
    const snippet = generateSnippet();
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Web snippet copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              Web Snippet
              <span className="text-xs font-normal bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">Analytics</span>
            </CardTitle>
            <CardDescription>
              Add PostHog analytics to your website with configurable options
            </CardDescription>
          </div>
          <Code2 className="h-8 w-8 text-blue-500/40" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration Options */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-semibold">Configuration Options</h4>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autocapture" className="text-sm font-medium">Autocapture Events</Label>
              <p className="text-xs text-muted-foreground">Automatically capture clicks, form submissions, and pageviews</p>
            </div>
            <Switch
              id="autocapture"
              checked={config.autocapture}
              onCheckedChange={(checked) => setConfig({ ...config, autocapture: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sessionRecording" className="text-sm font-medium">Session Recording</Label>
              <p className="text-xs text-muted-foreground">Record user sessions for replay and analysis</p>
            </div>
            <Switch
              id="sessionRecording"
              checked={config.sessionRecording}
              onCheckedChange={(checked) => setConfig({ ...config, sessionRecording: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="personProfiles" className="text-sm font-medium">Person Profiles</Label>
            <Select
              value={config.personProfiles}
              onValueChange={(value: 'identified_only' | 'always') => setConfig({ ...config, personProfiles: value })}
            >
              <SelectTrigger id="personProfiles">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="identified_only">Identified Only</SelectItem>
                <SelectItem value="always">Always (includes anonymous)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.personProfiles === 'identified_only'
                ? 'Only create profiles for identified users'
                : 'Create profiles for all users including anonymous'
              }
            </p>
          </div>
        </div>

        {/* Generated Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Generated Snippet</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="h-8 gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Snippet
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <pre className="bg-slate-950 dark:bg-slate-900 border border-slate-800 rounded-md p-4 text-xs overflow-x-auto max-h-64 overflow-y-auto">
              <code className="text-green-400">{generateSnippet()}</code>
            </pre>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 space-y-2">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Installation Instructions</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Copy the snippet above</li>
              <li>Paste it into your website's HTML</li>
              <li>Place it just before the closing <code className="bg-muted px-1 rounded">&lt;/head&gt;</code> tag</li>
              <li>Deploy your changes and analytics will start tracking automatically</li>
            </ol>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Link
            href="https://posthog.com/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              PostHog Documentation
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
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

      {/* Web Snippet */}
      <WebSnippetCard />

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
