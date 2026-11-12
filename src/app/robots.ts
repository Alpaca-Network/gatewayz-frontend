import type { MetadataRoute } from 'next';

// Static so it also builds under the Tauri static export (output: 'export').
export const dynamic = 'force-static';

/**
 * beta.gatewayz.ai had no robots.txt at all — the path 404'd — so crawlers
 * applied their own defaults across the whole app, authenticated and
 * transactional surfaces included.
 *
 * This deliberately does NOT change whether beta is indexable overall; it only
 * excludes authenticated and transactional paths that should never have been
 * crawlable.
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
