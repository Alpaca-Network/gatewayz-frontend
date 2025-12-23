/**
 * Unit tests for use-auth.ts
 *
 * Tests the authentication hook including:
 * - Normal operation with PrivyProvider mounted
 * - Sentry context tracking for authenticated users
 * - Hook state management
 *
 * Note: Invalid hook call errors are handled at the PrivyProviderWrapper level,
 * not in this hook. See privy-provider.tsx for error handling tests.
 */

import { renderHook } from '@testing-library/react';

// Mock Sentry utils before importing the hook
const mockSetUserContext = jest.fn();
const mockClearUserContext = jest.fn();

jest.mock('@/lib/sentry-utils', () => ({
  setUserContext: (...args: any[]) => mockSetUserContext(...args),
  clearUserContext: () => mockClearUserContext(),
}));

// Mock usePrivy with a configurable implementation
let mockUsePrivyImplementation: () => any;

jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => mockUsePrivyImplementation(),
}));

// Import after mocks
import { useAuth } from '../use-auth';

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation - provider is ready
    mockUsePrivyImplementation = () => ({
      user: null,
      authenticated: false,
      ready: true,
      login: jest.fn(),
    });
  });

  describe('Normal Operation', () => {
    it('should return loading: false when Privy is ready', () => {
      mockUsePrivyImplementation = () => ({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should return loading: true when Privy is not ready', () => {
      mockUsePrivyImplementation = () => ({
        user: null,
        authenticated: false,
        ready: false,
        login: jest.fn(),
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should return authenticated user data', () => {
      const mockUser = {
        id: 'user-123',
        email: { address: 'test@example.com' },
      };
      const mockLogin = jest.fn();

      mockUsePrivyImplementation = () => ({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: mockLogin,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.login).toBe(mockLogin);
    });

    it('should return unauthenticated state correctly', () => {
      mockUsePrivyImplementation = () => ({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('Sentry Context Tracking', () => {
    it('should set user context when authenticated', () => {
      const mockUser = {
        id: 'user-123',
        email: { address: 'test@example.com' },
      };

      mockUsePrivyImplementation = () => ({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      renderHook(() => useAuth());

      expect(mockSetUserContext).toHaveBeenCalledWith('user-123', 'test@example.com');
      expect(mockClearUserContext).not.toHaveBeenCalled();
    });

    it('should clear user context when not authenticated', () => {
      mockUsePrivyImplementation = () => ({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      renderHook(() => useAuth());

      expect(mockClearUserContext).toHaveBeenCalled();
      expect(mockSetUserContext).not.toHaveBeenCalled();
    });

    it('should set user context without email when email is not available', () => {
      const mockUser = {
        id: 'user-456',
        // No email
      };

      mockUsePrivyImplementation = () => ({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      renderHook(() => useAuth());

      expect(mockSetUserContext).toHaveBeenCalledWith('user-456', undefined);
    });
  });

  describe('Hook Reactivity', () => {
    it('should update when authentication state changes', () => {
      // Start unauthenticated
      mockUsePrivyImplementation = () => ({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      const { result, rerender } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);

      // Simulate login
      const mockUser = { id: 'user-123', email: { address: 'test@example.com' } };
      mockUsePrivyImplementation = () => ({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      rerender();

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('should update when ready state changes', () => {
      // Start not ready
      mockUsePrivyImplementation = () => ({
        user: null,
        authenticated: false,
        ready: false,
        login: jest.fn(),
      });

      const { result, rerender } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(true);

      // Become ready
      mockUsePrivyImplementation = () => ({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      rerender();

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with null email', () => {
      const mockUser = {
        id: 'user-789',
        email: null,
      };

      mockUsePrivyImplementation = () => ({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(mockSetUserContext).toHaveBeenCalledWith('user-789', undefined);
    });

    it('should handle authenticated but no user object', () => {
      // Edge case: authenticated is true but user is null (shouldn't happen, but be defensive)
      mockUsePrivyImplementation = () => ({
        user: null,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toBeNull();
      // Should not call setUserContext because user?.id is falsy
      expect(mockSetUserContext).not.toHaveBeenCalled();
    });
  });
});
