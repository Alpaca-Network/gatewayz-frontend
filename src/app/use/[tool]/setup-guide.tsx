"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getApiKey } from '@/lib/api';
import { type AgentTool, type ConfigStep, withApiKey } from '@/lib/agent-tools';

/**
 * Client half of the /use/[tool] pages.
 *
 * The page itself is a server component so it renders for crawlers and
 * logged-out visitors; this component only handles the parts that need the
 * browser — inlining the visitor's real API key when they have one, and
 * copy-to-clipboard.
 */

function CodeBlock({ step, apiKey }: { step: ConfigStep; apiKey: string | null }) {
  const [copied, setCopied] = useState(false);
  const code = withApiKey(step.code, apiKey);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions; the code is selectable anyway.
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">{step.label}</span>
        <Button variant="ghost" size="sm" onClick={copy} aria-label={`Copy ${step.label}`}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg border bg-slate-950 p-4 text-sm text-green-300">
        <code>{code}</code>
      </pre>
      {step.note ? <p className="text-sm text-muted-foreground">{step.note}</p> : null}
    </div>
  );
}

export function SetupGuide({ tool }: { tool: AgentTool }) {
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(getApiKey() ?? null);
  }, []);

  return (
    <div className="space-y-8">
      {!apiKey && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <p className="text-sm">
              The commands below use a placeholder key. Sign in to have your real key filled in
              automatically.
            </p>
            <Link href="/signin">
              <Button size="sm">Get an API key</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Install</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock step={tool.install} apiKey={apiKey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Configure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {tool.configure.map((step) => (
            <CodeBlock key={step.label} step={step} apiKey={apiKey} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Verify</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock step={tool.verify} apiKey={apiKey} />
        </CardContent>
      </Card>

      {tool.caveats && tool.caveats.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Things worth knowing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {tool.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommended models</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {tool.recommendedModels.map((model) => (
            <Link
              key={model}
              href={`/models/${model}`}
              className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
            >
              {model}
            </Link>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <a
          href={tool.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:underline"
        >
          {tool.name} on GitHub <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
