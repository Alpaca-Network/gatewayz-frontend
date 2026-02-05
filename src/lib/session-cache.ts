/**
 * Session Cache Utility
 * Provides storage-based caching for chat sessions to enable instant page load
 * and fast session creation with optimistic UI, with safe storage fallback
 */

import { ChatSession } from './chat-history';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safe-storage';
import { getUserData } from './api';

export interface SessionCacheData {
  sessions: ChatSession[];
  recentModels: string[];
  defaultModel: string;
  lastSync: number; // Timestamp
  expiresAt: number; // Timestamp
  userId?: number; // User ID for cache scoping validation
}

const CACHE_KEY_PREFIX = 'gatewayz_session_cache';
const LEGACY_CACHE_KEY = 'gatewayz_session_cache'; // For clearing old unscoped cache
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Get the current user's ID for cache scoping
 * Returns undefined for guest users (no cache scoping for guests)
 */
function getCurrentUserId(): number | undefined {
  const userData = getUserData();
  return userData?.user_id;
}

/**
 * Get the cache key scoped to the current user
 * Format: gatewayz_session_cache_<userId> for authenticated users
 * Returns the legacy key for guests (no user-specific sessions to cache)
 */
function getCacheKey(): string {
  const userId = getCurrentUserId();
  if (userId) {
    return `${CACHE_KEY_PREFIX}_${userId}`;
  }
  // Guest users don't have sessions to cache, but return a key for consistency
  return `${CACHE_KEY_PREFIX}_guest`;
}

// ============================================================================
// In-Memory Cache Layer
// ============================================================================
// OPTIMIZATION: Add in-memory memoization to avoid repeated localStorage reads
// and JSON parsing. The memory cache has a short TTL (5 seconds) to ensure
// fresh data while reducing redundant operations during initialization.

let memoryCachedData: SessionCacheData | null = null;
let memoryCacheTimestamp: number = 0;
const MEMORY_CACHE_TTL_MS = 5000; // 5 seconds in-memory cache

/**
 * Get cached data from memory if still valid
 */
function getMemoryCachedData(): SessionCacheData | null {
  if (memoryCachedData && Date.now() - memoryCacheTimestamp < MEMORY_CACHE_TTL_MS) {
    return memoryCachedData;
  }
  return null;
}

/**
 * Update the in-memory cache
 */
function setMemoryCachedData(data: SessionCacheData): void {
  memoryCachedData = data;
  memoryCacheTimestamp = Date.now();
}

/**
 * Invalidate the in-memory cache (call after any write operation)
 */
export function invalidateMemoryCache(): void {
  memoryCachedData = null;
  memoryCacheTimestamp = 0;
}

/**
 * Initialize empty cache data structure
 */
function createEmptyCache(): SessionCacheData {
  const now = Date.now();
  return {
    sessions: [],
    recentModels: [],
    defaultModel: 'fireworks/deepseek-r1',
    lastSync: now,
    expiresAt: now + CACHE_TTL_MS,
    userId: getCurrentUserId()
  };
}

/**
 * Check if cache is still valid
 */
function isCacheValid(cache: SessionCacheData): boolean {
  return Date.now() < cache.expiresAt;
}

/**
 * Get cached sessions from localStorage (with in-memory memoization)
 * Returns only sessions belonging to the current authenticated user
 */
export function getCachedSessions(): ChatSession[] {
  try {
    const currentUserId = getCurrentUserId();

    // OPTIMIZATION: Check memory cache first to avoid localStorage read + JSON parse
    const memCached = getMemoryCachedData();
    if (memCached && isCacheValid(memCached)) {
      // Verify cache belongs to current user (prevents cross-user data leak)
      if (memCached.userId === currentUserId) {
        return memCached.sessions || [];
      }
      // User mismatch - invalidate memory cache
      invalidateMemoryCache();
    }

    // Fall back to localStorage with user-scoped key
    const cacheKey = getCacheKey();
    const cached = safeLocalStorageGet(cacheKey);
    if (!cached) return [];

    const data = JSON.parse(cached) as SessionCacheData;
    if (!isCacheValid(data)) {
      // Cache expired, clear it
      clearSessionCache();
      return [];
    }

    // Double-check userId matches current user (defense in depth)
    if (data.userId !== undefined && data.userId !== currentUserId) {
      // Cache belongs to different user - clear and return empty
      clearSessionCache();
      return [];
    }

    // Update memory cache for subsequent reads
    setMemoryCachedData(data);
    return data.sessions || [];
  } catch (error) {
    console.warn('[SessionCache] Failed to read cached sessions:', error);
    return [];
  }
}

/**
 * Get user's cached default model (with in-memory memoization)
 */
export function getCachedDefaultModel(): string | null {
  try {
    const currentUserId = getCurrentUserId();

    // Check memory cache first
    const memCached = getMemoryCachedData();
    if (memCached && isCacheValid(memCached) && memCached.userId === currentUserId) {
      return memCached.defaultModel || 'fireworks/deepseek-r1';
    }

    const cacheKey = getCacheKey();
    const cached = safeLocalStorageGet(cacheKey);
    if (!cached) return null;

    const data = JSON.parse(cached) as SessionCacheData;
    if (!isCacheValid(data)) {
      clearSessionCache();
      return null;
    }

    // Verify cache belongs to current user
    if (data.userId !== undefined && data.userId !== currentUserId) {
      clearSessionCache();
      return null;
    }

    // Update memory cache
    setMemoryCachedData(data);
    return data.defaultModel || 'fireworks/deepseek-r1';
  } catch (error) {
    console.warn('[SessionCache] Failed to read cached default model:', error);
    return null;
  }
}

/**
 * Get cached recent models (with in-memory memoization)
 */
export function getCachedRecentModels(): string[] {
  try {
    const currentUserId = getCurrentUserId();

    // Check memory cache first
    const memCached = getMemoryCachedData();
    if (memCached && isCacheValid(memCached) && memCached.userId === currentUserId) {
      return memCached.recentModels || [];
    }

    const cacheKey = getCacheKey();
    const cached = safeLocalStorageGet(cacheKey);
    if (!cached) return [];

    const data = JSON.parse(cached) as SessionCacheData;
    if (!isCacheValid(data)) {
      clearSessionCache();
      return [];
    }

    // Verify cache belongs to current user
    if (data.userId !== undefined && data.userId !== currentUserId) {
      clearSessionCache();
      return [];
    }

    // Update memory cache
    setMemoryCachedData(data);
    return data.recentModels || [];
  } catch (error) {
    console.warn('[SessionCache] Failed to read cached recent models:', error);
    return [];
  }
}

/**
 * Update cached sessions
 */
export function setCachedSessions(sessions: ChatSession[], defaultModel?: string): void {
  try {
    // Invalidate memory cache before write
    invalidateMemoryCache();

    const cacheKey = getCacheKey();
    const cached = safeLocalStorageGet(cacheKey);
    let data: SessionCacheData;

    if (cached) {
      data = JSON.parse(cached) as SessionCacheData;
    } else {
      data = createEmptyCache();
    }

    // Update sessions
    data.sessions = sessions;
    data.lastSync = Date.now();
    // Ensure userId is always set for cache scoping
    data.userId = getCurrentUserId();

    // Update default model if provided
    if (defaultModel) {
      data.defaultModel = defaultModel;

      // Add to recent models if not already there
      if (!data.recentModels.includes(defaultModel)) {
        data.recentModels.unshift(defaultModel);
        // Keep only last 10 models
        data.recentModels = data.recentModels.slice(0, 10);
      }
    }

    // Reset expiry on update
    data.expiresAt = Date.now() + CACHE_TTL_MS;

    safeLocalStorageSet(cacheKey, JSON.stringify(data));

    // Update memory cache with new data
    setMemoryCachedData(data);
  } catch (error) {
    console.warn('[SessionCache] Failed to cache sessions:', error);
  }
}

/**
 * Update just the default model
 */
export function setCachedDefaultModel(model: string): void {
  try {
    // Invalidate memory cache before write
    invalidateMemoryCache();

    const cacheKey = getCacheKey();
    const cached = safeLocalStorageGet(cacheKey);
    let data: SessionCacheData;

    if (cached) {
      data = JSON.parse(cached) as SessionCacheData;
    } else {
      data = createEmptyCache();
    }

    data.defaultModel = model;
    // Ensure userId is always set for cache scoping
    data.userId = getCurrentUserId();

    // Add to recent models if not already there
    if (!data.recentModels.includes(model)) {
      data.recentModels.unshift(model);
      // Keep only last 10 models
      data.recentModels = data.recentModels.slice(0, 10);
    }

    data.expiresAt = Date.now() + CACHE_TTL_MS;

    safeLocalStorageSet(cacheKey, JSON.stringify(data));

    // Update memory cache with new data
    setMemoryCachedData(data);
  } catch (error) {
    console.warn('[SessionCache] Failed to cache default model:', error);
  }
}

/**
 * Add a new session to cache (optimistic update)
 */
export function addCachedSession(session: ChatSession): void {
  try {
    const sessions = getCachedSessions();

    // Add to beginning of list
    sessions.unshift(session);

    // Keep only last 50 sessions in cache
    const trimmedSessions = sessions.slice(0, 50);

    setCachedSessions(trimmedSessions);
  } catch (error) {
    console.warn('[SessionCache] Failed to add session to cache:', error);
  }
}

/**
 * Replace a cached session (for optimistic updates)
 */
export function updateCachedSession(sessionId: number, updates: Partial<ChatSession>): void {
  try {
    const sessions = getCachedSessions();

    const index = sessions.findIndex(s => s.id === sessionId);
    if (index >= 0) {
      sessions[index] = { ...sessions[index], ...updates };
      setCachedSessions(sessions);
    }
  } catch (error) {
    console.warn('[SessionCache] Failed to update cached session:', error);
  }
}

/**
 * Remove a session from cache
 */
export function removeCachedSession(sessionId: number): void {
  try {
    const sessions = getCachedSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    setCachedSessions(filtered);
  } catch (error) {
    console.warn('[SessionCache] Failed to remove session from cache:', error);
  }
}

/**
 * Clear entire cache for current user
 */
export function clearSessionCache(): void {
  try {
    // Invalidate memory cache
    invalidateMemoryCache();
    // Remove user-scoped cache
    safeLocalStorageRemove(getCacheKey());
    // Also clean up legacy unscoped cache if it exists (migration)
    safeLocalStorageRemove(LEGACY_CACHE_KEY);
  } catch (error) {
    console.warn('[SessionCache] Failed to clear cache:', error);
  }
}

/**
 * Clear session cache on logout - should be called when user logs out
 * This ensures no cached data leaks to the next user
 */
export function clearSessionCacheOnLogout(): void {
  try {
    // Invalidate memory cache
    invalidateMemoryCache();
    // Remove user-scoped cache (uses current user before auth is cleared)
    safeLocalStorageRemove(getCacheKey());
    // Also clean up legacy unscoped cache
    safeLocalStorageRemove(LEGACY_CACHE_KEY);
    // Clear guest cache as well
    safeLocalStorageRemove(`${CACHE_KEY_PREFIX}_guest`);
  } catch (error) {
    console.warn('[SessionCache] Failed to clear cache on logout:', error);
  }
}

/**
 * Get cache statistics for debugging
 */
export function getSessionCacheStats(): {
  sessionCount: number;
  cachedModels: string[];
  defaultModel: string;
  lastSync: Date | null;
  isExpired: boolean;
  userId: number | undefined;
} {
  try {
    const cacheKey = getCacheKey();
    const cached = safeLocalStorageGet(cacheKey);
    if (!cached) {
      return {
        sessionCount: 0,
        cachedModels: [],
        defaultModel: 'fireworks/deepseek-r1',
        lastSync: null,
        isExpired: true,
        userId: undefined
      };
    }

    const data = JSON.parse(cached) as SessionCacheData;
    const isExpired = !isCacheValid(data);

    return {
      sessionCount: data.sessions?.length || 0,
      cachedModels: data.recentModels || [],
      defaultModel: data.defaultModel || 'fireworks/deepseek-r1',
      lastSync: new Date(data.lastSync),
      isExpired,
      userId: data.userId
    };
  } catch (error) {
    console.warn('[SessionCache] Failed to get cache stats:', error);
    return {
      sessionCount: 0,
      cachedModels: [],
      defaultModel: 'fireworks/deepseek-r1',
      lastSync: null,
      isExpired: true,
      userId: undefined
    };
  }
}
