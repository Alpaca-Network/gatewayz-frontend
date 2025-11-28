/**
 * Chat Cache Invalidation Utilities
 *
 * Provides helpers to invalidate chat-related caches when data changes:
 * - Stats cache (invalidate on new sessions/messages)
 * - Search cache (invalidate on session/message changes)
 * - Session list cache (invalidate on session create/delete)
 */

import { cacheInvalidate, cacheKey, CACHE_PREFIX } from './cache-strategies';

/**
 * Invalidate chat stats cache for a specific user
 *
 * Call this when:
 * - New session created
 * - Session deleted
 * - New message saved
 *
 * @param apiKey - User's API key (used to generate cache key)
 */
export async function invalidateUserStatsCache(apiKey: string): Promise<void> {
  try {
    const userHash = Buffer.from(apiKey).toString('base64').slice(0, 16);
    const statsKey = cacheKey(CACHE_PREFIX.STATS, 'chat', userHash);
    await cacheInvalidate(statsKey);
    console.log('[Cache] Invalidated stats cache for user');
  } catch (error) {
    console.error('[Cache] Error invalidating stats cache:', error);
  }
}

/**
 * Invalidate all search caches for a specific user
 *
 * Call this when:
 * - New session created (changes search results)
 * - Session updated (title changed, affects search)
 * - Session deleted
 * - New message saved (content indexed for search)
 *
 * @param apiKey - User's API key (used to generate cache pattern)
 */
export async function invalidateUserSearchCache(apiKey: string): Promise<void> {
  try {
    const userHash = Buffer.from(apiKey).toString('base64').slice(0, 16);
    // Invalidate all search queries for this user (pattern matching)
    const searchPattern = cacheKey(CACHE_PREFIX.STATS, 'search', userHash, '*');
    const deleted = await cacheInvalidate(searchPattern);
    console.log(`[Cache] Invalidated ${deleted} search cache entries for user`);
  } catch (error) {
    console.error('[Cache] Error invalidating search cache:', error);
  }
}

/**
 * Invalidate session list cache for a specific user
 *
 * Call this when:
 * - New session created
 * - Session deleted
 * - Session updated (title, model, etc.)
 *
 * @param apiKey - User's API key
 */
export async function invalidateUserSessionsCache(apiKey: string): Promise<void> {
  try {
    const userHash = Buffer.from(apiKey).toString('base64').slice(0, 16);
    // Invalidate all session list variations (different limits/offsets)
    // Pattern: "sessions:{userHash}:list:*" matches all pagination pages
    const sessionsPattern = cacheKey(CACHE_PREFIX.SESSIONS, userHash, 'list', '*');
    const deleted = await cacheInvalidate(sessionsPattern);
    console.log(`[Cache] Invalidated ${deleted} session list cache entries for user`);
  } catch (error) {
    console.error('[Cache] Error invalidating sessions cache:', error);
  }
}

/**
 * Invalidate user profile cache (credits, tier, subscription)
 *
 * Call this when:
 * - Credits spent (message sent to paid model)
 * - Subscription updated
 * - Tier changed
 *
 * @param apiKey - User's API key
 */
export async function invalidateUserProfileCache(apiKey: string): Promise<void> {
  try {
    const userHash = Buffer.from(apiKey).toString('base64').slice(0, 16);
    const profileKey = cacheKey(CACHE_PREFIX.USER, userHash, 'profile');
    await cacheInvalidate(profileKey);
    console.log('[Cache] Invalidated user profile cache');
  } catch (error) {
    console.error('[Cache] Error invalidating user profile cache:', error);
  }
}

/**
 * Invalidate all chat-related caches for a user
 *
 * Use this for major changes or when unsure which specific cache to invalidate.
 * This is the "nuclear option" - invalidates stats, search, and session caches.
 *
 * @param apiKey - User's API key
 */
export async function invalidateAllUserChatCaches(apiKey: string): Promise<void> {
  await Promise.all([
    invalidateUserStatsCache(apiKey),
    invalidateUserSearchCache(apiKey),
    invalidateUserSessionsCache(apiKey),
  ]);
  console.log('[Cache] Invalidated all chat caches for user');
}

/**
 * Recommended cache invalidation for common operations
 */
export const ChatCacheInvalidation = {
  /**
   * Invalidate caches when a new session is created
   */
  onSessionCreate: async (apiKey: string) => {
    await Promise.all([
      invalidateUserStatsCache(apiKey),
      invalidateUserSessionsCache(apiKey),
      // Don't invalidate search - new empty session doesn't affect search results yet
    ]);
  },

  /**
   * Invalidate caches when a session is deleted
   */
  onSessionDelete: async (apiKey: string) => {
    await Promise.all([
      invalidateUserStatsCache(apiKey),
      invalidateUserSessionsCache(apiKey),
      invalidateUserSearchCache(apiKey), // Deleted content affects search
    ]);
  },

  /**
   * Invalidate caches when a session is updated (title/model changed)
   */
  onSessionUpdate: async (apiKey: string) => {
    await Promise.all([
      invalidateUserSessionsCache(apiKey),
      invalidateUserSearchCache(apiKey), // Title change affects search
      // Don't invalidate stats - counts don't change on update
    ]);
  },

  /**
   * Invalidate caches when a new message is saved
   */
  onMessageSave: async (apiKey: string) => {
    await Promise.all([
      invalidateUserStatsCache(apiKey), // Message count changes
      invalidateUserSearchCache(apiKey), // Message content indexed for search
      invalidateUserProfileCache(apiKey), // Credits may have been spent
      // Don't invalidate session list - message doesn't affect session list
    ]);
  },

  /**
   * Invalidate caches when a message is deleted
   */
  onMessageDelete: async (apiKey: string) => {
    await Promise.all([
      invalidateUserStatsCache(apiKey),
      invalidateUserSearchCache(apiKey),
    ]);
  },
};
