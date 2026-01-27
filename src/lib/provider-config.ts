/**
 * Provider API Configuration Utility
 *
 * Centralized configuration for provider API endpoints, authentication,
 * and model ID formatting. This is the single source of truth for provider
 * API settings used in the Playground and "Use Model" tabs.
 *
 * This module works alongside:
 * - gateway-registry.ts: Display names, colors, logos
 * - provider-model-formats.ts: Model ID transformation functions
 */

import { getGatewayDisplayName } from './gateway-registry';
import { getFormattedModelId, stripDeveloperPrefix, keepFullModelId } from './provider-model-formats';

/**
 * Configuration for a provider's API endpoint
 */
export interface ProviderApiConfig {
  /** Base URL for the provider's API (e.g., 'https://api.openai.com/v1') */
  baseUrl: string;
  /** Whether the provider requires an API key */
  requiresApiKey: boolean;
  /** Placeholder text for the API key input (e.g., 'sk-...') */
  apiKeyPlaceholder: string;
  /** Optional function to format model IDs for this provider */
  modelIdFormat?: (modelId: string) => string;
}

/**
 * Full provider configuration including display info
 */
export interface ProviderConfig extends ProviderApiConfig {
  /** Display name for the provider */
  name: string;
}

/**
 * Static API configurations for each provider.
 * Display names are fetched from gateway-registry.ts for consistency.
 */
const PROVIDER_API_CONFIGS: Record<string, ProviderApiConfig> = {
  gatewayz: {
    baseUrl: 'https://api.gatewayz.ai/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'gw_live_YOUR_API_KEY_HERE',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-or-v1-...',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-...',
    modelIdFormat: stripDeveloperPrefix,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-ant-...',
    modelIdFormat: stripDeveloperPrefix,
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'gsk_...',
    modelIdFormat: stripDeveloperPrefix,
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: '...',
    modelIdFormat: keepFullModelId,
  },
  fireworks: {
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'fw_...',
    modelIdFormat: keepFullModelId,
  },
  deepinfra: {
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    requiresApiKey: true,
    apiKeyPlaceholder: '...',
    modelIdFormat: keepFullModelId,
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'AIza...',
  },
  'google-vertex': {
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'AIza...',
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'csk-...',
    modelIdFormat: stripDeveloperPrefix,
  },
  xai: {
    baseUrl: 'https://api.x.ai/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'xai-...',
    modelIdFormat: stripDeveloperPrefix,
  },
  huggingface: {
    baseUrl: 'https://api-inference.huggingface.co/models',
    requiresApiKey: true,
    apiKeyPlaceholder: 'hf_...',
    modelIdFormat: keepFullModelId,
  },
  near: {
    baseUrl: 'https://api.near.ai/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'near_...',
    modelIdFormat: keepFullModelId,
  },
  nebius: {
    baseUrl: 'https://api.studio.nebius.ai/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: '...',
    modelIdFormat: stripDeveloperPrefix,
  },
  featherless: {
    baseUrl: 'https://api.featherless.ai/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: '...',
    modelIdFormat: keepFullModelId,
  },
  chutes: {
    baseUrl: 'https://api.chutes.ai/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: '...',
    modelIdFormat: keepFullModelId,
  },
  portkey: {
    baseUrl: 'https://api.portkey.ai/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: '...',
  },
  novita: {
    baseUrl: 'https://api.novita.ai/v3/openai',
    requiresApiKey: true,
    apiKeyPlaceholder: '...',
    modelIdFormat: stripDeveloperPrefix,
  },
  aimo: {
    baseUrl: 'https://api.aimo.network/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: '...',
    modelIdFormat: keepFullModelId,
  },
  fal: {
    baseUrl: 'https://fal.run/fal-ai',
    requiresApiKey: true,
    apiKeyPlaceholder: '...',
  },
  alibaba: {
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-...',
    modelIdFormat: stripDeveloperPrefix,
  },
};

/**
 * Default API configuration for unknown providers
 */
const DEFAULT_API_CONFIG: ProviderApiConfig = {
  baseUrl: '',
  requiresApiKey: true,
  apiKeyPlaceholder: '...',
};

/**
 * Get the API configuration for a provider
 * @param providerId - The provider identifier (e.g., 'openai', 'groq')
 * @returns The provider's API configuration or undefined if not found
 */
export function getProviderApiConfig(providerId: string): ProviderApiConfig | undefined {
  return PROVIDER_API_CONFIGS[providerId.toLowerCase()];
}

/**
 * Get the full provider configuration including display name
 * @param providerId - The provider identifier (e.g., 'openai', 'groq')
 * @param apiKeyOverride - Optional override for the API key placeholder (used for gatewayz)
 * @returns The full provider configuration or undefined if not found
 */
export function getProviderConfig(providerId: string, apiKeyOverride?: string): ProviderConfig | undefined {
  const apiConfig = getProviderApiConfig(providerId);
  if (!apiConfig) return undefined;

  // Special case for gatewayz - use provided API key as placeholder
  const apiKeyPlaceholder = providerId === 'gatewayz' && apiKeyOverride
    ? apiKeyOverride
    : apiConfig.apiKeyPlaceholder;

  return {
    ...apiConfig,
    apiKeyPlaceholder,
    name: getProviderDisplayName(providerId),
  };
}

/**
 * Get the display name for a provider
 * Uses gateway-registry.ts as the source of truth
 * @param providerId - The provider identifier
 * @returns The display name
 */
export function getProviderDisplayName(providerId: string): string {
  // Special case for gatewayz - always show as "Gatewayz (Unified)"
  if (providerId === 'gatewayz') {
    return 'Gatewayz (Unified)';
  }
  return getGatewayDisplayName(providerId);
}

/**
 * Format a model ID for a specific provider
 * @param providerId - The provider identifier
 * @param modelId - The canonical model ID (e.g., 'openai/gpt-4o')
 * @returns The formatted model ID for the provider's API
 */
export function formatProviderModelId(providerId: string, modelId: string): string {
  const config = getProviderApiConfig(providerId);
  if (config?.modelIdFormat) {
    return config.modelIdFormat(modelId);
  }
  // Fall back to provider-model-formats utility
  return getFormattedModelId(providerId, modelId);
}

/**
 * Check if a provider is configured
 * @param providerId - The provider identifier
 * @returns True if the provider has API configuration
 */
export function isProviderConfigured(providerId: string): boolean {
  return providerId.toLowerCase() in PROVIDER_API_CONFIGS;
}

/**
 * Get all configured provider IDs
 * @returns Array of provider IDs
 */
export function getAllConfiguredProviders(): string[] {
  return Object.keys(PROVIDER_API_CONFIGS);
}

/**
 * Build provider configs object for compatibility with existing code
 * This creates a Record<string, ProviderConfig> that can be used as a drop-in replacement
 * @param apiKeyOverride - Optional API key override for gatewayz
 */
export function buildProviderConfigsRecord(apiKeyOverride?: string): Record<string, ProviderConfig> {
  const result: Record<string, ProviderConfig> = {};
  for (const providerId of Object.keys(PROVIDER_API_CONFIGS)) {
    const config = getProviderConfig(providerId, apiKeyOverride);
    if (config) {
      result[providerId] = config;
    }
  }
  return result;
}
