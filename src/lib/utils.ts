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
 * Shorten model name by removing the gateway prefix
 * Converts gateway/provider/model format to provider/model format
 * Examples:
 * - "OpenRouter/deepseek/Deepseek-r1" → "deepseek/Deepseek-r1"
 * - "openrouter/openai/gpt-4o" → "openai/gpt-4o"
 * - "fireworks/meta-llama/llama-3" → "meta-llama/llama-3"
 * - "deepseek/deepseek-r1" → "deepseek/deepseek-r1" (no change if only 2 parts)
 * - "gpt-4o" → "gpt-4o" (no change if no slash)
 */
export const shortenModelName = (modelId: string): string => {
  if (!modelId) return modelId;

  const parts = modelId.split('/');

  // If there are 3+ parts (gateway/provider/model), remove the first part (gateway)
  if (parts.length >= 3) {
    return parts.slice(1).join('/');
  }

  // Return as-is if already short (provider/model or just model)
  return modelId;
};

/**
 * Normalize model IDs to consistent format
 * Handles various formats returned by different gateway APIs:
 * - @google/models/gemini-pro-latest → google/gemini-pro-latest
 * - @openrouter/qwen/qwen3-32b → openrouter/qwen/qwen3-32b
 * - accounts/fireworks/models/deepseek-r1 → fireworks/deepseek-r1
 * - google/gemini-pro → google/gemini-pro (no change)
 * - gemini-pro → gemini-pro (no change)
 *
 * This ensures compatibility with backend API expectations
 */
export const normalizeModelId = (modelId: string): string => {
  if (!modelId) return modelId;

  // Handle accounts/provider/models/model-name format → provider/model-name
  // This is the format used by Fireworks API (e.g., accounts/fireworks/models/deepseek-r1)
  const accountsProviderMatch = modelId.match(/^accounts\/([a-z0-9-]+)\/models\/(.+)$/i);
  if (accountsProviderMatch) {
    const [, provider, model] = accountsProviderMatch;
    return `${provider}/${model}`;
  }

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

/**
 * Normalize a string to be URL-safe for model names
 * Converts special characters to hyphens while preserving meaningful separators
 * Examples:
 * - "4.5" → "4-5" (dots become hyphens)
 * - "Claude 3.5 Sonnet" → "claude-35-sonnet" (spaces and dots become hyphens)
 * - "GPT-4o mini" → "gpt-4o-mini" (existing hyphens preserved, spaces become hyphens)
 * - "LLaMA 3.1 405B" → "llama-31-405b" (version numbers formatted correctly)
 */
export const normalizeToUrlSafe = (str: string): string => {
  if (!str) return '';

  return str
    .toLowerCase()
    .split('')
    .map((char) => {
      // Keep alphanumeric characters as-is
      if (/[a-z0-9]/.test(char)) return char;
      // Convert any other character to hyphen
      return '-';
    })
    .join('')
    // Replace multiple consecutive hyphens with a single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
};

/**
 * Generate a model URL in the format /models/[developer]/[model]
 * Handles various model ID formats:
 * - "openai/gpt-5.1" → "/models/openai/gpt-5-1"
 * - "aimo:model-name" → "/models/aimo/model-name"
 * - "near/deepseek-ai/deepseek-v3-1" → "/models/near/deepseek-ai/deepseek-v3-1" (preserves nested paths)
 * - "gpt-4o mini" → Uses provider_slug if available
 */
export const getModelUrl = (modelId: string, providerSlug?: string): string => {
  if (!modelId) return '/models';

  // Handle provider:model format (e.g., "aimo:model-name")
  if (modelId.includes(':')) {
    const [provider, model] = modelId.split(':');
    const urlSafeName = normalizeToUrlSafe(model);
    return `/models/${provider.toLowerCase()}/${urlSafeName}`;
  }

  // Handle provider/model format (e.g., "openai/gpt-5.1" or "near/deepseek-ai/deepseek-v3-1")
  if (modelId.includes('/')) {
    const [provider, ...modelParts] = modelId.split('/');
    // Normalize each segment individually and preserve the path structure with slashes
    const normalizedParts = modelParts.map(part => normalizeToUrlSafe(part));
    return `/models/${provider.toLowerCase()}/${normalizedParts.join('/')}`;
  }

  // Fallback: just the model ID (should rarely happen)
  if (providerSlug) {
    const urlSafeName = normalizeToUrlSafe(modelId);
    return `/models/${providerSlug.toLowerCase()}/${urlSafeName}`;
  }

  return `/models`;
};

/**
 * Debounce function - delays execution until after wait time has elapsed
 * Perfect for reducing API calls on rapid user input (e.g., session title updates)
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - limits execution to once per wait time
 * Perfect for scroll handlers and frequent events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastRan: number = 0;

  return function executedFunction(...args: Parameters<T>) {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (Date.now() - lastRan >= wait) {
          func(...args);
          lastRan = Date.now();
        }
      }, wait - (Date.now() - lastRan));
    }
  };
}