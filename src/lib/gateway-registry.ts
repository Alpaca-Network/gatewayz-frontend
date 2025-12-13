/**
 * Centralized Gateway Registry
 *
 * This file is the SINGLE SOURCE OF TRUTH for all gateway configurations.
 * When adding a new gateway, simply add it to the GATEWAYS array below.
 *
 * Each gateway entry includes:
 * - id: Unique identifier used in API calls
 * - name: Display name for UI
 * - color: Tailwind CSS color class for badges
 * - priority: 'fast' | 'slow' - determines loading order on models page
 * - deprecated: true if gateway should not be used (kept for backward compatibility)
 * - requiresApiKey: true if gateway needs authentication
 * - apiKeyEnvVar: Environment variable name(s) for API key
 * - icon: Optional icon component identifier
 *
 * To add a new gateway:
 * 1. Add entry to GATEWAYS array below
 * 2. If API key required, add env var to .env
 * 3. That's it! All files auto-import from here.
 */

import React from 'react';

export interface GatewayConfig {
  /** Unique identifier used in API calls (e.g., 'openrouter', 'groq') */
  id: string;
  /** Display name for UI (e.g., 'OpenRouter', 'Groq') */
  name: string;
  /** Tailwind CSS background color class (e.g., 'bg-blue-500') */
  color: string;
  /** Loading priority: 'fast' gateways load first, 'slow' load in background */
  priority: 'fast' | 'slow';
  /** If true, gateway is kept for backward compatibility but not actively used */
  deprecated?: boolean;
  /** If true, gateway requires API key authentication */
  requiresApiKey?: boolean;
  /** Environment variable name(s) for API key (checks NEXT_PUBLIC_ first, then without) */
  apiKeyEnvVar?: string;
  /** Optional icon identifier for special display (e.g., 'zap' for Groq) */
  icon?: string;
  /** Aliases that map to this gateway (e.g., 'hug' -> 'huggingface') */
  aliases?: string[];
}

/**
 * Master list of all supported gateways.
 *
 * ADD NEW GATEWAYS HERE - they will automatically appear everywhere in the app.
 */
export const GATEWAYS: GatewayConfig[] = [
  // Fast gateways (load first on models page)
  {
    id: 'openrouter',
    name: 'OpenRouter',
    color: 'bg-blue-500',
    priority: 'fast',
  },
  {
    id: 'groq',
    name: 'Groq',
    color: 'bg-orange-500',
    priority: 'fast',
    icon: 'zap',
  },
  {
    id: 'together',
    name: 'Together',
    color: 'bg-indigo-500',
    priority: 'fast',
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    color: 'bg-red-500',
    priority: 'fast',
  },
  {
    id: 'vercel-ai-gateway',
    name: 'Vercel AI',
    color: 'bg-slate-900',
    priority: 'fast',
  },

  // Slow gateways (load in background)
  {
    id: 'featherless',
    name: 'Featherless',
    color: 'bg-green-500',
    priority: 'slow',
  },
  {
    id: 'chutes',
    name: 'Chutes',
    color: 'bg-yellow-500',
    priority: 'slow',
  },
  {
    id: 'deepinfra',
    name: 'DeepInfra',
    color: 'bg-cyan-500',
    priority: 'slow',
  },
  {
    id: 'google',
    name: 'Google',
    color: 'bg-blue-600',
    priority: 'slow',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    color: 'bg-amber-600',
    priority: 'slow',
  },
  {
    id: 'nebius',
    name: 'Nebius',
    color: 'bg-slate-600',
    priority: 'slow',
  },
  {
    id: 'xai',
    name: 'xAI',
    color: 'bg-black',
    priority: 'slow',
  },
  {
    id: 'novita',
    name: 'Novita',
    color: 'bg-violet-600',
    priority: 'slow',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    color: 'bg-yellow-600',
    priority: 'slow',
    requiresApiKey: true,
    apiKeyEnvVar: 'HF_API_KEY',
    aliases: ['hug'], // Backend sometimes uses 'hug' abbreviation
  },
  {
    id: 'aimo',
    name: 'AiMo',
    color: 'bg-pink-600',
    priority: 'slow',
  },
  {
    id: 'near',
    name: 'NEAR',
    color: 'bg-teal-600',
    priority: 'slow',
    requiresApiKey: true,
    apiKeyEnvVar: 'NEAR_API_KEY',
  },
  {
    id: 'fal',
    name: 'Fal',
    color: 'bg-emerald-600',
    priority: 'slow',
  },
  {
    id: 'helicone',
    name: 'Helicone',
    color: 'bg-indigo-600',
    priority: 'slow',
  },
  {
    id: 'alpaca',
    name: 'Alpaca Network',
    color: 'bg-green-700',
    priority: 'slow',
  },
  {
    id: 'alibaba',
    name: 'Alibaba',
    color: 'bg-orange-700',
    priority: 'slow',
    requiresApiKey: true,
    apiKeyEnvVar: 'ALIBABA_API_KEY',
  },
  {
    id: 'clarifai',
    name: 'Clarifai',
    color: 'bg-purple-600',
    priority: 'slow',
    requiresApiKey: true,
    apiKeyEnvVar: 'CLARIFAI_API_KEY',
  },
  {
    id: 'onerouter',
    name: 'OneRouter',
    color: 'bg-emerald-500',
    priority: 'slow',
  },

  // Deprecated gateways (kept for backward compatibility)
  {
    id: 'portkey',
    name: 'Portkey',
    color: 'bg-purple-500',
    priority: 'slow',
    deprecated: true,
  },
];

// ============================================================================
// Derived exports - automatically computed from GATEWAYS array
// ============================================================================

/** All active (non-deprecated) gateways */
export const ACTIVE_GATEWAYS = GATEWAYS.filter(g => !g.deprecated);

/** All gateway IDs including deprecated ones (for validation) */
export const ALL_GATEWAY_IDS = GATEWAYS.map(g => g.id);

/** Active gateway IDs only (excluding deprecated) */
export const ACTIVE_GATEWAY_IDS = ACTIVE_GATEWAYS.map(g => g.id);

/** Fast-loading gateways (typically under 1s) */
export const PRIORITY_GATEWAYS = ACTIVE_GATEWAYS
  .filter(g => g.priority === 'fast')
  .map(g => g.id);

/** Slower gateways that can be deferred */
export const DEFERRED_GATEWAYS = ACTIVE_GATEWAYS
  .filter(g => g.priority === 'slow')
  .map(g => g.id);

/** Valid gateways for API validation (includes 'all' special value) */
export const VALID_GATEWAYS = [...ALL_GATEWAY_IDS, 'all'];

/** Gateway config lookup by ID */
export const GATEWAY_BY_ID: Record<string, GatewayConfig> = {};
GATEWAYS.forEach(g => {
  GATEWAY_BY_ID[g.id] = g;
  // Also map aliases
  g.aliases?.forEach(alias => {
    GATEWAY_BY_ID[alias] = g;
  });
});

/** Gateway display config for UI (compatible with existing GATEWAY_CONFIG format) */
export const GATEWAY_CONFIG: Record<string, { name: string; color: string; icon?: string }> = {};
GATEWAYS.forEach(g => {
  GATEWAY_CONFIG[g.id] = {
    name: g.name,
    color: g.color,
    icon: g.icon,
  };
  // Also map aliases for backwards compatibility
  g.aliases?.forEach(alias => {
    GATEWAY_CONFIG[alias] = {
      name: g.name,
      color: g.color,
      icon: g.icon,
    };
  });
});

/** Gateways that require API keys */
export const GATEWAYS_WITH_API_KEYS = ACTIVE_GATEWAYS.filter(g => g.requiresApiKey);

/**
 * Get API key for a gateway from environment variables
 */
export function getGatewayApiKey(gatewayId: string): string | undefined {
  const config = GATEWAY_BY_ID[gatewayId];
  if (!config?.apiKeyEnvVar) return undefined;

  const envVar = config.apiKeyEnvVar;
  // Check NEXT_PUBLIC_ version first (for client-side), then server-side version
  return process.env[`NEXT_PUBLIC_${envVar}`] || process.env[envVar];
}

/**
 * Build headers for gateway request, including API key if required
 */
export function buildGatewayHeaders(gatewayId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = getGatewayApiKey(gatewayId);
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}

/**
 * Normalize gateway ID (handles aliases like 'hug' -> 'huggingface')
 */
export function normalizeGatewayId(gatewayId: string): string {
  const config = GATEWAY_BY_ID[gatewayId];
  return config?.id || gatewayId;
}

/**
 * Check if a gateway ID is valid
 */
export function isValidGateway(gatewayId: string): boolean {
  return VALID_GATEWAYS.includes(gatewayId) || gatewayId in GATEWAY_BY_ID;
}

/**
 * Get gateway display name
 */
export function getGatewayDisplayName(gatewayId: string): string {
  const config = GATEWAY_BY_ID[gatewayId];
  return config?.name || gatewayId;
}

/**
 * Check if gateway is deprecated
 */
export function isGatewayDeprecated(gatewayId: string): boolean {
  const config = GATEWAY_BY_ID[gatewayId];
  return config?.deprecated || false;
}

// ============================================================================
// Dynamic Gateway Discovery
// ============================================================================

/**
 * Runtime-discovered gateways that aren't in the static registry.
 * These are discovered from backend API responses and can be used
 * for new gateways before they're added to the static config.
 */
const dynamicGateways: Map<string, GatewayConfig> = new Map();

/**
 * Generate a default color for dynamically discovered gateways
 * Uses a hash of the gateway ID to pick a consistent color
 */
function generateGatewayColor(gatewayId: string): string {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-cyan-500',
    'bg-amber-500', 'bg-rose-500', 'bg-emerald-500', 'bg-violet-500',
  ];
  // Simple hash based on string chars
  let hash = 0;
  for (let i = 0; i < gatewayId.length; i++) {
    hash = ((hash << 5) - hash) + gatewayId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Register a dynamically discovered gateway.
 * This allows new gateways to be used immediately without code changes.
 *
 * @param gatewayId - The gateway identifier from the backend
 * @param config - Optional partial config to override defaults
 * @returns The gateway config (either existing or newly created)
 */
export function registerDynamicGateway(
  gatewayId: string,
  config?: Partial<GatewayConfig>
): GatewayConfig {
  // If already in static registry, return that
  if (GATEWAY_BY_ID[gatewayId]) {
    return GATEWAY_BY_ID[gatewayId];
  }

  // If already dynamically registered, return that
  if (dynamicGateways.has(gatewayId)) {
    return dynamicGateways.get(gatewayId)!;
  }

  // Create new gateway config with sensible defaults
  const newGateway: GatewayConfig = {
    id: gatewayId,
    name: config?.name || formatGatewayName(gatewayId),
    color: config?.color || generateGatewayColor(gatewayId),
    priority: config?.priority || 'slow', // Default to slow for safety
    ...config,
  };

  // Register it
  dynamicGateways.set(gatewayId, newGateway);
  GATEWAY_BY_ID[gatewayId] = newGateway;
  GATEWAY_CONFIG[gatewayId] = {
    name: newGateway.name,
    color: newGateway.color,
    icon: newGateway.icon,
  };

  console.log(`[Gateway Registry] Dynamically registered new gateway: ${gatewayId}`);
  return newGateway;
}

/**
 * Format a gateway ID into a display name
 * e.g., 'my-new-gateway' -> 'My New Gateway'
 */
function formatGatewayName(gatewayId: string): string {
  return gatewayId
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get all gateways including dynamically registered ones
 */
export function getAllGateways(): GatewayConfig[] {
  return [...GATEWAYS, ...Array.from(dynamicGateways.values())];
}

/**
 * Get all active gateway IDs including dynamically registered ones
 */
export function getAllActiveGatewayIds(): string[] {
  const staticIds = ACTIVE_GATEWAY_IDS;
  const dynamicIds = Array.from(dynamicGateways.keys());
  return [...staticIds, ...dynamicIds];
}

/**
 * Check if a gateway was dynamically registered (not in static config)
 */
export function isDynamicGateway(gatewayId: string): boolean {
  return dynamicGateways.has(gatewayId);
}

/**
 * Process model data and auto-register any unknown gateways found
 * Call this when processing models from the API
 */
export function autoRegisterGatewaysFromModels(models: Array<{ source_gateway?: string; source_gateways?: string[] }>): void {
  const seenGateways = new Set<string>();

  for (const model of models) {
    // Check source_gateway
    if (model.source_gateway) {
      seenGateways.add(model.source_gateway);
    }
    // Check source_gateways array
    if (model.source_gateways) {
      for (const gw of model.source_gateways) {
        seenGateways.add(gw);
      }
    }
  }

  // Register any unknown gateways
  for (const gatewayId of seenGateways) {
    if (!GATEWAY_BY_ID[gatewayId] && !dynamicGateways.has(gatewayId)) {
      // Normalize alias first (e.g., 'hug' -> 'huggingface')
      const normalized = normalizeGatewayId(gatewayId);
      if (!GATEWAY_BY_ID[normalized]) {
        registerDynamicGateway(gatewayId);
      }
    }
  }
}

/**
 * Get a list of dynamically registered gateways (useful for debugging/logging)
 */
export function getDynamicGateways(): GatewayConfig[] {
  return Array.from(dynamicGateways.values());
}
