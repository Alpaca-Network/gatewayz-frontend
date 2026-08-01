/**
 * Documentation content for /docs.
 *
 * Kept as structured data rather than MDX so pages stay statically generated,
 * indexable, and greppable — and so the Concierge support agent can be pointed
 * at the same source the docs site renders, rather than a second copy that
 * drifts.
 *
 * Editorial rule: document what the gateway actually does today, including the
 * gaps. A doc that overstates support turns into a support ticket and a refund.
 */

export type DocSection = {
  heading: string;
  body: string;
  code?: { language: string; content: string };
};

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  category: 'Getting started' | 'API reference' | 'Guides' | 'Billing';
  order: number;
  sections: DocSection[];
};

const BASE = 'https://api.gatewayz.ai';

export const DOC_PAGES: DocPage[] = [
  {
    slug: 'quickstart',
    title: 'Quickstart',
    description: 'Make your first request through Gatewayz in under two minutes.',
    category: 'Getting started',
    order: 1,
    sections: [
      {
        heading: 'Get a key',
        body: 'Create an account and issue an API key from settings. A `test` key is free and rate limited — enough to evaluate. A `live` key requires credits on the account.',
      },
      {
        heading: 'Make a request',
        body: 'Gatewayz is OpenAI-compatible. Point any OpenAI client at the base URL below.',
        code: {
          language: 'bash',
          content: `curl ${BASE}/v1/chat/completions \\
  -H "Authorization: Bearer $GATEWAYZ_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "anthropic/claude-sonnet-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
        },
      },
      {
        heading: 'Use the OpenAI SDK',
        body: 'Change two lines. Everything else works unchanged.',
        code: {
          language: 'python',
          content: `from openai import OpenAI

client = OpenAI(
    base_url="${BASE}/v1",
    api_key=os.environ["GATEWAYZ_API_KEY"],
)

response = client.chat.completions.create(
    model="anthropic/claude-sonnet-4",
    messages=[{"role": "user", "content": "Hello"}],
)`,
        },
      },
    ],
  },
  {
    slug: 'endpoints',
    title: 'Endpoints',
    description: 'Every API surface Gatewayz exposes, and which clients each one is for.',
    category: 'API reference',
    order: 1,
    sections: [
      {
        heading: 'POST /v1/chat/completions',
        body: 'The primary inference endpoint. OpenAI-compatible: streaming, tool calling, structured output, vision. Used by Cline, Aider, OpenCode, Continue and any OpenAI SDK.',
      },
      {
        heading: 'POST /v1/messages',
        body: 'Anthropic Messages API. Native, not a translation proxy — set `ANTHROPIC_BASE_URL` and Claude Code works directly. Supports streaming, tools and prompt caching. Accepts either `x-api-key` or `Authorization: Bearer`.',
      },
      {
        heading: 'POST /v1/embeddings',
        body: 'OpenAI-compatible embeddings, proxied to the owning provider. Model IDs must be namespaced (for example `openai/text-embedding-3-small`) — an unroutable model returns a 400 naming the supported prefixes rather than guessing. Embeddings are forwarded at cost and are not currently metered through the credit ledger.',
      },
      {
        heading: 'POST /v1/completions',
        body: 'Legacy text completions, translated to a chat request internally. Provided for tools that have not migrated. Streaming is not supported here — use /v1/chat/completions. Batched prompt arrays return one choice and say so in `gatewayz_warnings`.',
      },
      {
        heading: 'GET /v1/models',
        body: 'The model catalog, in OpenAI list shape. Each entry carries `supported_parameters` and a `capabilities` object so a client can check for tool, vision or caching support before sending a request.',
      },
    ],
  },
  {
    slug: 'prompt-caching',
    title: 'Prompt caching',
    description: 'How to cut the cost of a replayed context, and what it actually saves.',
    category: 'Guides',
    order: 1,
    sections: [
      {
        heading: 'Why it matters',
        body: 'A coding agent replays a large, mostly-static prefix on every turn: system prompt, tool definitions, file context. Without caching you pay full input price for those tokens every single turn. With caching you pay a one-off premium to write them, then a fraction of the input rate on every subsequent read.',
      },
      {
        heading: 'Mark a cache breakpoint',
        body: 'Add `cache_control` to the content block you want cached. Everything before the breakpoint is cached; put it at the end of your static prefix.',
        code: {
          language: 'json',
          content: `{
  "model": "anthropic/claude-sonnet-4",
  "messages": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "<your long, stable system prompt>",
          "cache_control": {"type": "ephemeral"}
        }
      ]
    },
    {"role": "user", "content": "the varying instruction"}
  ]
}`,
        },
      },
      {
        heading: 'Confirm it worked',
        body: 'The response `usage` object reports cache activity. If `cache_read_input_tokens` is zero on a repeat request, your breakpoint is not taking effect — usually because the prefix is below the provider’s minimum cacheable length or because it changed between turns.',
        code: {
          language: 'json',
          content: `"usage": {
  "prompt_tokens": 12450,
  "completion_tokens": 320,
  "cache_read_input_tokens": 11200,
  "cache_creation_input_tokens": 0
}`,
        },
      },
      {
        heading: 'Billing',
        body: 'Cache reads are billed at the provider’s cache rate, not the full input rate, and cache writes at the write rate. Models without caching support are billed at the normal input rate — check `capabilities.prompt_caching` on the model in the catalog before assuming.',
      },
    ],
  },
  {
    slug: 'tool-calling',
    title: 'Tool calling',
    description: 'Function calling, forced tool choice and structured output.',
    category: 'Guides',
    order: 2,
    sections: [
      {
        heading: 'Supported parameters',
        body: '`tools`, `tool_choice`, `parallel_tool_calls` and `response_format` are forwarded to the provider unmodified. Parameters a given provider does not accept are pruned rather than passed through as an error — check `supported_parameters` on the model to see what will reach it.',
      },
      {
        heading: 'Forcing a specific tool',
        body: 'Set `tool_choice` to force a call. This is honoured end to end.',
        code: {
          language: 'json',
          content: `{
  "tools": [{"type": "function", "function": {"name": "read_file", "parameters": {}}}],
  "tool_choice": {"type": "function", "function": {"name": "read_file"}}
}`,
        },
      },
      {
        heading: 'The agent loop is yours',
        body: 'Gatewayz returns `tool_calls` and expects you to execute them and send the results back as `role: "tool"` messages. It does not run the loop for you — every target agent tool runs its own.',
      },
    ],
  },
  {
    slug: 'api-keys',
    title: 'API keys and environments',
    description: 'Key environments, what each allows, and why live keys require credits.',
    category: 'Billing',
    order: 1,
    sections: [
      {
        heading: 'Environments',
        body: '`test` and `development` keys are free and rate limited — enough to evaluate the API without a card. `live` and `staging` keys require a payment signal on the account.',
      },
      {
        heading: 'Why live keys require payment',
        body: 'Free API keys are farmable, and a farmed key table makes every account metric meaningless. Requiring credits before issuing a live key is the cheapest filter that a bot cannot manufacture. If you hit this, top up and retry — or use a `test` key, which stays free.',
      },
      {
        heading: 'Credits',
        body: 'Credits are purchased through Stripe checkout with a $5 minimum. They are granted as soon as the payment settles; if the confirmation is slow, reloading the success page reconciles it immediately.',
      },
    ],
  },
  {
    slug: 'errors',
    title: 'Errors',
    description: 'What each status code means and what to do about it.',
    category: 'API reference',
    order: 2,
    sections: [
      {
        heading: '400 — invalid request',
        body: 'Malformed body, or a model that cannot be routed. Embedding models must be namespaced; the error names the supported prefixes.',
      },
      {
        heading: '402 — payment required',
        body: 'You asked for a live API key without credits on the account, or your balance is exhausted. The response body names the free alternative.',
      },
      {
        heading: '429 — rate limited',
        body: 'Either your key’s limit or an upstream provider’s. `Retry-After` is set when the upstream supplied one. Upstream 429s are surfaced as 429 rather than 502 so retry logic behaves correctly.',
      },
      {
        heading: '502 / 503 — provider trouble',
        body: 'The gateway failed over across healthy providers and none succeeded. Circuit breakers open after repeated failures; check /health for current provider status.',
      },
    ],
  },
];

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}

export function getDocSlugs(): string[] {
  return DOC_PAGES.map((p) => p.slug);
}

export function getDocsByCategory(): Record<string, DocPage[]> {
  const grouped: Record<string, DocPage[]> = {};
  for (const page of DOC_PAGES) {
    (grouped[page.category] ??= []).push(page);
  }
  for (const pages of Object.values(grouped)) {
    pages.sort((a, b) => a.order - b.order);
  }
  return grouped;
}
