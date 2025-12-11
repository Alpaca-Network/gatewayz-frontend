/**
 * Token Refresh & Expiry Management
 * Handles automatic token refresh before expiry
 */

import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safe-storage';

const TOKEN_EXPIRY_STORAGE_KEY = 'gatewayz_token_expiry';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
const DEFAULT_TOKEN_LIFETIME_MS = 60 * 60 * 1000; // 1 hour default

interface TokenMetadata {
  api_key: string;
  expires_at: number; // Unix timestamp in milliseconds
  issued_at: number; // Unix timestamp in milliseconds
}

/**
 * Save token expiry metadata to localStorage (with safe storage fallback)
 */
export const saveTokenMetadata = (apiKey: string, expiryTime?: number): void => {
  if (typeof window === 'undefined') return;

  try {
    const now = Date.now();

    // If no expiry provided, assume 1 hour from now
    const expiresAt = expiryTime || (now + DEFAULT_TOKEN_LIFETIME_MS);

    const metadata: TokenMetadata = {
      api_key: apiKey,
      expires_at: expiresAt,
      issued_at: now,
    };

    safeLocalStorageSet(TOKEN_EXPIRY_STORAGE_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.warn('[token-refresh] Failed to save token metadata:', error);
  }
};

/**
 * Get token metadata from localStorage (with safe storage fallback)
 */
export const getTokenMetadata = (): TokenMetadata | null => {
  if (typeof window === 'undefined') return null;

  try {
    const data = safeLocalStorageGet(TOKEN_EXPIRY_STORAGE_KEY);

    if (!data) return null;

    return JSON.parse(data) as TokenMetadata;
  } catch (error) {
    console.warn('[token-refresh] Failed to parse token metadata:', error);
    return null;
  }
};

/**
 * Clear token metadata from localStorage (with safe storage fallback)
 */
export const clearTokenMetadata = (): void => {
  if (typeof window === 'undefined') return;

  try {
    safeLocalStorageRemove(TOKEN_EXPIRY_STORAGE_KEY);
  } catch (error) {
    console.warn('[token-refresh] Failed to clear token metadata:', error);
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (): boolean => {
  const metadata = getTokenMetadata();
  if (!metadata) return false;

  const now = Date.now();
  return now >= metadata.expires_at;
};

/**
 * Check if token needs refresh (expires within buffer time)
 */
export const shouldRefreshToken = (): boolean => {
  const metadata = getTokenMetadata();
  if (!metadata) return false;

  const now = Date.now();
  const timeUntilExpiry = metadata.expires_at - now;

  return timeUntilExpiry <= TOKEN_REFRESH_BUFFER_MS;
};

/**
 * Get time remaining until token expires (in milliseconds)
 */
export const getTokenTimeRemaining = (): number => {
  const metadata = getTokenMetadata();
  if (!metadata) return 0;

  const now = Date.now();
  const remaining = metadata.expires_at - now;

  return Math.max(0, remaining);
};

/**
 * Get token expiry time (Unix timestamp in milliseconds)
 */
export const getTokenExpiryTime = (): number | null => {
  const metadata = getTokenMetadata();
  return metadata?.expires_at || null;
};

/**
 * Validate token metadata consistency
 */
export const validateTokenMetadata = (apiKey: string): boolean => {
  const metadata = getTokenMetadata();

  if (!metadata) return false;

  // Check if API key matches
  if (metadata.api_key !== apiKey) {
    console.warn('[token-refresh] Token metadata API key mismatch');
    return false;
  }

  // Check if expired
  if (isTokenExpired()) {
    console.warn('[token-refresh] Token has expired');
    return false;
  }

  return true;
};

/**
 * Format time remaining for display
 */
export const formatTimeRemaining = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};
