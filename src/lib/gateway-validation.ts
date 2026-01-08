import * as Sentry from '@sentry/nextjs';

/**
 * Gateway validation utilities
 * Ensures gateway configurations are valid and handles edge cases
 */

// List of known valid gateways
const KNOWN_GATEWAYS = [
  'openai',
  'anthropic',
  'openrouter',
  'portkey',
  'featherless',
  'groq',
  'together',
  'fireworks',
  'chutes',
  'deepinfra',
  'google',
  'cerebras',
  'nebius',
  'xai',
  'novita',
  'huggingface',
  'hug', // Backend abbreviation
  'aimo',
  'near',
  'fal',
  'vercel-ai-gateway',
  'helicone',
  'alpaca',
  'alibaba',
  'clarifai',
  'gatewayz', // Unified gateway
];

/**
 * Validate if a gateway slug is known/supported
 */
export function isValidGateway(gateway: string | undefined | null): boolean {
  if (!gateway) return false;
  return KNOWN_GATEWAYS.includes(gateway.toLowerCase());
}

/**
 * Validate a list of gateways and filter out invalid ones
 * @param gateways - Array of gateway slugs
 * @returns Array of valid gateway slugs
 */
export function validateGateways(gateways: string[] | undefined | null): string[] {
  if (!gateways || !Array.isArray(gateways)) {
    return [];
  }

  const validGateways = gateways
    .map(gateway => {
      if (!gateway) return null;
      // Normalize to lowercase
      const normalized = gateway.toLowerCase().trim();
      const isValid = isValidGateway(normalized);

      if (!isValid) {
        console.warn(`[validateGateways] Unknown gateway: ${gateway}`);
        Sentry.captureMessage(`Unknown gateway encountered: ${gateway}`, {
          level: 'warning',
          tags: {
            function: 'validateGateways',
            gateway_slug: gateway,
          },
        });
        return null;
      }

      return normalized;
    })
    .filter((gateway): gateway is string => gateway !== null);

  return validGateways;
}

/**
 * Get a fallback gateway when none are available
 */
export function getFallbackGateway(): string {
  return 'gatewayz'; // Default to unified gateway
}

/**
 * Ensure at least one valid gateway exists, or return fallback
 * @param gateways - Array of gateway slugs
 * @returns Array with at least one valid gateway
 */
export function ensureValidGateways(gateways: string[] | undefined | null): string[] {
  const validated = validateGateways(gateways);

  if (validated.length === 0) {
    console.warn('[ensureValidGateways] No valid gateways found, using fallback');
    return [getFallbackGateway()];
  }

  return validated;
}

/**
 * Check if a model has required provider information
 */
export function validateModelProviderInfo(model: {
  id?: string;
  name?: string;
  source_gateways?: string[];
  source_gateway?: string;
}): boolean {
  if (!model.id || !model.name) {
    Sentry.captureMessage('Model missing required fields', {
      level: 'warning',
      tags: {
        function: 'validateModelProviderInfo',
      },
      contexts: {
        model: {
          id: model.id,
          name: model.name,
          has_source_gateways: !!model.source_gateways,
          has_source_gateway: !!model.source_gateway,
        },
      },
    });
    return false;
  }

  // Check if model has any gateway information
  const hasGatewayInfo =
    (model.source_gateways && model.source_gateways.length > 0) ||
    !!model.source_gateway;

  if (!hasGatewayInfo) {
    console.warn(`[validateModelProviderInfo] Model ${model.id} has no gateway information`);
  }

  return hasGatewayInfo;
}

/**
 * Get gateways from a model, handling both old and new formats
 */
export function getModelGateways(model: {
  source_gateways?: string[];
  source_gateway?: string;
}): string[] {
  // New format: source_gateways array
  if (model.source_gateways && Array.isArray(model.source_gateways)) {
    return validateGateways(model.source_gateways);
  }

  // Old format: single source_gateway
  if (model.source_gateway) {
    const validated = validateGateways([model.source_gateway]);
    return validated.length > 0 ? validated : [];
  }

  return [];
}

/**
 * Check if a gateway has required API key configured
 * This is a placeholder - actual implementation would check environment variables
 */
export function isGatewayConfigured(gateway: string): boolean {
  // For now, always return true
  // In production, this would check for API keys in environment
  return true;
}

/**
 * Filter gateways to only those that are properly configured
 */
export function getConfiguredGateways(gateways: string[]): string[] {
  return gateways.filter(gateway => {
    const isValid = isValidGateway(gateway);
    const isConfigured = isGatewayConfigured(gateway);
    return isValid && isConfigured;
  });
}

/**
 * Validate and sanitize gateway input from user
 */
export function sanitizeGatewayInput(gateway: string | undefined | null): string | null {
  if (!gateway) return null;

  // Convert to lowercase and trim
  const normalized = gateway.toLowerCase().trim();

  // Check if valid
  if (!isValidGateway(normalized)) {
    console.warn(`[sanitizeGatewayInput] Invalid gateway input: ${gateway}`);
    return null;
  }

  return normalized;
}
