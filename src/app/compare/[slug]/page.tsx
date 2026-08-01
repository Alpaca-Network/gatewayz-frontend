import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, Minus } from 'lucide-react';

import { COMPARISONS, getComparison, getComparisonSlugs } from '@/lib/comparisons';

/**
 * /compare/[slug] — bottom-funnel comparison pages.
 *
 * These capture "X vs Y" search, which is the highest-intent query a gateway
 * can rank for. They only work if they read as an honest assessment rather
 * than a sales sheet, so rows where the competitor wins are rendered as such
 * and the verdict says plainly when to pick the other option.
 */

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getComparisonSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparison(slug);

  if (!comparison) {
    return { title: 'Comparison not found | Gatewayz' };
  }

  const url = `https://gatewayz.ai/compare/${comparison.slug}`;

  return {
    title: `${comparison.seo.title} | Gatewayz`,
    description: comparison.seo.description,
    keywords: comparison.seo.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: comparison.seo.title,
      description: comparison.seo.description,
      url,
      type: 'article',
    },
  };
}

function AdvantageBadge({ advantage, competitorName }: { advantage: string; competitorName: string }) {
  if (advantage === 'gatewayz') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
        <Check className="h-3 w-3" /> Gatewayz
      </span>
    );
  }
  if (advantage === 'competitor') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
        <Check className="h-3 w-3" /> {competitorName}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" /> Even
    </span>
  );
}

export default async function ComparePage({ params }: Props) {
  const { slug } = await params;
  const comparison = getComparison(slug);

  if (!comparison) {
    notFound();
  }

  const others = COMPARISONS.filter((c) => c.slug !== comparison.slug);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">{comparison.headline}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{comparison.summary}</p>
        </header>

        <section className="mb-12 rounded-xl border bg-muted/40 p-6">
          <h2 className="mb-2 text-lg font-semibold">The short answer</h2>
          <p className="text-muted-foreground">{comparison.verdict}</p>
        </section>

        {/* Wide tables must scroll inside their own container rather than
            making the page scroll horizontally on mobile. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-3 pr-4 font-semibold">Feature</th>
                <th className="py-3 pr-4 font-semibold">Gatewayz</th>
                <th className="py-3 pr-4 font-semibold">{comparison.competitorName}</th>
                <th className="py-3 font-semibold">Edge</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.feature} className="border-b align-top">
                  <td className="py-4 pr-4 font-medium">{row.feature}</td>
                  <td className="py-4 pr-4 text-muted-foreground">{row.gatewayz}</td>
                  <td className="py-4 pr-4 text-muted-foreground">{row.competitor}</td>
                  <td className="py-4">
                    <AdvantageBadge
                      advantage={row.advantage}
                      competitorName={comparison.competitorName}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {comparison.rows.some((r) => r.detail) && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-semibold">Notes</h2>
            <dl className="space-y-4">
              {comparison.rows
                .filter((r) => r.detail)
                .map((row) => (
                  <div key={row.feature}>
                    <dt className="text-sm font-medium">{row.feature}</dt>
                    <dd className="text-sm text-muted-foreground">{row.detail}</dd>
                  </div>
                ))}
            </dl>
          </section>
        )}

        <section className="mt-16 border-t pt-8">
          <h2 className="mb-4 text-lg font-semibold">Try it</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Switching is a base URL change. Start with the setup guide for your agent.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/use" className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
              Setup guides
            </Link>
            <Link
              href="/benchmarks/coding"
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              Coding benchmark
            </Link>
            {others.map((other) => (
              <Link
                key={other.slug}
                href={`/compare/${other.slug}`}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
              >
                {other.headline}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
