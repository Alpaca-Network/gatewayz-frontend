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
 * Whether this BUILD lists /staking in the header nav.
 *
 * Staking is UNLISTED on production: the page is reachable at /staking (so the
 * owner can test it end to end on beta.gatewayz.ai, which Privy already allows)
 * but nothing links to it, and the page is noindex. Preview/development
 * deployments and `next dev` show the nav link.
 *
 * Read at build time by next.config.ts, which inlines the result as
 * STAKING_NAV_HIDDEN for the header. Off Vercel it fails closed: any
 * `next build` hides the link, only `next dev` shows it.
 *
 * Kept free of "@/" imports: next.config.ts compiles this module without the
 * path alias.
 */
export function isStakingNavHiddenForBuild(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV) {
    return env.VERCEL_ENV === 'production';
  }
  return env.NODE_ENV === 'production';
}

/**
 * Redirect rules for the application
 *
 * These redirects are applied at the Next.js routing level,
 * before any page components are rendered.
 */
export function getRedirects(): Redirect[] {
  return [
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
