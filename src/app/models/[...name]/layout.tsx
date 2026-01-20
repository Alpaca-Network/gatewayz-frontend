/**
 * Server-side layout for model detail pages
 * Handles generateStaticParams for static generation and ISR configuration
 *
 * Note: For static export (desktop builds), only pre-generated models will be
 * available. For server mode (web), all models are accessible via ISR.
 */

import { ReactNode } from 'react';
import { generateStaticParamsForModels } from './utils';

/**
 * Generate static parameters for popular models at build time
 * This enables ISR and fast page loads for important models
 *
 * Pages will be pre-generated for:
 * - All static models (from models-data.ts)
 * - Top 30-50 models from popular gateways
 *
 * For server mode (web), any model not in this list will:
 * 1. Generate the page on first request (with `fallback: 'blocking'`)
 * 2. Cache it
 * 3. Revalidate after 1 hour
 *
 * For static export (desktop), only pre-generated models are accessible.
 */
export async function generateStaticParams() {
  return await generateStaticParamsForModels();
}

/**
 * Configure ISR (Incremental Static Regeneration) for model pages
 * (Only applies in server mode, not static export)
 *
 * revalidate: 3600 (1 hour)
 * - Pages will be revalidated every hour
 * - When accessed after expiry, serves stale page while regenerating in background
 * - New models added to providers will be visible on their detail page within 1 hour of addition
 */
export const revalidate = 3600; // 1 hour in seconds

/**
 * Dynamic params behavior:
 * - Server mode (web): defaults to true, enabling ISR fallback for any model
 * - Static export (desktop): automatically set to false by Next.js during static export
 *
 * No explicit export needed - Next.js handles this based on output mode
 */

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ name: string[] }>;
}

export default async function ModelDetailLayout({
  children,
  params,
}: LayoutProps) {
  return <>{children}</>;
}

/**
 * IMPLEMENTATION NOTES:
 *
 * This layout enables hybrid static generation:
 *
 * 1. BUILD TIME (generateStaticParams):
 *    - Pre-generates pages for ~50 popular/important models
 *    - Reduces build time by being selective
 *    - Provides instant page loads for most users
 *
 * 2. ISR REVALIDATION (revalidate) - Server mode only:
 *    - Every model page is revalidated every 1 hour
 *    - Ensures pricing and model info stay current
 *    - New models from providers visible after revalidation
 *
 * 3. DYNAMIC FALLBACK - Server mode only:
 *    - Any model not pre-generated will render on first request
 *    - Subsequent requests serve cached version
 *    - User doesn't wait for regeneration (unless first visitor)
 *    - Note: Not available in static export mode (desktop builds)
 *
 * 4. ON-DEMAND ISR (Webhook) - Server mode only:
 *    - Webhook at /api/webhooks/models-updated can trigger immediate refresh
 *    - When backends add new models, webhook regenerates pages instantly
 *    - See /api/webhooks/models-updated for implementation
 *
 * CACHE INVALIDATION:
 * - Time-based: All pages regenerate every 1 hour
 * - Event-based: Webhook can force immediate regeneration
 * - Tag-based: Individual models can be invalidated by ID
 */
