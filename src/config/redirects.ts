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
    // Deck presentation redirect
    {
      source: '/deck',
      destination: 'https://www.canva.com/design/DAG2Dc4lQvI/P2ws7cdUnYAjdFxXpsKvUw/view?utm_content=DAG2Dc4lQvI&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h20484be5f9',
      permanent: false,
    },
    // Inbox redirect - redirects to Terragon for all hosts
    {
      source: '/inbox',
      destination: TERRAGON_DASHBOARD_URL,
      permanent: false,
    },
    // Code redirect - redirects to Terragon for all hosts
    {
      source: '/code',
      destination: TERRAGON_DASHBOARD_URL,
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
  ];
}
