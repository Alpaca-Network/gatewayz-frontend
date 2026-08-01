/**
 * Data-integrity tests for the wedge content surfaces.
 *
 * These pages are the top of the acquisition funnel and are read by people
 * deciding whether the product works. A setup guide with a broken placeholder
 * or a comparison table that wins every row costs more trust than it earns, so
 * both properties are enforced here rather than left to review.
 */

import {
  AGENT_TOOLS,
  API_KEY_PLACEHOLDER,
  getAgentTool,
  getAgentToolSlugs,
  withApiKey,
} from '../agent-tools';
import { COMPARISONS, getComparison, getComparisonSlugs } from '../comparisons';

describe('agent tools', () => {
  it('exposes the five targeted coding agents', () => {
    const slugs = getAgentToolSlugs();
    for (const expected of ['claude-code', 'cline', 'aider', 'opencode', 'continue']) {
      expect(slugs).toContain(expected);
    }
  });

  it('has unique slugs', () => {
    const slugs = getAgentToolSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(AGENT_TOOLS.map((t) => [t.slug, t] as const))(
    '%s has complete setup content',
    (_slug, tool) => {
      expect(tool.name).toBeTruthy();
      expect(tool.tagline).toBeTruthy();
      expect(tool.install.code).toBeTruthy();
      expect(tool.configure.length).toBeGreaterThan(0);
      expect(tool.verify.code).toBeTruthy();
      expect(tool.recommendedModels.length).toBeGreaterThan(0);
    }
  );

  it.each(AGENT_TOOLS.map((t) => [t.slug, t] as const))(
    '%s has SEO metadata',
    (_slug, tool) => {
      expect(tool.seo.title).toBeTruthy();
      expect(tool.seo.description.length).toBeGreaterThan(50);
      expect(tool.seo.keywords.length).toBeGreaterThan(0);
    }
  );

  it('routes Claude Code over the Anthropic Messages API', () => {
    // Claude Code has no OpenAI-compatible mode; getting this wrong makes the
    // whole guide non-functional.
    expect(getAgentTool('claude-code')?.protocol).toBe('anthropic-messages');
  });

  it('points Claude Code at ANTHROPIC_BASE_URL', () => {
    const config = getAgentTool('claude-code')!.configure[0].code;
    expect(config).toContain('ANTHROPIC_BASE_URL');
    expect(config).toContain('api.gatewayz.ai');
  });

  it('discloses the Continue embeddings gap', () => {
    // We do not serve /v1/embeddings; saying so up front prevents a user
    // concluding the gateway is broken.
    const caveats = getAgentTool('continue')?.caveats?.join(' ') ?? '';
    expect(caveats).toContain('embeddings');
  });

  it('returns undefined for an unknown slug', () => {
    expect(getAgentTool('not-a-real-tool')).toBeUndefined();
  });
});

describe('API key substitution', () => {
  it('substitutes a real key', () => {
    expect(withApiKey('key={{API_KEY}}', 'gw_live_abc')).toBe('key=gw_live_abc');
  });

  it('falls back to the placeholder when signed out', () => {
    expect(withApiKey('key={{API_KEY}}', null)).toBe(`key=${API_KEY_PLACEHOLDER}`);
  });

  it('replaces every occurrence', () => {
    expect(withApiKey('{{API_KEY}} {{API_KEY}}', 'k')).toBe('k k');
  });

  it('leaves code without a placeholder untouched', () => {
    expect(withApiKey('npm install foo', 'k')).toBe('npm install foo');
  });

  it('leaves no unsubstituted placeholders in any guide', () => {
    for (const tool of AGENT_TOOLS) {
      const blocks = [tool.install, ...tool.configure, tool.verify];
      for (const block of blocks) {
        expect(withApiKey(block.code, 'k')).not.toContain('{{API_KEY}}');
      }
    }
  });
});

describe('comparison pages', () => {
  it('has unique slugs', () => {
    const slugs = getComparisonSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(COMPARISONS.map((c) => [c.slug, c] as const))(
    '%s concedes at least one row to the competitor',
    (_slug, comparison) => {
      // A table that wins every line reads as marketing and gets discarded.
      // Conceding real points is what makes the won rows believable.
      const conceded = comparison.rows.filter((r) => r.advantage === 'competitor');
      expect(conceded.length).toBeGreaterThan(0);
    }
  );

  it.each(COMPARISONS.map((c) => [c.slug, c] as const))(
    '%s verdict says when to pick the competitor',
    (_slug, comparison) => {
      expect(comparison.verdict.length).toBeGreaterThan(100);
    }
  );

  it.each(COMPARISONS.map((c) => [c.slug, c] as const))(
    '%s rows are complete',
    (_slug, comparison) => {
      for (const row of comparison.rows) {
        expect(row.feature).toBeTruthy();
        expect(row.gatewayz).toBeTruthy();
        expect(row.competitor).toBeTruthy();
        expect(['gatewayz', 'competitor', 'tie']).toContain(row.advantage);
      }
    }
  );

  it('covers OpenRouter, the main competitor', () => {
    expect(getComparison('gatewayz-vs-openrouter')).toBeDefined();
  });

  it('returns undefined for an unknown slug', () => {
    expect(getComparison('gatewayz-vs-nobody')).toBeUndefined();
  });
});
