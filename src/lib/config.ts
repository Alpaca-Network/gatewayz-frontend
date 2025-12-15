// API configuration
// Ensure URL has protocol prefix to prevent "Request URL is missing protocol" errors
function ensureProtocol(url: string | undefined, defaultUrl: string): string {
  if (!url) return defaultUrl;
  const trimmed = url.trim();
  if (!trimmed) return defaultUrl;
  // If URL doesn't start with http:// or https://, prepend https://
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    console.warn(`[Config] URL "${trimmed}" missing protocol, prepending https://`);
    return `https://${trimmed}`;
  }
  return trimmed;
}

export const API_BASE_URL = ensureProtocol(process.env.NEXT_PUBLIC_API_BASE_URL, 'https://api.gatewayz.ai');
export const CHAT_HISTORY_API_URL = ensureProtocol(process.env.NEXT_PUBLIC_CHAT_HISTORY_API_URL, API_BASE_URL);
export const BACKEND_URL = ensureProtocol(process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL, API_BASE_URL);

/**
 * Featured/Default Model Versions
 *
 * Centralized configuration for default model versions used across the app.
 * Update these when new model versions are released by providers.
 *
 * Format: provider/model-name (e.g., "anthropic/claude-opus-4.5")
 *
 * Last updated: 2025-12-15
 */
export const FEATURED_MODELS = {
  // Anthropic Claude - Best for code generation and programming tasks
  code: {
    id: 'anthropic/claude-opus-4.5',
    displayName: 'Claude Opus 4.5',
    provider: 'Anthropic',
  },
  // Google Gemini - Best for math, reasoning, and calculations
  math: {
    id: 'google/gemini-3-pro-preview',
    displayName: 'Gemini 3 Pro',
    provider: 'Google',
  },
  // OpenAI GPT - Best for general purpose questions
  general: {
    id: 'openai/gpt-5.2',
    displayName: 'GPT-5.2',
    provider: 'OpenAI',
  },
} as const;

// Type for featured model categories
export type FeaturedModelCategory = keyof typeof FEATURED_MODELS;
