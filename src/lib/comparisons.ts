/**
 * Content for the /compare/* pages.
 *
 * Editorial rule for these pages: every row must be defensible if the
 * competitor reads it, because they will. Where a competitor is genuinely
 * better, the row says so — a comparison table that wins every line is read as
 * marketing and discarded. The credibility earned by conceding real points is
 * what makes the rows we do win believable.
 */

export type ComparisonRow = {
  feature: string;
  gatewayz: string;
  competitor: string;
  /** Who this row favours. 'competitor' rows are deliberate and stay in. */
  advantage: 'gatewayz' | 'competitor' | 'tie';
  detail?: string;
};

export type Comparison = {
  slug: string;
  competitorName: string;
  headline: string;
  summary: string;
  /** The honest one-paragraph answer to "which should I use?". */
  verdict: string;
  rows: ComparisonRow[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
};

export const COMPARISONS: Comparison[] = [
  {
    slug: 'gatewayz-vs-openrouter',
    competitorName: 'OpenRouter',
    headline: 'Gatewayz vs OpenRouter',
    summary:
      'Both are multi-model gateways with one API key. OpenRouter is the general-purpose router with the larger catalog and longer track record. Gatewayz is built specifically around coding agents.',
    verdict:
      'If you want the broadest possible model catalog and the most battle-tested option, use OpenRouter — they have more models and more years behind them. If you are running Claude Code, Cline or Aider all day and your bill is dominated by a large replayed prefix, Gatewayz is built for that workload: native Anthropic Messages support, prompt caching passed through and billed at the cache rate, and per-tool setup guides. Try both; the switching cost is a base URL.',
    rows: [
      {
        feature: 'Model catalog size',
        gatewayz: '100+ models, 30+ providers',
        competitor: 'Larger catalog, longer history',
        advantage: 'competitor',
        detail:
          'OpenRouter has been at this longer and lists more models. If breadth is your first criterion, that is a real advantage.',
      },
      {
        feature: 'Anthropic Messages API (/v1/messages)',
        gatewayz: 'Native — point ANTHROPIC_BASE_URL at Gatewayz',
        competitor: 'OpenAI-compatible only',
        advantage: 'gatewayz',
        detail:
          'Claude Code speaks the Messages API. Native support means no translation proxy in the path.',
      },
      {
        feature: 'Prompt caching',
        gatewayz: 'Passed through, billed at the cache rate',
        competitor: 'Supported on supported models',
        advantage: 'tie',
        detail:
          'Both pass caching through. Check the effective per-token rate for your own workload rather than taking either vendor’s word for it.',
      },
      {
        feature: 'Coding-agent setup guides',
        gatewayz: 'Per-tool guides for 5 agents',
        competitor: 'General API docs',
        advantage: 'gatewayz',
      },
      {
        feature: 'Published latency benchmarks',
        gatewayz: 'Coding-task benchmark, refreshed regularly',
        competitor: 'Per-model stats in the dashboard',
        advantage: 'tie',
      },
      {
        feature: 'Track record',
        gatewayz: 'Early — smaller team, newer service',
        competitor: 'Established, widely adopted',
        advantage: 'competitor',
        detail:
          'Worth weighing honestly if this sits on a production critical path today.',
      },
      {
        feature: 'Provider failover',
        gatewayz: 'Automatic, health-aware, with circuit breakers',
        competitor: 'Automatic',
        advantage: 'tie',
      },
    ],
    seo: {
      title: 'Gatewayz vs OpenRouter — an honest comparison',
      description:
        'Gatewayz and OpenRouter compared for coding agents: model catalog, Anthropic Messages support, prompt caching, pricing and track record. Including where OpenRouter wins.',
      keywords: [
        'gatewayz vs openrouter',
        'openrouter alternative',
        'llm gateway comparison',
        'openrouter coding agent',
      ],
    },
  },
  {
    slug: 'gatewayz-vs-anthropic',
    competitorName: 'Anthropic direct',
    headline: 'Gatewayz vs going direct to Anthropic',
    summary:
      'Anthropic direct gives you the shortest path to Claude. Gatewayz adds multi-model routing, failover and one key across providers, at the cost of one extra hop.',
    verdict:
      'If Claude is the only model you will ever use and you never want another vendor in the path, go direct — it is one fewer dependency and the lowest possible latency. Gatewayz makes sense when you want to switch models without changing code, need failover when Anthropic has a bad hour, or want one bill across several providers. On cached workloads the per-token economics are close enough that convenience, not price, should decide it.',
    rows: [
      {
        feature: 'Latency',
        gatewayz: 'One additional network hop',
        competitor: 'Shortest possible path',
        advantage: 'competitor',
      },
      {
        feature: 'Model choice',
        gatewayz: '100+ models across 30+ providers on one key',
        competitor: 'Claude models only',
        advantage: 'gatewayz',
      },
      {
        feature: 'Failover when a provider degrades',
        gatewayz: 'Automatic to a healthy alternative',
        competitor: 'None — you retry or wait',
        advantage: 'gatewayz',
      },
      {
        feature: 'Prompt caching',
        gatewayz: 'Passed through natively',
        competitor: 'Native',
        advantage: 'tie',
      },
      {
        feature: 'Rate limits',
        gatewayz: 'Pooled across providers',
        competitor: 'Your own Anthropic tier',
        advantage: 'gatewayz',
      },
      {
        feature: 'Vendor relationship',
        gatewayz: 'Gatewayz is an intermediary',
        competitor: 'Direct with the model provider',
        advantage: 'competitor',
        detail:
          'Some teams have procurement or compliance reasons to hold the provider relationship directly. That is a legitimate reason to skip any gateway.',
      },
    ],
    seo: {
      title: 'Gatewayz vs Anthropic direct — when a gateway is worth it',
      description:
        'When to use Gatewayz instead of the Anthropic API directly: multi-model routing, failover, pooled rate limits — and when going direct is the better call.',
      keywords: [
        'gatewayz vs anthropic',
        'anthropic api alternative',
        'claude api gateway',
        'llm gateway worth it',
      ],
    },
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}

export function getComparisonSlugs(): string[] {
  return COMPARISONS.map((c) => c.slug);
}
