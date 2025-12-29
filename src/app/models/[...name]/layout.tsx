/**
 * Server-side layout for model detail pages
 * Handles generateStaticParams for static generation and ISR configuration
 */

import { ReactNode } from 'react';
import { generateStaticParamsForModels, MODEL_CACHE_TAGS } from './utils';

/**
 * Generate static parameters for popular models at build time
 * This enables ISR and fast page loads for important models
 *
 * Pages will be pre-generated for:
 * - All static models (from models-data.ts)
 * - Top 30-50 models from popular gateways
 *
 * For any model not in this list, Next.js will:
 * 1. Generate the page on first request (with `fallback: 'blocking'`)
 * 2. Cache it
 * 3. Revalidate after 1 hour
 */
export async function generateStaticParams() {
  return await generateStaticParamsForModels();
}

/**
 * Configure ISR (Incremental Static Regeneration) for model pages
 *
 * revalidate: 3600 (1 hour)
 * - Pages will be revalidated every hour
 * - When accessed after expiry, serves stale page while regenerating in background
 * - New models added to providers will be visible on their detail page within 1 hour of addition
 *
 * dynamic: 'force-dynamic'
 * - Override for homepage, but detail pages benefit from ISR
 */
export const revalidate = 3600; // 1 hour in seconds

/**
 * Configure on-demand ISR
 * Webhook at /api/webhooks/models-updated can trigger immediate regeneration
 */
export const dynamicParams = true; // Allow dynamic params not in generateStaticParams

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
 * 2. ISR REVALIDATION (revalidate):
 *    - Every model page is revalidated every 1 hour
 *    - Ensures pricing and model info stay current
 *    - New models from providers visible after revalidation
 *
 * 3. DYNAMIC FALLBACK (dynamicParams):
 *    - Any model not pre-generated will render on first request
 *    - Subsequent requests serve cached version
 *    - User doesn't wait for regeneration (unless first visitor)
 *
 * 4. ON-DEMAND ISR (Webhook):
 *    - Webhook at /api/webhooks/models-updated can trigger immediate refresh
 *    - When backends add new models, webhook regenerates pages instantly
 *    - See /api/webhooks/models-updated for implementation
 *
 * CACHE INVALIDATION:
 * - Time-based: All pages regenerate every 1 hour
 * - Event-based: Webhook can force immediate regeneration
 * - Tag-based: Individual models can be invalidated by ID
 */
