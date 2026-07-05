
"use client";

import { useCallback, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, ExternalLink, Terminal, Code2, Zap, Copy, Trash2, Loader2 } from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { BYOK_ENABLED } from "@/lib/config";
import {
  type Gateway,
  type ProviderKey,
  addProviderKey,
  deleteProviderKey,
  getGateways,
  listProviderKeys,
} from "@/lib/byok-api";

function BYOKManager() {
  const { toast } = useToast();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [apiKey, setApiKey] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [gw, k] = await Promise.all([
        getGateways().catch(() => [] as Gateway[]),
        listProviderKeys(),
      ]);
      setGateways(gw);
      setKeys(k);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load your provider keys",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const gatewayName = (slug: string) => gateways.find((g) => g.id === slug)?.name ?? slug;

  const handleSave = async () => {
    if (!selectedSlug || apiKey.trim().length < 8) {
      toast({
        title: "Missing details",
        description: "Choose a provider and paste a key of at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await addProviderKey(selectedSlug, apiKey.trim());
      toast({
        title: "Key saved",
        description: `Your ${gatewayName(selectedSlug)} key is stored securely.`,
      });
      setDialogOpen(false);
      setApiKey('');
      setSelectedSlug('');
      await refresh();
    } catch (e) {
      toast({
        title: "Could not save key",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    try {
      await deleteProviderKey(slug);
      toast({ title: "Key removed", description: `Your ${gatewayName(slug)} key was deleted.` });
      await refresh();
    } catch (e) {
      toast({
        title: "Could not remove key",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Bring Your Own Keys (BYOK)</h2>
          <p className="text-sm text-muted-foreground">
            Register your own upstream provider API keys. When enabled, your requests are
            served on your key and billed a reduced routing fee instead of the full credit
            cost. Keys are encrypted at rest and never shown again.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex-shrink-0">Add key</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Add a provider key</DialogTitle>
              <DialogDescription>
                Select a provider and paste your API key. It is encrypted on save and never
                displayed again.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="byok-provider">Provider</Label>
                <select
                  id="byok-provider"
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a provider…</option>
                  {gateways.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="byok-key">API Key</Label>
                <Input
                  id="byok-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your provider API key"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                ) : (
                  "Save key"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your keys…
            </div>
          ) : keys.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No provider keys yet. Add one to route your requests on your own provider account.
            </p>
          ) : (
            keys.map((k) => (
              <div
                key={k.provider_slug}
                className="flex items-center justify-between py-3 border-b last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{gatewayName(k.provider_slug)}</span>
                  <span className="text-xs font-mono text-muted-foreground">•••• {k.key_last4}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(k.provider_slug)}
                  aria-label={`Remove ${gatewayName(k.provider_slug)} key`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const OpenCodeCard = () => {
  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Terminal className="h-5 w-5 text-emerald-500" />
              OpenCode
              <span className="text-xs font-normal bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">NEW</span>
            </CardTitle>
            <CardDescription>
              AI-powered terminal development with GatewayZ integration
            </CardDescription>
          </div>
          <Code2 className="h-8 w-8 text-emerald-500/40" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            OpenCode is an open-source AI coding assistant that runs in your terminal. Connect it to GatewayZ for access to 1000+ models.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
              <Zap className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Multi-Agent</p>
                <p className="text-xs text-muted-foreground">Tab to switch between build & plan agents</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
              <Terminal className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">1000+ Models</p>
                <p className="text-xs text-muted-foreground">Claude, GPT, Gemini, Grok, DeepSeek</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
              <Code2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Open Source</p>
                <p className="text-xs text-muted-foreground">MIT licensed, community-driven</p>
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
                <code className="flex-1 overflow-x-auto text-green-400">irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-monorepo/main/opencode/setup-windows.ps1 | iex</code>
                <Button
                  size="sm"
                  className="h-8 px-3 flex-shrink-0 bg-white text-black hover:bg-gray-200 border border-gray-300"
                  onClick={() => {
                    navigator.clipboard.writeText('irm https://raw.githubusercontent.com/Alpaca-Network/gatewayz-monorepo/main/opencode/setup-windows.ps1 | iex');
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
                <code className="flex-1 overflow-x-auto text-green-400">bash &lt;(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-monorepo/main/opencode/setup-macos.sh)</code>
                <Button
                  size="sm"
                  className="h-8 px-3 flex-shrink-0 bg-white text-black hover:bg-gray-200 border border-gray-300"
                  onClick={() => {
                    navigator.clipboard.writeText('bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-monorepo/main/opencode/setup-macos.sh)');
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
                <code className="flex-1 overflow-x-auto text-green-400">bash &lt;(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-monorepo/main/opencode/setup-linux.sh)</code>
                <Button
                  size="sm"
                  className="h-8 px-3 flex-shrink-0 bg-white text-black hover:bg-gray-200 border border-gray-300"
                  onClick={() => {
                    navigator.clipboard.writeText('bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-monorepo/main/opencode/setup-linux.sh)');
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
              href="https://github.com/Alpaca-Network/gatewayz-monorepo/tree/main/opencode"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="default" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <ExternalLink className="h-4 w-4" />
                View Setup Guide
              </Button>
            </Link>
            <Link
              href="https://opencode.ai"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-2">
                <Code2 className="h-4 w-4" />
                OpenCode.ai
              </Button>
            </Link>
          </div>
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

      {/* OpenCode */}
      <OpenCodeCard />

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
      {BYOK_ENABLED && <BYOKManager />}

      {BYOK_ENABLED && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How BYOK billing works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>When you register a provider key, GatewayZ uses it to call that provider on your behalf.</p>
            <p>The inference cost is paid on your own provider account, so GatewayZ charges only a small routing fee instead of debiting the full credit cost.</p>
            <p>If a request can&apos;t use your key, it falls back to the platform key and is billed normally. Keys are encrypted at rest and can be removed at any time.</p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
