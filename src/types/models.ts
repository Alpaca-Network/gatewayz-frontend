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
    prompt: string;                  // Prompt price as string (e.g., "0.025")
    completion: string;              // Completion price as string (e.g., "0.05")
  };
  health_status: 'healthy' | 'degraded' | 'down';  // Provider health status
  average_response_time_ms: number;  // Average response time in milliseconds
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
  // Extract all gateways
  const gateways = model.source_gateways || (model.source_gateway ? [model.source_gateway] : []);
  const gatewayPricing = model.gateway_pricing || {};

  // Convert gateway pricing to Provider array
  const providers: Provider[] = gateways.map(gateway => ({
    slug: gateway,
    name: gateway.charAt(0).toUpperCase() + gateway.slice(1),
    pricing: gatewayPricing[gateway] || model.pricing || { prompt: '0', completion: '0' },
    health_status: 'healthy' as const, // Default to healthy
    average_response_time_ms: 1000,    // Default to 1000ms
  }));

  // Find cheapest provider
  let cheapestProvider = providers[0]?.slug || '';
  let cheapestPrice = Infinity;
  providers.forEach(p => {
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
    architecture: model.architecture,
    supported_parameters: model.supported_parameters,
    provider_count: providers.length,
    providers,
    cheapest_provider: cheapestProvider,
    fastest_provider: fastestProvider,
    cheapest_prompt_price: cheapestPrice === Infinity ? 0 : cheapestPrice,
    fastest_response_time: fastestResponseTime,
    created: model.created,
    is_private: model.is_private,
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
    is_free: model.cheapest_prompt_price === 0,
  };
}
