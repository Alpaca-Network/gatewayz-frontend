/**
 * Next.js redirect configuration
 *
 * This module exports the redirect rules used by next.config.ts.
 * Extracted into a separate file for better testability.
 */

import type { Redirect } from 'next/dist/lib/load-custom-routes';

/**
 * Terragon production dashboard URL
 */
export const TERRAGON_DASHBOARD_URL = 'https://terragon-www-production.up.railway.app/dashboard';

/**
 * Redirect rules for the application
 *
 * These redirects are applied at the Next.js routing level,
 * before any page components are rendered.
 */
/**
 * Mirrors isWayzConfigured() in src/lib/wayz/addresses.ts.
 *
 * Deliberately duplicated rather than imported: this module is pulled in by
 * next.config.ts, which Next compiles on its own without the "@/" path alias,
 * so importing from src/lib there fails to resolve at config-compile time.
 * Two lines of duplication beats a build that breaks in a way jest can't see.
 */
function wayzIsConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS?.trim() &&
      process.env.NEXT_PUBLIC_WAYZ_STAKING_ADDRESS?.trim()
  );
}

export function getRedirects(): Redirect[] {
  return [
    // Staking is gated on the WAYZ contract addresses (src/lib/wayz/addresses.ts).
    // The page itself already calls notFound() when unconfigured, but as a
    // statically generated route that serves the not-found body with HTTP 200 —
    // a soft 404, which crawlers read as a live page. A redirect is evaluated
    // before rendering, so it is not subject to that, and it gives a real 3xx.
    ...(wayzIsConfigured()
      ? []
      : [
          {
            source: '/staking',
            destination: '/',
            permanent: false,
          },
        ]),
    // Deck presentation redirect
    {
      source: '/deck',
      destination: 'https://www.canva.com/design/DAG2Dc4lQvI/P2ws7cdUnYAjdFxXpsKvUw/view?utm_content=DAG2Dc4lQvI&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h20484be5f9',
      permanent: false,
    },
    // Terragon redirect - only for beta.gatewayz.ai host
    {
      source: '/terragon',
      destination: TERRAGON_DASHBOARD_URL,
      permanent: false,
      has: [
        {
          type: 'host',
          value: 'beta.gatewayz.ai',
        },
      ],
    },
    // Catalog consolidation (Task 8): the DB-driven /models page is now the single
    // model/provider browsing surface. The old admin-style /catalog/* pages (which
    // called the admin-gated /providers router) are consolidated into /models.
    {
      source: '/catalog',
      destination: '/models',
      permanent: false,
    },
    {
      source: '/catalog/models',
      destination: '/models',
      permanent: false,
    },
    {
      source: '/catalog/providers',
      destination: '/models',
      permanent: false,
    },
  ];
}
