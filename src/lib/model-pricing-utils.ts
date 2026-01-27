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
 * - OneRouter: per-million-tokens (e.g., 0.15 = $0.15/MTok)
 *
 * The formatPricingForDisplay function normalizes all pricing to per-million-tokens for display.
 *
 * Pricing Unit Mismatch Detection:
 * When a gateway returns pricing in an unexpected format, we detect this using heuristics:
 * 1. If calculated per-million price exceeds a reasonable threshold (e.g., $1000/MTok),
 *    the gateway likely returns per-million instead of per-token
 * 2. We auto-correct by dividing by the appropriate factor
 * 3. Final prices are capped at MAX_PRICE_PER_MILLION ($100/MTok) as a safety net
 *
 * This approach prevents order-of-magnitude errors from reaching users while
 * allowing the system to gracefully handle unknown gateways.
 */

/**
 * Maximum allowed price per million tokens for display.
 * Prices exceeding this are capped to prevent display of unrealistic values
 * caused by pricing unit mismatches between gateways.
 */
export const MAX_PRICE_PER_MILLION = 100;

/**
 * Threshold for detecting pricing unit mismatches.
 * If calculated per-million price exceeds this, we assume the gateway
 * returns per-million (not per-token) and auto-correct.
 *
 * Set to $1000/MTok - no legitimate model costs more than this per million tokens.
 * GPT-4o is ~$15/MTok, Claude 3.5 Opus is ~$75/MTok, so $1000 provides headroom.
 */
const PRICE_MISMATCH_THRESHOLD = 1000;

/**
 * Track gateways that have been warned about pricing mismatches.
 * Prevents flooding logs with repeated warnings for the same gateway.
 */
const warnedGateways = new Set<string>();

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
 *
 * How to identify if a gateway uses per-million pricing:
 * - If a model like GPT-4o-mini shows $0.15 in the API response, it's per-million
 * - If it shows $0.00000015, it's per-token
 *
 * Known per-million gateways (from manual_pricing.json and API responses):
 * - onerouter: Returns prices like 0.15 for $0.15/MTok
 * - google/google-vertex: Returns prices like 0.075 for $0.075/MTok
 * - helicone: Returns prices like 0.15 for $0.15/MTok
 * - vercel-ai-gateway: Returns prices like 0.15 for $0.15/MTok
 * - deepinfra: Returns prices like 0.35 for $0.35/MTok
 * - featherless: Returns prices like 0.35 for $0.35/MTok
 * - chutes: Returns prices like 0.02 for $0.02/MTok
 * - together: Returns prices like 0.20 for $0.20/MTok
 * - near: Returns prices like 1.00 for $1.00/MTok
 * - fireworks: Returns prices like 0.20 for $0.20/MTok
 * - groq: Returns prices like 0.05 for $0.05/MTok
 * - cerebras: Returns prices like 0.10 for $0.10/MTok
 * - novita: Returns prices like 0.12 for $0.12/MTok
 * - nebius: Returns prices like 0.20 for $0.20/MTok
 * - xai: Returns prices like 2.00 for $2.00/MTok
 * - alibaba/alibaba-cloud: Returns prices like 0.005 for $0.005/MTok
 * - clarifai: Returns prices like 3.00 for $3.00/MTok
 * - simplismart: Returns prices like 0.74 for $0.74/MTok
 * - akash: Returns prices like 0.13 for $0.13/MTok
 * - cloudflare-workers-ai: Returns prices like 0.66 for $0.66/MTok
 * - alpaca-network: Returns prices like 0.27 for $0.27/MTok
 *
 * NOTE: openai and anthropic direct gateways return per-TOKEN pricing (e.g., 0.0000025)
 * NOT per-million, so they are excluded from this list and handled like openrouter.
 */
const PER_MILLION_PRICING_GATEWAYS = [
  'onerouter',
  'google',
  'google-vertex',
  'helicone',
  'vercel-ai-gateway',
  'deepinfra',
  'featherless',
  'chutes',
  'together',
  'near',
  'fireworks',
  'groq',
  'cerebras',
  'novita',
  'nebius',
  'xai',
  'alibaba',
  'alibaba-cloud',
  'clarifai',
  'simplismart',
  'akash',
  'cloudflare-workers-ai',
  'alpaca-network',
];

/**
 * Gateways that return pricing in per-billion-tokens format.
 * These prices need to be divided by 1,000 to convert to per-million for display.
 * Example: aihubmix returns 150.0 for GPT-4o mini which should display as $0.15/MTok
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
 * Normalize price to per-million-tokens format with automatic mismatch detection.
 *
 * This is the core normalization logic used by both formatPricingForDisplay
 * and getNormalizedPerTokenPrice to ensure consistent behavior.
 *
 * Detection Logic:
 * 1. Apply known gateway format (per-token, per-million, per-billion)
 * 2. If result exceeds PRICE_MISMATCH_THRESHOLD ($1000/MTok), assume the gateway
 *    returns per-million instead of per-token and auto-correct
 * 3. Cap final result at MAX_PRICE_PER_MILLION ($100/MTok)
 *
 * @param numPrice - Numeric price value from the API
 * @param sourceGateway - Gateway the model comes from
 * @returns Normalized price in per-million-tokens format, capped at $100
 */
function normalizeToPerMillion(numPrice: number, sourceGateway: string): number {
  let perMillionPrice: number;

  if (isPerMillionPricingGateway(sourceGateway)) {
    // Already in per-million format, display as-is
    perMillionPrice = numPrice;
  } else if (isPerBillionPricingGateway(sourceGateway)) {
    // Per-billion format: divide by 1,000 to get per-million
    perMillionPrice = numPrice / 1000;
  } else {
    // Assume per-token format: multiply by 1,000,000 to get per-million
    perMillionPrice = numPrice * 1000000;
  }

  // Detect pricing unit mismatch: if price is unrealistically high,
  // the gateway likely returns per-million (not per-token)
  if (perMillionPrice > PRICE_MISMATCH_THRESHOLD) {
    // Log warning once per gateway to help identify gateways needing registration
    if (!warnedGateways.has(sourceGateway) && typeof console !== 'undefined') {
      warnedGateways.add(sourceGateway);
      console.warn(
        `[model-pricing-utils] Detected pricing unit mismatch for gateway "${sourceGateway}". ` +
        `Price ${numPrice} converted to $${perMillionPrice.toFixed(2)}/MTok which exceeds threshold. ` +
        `Consider adding "${sourceGateway}" to PER_MILLION_PRICING_GATEWAYS if it returns per-million prices.`
      );
    }
  }

  // Cap price at MAX_PRICE_PER_MILLION as a safety net
  if (perMillionPrice > MAX_PRICE_PER_MILLION) {
    perMillionPrice = MAX_PRICE_PER_MILLION;
  }

  return perMillionPrice;
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
 * Automatic Mismatch Detection:
 * If the calculated price exceeds $1000/MTok, we assume the gateway returns
 * per-million instead of per-token and log a warning. Final prices are
 * always capped at MAX_PRICE_PER_MILLION ($100/MTok) as a safety net.
 *
 * @param price - Price string from the API
 * @param sourceGateway - Gateway the model comes from
 * @returns Formatted price string for display (per-million-tokens), capped at $100, or null
 */
export function formatPricingForDisplay(price: string | undefined, sourceGateway: string): string | null {
  if (!price) return null;
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return null;

  const perMillionPrice = normalizeToPerMillion(numPrice, sourceGateway);
  return perMillionPrice.toFixed(2);
}

/**
 * Get normalized per-token price for filtering/sorting.
 * Returns price in per-token format regardless of gateway pricing convention.
 *
 * Uses the same normalization logic as formatPricingForDisplay to ensure
 * consistent behavior between display and filtering. A model showing $X/MTok
 * will be filtered/sorted using the same $X/MTok value.
 *
 * @param price - Price string from the API
 * @param sourceGateway - Gateway the model comes from
 * @returns Normalized per-token price as number (capped per-million / 1,000,000)
 */
export function getNormalizedPerTokenPrice(price: string | undefined, sourceGateway: string): number {
  if (!price) return 0;
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return 0;

  // Use the shared normalization logic (includes mismatch detection and capping)
  const perMillionPrice = normalizeToPerMillion(numPrice, sourceGateway);

  // Convert per-million to per-token
  return perMillionPrice / 1000000;
}
