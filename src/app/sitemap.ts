import type { MetadataRoute } from 'next';

const BASE = 'https://beta.gatewayz.ai';

/**
 * Public, indexable routes only. Anything disallowed in robots.ts must not
 * appear here — advertising a URL that robots blocks is a Search Console
 * coverage error.
 *
 * Deliberately hand-maintained rather than crawled from the filesystem: the
 * app router directory contains authenticated and transactional surfaces that
 * look identical to marketing pages from a glob's point of view, and the
 * failure mode of getting that wrong is silent.
 *
 * Note for whoever revisits FR-A5.1: `/models` currently lives here, and
 * `www.gatewayz.ai/models` 307-redirects to it. If the marketing `/models`
 * index moves to the apex, this entry and that redirect change together (RG-4).
 */
const ROUTES: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }> = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/models', changeFrequency: 'daily', priority: 0.9 },
  { path: '/claude-code', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/developers', changeFrequency: 'monthly', priority: 0.7 },
  // /start itself 404s — it is a segment with no page, only children.
  { path: '/start/api', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/start/chat', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/start/claude-code', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/start/opencode', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/releases', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
