import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Changelog | Gatewayz',
  description:
    'What shipped on Gatewayz, newest first — the error contract agents can act on, streaming that fails loudly, exact model resolution, build transparency, and the Learn hub.',
  keywords: ['gatewayz changelog', 'release notes', 'llm api changelog', 'inference gateway updates'],
  alternates: { canonical: 'https://beta.gatewayz.ai/releases' },
  openGraph: {
    type: 'website',
    url: 'https://beta.gatewayz.ai/releases',
    siteName: 'Gatewayz',
    title: 'Gatewayz Changelog',
    description:
      'What shipped on Gatewayz, newest first — the error contract agents can act on, streaming that fails loudly, exact model resolution, build transparency, and the Learn hub.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gatewayz Changelog',
    description:
      'What shipped on Gatewayz, newest first — the error contract agents can act on, streaming that fails loudly, exact model resolution, build transparency, and the Learn hub.',
  },
};

// The public changelog. Everything here is user-visible behaviour that has
// shipped. Deliberately excluded, and to be kept excluded: internal ticket or
// branch references, file paths, vendor and tooling names, unreleased plans,
// partner traffic, and any figure we cannot source (model counts, uptime or
// SLA percentages, savings claims). Honest wording only -- "corrected",
// "clarified", "hardened" -- never a retroactive confession.
type ChangeTag = 'API' | 'Reliability' | 'Transparency' | 'App' | 'Docs' | 'Pricing' | 'Learn';

interface ChangeEntry {
  tag: ChangeTag;
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
}

interface ChangelogRelease {
  date: string;
  summary: string;
  entries: ChangeEntry[];
}

const TAG_CLASSES: Record<ChangeTag, string> = {
  API: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  Reliability: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  Transparency: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  App: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
  Docs: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
  Pricing: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  Learn: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20',
};

const CHANGELOG: ChangelogRelease[] = [
  {
    date: 'September 15, 2026',
    summary: 'Navigation cleanup.',
    entries: [
      {
        tag: 'App',
        title: 'Navigation links all resolve again',
        body: 'Several links in the header and footer pointed at destinations that no longer existed and returned a not-found page. Every navigation entry now goes where its label says it goes.',
      },
    ],
  },
  {
    date: 'September 14, 2026',
    summary: 'A Learn hub, a complete error reference, and a site that only says what it can source.',
    entries: [
      {
        tag: 'Learn',
        title: 'Learn hub',
        body: 'A new Learn hub is live: a Start here path that takes you from an API key to a first working request, ten foundation guides on inference and agents, longer in-depth articles, and a glossary for the vocabulary the docs assume.',
        href: 'https://www.gatewayz.ai/learn',
        hrefLabel: 'Open the Learn hub',
      },
      {
        tag: 'Docs',
        title: 'The full error contract is documented',
        body: 'The error reference now lists every status and error code the API returns, what causes each one, and whether retrying can help. You can write your handling against the reference instead of discovering codes in production.',
      },
      {
        tag: 'Docs',
        title: 'Unsourced claims removed',
        body: 'Figures we could not stand behind — model counts, availability and service-level numbers, and savings comparisons — are gone from the site. Automated checks now run on every change to keep them from creeping back in.',
      },
      {
        tag: 'Pricing',
        title: 'Pricing described plainly',
        body: 'Pricing is now described as what it is: the provider’s list price for the model you called, plus a routing fee. Per-model prices stay in the catalog, so you can compare before you send traffic.',
      },
      {
        tag: 'App',
        title: 'Claude Code setup corrected',
        body: 'The Claude Code setup guide gave a base URL with a path suffix that the Anthropic client appends itself, and named the wrong environment variable for the key. The guide now shows the base URL and the auth-token variable that actually work.',
      },
    ],
  },
  {
    date: 'September 11, 2026',
    summary: 'The status view stops guessing.',
    entries: [
      {
        tag: 'Transparency',
        title: 'Status reports only what it measures',
        body: 'The public status endpoint now reports measured signals from the live catalog and nothing else. A model that has not been measured is shown as unmonitored rather than being reported as down, so an absence of data no longer reads as an outage.',
      },
    ],
  },
  {
    date: 'September 10, 2026',
    summary: 'Traceability for anything you need to report.',
    entries: [
      {
        tag: 'Transparency',
        title: 'Responses are traceable to the exact build',
        body: 'Every response can now be tied back to the precise build that served it. When something looks wrong, a report names a specific release instead of a rough window.',
      },
      {
        tag: 'API',
        title: 'Check how a model id resolves before you send traffic',
        body: 'A diagnostic now reports how a given model id resolves against the live index — which exact model it lands on, or that it does not resolve at all. Useful when pinning a snapshot for a long-running agent.',
      },
    ],
  },
  {
    date: 'September 9, 2026',
    summary: 'Streams fail loudly; aliases resolve exactly.',
    entries: [
      {
        tag: 'Reliability',
        title: 'A stream that fails upstream ends with an error event',
        body: 'If an upstream failure interrupts a response part-way through, the stream now ends with an explicit error event instead of simply stopping. A truncated answer can no longer be mistaken for a complete one.',
      },
      {
        tag: 'API',
        title: 'Undated aliases resolve to their exact dated snapshot',
        body: 'An undated model alias now resolves to the exact dated snapshot behind it, and the response tells you which one you got. Resolution only: an id is never quietly swapped for a nearby model.',
      },
      {
        tag: 'API',
        title: 'Unknown model ids return a clear 400',
        body: 'An id that does not exist now returns 400 model_not_found instead of a retryable status. An agent stops retrying a request that can never succeed and surfaces the typo instead.',
      },
    ],
  },
  {
    date: 'September 8, 2026',
    summary: 'Errors an agent can act on.',
    entries: [
      {
        tag: 'API',
        title: 'Vendor-native model ids are accepted as written',
        body: 'Model ids in the form the provider publishes are accepted directly, so code that already names a model does not need a Gatewayz-specific spelling.',
      },
      {
        tag: 'API',
        title: 'Spend ceilings return 402 with a machine-readable code',
        body: 'A key that has spent its request cap returns 402 request_cap_exhausted, and an account with no balance returns 402 insufficient_credits. Both are terminal: a caller can top up or raise the cap rather than retry into the same wall.',
      },
      {
        tag: 'API',
        title: 'An invalid key is rejected, not demoted',
        body: 'A request that supplies a key which does not validate is now rejected outright. Previously such a request could fall through to the anonymous path, which made a bad key look like a working one with surprising limits.',
      },
    ],
  },
  {
    date: 'August 18, 2026',
    summary: 'Account and billing surfaces hardened.',
    entries: [
      {
        tag: 'App',
        title: 'Sign-in hardened',
        body: 'Sign-in and account linking were hardened, and the billing surfaces now check that the account asking for a record is the account that owns it. No action is needed on your side.',
      },
    ],
  },
];

export default function ReleasesPage() {
  return (
    <div className="min-h-screen bg-background" style={{ marginTop: '-65px' }}>
      <div
        data-page-content
        className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-8 pt-32 has-onboarding-banner:pt-40"
        style={{ transition: 'padding-top 0.3s ease' }}
      >
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-2xl lg:text-4xl font-bold tracking-tight">Changelog</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm lg:text-lg text-muted-foreground">
            What shipped on Gatewayz, newest first. Behaviour you can see from the outside — the
            error contract, model resolution, streaming, the app and the docs.
          </p>
        </header>

        {/* Releases */}
        <div className="space-y-8">
          {CHANGELOG.map((release) => (
            <Card key={release.date} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <CardTitle className="text-xl lg:text-2xl">{release.date}</CardTitle>
                <p className="text-sm text-muted-foreground">{release.summary}</p>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-6">
                  {release.entries.map((entry) => (
                    <li key={entry.title} className="border-l-2 border-border pl-4">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TAG_CLASSES[entry.tag]}`}
                        >
                          {entry.tag}
                        </span>
                        <h3 className="text-base font-semibold text-foreground">{entry.title}</h3>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">{entry.body}</p>
                      {entry.href && (
                        <a
                          href={entry.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                        >
                          {entry.hrefLabel ?? 'Read more'} →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          Looking for the contract behind these changes? It is written out in the{' '}
          <Link href="/docs" className="font-medium text-primary hover:underline">
            documentation
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
