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
 * Whether this BUILD hides /staking (WAYZ is out of the product on production).
 *
 * True on a Vercel production deployment, false on Vercel preview/development
 * deployments so the owner can exercise the flow on a preview URL. Off Vercel
 * (no VERCEL_ENV) it fails closed: any `next build` hides staking, only
 * `next dev` shows it — a production build that somehow lost VERCEL_ENV must
 * not un-hide the page.
 *
 * Why this works where the address-gated rule of #1025 did not: VERCEL_ENV is
 * a Vercel system variable present during the build, and both consumers read
 * it at build time — next.config.ts evaluates redirects() into the routes
 * manifest, and inlines this same result as STAKING_ROUTE_HIDDEN (its `env`
 * block) for the page gate and header link. One value, one moment, no
 * build-vs-request disagreement. (#1025's rule emitted nothing for a simpler
 * reason: NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS / _STAKING_ADDRESS ARE set in the
 * Production environment, so "configured" was true and no rule was due.)
 *
 * Caveat: a deployment's manifest is fixed at build. Promoting a preview
 * deployment to production rebuilds it with production env on Vercel, so the
 * rule comes back; serving an old preview build as production would not.
 *
 * Kept free of "@/" imports: next.config.ts compiles this module without the
 * path alias.
 */
export function isStakingHiddenForBuild(env: NodeJS.ProcessEnv = process.env): boolean {
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
    // Staking is out of the product on production (WAYZ is hidden, #1021,
    // #1025, #1026) but reachable on preview deployments for testing. See
    // isStakingHiddenForBuild above for why a build-time env gate is sound.
    //
    // To bring staking back everywhere: delete this entry and the
    // STAKING_ROUTE_HIDDEN gate in src/lib/wayz/addresses.ts.
    ...(isStakingHiddenForBuild()
      ? [
          {
            source: '/staking',
            destination: '/',
            permanent: false,
          },
        ]
      : []),
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
