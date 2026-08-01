/**
 * Setup data for the coding-agent tools Gatewayz targets.
 *
 * These drive /use/[tool] — the wedge's acquisition pages. Everything here is
 * content, not logic, so a new tool is one object rather than a new page.
 *
 * Accuracy rule: only claim support the gateway actually delivers. A setup
 * guide that does not work is worse than no page at all, because the visitor
 * concludes the product is broken rather than that the docs are thin.
 */

export type ConfigStep = {
  label: string;
  /** Shell or file content. `{{API_KEY}}` is substituted at render time. */
  code: string;
  language?: 'bash' | 'json' | 'toml' | 'yaml';
  note?: string;
};

export type AgentTool = {
  slug: string;
  name: string;
  tagline: string;
  /** How the tool reaches the gateway. Drives the compatibility note. */
  protocol: 'anthropic-messages' | 'openai-chat';
  repoUrl: string;
  install: ConfigStep;
  configure: ConfigStep[];
  verify: ConfigStep;
  /** Honest caveats. Rendered prominently — these prevent support tickets. */
  caveats?: string[];
  recommendedModels: string[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
};

const GATEWAY_URL = 'https://api.gatewayz.ai';

export const AGENT_TOOLS: AgentTool[] = [
  {
    slug: 'claude-code',
    name: 'Claude Code',
    tagline: "Anthropic's terminal coding agent, running on any model through one key.",
    protocol: 'anthropic-messages',
    repoUrl: 'https://github.com/anthropics/claude-code',
    install: {
      label: 'Install Claude Code',
      code: 'npm install -g @anthropic-ai/claude-code',
      language: 'bash',
    },
    configure: [
      {
        label: 'Point it at Gatewayz',
        code: `export ANTHROPIC_BASE_URL=${GATEWAY_URL}
export ANTHROPIC_AUTH_TOKEN={{API_KEY}}`,
        language: 'bash',
        note: 'Add these to your shell profile to make them permanent.',
      },
    ],
    verify: {
      label: 'Verify',
      code: 'claude "say hello and nothing else"',
      language: 'bash',
    },
    caveats: [
      'Claude Code speaks the Anthropic Messages API. Gatewayz serves it natively at /v1/messages — no translation proxy required.',
      'Prompt caching is passed through, so your system prompt and file context are billed at the cache rate on repeat turns.',
    ],
    recommendedModels: ['anthropic/claude-sonnet-4', 'anthropic/claude-opus-4'],
    seo: {
      title: 'Run Claude Code on Gatewayz — setup guide',
      description:
        'Point Claude Code at Gatewayz with two environment variables. Native Anthropic Messages API support, prompt caching passed through, any model on one key.',
      keywords: [
        'claude code',
        'claude code cheaper',
        'claude code api costs',
        'ANTHROPIC_BASE_URL',
        'claude code proxy',
      ],
    },
  },
  {
    slug: 'cline',
    name: 'Cline',
    tagline: 'The autonomous coding agent for VS Code.',
    protocol: 'openai-chat',
    repoUrl: 'https://github.com/cline/cline',
    install: {
      label: 'Install Cline',
      code: '# Install the "Cline" extension from the VS Code marketplace',
      language: 'bash',
    },
    configure: [
      {
        label: 'Configure the provider',
        code: `API Provider:   OpenAI Compatible
Base URL:       ${GATEWAY_URL}/v1
API Key:        {{API_KEY}}
Model ID:       anthropic/claude-sonnet-4`,
        note: 'Cline settings → API Provider. Any model ID from the Gatewayz catalog works.',
      },
    ],
    verify: {
      label: 'Verify',
      code: '# Open the Cline panel and ask: "list the files in this repo"',
      language: 'bash',
    },
    caveats: [
      'Cline relies on tool calling and structured output — both are forwarded to the provider unmodified.',
    ],
    recommendedModels: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'deepseek/deepseek-v3'],
    seo: {
      title: 'Run Cline on Gatewayz — setup guide',
      description:
        'Configure Cline to use Gatewayz as an OpenAI-compatible provider. One key, every model, tool calling and prompt caching supported.',
      keywords: ['cline', 'cline vscode', 'cline api provider', 'cline cheaper models'],
    },
  },
  {
    slug: 'aider',
    name: 'Aider',
    tagline: 'AI pair programming in your terminal, git-native.',
    protocol: 'openai-chat',
    repoUrl: 'https://github.com/Aider-AI/aider',
    install: {
      label: 'Install Aider',
      code: 'python -m pip install aider-install && aider-install',
      language: 'bash',
    },
    configure: [
      {
        label: 'Point it at Gatewayz',
        code: `export OPENAI_API_BASE=${GATEWAY_URL}/v1
export OPENAI_API_KEY={{API_KEY}}`,
        language: 'bash',
      },
      {
        label: 'Run against a model',
        code: 'aider --model openai/anthropic/claude-sonnet-4',
        language: 'bash',
        note: "Aider prefixes custom endpoints with 'openai/'. The rest is the Gatewayz model ID.",
      },
    ],
    verify: {
      label: 'Verify',
      code: 'aider --model openai/anthropic/claude-sonnet-4 --message "what does this repo do?"',
      language: 'bash',
    },
    caveats: [
      "Aider's model-prefix convention means the full argument is openai/<gatewayz-model-id>. This is an Aider quirk, not a Gatewayz one.",
    ],
    recommendedModels: ['anthropic/claude-sonnet-4', 'deepseek/deepseek-v3', 'openai/gpt-4o'],
    seo: {
      title: 'Run Aider on Gatewayz — setup guide',
      description:
        'Use Gatewayz as Aider’s OpenAI-compatible endpoint. Two environment variables, any model, usage-based pricing with no subscription.',
      keywords: ['aider', 'aider ai', 'aider openai base url', 'aider cheaper models'],
    },
  },
  {
    slug: 'opencode',
    name: 'OpenCode',
    tagline: 'Open-source terminal coding agent.',
    protocol: 'openai-chat',
    repoUrl: 'https://github.com/sst/opencode',
    install: {
      label: 'Install OpenCode',
      code: 'curl -fsSL https://opencode.ai/install | bash',
      language: 'bash',
    },
    configure: [
      {
        label: 'Add Gatewayz as a provider',
        code: `{
  "provider": {
    "gatewayz": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "${GATEWAY_URL}/v1",
        "apiKey": "{{API_KEY}}"
      },
      "models": {
        "anthropic/claude-sonnet-4": { "name": "Claude Sonnet 4" }
      }
    }
  }
}`,
        language: 'json',
        note: 'Save as ~/.config/opencode/opencode.json',
      },
    ],
    verify: {
      label: 'Verify',
      code: 'opencode run "summarise this repository"',
      language: 'bash',
    },
    recommendedModels: ['anthropic/claude-sonnet-4', 'openai/gpt-4o'],
    seo: {
      title: 'Run OpenCode on Gatewayz — setup guide',
      description:
        'Add Gatewayz as an OpenCode provider. One config file, one API key, access to every model in the catalog.',
      keywords: ['opencode', 'opencode ai', 'opencode provider config'],
    },
  },
  {
    slug: 'continue',
    name: 'Continue',
    tagline: 'The open-source AI code assistant for VS Code and JetBrains.',
    protocol: 'openai-chat',
    repoUrl: 'https://github.com/continuedev/continue',
    install: {
      label: 'Install Continue',
      code: '# Install the "Continue" extension from the VS Code or JetBrains marketplace',
      language: 'bash',
    },
    configure: [
      {
        label: 'Add Gatewayz to your config',
        code: `{
  "models": [
    {
      "title": "Claude Sonnet 4 (Gatewayz)",
      "provider": "openai",
      "model": "anthropic/claude-sonnet-4",
      "apiBase": "${GATEWAY_URL}/v1",
      "apiKey": "{{API_KEY}}"
    }
  ]
}`,
        language: 'json',
        note: 'Save as ~/.continue/config.json',
      },
    ],
    verify: {
      label: 'Verify',
      code: '# Open the Continue panel and ask a question about the open file',
      language: 'bash',
    },
    caveats: [
      "Continue's codebase indexing uses an embeddings endpoint. Gatewayz does not serve /v1/embeddings yet, so configure a separate embeddings provider or disable indexing.",
    ],
    recommendedModels: ['anthropic/claude-sonnet-4', 'openai/gpt-4o'],
    seo: {
      title: 'Run Continue on Gatewayz — setup guide',
      description:
        'Configure Continue to use Gatewayz as an OpenAI-compatible provider in VS Code or JetBrains.',
      keywords: ['continue dev', 'continue vscode', 'continue config.json', 'continue apiBase'],
    },
  },
];

export function getAgentTool(slug: string): AgentTool | undefined {
  return AGENT_TOOLS.find((tool) => tool.slug === slug);
}

export function getAgentToolSlugs(): string[] {
  return AGENT_TOOLS.map((tool) => tool.slug);
}

/** Placeholder shown to logged-out visitors so the page is useful without an account. */
export const API_KEY_PLACEHOLDER = 'gw_your_api_key_here';

export function withApiKey(code: string, apiKey?: string | null): string {
  return code.replace(/\{\{API_KEY\}\}/g, apiKey || API_KEY_PLACEHOLDER);
}
