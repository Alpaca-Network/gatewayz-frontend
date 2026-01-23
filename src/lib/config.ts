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
 * Check if running in Tauri desktop environment
 * This is used to determine whether to use direct backend URLs or Next.js API routes
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Get the appropriate chat API base URL
 *
 * On desktop (Tauri with static export), we must use the direct backend URL
 * because Next.js API routes don't exist in static builds.
 *
 * On web, we use relative paths to leverage Next.js API routes which:
 * - Handle CORS properly
 * - Add authentication headers
 * - Provide proxy functionality
 *
 * @returns The base URL for chat API endpoints
 */
export function getChatApiBaseUrl(): string {
  if (isTauriEnvironment()) {
    // Desktop: use direct backend URL (no Next.js server in static export)
    return API_BASE_URL;
  }
  // Web: use relative paths (Next.js API routes)
  return '';
}

/**
 * Build the full URL for a chat API endpoint
 *
 * @param path - The API path (e.g., '/v1/chat/completions')
 * @returns The full URL for the endpoint
 */
export function getChatApiUrl(path: string): string {
  const baseUrl = getChatApiBaseUrl();
  if (baseUrl) {
    // Desktop: combine base URL with path
    return `${baseUrl}${path}`;
  }
  // Web: use Next.js API route (translates /v1/* to /api/chat/*)
  // Map backend paths to Next.js API routes
  if (path.startsWith('/v1/chat/ai-sdk-completions')) {
    return '/api/chat/ai-sdk-completions' + path.slice('/v1/chat/ai-sdk-completions'.length);
  }
  if (path.startsWith('/v1/chat/completions')) {
    return '/api/chat/completions' + path.slice('/v1/chat/completions'.length);
  }
  if (path.startsWith('/v1/chat/sessions')) {
    return '/api/chat/sessions' + path.slice('/v1/chat/sessions'.length);
  }
  // Fallback: use path as-is (already a Next.js API route)
  return path;
}

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
