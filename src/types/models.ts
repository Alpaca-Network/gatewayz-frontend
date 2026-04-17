/**
 * TypeScript type definitions for model data structures
 *
 * This file contains interfaces for both:
 * - Legacy Model format (used with /models endpoint)
 * - New UniqueModel format (used with /models/unique endpoint)
 */

// ============================================================================
// New UniqueModel Types (from /models/unique endpoint)
// ============================================================================

/**
 * Provider information for a unique model
 * Includes pricing, health status, and performance metrics
 */
export interface Provider {
  slug: string;                      // Provider identifier (e.g., "groq", "openrouter")
  name: string;                      // Display name (e.g., "Groq", "OpenRouter")
  pricing: {
    prompt: string;                  // Prompt price as string (e.g., "0.025" = $/1M tokens)
    completion: string;              // Completion price as string (e.g., "0.05" = $/1M tokens)
    image: string;                   // Image price as string (e.g., "0" if not applicable)
    request: string;                 // Request price as string (e.g., "0")
  };
  context_length: number;            // Context window size for this provider
  health_status: 'healthy' | 'degraded' | 'unhealthy';  // Provider health status
  average_response_time_ms: number;  // Average response time in milliseconds
  modality: string;                  // Modality type (e.g., "text->text", "text+image->text")
  supports_streaming: boolean;       // Whether provider supports streaming
  supports_function_calling: boolean; // Whether provider supports function calling
  supports_vision: boolean;          // Whether provider supports vision/image input
  model_name: string;                // Original model name from provider
  description?: string;              // Optional model description from provider
  architecture?: any;                // Optional architecture metadata
}

/**
 * Unique model with provider arrays from many-to-many relationship
 * This is the new format returned by /models/unique endpoint
 */
export interface UniqueModel {
  id: string;                        // Model ID (e.g., "gpt-4")
  name: string;                      // Model display name (e.g., "GPT-4")
  description: string | null;        // Model description
  context_length: number;            // Context window size in tokens
  architecture: {
    input_modalities: string[];      // Input types (e.g., ["text", "image"])
    output_modalities: string[];     // Output types (e.g., ["text"])
  } | null;
  supported_parameters: string[] | null;  // Supported API parameters
  provider_count: number;            // Number of providers offering this model
  providers: Provider[];             // Array of all providers (from many-to-many)
  cheapest_provider: string;         // Slug of cheapest provider (auto-calculated)
  fastest_provider: string;          // Slug of fastest provider (auto-calculated)
  cheapest_prompt_price: number;     // Lowest prompt price across providers
  fastest_response_time: number;     // Fastest response time across providers
  created?: number;                  // Unix timestamp of model creation
  is_private?: boolean;              // Whether model is on private network

  // Legacy compatibility fields (from adaptLegacyToUniqueModel)
  // These are populated when converting from legacy Model format
  provider_slug?: string;            // Primary provider slug (legacy compatibility)
  pricing?: {                        // Primary pricing (legacy compatibility)
    prompt: string;
    completion: string;
  } | null;
  source_gateway?: string;           // Single gateway (legacy compatibility)
  source_gateways?: string[];        // Array of all gateways (legacy compatibility)
  gateway_pricing?: Record<string, GatewayPricing>; // Per-gateway pricing (legacy compatibility)
}

/**
 * Response from /models/unique endpoint with pagination
 */
export interface UniqueModelsResponse {
  data: UniqueModel[];
  total?: number;                    // Total unique models available
  returned?: number;                 // Number of models in this response
  offset?: number;                   // Current offset
  limit?: number;                    // Current limit
  has_more?: boolean;                // Whether more results exist
  next_offset?: number;              // Next offset for pagination
}

/**
 * Query options for /models/unique endpoint
 */
export interface UniqueModelsQueryOptions {
  min_providers?: number;            // Minimum number of providers required
  sort_by?: 'provider_count' | 'name' | 'cheapest_price' | 'newest';
  order?: 'asc' | 'desc';
  limit?: number;                    // Results per page
  offset?: number;                   // Pagination offset
  search?: string;                   // Search query
}

// ============================================================================
// Legacy Model Types (from /models endpoint)
// ============================================================================

/**
 * Per-gateway pricing information (legacy format)
 */
export interface GatewayPricing {
  prompt: string;
  completion: string;
}

/**
 * Legacy model format from /models endpoint
 * This format requires client-side deduplication and merging
 * @deprecated Use UniqueModel instead when possible
 */
export interface Model {
  id: string;
  name: string;
  description: string | null;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  } | null;
  architecture: {
    input_modalities: string[] | null;
    output_modalities: string[] | null;
  } | null;
  supported_parameters: string[] | null;
  provider_slug: string;
  provider_slugs?: string[];         // Array of all providers (client-side merged)
  source_gateway?: string;           // Single gateway (backwards compat)
  source_gateways?: string[];        // Array of all gateways (client-side merged)
  gateway_pricing?: Record<string, GatewayPricing>; // Per-gateway pricing (client-side merged)
  created?: number;
  is_private?: boolean;
  is_free?: boolean;                 // OpenRouter :free models
}

/**
 * Paginated response format
 */
export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  returned?: number;
  offset?: number;
  limit?: number;
  has_more?: boolean;
  next_offset?: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a model is UniqueModel format
 */
export function isUniqueModel(model: Model | UniqueModel): model is UniqueModel {
  return 'providers' in model && Array.isArray((model as UniqueModel).providers);
}

/**
 * Type guard to check if a model is legacy Model format
 */
export function isLegacyModel(model: Model | UniqueModel): model is Model {
  return !isUniqueModel(model);
}

// ============================================================================
// Adapter Functions
// ============================================================================

/**
 * Convert legacy Model format to UniqueModel format
 * Useful during migration or when feature flag is being tested
 */
export function adaptLegacyToUniqueModel(model: Model): UniqueModel {
  const architecture = model.architecture
    ? {
      input_modalities: model.architecture.input_modalities || [],
      output_modalities: model.architecture.output_modalities || [],
    }
    : null;

  // Extract all gateways
  const gateways = model.source_gateways || (model.source_gateway ? [model.source_gateway] : []);
  const gatewayPricing = model.gateway_pricing || {};

  // Convert gateway pricing to Provider array.
  // IMPORTANT: when no pricing source resolves, emit empty strings (not '0'),
  // so formatPricingForDisplay() returns null and the UI renders "Contact for
  // pricing" instead of a bogus "$0.00/M" label.
  const providers: Provider[] = gateways.map(gateway => {
    const pricing = gatewayPricing[gateway] || model.pricing || { prompt: '', completion: '' };
    return {
      slug: gateway,
      name: gateway.charAt(0).toUpperCase() + gateway.slice(1),
      pricing: {
        prompt: pricing.prompt ?? '',
        completion: pricing.completion ?? '',
        image: '0',
        request: '0'
      },
      context_length: model.context_length,
      health_status: 'healthy' as const, // Default to healthy
      average_response_time_ms: 1000,    // Default to 1000ms
      modality: 'text->text',           // Default modality
      supports_streaming: true,         // Default to true
      supports_function_calling: false, // Default to false
      supports_vision: false,           // Default to false
      model_name: model.name,
      description: model.description || undefined,
      architecture: model.architecture || undefined,
    };
  });

  // Find cheapest provider. Only consider providers with a real (non-empty)
  // price string — an empty string means the provider has no resolved pricing,
  // not "$0". If nothing resolves, leave cheapestPrice as Infinity so the
  // caller can distinguish "truly free (0)" from "pricing unknown".
  let cheapestProvider = providers[0]?.slug || '';
  let cheapestPrice = Infinity;
  providers.forEach(p => {
    if (!p.pricing.prompt) return;
    const price = parseFloat(p.pricing.prompt);
    if (!isNaN(price) && price < cheapestPrice) {
      cheapestPrice = price;
      cheapestProvider = p.slug;
    }
  });

  // Find fastest provider (use first one as default)
  const fastestProvider = providers[0]?.slug || '';
  const fastestResponseTime = providers[0]?.average_response_time_ms || 1000;

  return {
    id: model.id,
    name: model.name,
    description: model.description,
    context_length: model.context_length,
    architecture,
    supported_parameters: model.supported_parameters,
    provider_count: providers.length,
    providers,
    cheapest_provider: cheapestProvider,
    fastest_provider: fastestProvider,
    cheapest_prompt_price: cheapestPrice === Infinity ? 0 : cheapestPrice,
    fastest_response_time: fastestResponseTime,
    created: model.created,
    is_private: model.is_private,
    // Legacy compatibility fields
    provider_slug: model.provider_slug,
    pricing: model.pricing,
    source_gateway: model.source_gateway,
    source_gateways: model.source_gateways,
    gateway_pricing: model.gateway_pricing,
  };
}

/**
 * Convert UniqueModel format to legacy Model format
 * Used for backwards compatibility with components not yet migrated
 */
export function adaptUniqueToLegacyModel(model: UniqueModel): Model {
  // Use cheapest provider as primary pricing
  const cheapestProvider = model.providers.find(p => p.slug === model.cheapest_provider);
  const pricing = cheapestProvider?.pricing || model.providers[0]?.pricing || null;

  // Build gateway_pricing map
  const gateway_pricing: Record<string, GatewayPricing> = {};
  model.providers.forEach(provider => {
    gateway_pricing[provider.slug] = provider.pricing;
  });

  return {
    id: model.id,
    name: model.name,
    description: model.description,
    context_length: model.context_length,
    pricing,
    architecture: model.architecture,
    supported_parameters: model.supported_parameters,
    provider_slug: model.providers[0]?.slug || 'unknown',
    provider_slugs: model.providers.map(p => p.slug),
    source_gateway: model.cheapest_provider,
    source_gateways: model.providers.map(p => p.slug),
    gateway_pricing,
    created: model.created,
    is_private: model.is_private,
    // cheapest_prompt_price defaults to 0 when no provider has valid pricing,
    // so checking `=== 0` alone would mis-label unpriced models as free.
    // Only claim "free" when we actually resolved a priced provider.
    is_free: !!pricing && model.cheapest_prompt_price === 0,
  };
}

/**
 * Merge multiple legacy Model objects into a list of UniqueModel objects.
 * This function groups models by their ID and consolidates all provider information.
 */
export function mergeLegacyModelsToUnique(legacyModels: Model[]): UniqueModel[] {
  const modelMap: Record<string, UniqueModel> = {};

  for (const legacyModel of legacyModels) {
    if (!legacyModel.id) continue;

    const adapted = adaptLegacyToUniqueModel(legacyModel);
    const existing = modelMap[legacyModel.id];

    if (!existing) {
      modelMap[legacyModel.id] = adapted;
    } else {
      // Merge providers
      const newProviders = adapted.providers;

      // Only add providers that aren't already there
      for (const newP of newProviders) {
        if (!existing.providers.some(p => p.slug === newP.slug)) {
          existing.providers.push(newP);
        }
      }

      // Update provider count
      existing.provider_count = existing.providers.length;

      // Update cheapest provider if necessary
      const cheapestNew = adapted.providers.reduce((min, p) =>
        (parseFloat(p.pricing.prompt) < parseFloat(min.pricing.prompt) ? p : min), adapted.providers[0]);

      if (parseFloat(cheapestNew.pricing.prompt) < existing.cheapest_prompt_price) {
        existing.cheapest_provider = cheapestNew.slug;
        existing.cheapest_prompt_price = parseFloat(cheapestNew.pricing.prompt);
      }

      // Update fastest provider if necessary
      const fastestNew = adapted.providers.reduce((min, p) =>
        (p.average_response_time_ms < min.average_response_time_ms ? p : min), adapted.providers[0]);

      if (fastestNew.average_response_time_ms < existing.fastest_response_time) {
        existing.fastest_provider = fastestNew.slug;
        existing.fastest_response_time = fastestNew.average_response_time_ms;
      }

      // Merge legacy fields for consistency
      if (!existing.source_gateways) existing.source_gateways = [];
      if (!existing.gateway_pricing) existing.gateway_pricing = {};

      adapted.providers.forEach(p => {
        if (!existing.source_gateways?.includes(p.slug)) {
          existing.source_gateways?.push(p.slug);
        }
        if (existing.gateway_pricing) {
          existing.gateway_pricing[p.slug] = p.pricing;
        }
      });
    }
  }

  return Object.values(modelMap);
}
