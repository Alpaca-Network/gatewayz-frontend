/**
 * Utility functions for model pricing and free model detection.
 *
 * Free Model Policy:
 * Only OpenRouter models with the `:free` suffix in their ID are considered free.
 * The `is_free` field from the backend is NOT used for determining free status.
 */

export interface ModelPricingInfo {
  id?: string;
  is_free?: boolean;
  source_gateway?: string;
  source_gateways?: string[];
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
