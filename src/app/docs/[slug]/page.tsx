import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getDocPage, getDocSlugs, getDocsByCategory } from '@/lib/docs';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) {
    return { title: 'Not found | Gatewayz docs' };
  }

  const url = `https://gatewayz.ai/docs/${page.slug}`;

  return {
    title: `${page.title} | Gatewayz docs`,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${page.title} | Gatewayz docs`,
      description: page.description,
      url,
      type: 'article',
    },
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) {
    notFound();
  }

  const grouped = getDocsByCategory();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto flex max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:px-8">
        <nav className="hidden w-56 shrink-0 lg:block">
          {Object.entries(grouped).map(([category, pages]) => (
            <div key={category} className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </p>
              <ul className="space-y-1">
                {pages.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/docs/${p.slug}`}
                      className={`block rounded px-2 py-1 text-sm ${
                        p.slug === page.slug
                          ? 'bg-muted font-medium'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <article className="min-w-0 flex-1">
          <header className="mb-10">
            <p className="text-sm text-muted-foreground">{page.category}</p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight">{page.title}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{page.description}</p>
          </header>

          <div className="space-y-10">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="mb-3 text-xl font-semibold">{section.heading}</h2>
                <p className="leading-relaxed text-muted-foreground">{section.body}</p>
                {section.code && (
                  <pre className="mt-4 overflow-x-auto rounded-lg border bg-slate-950 p-4 text-sm text-green-300">
                    <code>{section.code.content}</code>
                  </pre>
                )}
              </section>
            ))}
          </div>

          <footer className="mt-16 border-t pt-8">
            <p className="text-sm text-muted-foreground">
              Running a coding agent? See the{' '}
              <Link href="/use" className="underline">
                per-tool setup guides
              </Link>
              .
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
