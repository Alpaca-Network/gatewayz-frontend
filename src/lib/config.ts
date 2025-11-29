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
