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
 * Normalize model IDs to consistent format
 * Handles various formats returned by different gateway APIs:
 * - @google/models/gemini-pro-latest → google/gemini-pro-latest
<<<<<<< HEAD
  * - @cerebras/llama3.1-8b → cerebras/llama3.1-8b
=======
 * - @openrouter/qwen/qwen3-32b → openrouter/qwen/qwen3-32b
>>>>>>> origin/master
 * - google/gemini-pro → google/gemini-pro (no change)
 * - gemini-pro → gemini-pro (no change)
 *
 * This ensures compatibility with backend API expectations
 */
export const normalizeModelId = (modelId: string): string => {
  if (!modelId) return modelId;

  // Handle @provider/models/model-name format → provider/model-name
  const atProviderMatch = modelId.match(/^@([a-z0-9-]+)\/models\/(.+)$/i);
  if (atProviderMatch) {
    const [, provider, model] = atProviderMatch;
    return `${provider}/${model}`;
  }

  // Handle @provider/model-name format → provider/model-name
  if (modelId.startsWith('@')) {
    return modelId.substring(1);
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