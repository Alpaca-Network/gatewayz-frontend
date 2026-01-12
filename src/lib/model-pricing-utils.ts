/**
 * Utility functions for model pricing and free model detection.
 *
 * Free Model Policy:
 * Only OpenRouter models with the `:free` suffix in their ID are considered free.
 * The `is_free` field from the backend is NOT used for determining free status.
 *
 * Pricing Unit Normalization:
 * Different gateways return pricing in different units:
 * - Most gateways (OpenRouter, Groq, etc.): per-token (e.g., 0.00000015 = $0.00000015/token)
 * - OneRouter: per-million-tokens (e.g., 0.15 = $0.15/M tokens)
 *
 * The formatPricingForDisplay function normalizes all pricing to per-million-tokens for display.
 *
 * Price Limit:
 * Maximum displayed price is capped at $100/M tokens. If a calculated price exceeds this,
 * it indicates a pricing unit mismatch that needs investigation. The cap prevents
 * unrealistic prices from being displayed to users.
 */

/**
 * Maximum allowed price per million tokens for display.
 * Prices exceeding this are capped to prevent display of unrealistic values
 * caused by pricing unit mismatches between gateways.
 */
export const MAX_PRICE_PER_MILLION = 100;

export interface ModelPricingInfo {
  id?: string;
  is_free?: boolean;
  source_gateway?: string;
  source_gateways?: string[];
  pricing?: {
    prompt?: string | number | null;
    completion?: string | number | null;
  } | null;
}

/**
 * Gateways that return pricing in per-million-tokens format (not per-token).
 * These gateways should NOT have their pricing multiplied by 1,000,000.
 */
const PER_MILLION_PRICING_GATEWAYS = ['onerouter'];

/**
 * Gateways that return pricing in per-billion-tokens format.
 * These prices need to be divided by 1,000 to convert to per-million for display.
 * Example: aihubmix returns 150.0 for GPT-4o mini which should display as $0.15/M
 */
const PER_BILLION_PRICING_GATEWAYS = ['aihubmix'];

/**
 * Check if a gateway returns pricing in per-million format.
 */
export function isPerMillionPricingGateway(gateway: string): boolean {
  return PER_MILLION_PRICING_GATEWAYS.includes(gateway.toLowerCase());
}

/**
 * Check if a gateway returns pricing in per-billion format.
 */
export function isPerBillionPricingGateway(gateway: string): boolean {
  return PER_BILLION_PRICING_GATEWAYS.includes(gateway.toLowerCase());
}

/**
 * Determines the source gateway for a model, with fallback logic.
 * Priority: source_gateway > source_gateways[0] > empty string
 */
export function getSourceGateway(model: ModelPricingInfo): string {
  return model.source_gateway || model.source_gateways?.[0] || '';
}

/**
 * Determines if a model is free based on OpenRouter :free suffix.
 *
 * Only OpenRouter models with IDs ending in ':free' are considered free.
 * The is_free field from the backend is intentionally ignored.
 *
 * @param model - Model with id and gateway information
 * @returns true if the model is a free OpenRouter model
 */
export function isFreeModel(model: ModelPricingInfo): boolean {
  const sourceGateway = getSourceGateway(model);
  return sourceGateway === 'openrouter' && model.id?.endsWith(':free') === true;
}

/**
 * Determines the pricing category for a model.
 *
 * Categories:
 * - 'Portkey': Models from the portkey gateway
 * - 'Free': OpenRouter models with :free suffix
 * - 'Paid': All other models
 *
 * @param model - Model with id and gateway information
 * @returns The pricing category string
 */
export function getModelPricingCategory(model: ModelPricingInfo): 'Free' | 'Paid' | 'Portkey' {
  const sourceGateway = getSourceGateway(model);

  if (sourceGateway === 'portkey') {
    return 'Portkey';
  }

  return isFreeModel(model) ? 'Free' : 'Paid';
}

/**
 * Convert pricing to per-million-tokens format for display.
 *
 * Gateway pricing formats:
 * - Most gateways (OpenRouter, Groq, etc.): per-token (e.g., 0.00000015)
 *   → multiply by 1,000,000 to get per-million
 * - Per-million gateways (onerouter): per-million (e.g., 0.15)
 *   → display as-is
 * - Per-billion gateways (aihubmix): per-billion (e.g., 150.0)
 *   → divide by 1,000 to get per-million
 *
 * Price Cap:
 * Prices are capped at MAX_PRICE_PER_MILLION ($100/M tokens) to prevent
 * display of unrealistic values caused by pricing unit mismatches.
 * If a price exceeds this limit, it indicates the gateway's pricing format
 * may need to be added to the appropriate pricing gateway list.
 *
 * @param price - Price string from the API
 * @param sourceGateway - Gateway the model comes from
 * @returns Formatted price string for display (per-million-tokens), capped at $100, or null
 */
export function formatPricingForDisplay(price: string | undefined, sourceGateway: string): string | null {
  if (!price) return null;
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return null;

  let perMillionPrice: number;
  if (isPerMillionPricingGateway(sourceGateway)) {
    // Already in per-million format, display as-is
    perMillionPrice = numPrice;
  } else if (isPerBillionPricingGateway(sourceGateway)) {
    // Per-billion format: divide by 1,000 to get per-million
    perMillionPrice = numPrice / 1000;
  } else {
    // Per-token format: multiply by 1,000,000 to get per-million
    perMillionPrice = numPrice * 1000000;
  }

  // Cap price at MAX_PRICE_PER_MILLION to prevent unrealistic display values
  // This catches pricing unit mismatches where gateways return per-million
  // but aren't registered in PER_MILLION_PRICING_GATEWAYS
  if (perMillionPrice > MAX_PRICE_PER_MILLION) {
    perMillionPrice = MAX_PRICE_PER_MILLION;
  }

  return perMillionPrice.toFixed(2);
}

/**
 * Get normalized per-token price for filtering/sorting.
 * Returns price in per-token format regardless of gateway pricing convention.
 *
 * @param price - Price string from the API
 * @param sourceGateway - Gateway the model comes from
 * @returns Normalized per-token price as number
 */
export function getNormalizedPerTokenPrice(price: string | undefined, sourceGateway: string): number {
  if (!price) return 0;
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return 0;

  if (isPerMillionPricingGateway(sourceGateway)) {
    // Per-million format: divide by 1,000,000 to get per-token
    return numPrice / 1000000;
  } else if (isPerBillionPricingGateway(sourceGateway)) {
    // Per-billion format: divide by 1,000,000,000 to get per-token
    return numPrice / 1000000000;
  }
  // Already per-token
  return numPrice;
}
