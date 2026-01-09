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
 */

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
 * Check if a gateway returns pricing in per-million format.
 */
export function isPerMillionPricingGateway(gateway: string): boolean {
  return PER_MILLION_PRICING_GATEWAYS.includes(gateway.toLowerCase());
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
 * Most gateways return per-token pricing (e.g., 0.00000015 = $0.00000015/token)
 * which needs to be multiplied by 1,000,000 to get per-million-tokens.
 * Some gateways (e.g., onerouter) already return per-million pricing.
 *
 * @param price - Price string from the API
 * @param sourceGateway - Gateway the model comes from
 * @returns Formatted price string for display (per-million-tokens) or null
 */
export function formatPricingForDisplay(price: string | undefined, sourceGateway: string): string | null {
  if (!price) return null;
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return null;

  // If gateway already returns per-million pricing, display as-is
  // Otherwise, multiply by 1,000,000 to convert from per-token to per-million
  const perMillionPrice = isPerMillionPricingGateway(sourceGateway) ? numPrice : numPrice * 1000000;

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

  // If gateway returns per-million pricing, convert to per-token
  // Otherwise, it's already per-token
  return isPerMillionPricingGateway(sourceGateway) ? numPrice / 1000000 : numPrice;
}
