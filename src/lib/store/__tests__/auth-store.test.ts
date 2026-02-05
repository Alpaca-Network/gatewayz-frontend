/**
 * Unit tests for auth-store.ts
 *
 * Tests the Zustand auth store including:
 * - Synchronous initialization from localStorage
 * - State actions (setAuth, clearAuth, setLoading, setError)
 */

// Mock functions need to be defined before jest.mock calls
const mockGetApiKey = jest.fn();
const mockGetUserData = jest.fn();

// Mock the api module BEFORE importing the store
jest.mock('@/lib/api', () => ({
  getApiKey: () => mockGetApiKey(),
  getUserData: () => mockGetUserData(),
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Clear module cache to re-run initialization
    mockGetApiKey.mockReturnValue(null);
    mockGetUserData.mockReturnValue(null);
  });

  describe('synchronous initialization from localStorage', () => {
    it('should initialize with isLoading: false and isAuthenticated: false when no credentials exist', () => {
      // Arrange: No credentials in localStorage
      mockGetApiKey.mockReturnValue(null);
      mockGetUserData.mockReturnValue(null);

      // Act: Import the store (triggers initialization)
      const { useAuthStore } = require('../auth-store');
      const state = useAuthStore.getState();

      // Assert: Guest user state - NOT loading, NOT authenticated
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.apiKey).toBeNull();
      expect(state.userData).toBeNull();
    });

    it('should initialize with isLoading: false and isAuthenticated: true when credentials exist', () => {
      // Arrange: User has cached credentials
      const mockApiKey = 'test-api-key-123';
      const mockUserData = {
        user_id: 1,
        api_key: mockApiKey,
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      };

      mockGetApiKey.mockReturnValue(mockApiKey);
      mockGetUserData.mockReturnValue(mockUserData);

      // Act: Import the store (triggers initialization)
      const { useAuthStore } = require('../auth-store');
      const state = useAuthStore.getState();

      // Assert: Authenticated user state - NOT loading, IS authenticated
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.apiKey).toBe(mockApiKey);
      expect(state.userData).toEqual(mockUserData);
    });

    it('should initialize as guest when only apiKey exists but no userData', () => {
      // Arrange: Partial credentials (edge case)
      mockGetApiKey.mockReturnValue('some-key');
      mockGetUserData.mockReturnValue(null);

      // Act
      const { useAuthStore } = require('../auth-store');
      const state = useAuthStore.getState();

      // Assert: Should treat as guest since both are needed
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });

    it('should initialize as guest when only userData exists but no apiKey', () => {
      // Arrange: Partial credentials (edge case)
      mockGetApiKey.mockReturnValue(null);
      mockGetUserData.mockReturnValue({ user_id: 1 });

      // Act
      const { useAuthStore } = require('../auth-store');
      const state = useAuthStore.getState();

      // Assert: Should treat as guest since both are needed
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setAuth action', () => {
    it('should set authenticated state correctly', () => {
      // Arrange
      const { useAuthStore } = require('../auth-store');
      const apiKey = 'new-api-key';
      const userData = {
        user_id: 2,
        api_key: apiKey,
        auth_method: 'google',
        privy_user_id: 'privy-456',
        display_name: 'New User',
        email: 'new@example.com',
        credits: 50,
      };

      // Act
      useAuthStore.getState().setAuth(apiKey, userData);
      const state = useAuthStore.getState();

      // Assert
      expect(state.apiKey).toBe(apiKey);
      expect(state.userData).toEqual(userData);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('clearAuth action', () => {
    it('should clear authenticated state correctly', () => {
      // Arrange: Set up authenticated state first
      const { useAuthStore } = require('../auth-store');
      useAuthStore.getState().setAuth('some-key', { user_id: 1 } as any);

      // Act
      useAuthStore.getState().clearAuth();
      const state = useAuthStore.getState();

      // Assert
      expect(state.apiKey).toBeNull();
      expect(state.userData).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('setLoading action', () => {
    it('should update isLoading state', () => {
      // Arrange
      const { useAuthStore } = require('../auth-store');

      // Act
      useAuthStore.getState().setLoading(true);

      // Assert
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Act again
      useAuthStore.getState().setLoading(false);

      // Assert
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError action', () => {
    it('should update error state', () => {
      // Arrange
      const { useAuthStore } = require('../auth-store');
      const errorMessage = 'Authentication failed';

      // Act
      useAuthStore.getState().setError(errorMessage);

      // Assert
      expect(useAuthStore.getState().error).toBe(errorMessage);

      // Act: Clear error
      useAuthStore.getState().setError(null);

      // Assert
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
