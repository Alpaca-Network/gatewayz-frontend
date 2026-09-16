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
export function getRedirects(): Redirect[] {
  return [
    // Staking is out of the product for now (WAYZ is hidden), so this is
    // unconditional rather than gated on the contract addresses.
    //
    // The conditional version did not work: next.config.ts evaluates these
    // rules at BUILD time, while the page's own gate evaluates at REQUEST
    // time, and the two disagreed about whether WAYZ was configured — so no
    // rule was emitted and /staking kept answering 200. Verified against the
    // unconditional /deck rule in this same file, which returns 307 correctly.
    //
    // To bring staking back: delete this entry. The page's own gate and the
    // header nav link both still key off the contract addresses.
    {
      source: '/staking',
      destination: '/',
      permanent: false,
    },
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
