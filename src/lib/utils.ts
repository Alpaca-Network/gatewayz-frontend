import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const stringToColor = (str: string | null | undefined) => {
  if (!str) return 'hsl(0, 0%, 85%)'; // Default gray for null/undefined
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  // Use a slightly different HSL range for better pastel colors
  return `hsl(${h}, 60%, 85%)`;
};

export const extractTokenValue = (str: string): string | null => {
  const match = str.match(/^(\d+(?:\.\d+)?[BTMK])\s*tokens$/i);
  return match ? match[1] : null;
};

/**
 * Model ID aliases - maps alternative/legacy model IDs to their canonical IDs
 * This handles cases where models are referenced by different names or formats
 */
const MODEL_ID_ALIASES: Record<string, string> = {
  'z-ai/glm-4.6:exacto': 'near/zai-org/GLM-4.6',
  'z-ai/glm-4.6': 'near/zai-org/GLM-4.6',
  'exacto': 'near/zai-org/GLM-4.6',
};

/**
 * Normalize model IDs to consistent format
 * Handles various formats returned by different gateway APIs:
 * - @google/models/gemini-pro-latest → google/gemini-pro-latest
 * - google/gemini-pro → google/gemini-pro (no change)
 * - gemini-pro → gemini-pro (no change)
 * - z-ai/glm-4.6:exacto → near/zai-org/GLM-4.6 (alias mapping)
 *
 * This ensures compatibility with backend API expectations
 */
export const normalizeModelId = (modelId: string): string => {
  if (!modelId) return modelId;

  // Check for known aliases first (case-insensitive)
  const lowerModelId = modelId.toLowerCase();
  for (const [alias, canonical] of Object.entries(MODEL_ID_ALIASES)) {
    if (alias.toLowerCase() === lowerModelId) {
      console.log(`[normalizeModelId] Mapped alias "${modelId}" → "${canonical}"`);
      return canonical;
    }
  }

  // Handle @provider/models/model-name format → provider/model-name
  const atProviderMatch = modelId.match(/^@([a-z0-9-]+)\/models\/(.+)$/i);
  if (atProviderMatch) {
    const [, provider, model] = atProviderMatch;
    return `${provider}/${model}`;
  }

  // Handle provider/models/model-name format → provider/model-name
  const providerModelsMatch = modelId.match(/^([a-z0-9-]+)\/models\/(.+)$/i);
  if (providerModelsMatch) {
    const [, provider, model] = providerModelsMatch;
    return `${provider}/${model}`;
  }

  // Return as-is if already in correct format
  return modelId;
};