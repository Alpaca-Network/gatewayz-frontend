import type { Metadata } from 'next';
import Link from 'next/link';

import { AGENT_TOOLS } from '@/lib/agent-tools';

export const metadata: Metadata = {
  title: 'Run your coding agent on Gatewayz | Gatewayz',
  description:
    'Setup guides for Claude Code, Cline, Aider, OpenCode and Continue. One API key, every model, prompt caching passed through.',
  keywords: [
    'coding agent api',
    'claude code',
    'cline',
    'aider',
    'opencode',
    'continue dev',
    'cheapest llm api for coding',
  ],
  alternates: { canonical: 'https://gatewayz.ai/use' },
};

export default function UseIndexPage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight">
            Run your coding agent on Gatewayz
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            One API key, every model. Prompt caching is passed through and billed at the cache
            rate, so replaying a large static prefix every turn costs what it should.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {AGENT_TOOLS.map((tool) => (
            <Link
              key={tool.slug}
              href={`/use/${tool.slug}`}
              className="rounded-xl border p-6 transition-colors hover:bg-muted"
            >
              <h2 className="text-xl font-semibold">{tool.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{tool.tagline}</p>
              <p className="mt-4 text-sm font-medium">Setup guide →</p>
            </Link>
          ))}
        </div>

        <section className="mt-16 border-t pt-8">
          <h2 className="text-lg font-semibold">Comparing options?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            See how Gatewayz stacks up against{' '}
            <Link href="/compare/gatewayz-vs-openrouter" className="underline">
              OpenRouter
            </Link>{' '}
            and{' '}
            <Link href="/compare/gatewayz-vs-anthropic" className="underline">
              going direct to Anthropic
            </Link>
            , or read the{' '}
            <Link href="/benchmarks/coding" className="underline">
              coding-agent benchmark
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
