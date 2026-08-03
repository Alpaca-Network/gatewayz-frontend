import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AGENT_TOOLS, getAgentTool, getAgentToolSlugs } from '@/lib/agent-tools';
import { SetupGuide } from './setup-guide';

/**
 * /use/[tool] — the wedge's acquisition pages.
 *
 * Server-rendered and statically generated so they are indexable and render
 * for logged-out visitors. The interactive parts live in SetupGuide.
 */

type Props = { params: Promise<{ tool: string }> };

export function generateStaticParams() {
  return getAgentToolSlugs().map((tool) => ({ tool }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = getAgentTool(slug);

  if (!tool) {
    return { title: 'Tool not found | Gatewayz' };
  }

  const url = `https://gatewayz.ai/use/${tool.slug}`;

  return {
    title: `${tool.seo.title} | Gatewayz`,
    description: tool.seo.description,
    keywords: tool.seo.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: tool.seo.title,
      description: tool.seo.description,
      url,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: tool.seo.title,
      description: tool.seo.description,
    },
  };
}

export default async function UseToolPage({ params }: Props) {
  const { tool: slug } = await params;
  const tool = getAgentTool(slug);

  if (!tool) {
    notFound();
  }

  // HowTo structured data — setup guides are exactly what this schema is for,
  // and it is what earns the step-by-step treatment in search results.
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: tool.seo.title,
    description: tool.seo.description,
    step: [
      { '@type': 'HowToStep', name: 'Install', text: tool.install.code },
      ...tool.configure.map((step) => ({
        '@type': 'HowToStep',
        name: step.label,
        text: step.code,
      })),
      { '@type': 'HowToStep', name: 'Verify', text: tool.verify.code },
    ],
  };

  const otherTools = AGENT_TOOLS.filter((t) => t.slug !== tool.slug);

  return (
    <div className="min-h-screen bg-background pb-24">
      <script
        type="application/ld+json"
        // Content is static and in-repo (src/lib/agent-tools.ts), never user
        // input. Escaping '<' anyway so a future code sample containing
        // "</script>" cannot break out of the tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(howToSchema).replace(/</g, '\\u003c'),
        }}
      />

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10">
          <p className="text-sm font-medium text-muted-foreground">Setup guide</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Run {tool.name} on Gatewayz
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">{tool.tagline}</p>
        </header>

        <SetupGuide tool={tool} />

        <section className="mt-16 border-t pt-8">
          <h2 className="mb-4 text-lg font-semibold">Other coding agents</h2>
          <div className="flex flex-wrap gap-3">
            {otherTools.map((other) => (
              <Link
                key={other.slug}
                href={`/use/${other.slug}`}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
              >
                {other.name}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
