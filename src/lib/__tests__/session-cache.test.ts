/**
 * Tests for session-cache.ts
 *
 * Focus areas:
 * - User-scoped cache keys (prevents cross-user data leak)
 * - Cache validation (expiry, user ID matching)
 * - Cache operations (get, set, clear)
 * - Memory cache layer
 * - Logout cache clearing
 */

import {
  getCachedSessions,
  setCachedSessions,
  clearSessionCache,
  clearSessionCacheOnLogout,
  getSessionCacheStats,
  getCachedDefaultModel,
  setCachedDefaultModel,
  invalidateMemoryCache,
} from '../session-cache';
import { ChatSession } from '../chat-history';
import * as api from '../api';

// Mock the api module
jest.mock('../api', () => ({
  getUserData: jest.fn(),
  getApiKey: jest.fn(),
}));

// Mock safe-storage
jest.mock('../safe-storage', () => {
  const store: Record<string, string> = {};
  return {
    safeLocalStorageGet: jest.fn((key: string) => store[key] || null),
    safeLocalStorageSet: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    safeLocalStorageRemove: jest.fn((key: string) => {
      delete store[key];
    }),
    // Helper to reset the store between tests
    __resetStore: () => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
    __getStore: () => store,
  };
});

const mockGetUserData = api.getUserData as jest.Mock;
const mockSafeStorage = jest.requireMock('../safe-storage');

// Helper to create mock sessions
function createMockSession(id: number, userId: number): ChatSession {
  return {
    id,
    user_id: userId,
    title: `Session ${id}`,
    model: 'test-model',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
  };
}

describe('session-cache', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockSafeStorage.__resetStore();
    invalidateMemoryCache();
    // Default to no user (guest)
    mockGetUserData.mockReturnValue(null);
  });

  describe('user-scoped cache keys', () => {
    it('should use user-scoped cache key for authenticated users', () => {
      // Setup: User 123 is logged in
      mockGetUserData.mockReturnValue({ user_id: 123, email: 'user@test.com' });

      const sessions = [createMockSession(1, 123)];
      setCachedSessions(sessions);

      // Verify the cache was stored with user-scoped key
      const store = mockSafeStorage.__getStore();
      expect(store['gatewayz_session_cache_123']).toBeDefined();
      expect(store['gatewayz_session_cache']).toBeUndefined();
    });

    it('should use guest cache key for unauthenticated users', () => {
      // Setup: No user logged in
      mockGetUserData.mockReturnValue(null);

      const sessions = [createMockSession(1, 0)];
      setCachedSessions(sessions);

      // Verify the cache was stored with guest key
      const store = mockSafeStorage.__getStore();
      expect(store['gatewayz_session_cache_guest']).toBeDefined();
    });

    it('should not return sessions from different user cache', () => {
      // Setup: User 123 cached some sessions
      mockGetUserData.mockReturnValue({ user_id: 123, email: 'user1@test.com' });
      const user1Sessions = [createMockSession(1, 123), createMockSession(2, 123)];
      setCachedSessions(user1Sessions);

      // Verify user 123 can read their sessions
      const cachedForUser1 = getCachedSessions();
      expect(cachedForUser1).toHaveLength(2);

      // Now user 456 logs in (simulating logout + login)
      invalidateMemoryCache();
      mockGetUserData.mockReturnValue({ user_id: 456, email: 'user2@test.com' });

      // User 456 should NOT see user 123's sessions
      const cachedForUser2 = getCachedSessions();
      expect(cachedForUser2).toHaveLength(0);
    });

    it('should validate userId in cached data matches current user', () => {
      // Setup: User 123 cached sessions
      mockGetUserData.mockReturnValue({ user_id: 123, email: 'user1@test.com' });
      const sessions = [createMockSession(1, 123)];
      setCachedSessions(sessions);

      // Verify sessions are stored with userId
      const stats = getSessionCacheStats();
      expect(stats.userId).toBe(123);
      expect(stats.sessionCount).toBe(1);
    });
  });

  describe('cache operations', () => {
    it('should store and retrieve sessions correctly', () => {
      mockGetUserData.mockReturnValue({ user_id: 100, email: 'test@test.com' });

      const sessions = [
        createMockSession(1, 100),
        createMockSession(2, 100),
      ];
      setCachedSessions(sessions);

      const cached = getCachedSessions();
      expect(cached).toHaveLength(2);
      expect(cached[0].id).toBe(1);
      expect(cached[1].id).toBe(2);
    });

    it('should store and retrieve default model correctly', () => {
      mockGetUserData.mockReturnValue({ user_id: 100, email: 'test@test.com' });

      setCachedDefaultModel('openai/gpt-4');

      const model = getCachedDefaultModel();
      expect(model).toBe('openai/gpt-4');
    });

    it('should clear cache for current user only', () => {
      // Setup: Two users have cached data
      mockGetUserData.mockReturnValue({ user_id: 100, email: 'user1@test.com' });
      setCachedSessions([createMockSession(1, 100)]);

      invalidateMemoryCache();
      mockGetUserData.mockReturnValue({ user_id: 200, email: 'user2@test.com' });
      setCachedSessions([createMockSession(2, 200)]);

      // Clear cache for user 200
      clearSessionCache();

      // User 200's cache should be empty
      expect(getCachedSessions()).toHaveLength(0);

      // Switch back to user 100 - their cache should still exist
      invalidateMemoryCache();
      mockGetUserData.mockReturnValue({ user_id: 100, email: 'user1@test.com' });
      expect(getCachedSessions()).toHaveLength(1);
    });
  });

  describe('logout cache clearing', () => {
    it('should clear all caches on logout', () => {
      // Setup: User 100 has cached data
      mockGetUserData.mockReturnValue({ user_id: 100, email: 'user@test.com' });
      setCachedSessions([createMockSession(1, 100)]);

      // Call logout cache clearing BEFORE clearing user auth
      // (this is how it's called in auth-store.ts)
      clearSessionCacheOnLogout();

      // Cache should be cleared
      expect(getCachedSessions()).toHaveLength(0);
    });

    it('should clear legacy unscoped cache on logout', () => {
      // Setup: Put something in the legacy cache key
      const store = mockSafeStorage.__getStore();
      store['gatewayz_session_cache'] = JSON.stringify({
        sessions: [createMockSession(1, 100)],
        recentModels: [],
        defaultModel: 'test',
        lastSync: Date.now(),
        expiresAt: Date.now() + 1000000,
      });

      mockGetUserData.mockReturnValue({ user_id: 100, email: 'user@test.com' });
      clearSessionCacheOnLogout();

      // Legacy cache should be cleared
      expect(store['gatewayz_session_cache']).toBeUndefined();
    });
  });

  describe('memory cache layer', () => {
    it('should invalidate memory cache on user mismatch', () => {
      // Setup: User 100 has cached and memory-cached data
      mockGetUserData.mockReturnValue({ user_id: 100, email: 'user1@test.com' });
      setCachedSessions([createMockSession(1, 100)]);

      // Read to populate memory cache
      const sessions1 = getCachedSessions();
      expect(sessions1).toHaveLength(1);

      // Simulate user switch (without calling invalidateMemoryCache manually)
      mockGetUserData.mockReturnValue({ user_id: 200, email: 'user2@test.com' });

      // Memory cache should be invalidated due to userId mismatch
      const sessions2 = getCachedSessions();
      expect(sessions2).toHaveLength(0); // User 200 has no cached sessions
    });
  });

  describe('cache stats', () => {
    it('should include userId in cache stats', () => {
      mockGetUserData.mockReturnValue({ user_id: 999, email: 'test@test.com' });
      setCachedSessions([createMockSession(1, 999)]);

      const stats = getSessionCacheStats();
      expect(stats.userId).toBe(999);
      expect(stats.sessionCount).toBe(1);
    });

    it('should return undefined userId when no cache exists', () => {
      mockGetUserData.mockReturnValue({ user_id: 888, email: 'test@test.com' });

      const stats = getSessionCacheStats();
      expect(stats.userId).toBeUndefined();
      expect(stats.sessionCount).toBe(0);
    });
  });
});
