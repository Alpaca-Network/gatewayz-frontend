/**
 * Session Cache Utility
 * Provides localStorage-based caching for chat sessions to enable instant page load
 * and fast session creation with optimistic UI.
 */

import { ChatSession } from './chat-history';
import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage';

export interface SessionCacheData {
  sessions: ChatSession[];
  recentModels: string[];
  defaultModel: string;
  lastSync: number; // Timestamp
  expiresAt: number; // Timestamp
}

const CACHE_KEY = 'gatewayz_session_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    expiresAt: now + CACHE_TTL_MS
  };
}

/**
 * Check if cache is still valid
 */
function isCacheValid(cache: SessionCacheData): boolean {
  return Date.now() < cache.expiresAt;
}

/**
 * Get cached sessions from localStorage
 */
export function getCachedSessions(): ChatSession[] {
  try {
    const cached = safeLocalStorageGet(CACHE_KEY);
    if (!cached) return [];

    const data = JSON.parse(cached) as SessionCacheData;
    if (!isCacheValid(data)) {
      // Cache expired, clear it
      clearSessionCache();
      return [];
    }

    return data.sessions || [];
  } catch (error) {
    console.warn('[SessionCache] Failed to read cached sessions:', error);
    return [];
  }
}

/**
 * Get user's cached default model
 */
export function getCachedDefaultModel(): string | null {
  try {
    const cached = safeLocalStorageGet(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached) as SessionCacheData;
    if (!isCacheValid(data)) {
      clearSessionCache();
      return null;
    }

    return data.defaultModel || 'fireworks/deepseek-r1';
  } catch (error) {
    console.warn('[SessionCache] Failed to read cached default model:', error);
    return null;
  }
}

/**
 * Get cached recent models
 */
export function getCachedRecentModels(): string[] {
  try {
    const cached = safeLocalStorageGet(CACHE_KEY);
    if (!cached) return [];

    const data = JSON.parse(cached) as SessionCacheData;
    if (!isCacheValid(data)) {
      clearSessionCache();
      return [];
    }

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
    const cached = safeLocalStorageGet(CACHE_KEY);
    let data: SessionCacheData;

    if (cached) {
      data = JSON.parse(cached) as SessionCacheData;
    } else {
      data = createEmptyCache();
    }

    // Update sessions
    data.sessions = sessions;
    data.lastSync = Date.now();

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

    safeLocalStorageSet(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[SessionCache] Failed to cache sessions:', error);
  }
}

/**
 * Update just the default model
 */
export function setCachedDefaultModel(model: string): void {
  try {
    const cached = safeLocalStorageGet(CACHE_KEY);
    let data: SessionCacheData;

    if (cached) {
      data = JSON.parse(cached) as SessionCacheData;
    } else {
      data = createEmptyCache();
    }

    data.defaultModel = model;

    // Add to recent models if not already there
    if (!data.recentModels.includes(model)) {
      data.recentModels.unshift(model);
      // Keep only last 10 models
      data.recentModels = data.recentModels.slice(0, 10);
    }

    data.expiresAt = Date.now() + CACHE_TTL_MS;

    safeLocalStorageSet(CACHE_KEY, JSON.stringify(data));
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
 * Clear entire cache
 */
export function clearSessionCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('[SessionCache] Failed to clear cache:', error);
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
} {
  try {
    const cached = safeLocalStorageGet(CACHE_KEY);
    if (!cached) {
      return {
        sessionCount: 0,
        cachedModels: [],
        defaultModel: 'fireworks/deepseek-r1',
        lastSync: null,
        isExpired: true
      };
    }

    const data = JSON.parse(cached) as SessionCacheData;
    const isExpired = !isCacheValid(data);

    return {
      sessionCount: data.sessions?.length || 0,
      cachedModels: data.recentModels || [],
      defaultModel: data.defaultModel || 'fireworks/deepseek-r1',
      lastSync: new Date(data.lastSync),
      isExpired
    };
  } catch (error) {
    console.warn('[SessionCache] Failed to get cache stats:', error);
    return {
      sessionCount: 0,
      cachedModels: [],
      defaultModel: 'fireworks/deepseek-r1',
      lastSync: null,
      isExpired: true
    };
  }
}
