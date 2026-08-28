import type { MetadataRoute } from 'next';

/**
 * beta.gatewayz.ai had no robots.txt at all — the path 404'd — so crawlers
 * applied their own defaults across the whole app, authenticated and
 * transactional surfaces included.
 *
 * This deliberately does NOT change whether beta is indexable overall. That is
 * a live RG-4 question (see docs/discovery-beta-gatewayz-ai.md §7): the cleanest
 * answer to the apex-vs-beta brand-query split may be to canonicalise everything
 * here to the apex domain. Until Joaquim rules, this keeps today's behaviour and
 * only excludes paths that should never have been crawlable.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/v1/',
          '/checkout',
          '/onboarding',
          '/settings',
          '/login',
          '/signin',
          '/signup',
          '/playground',
          '/monitoring',
          '/share/', // per-user shared artefacts
        ],
      },
    ],
    sitemap: 'https://beta.gatewayz.ai/sitemap.xml',
    host: 'https://beta.gatewayz.ai',
  };
}
