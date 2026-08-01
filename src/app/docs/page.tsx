import type { Metadata } from 'next';
import Link from 'next/link';

import { getDocsByCategory } from '@/lib/docs';

export const metadata: Metadata = {
  title: 'Documentation | Gatewayz',
  description:
    'Gatewayz API documentation: chat completions, the Anthropic Messages API, embeddings, prompt caching, tool calling, and billing.',
  keywords: ['gatewayz docs', 'llm gateway api', 'openai compatible api', 'anthropic messages api'],
  alternates: { canonical: 'https://gatewayz.ai/docs' },
};

export default function DocsIndexPage() {
  const grouped = getDocsByCategory();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            One API key, every model. OpenAI-compatible, with native Anthropic Messages support
            and prompt caching passed through.
          </p>
        </header>

        <div className="space-y-10">
          {Object.entries(grouped).map(([category, pages]) => (
            <section key={category}>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {pages.map((page) => (
                  <Link
                    key={page.slug}
                    href={`/docs/${page.slug}`}
                    className="rounded-xl border p-5 transition-colors hover:bg-muted"
                  >
                    <h3 className="font-semibold">{page.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{page.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-16 border-t pt-8">
          <h2 className="text-lg font-semibold">Running a coding agent?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The{' '}
            <Link href="/use" className="underline">
              setup guides
            </Link>{' '}
            cover Claude Code, Cline, Aider, OpenCode and Continue specifically.
          </p>
        </section>
      </div>
    </div>
  );
}
