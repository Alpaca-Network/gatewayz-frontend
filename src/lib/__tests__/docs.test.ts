/**
 * Docs content integrity.
 *
 * Docs that overstate support turn into support tickets and refunds, so the
 * tests check that the known gaps are actually documented rather than trusting
 * review to catch an omission.
 */

import { DOC_PAGES, getDocPage, getDocSlugs, getDocsByCategory } from '../docs';

describe('doc pages', () => {
  it('has unique slugs', () => {
    const slugs = getDocSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(DOC_PAGES.map((p) => [p.slug, p] as const))('%s is complete', (_slug, page) => {
    expect(page.title).toBeTruthy();
    expect(page.description.length).toBeGreaterThan(20);
    expect(page.sections.length).toBeGreaterThan(0);
    for (const section of page.sections) {
      expect(section.heading).toBeTruthy();
      expect(section.body.length).toBeGreaterThan(20);
    }
  });

  it('groups by category with stable ordering', () => {
    const grouped = getDocsByCategory();
    for (const pages of Object.values(grouped)) {
      const orders = pages.map((p) => p.order);
      expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    }
  });

  it('covers a quickstart', () => {
    expect(getDocPage('quickstart')).toBeDefined();
  });

  it('returns undefined for an unknown slug', () => {
    expect(getDocPage('nope')).toBeUndefined();
  });
});

describe('documented limitations', () => {
  const text = JSON.stringify(DOC_PAGES).toLowerCase();

  it('states that the agent loop is the caller’s job', () => {
    // We return tool_calls and expect the caller to execute them. A user who
    // assumes otherwise builds against behaviour that does not exist.
    expect(text).toContain('does not run the loop for you');
  });

  it('states that legacy completions cannot stream', () => {
    expect(text).toContain('streaming is not supported here');
  });

  it('states that embeddings are not metered through the credit ledger', () => {
    expect(text).toContain('not currently metered through the credit ledger');
  });

  it('states the $5 top-up minimum', () => {
    expect(text).toContain('$5 minimum');
  });

  it('explains why live keys require payment rather than just refusing', () => {
    expect(text).toContain('farmable');
  });

  it('tells the reader how to confirm caching actually worked', () => {
    expect(text).toContain('cache_read_input_tokens');
  });
});

describe('endpoint reference', () => {
  const endpoints = getDocPage('endpoints')!;
  const headings = endpoints.sections.map((s) => s.heading).join(' ');

  it.each([
    '/v1/chat/completions',
    '/v1/messages',
    '/v1/embeddings',
    '/v1/completions',
    '/v1/models',
  ])('documents %s', (path) => {
    expect(headings).toContain(path);
  });
});
