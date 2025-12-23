import { renderHook } from '@testing-library/react';
import { useAuth } from '../use-auth';
import { usePrivy } from '@privy-io/react-auth';
import { setUserContext, clearUserContext } from '@/lib/sentry-utils';

// Mock the dependencies
jest.mock('@privy-io/react-auth', () => ({
  usePrivy: jest.fn(),
}));

jest.mock('@/lib/sentry-utils', () => ({
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
}));

describe('useAuth', () => {
  const mockUsePrivy = usePrivy as jest.Mock;
  const mockSetUserContext = setUserContext as jest.Mock;
  const mockClearUserContext = clearUserContext as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Return Values', () => {
    it('should return user, loading, isAuthenticated, and login from usePrivy', () => {
      const mockUser = { id: 'user-123', email: { address: 'test@example.com' } };
      const mockLogin = jest.fn();

      mockUsePrivy.mockReturnValue({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: mockLogin,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(result.current.login).toBe(mockLogin);
    });

    it('should return loading=true when not ready', () => {
      mockUsePrivy.mockReturnValue({
        user: null,
        authenticated: false,
        ready: false,
        login: jest.fn(),
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(true);
    });

    it('should return loading=false when ready', () => {
      mockUsePrivy.mockReturnValue({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Sentry User Context', () => {
    it('should set user context when authenticated with user id', () => {
      const mockUser = { id: 'user-123', email: { address: 'test@example.com' } };

      mockUsePrivy.mockReturnValue({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      renderHook(() => useAuth());

      expect(mockSetUserContext).toHaveBeenCalledWith('user-123', 'test@example.com');
      expect(mockClearUserContext).not.toHaveBeenCalled();
    });

    it('should set user context with undefined email when user has no email', () => {
      const mockUser = { id: 'user-123' };

      mockUsePrivy.mockReturnValue({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      renderHook(() => useAuth());

      expect(mockSetUserContext).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should clear user context when not authenticated', () => {
      mockUsePrivy.mockReturnValue({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      renderHook(() => useAuth());

      expect(mockClearUserContext).toHaveBeenCalled();
      expect(mockSetUserContext).not.toHaveBeenCalled();
    });

    it('should not set user context when authenticated but user is null', () => {
      mockUsePrivy.mockReturnValue({
        user: null,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      renderHook(() => useAuth());

      // authenticated is true but user?.id is falsy, so neither should be called
      expect(mockSetUserContext).not.toHaveBeenCalled();
      expect(mockClearUserContext).not.toHaveBeenCalled();
    });

    it('should not set user context when authenticated but user has no id', () => {
      mockUsePrivy.mockReturnValue({
        user: { email: { address: 'test@example.com' } },
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      renderHook(() => useAuth());

      expect(mockSetUserContext).not.toHaveBeenCalled();
      expect(mockClearUserContext).not.toHaveBeenCalled();
    });
  });

  describe('Context Updates on Authentication Change', () => {
    it('should update user context when user logs in', () => {
      // Start unauthenticated
      mockUsePrivy.mockReturnValue({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      const { rerender } = renderHook(() => useAuth());

      expect(mockClearUserContext).toHaveBeenCalledTimes(1);
      expect(mockSetUserContext).not.toHaveBeenCalled();

      // User logs in
      const mockUser = { id: 'user-123', email: { address: 'test@example.com' } };
      mockUsePrivy.mockReturnValue({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      rerender();

      expect(mockSetUserContext).toHaveBeenCalledWith('user-123', 'test@example.com');
    });

    it('should clear user context when user logs out', () => {
      // Start authenticated
      const mockUser = { id: 'user-123', email: { address: 'test@example.com' } };
      mockUsePrivy.mockReturnValue({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      const { rerender } = renderHook(() => useAuth());

      expect(mockSetUserContext).toHaveBeenCalledWith('user-123', 'test@example.com');

      // User logs out
      mockUsePrivy.mockReturnValue({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      rerender();

      expect(mockClearUserContext).toHaveBeenCalled();
    });

    it('should update user context when user email changes', () => {
      // Start with one email
      const mockUser = { id: 'user-123', email: { address: 'old@example.com' } };
      mockUsePrivy.mockReturnValue({
        user: mockUser,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      const { rerender } = renderHook(() => useAuth());

      expect(mockSetUserContext).toHaveBeenCalledWith('user-123', 'old@example.com');

      // Email changes
      const updatedUser = { id: 'user-123', email: { address: 'new@example.com' } };
      mockUsePrivy.mockReturnValue({
        user: updatedUser,
        authenticated: true,
        ready: true,
        login: jest.fn(),
      });

      rerender();

      expect(mockSetUserContext).toHaveBeenLastCalledWith('user-123', 'new@example.com');
    });
  });

  describe('Hook Rules Compliance', () => {
    it('should call usePrivy unconditionally at the top level', () => {
      mockUsePrivy.mockReturnValue({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      // This should not throw - hooks are called correctly
      expect(() => renderHook(() => useAuth())).not.toThrow();

      // usePrivy should have been called
      expect(mockUsePrivy).toHaveBeenCalled();
    });

    it('should handle multiple rapid rerenders without errors', () => {
      mockUsePrivy.mockReturnValue({
        user: null,
        authenticated: false,
        ready: true,
        login: jest.fn(),
      });

      const { rerender } = renderHook(() => useAuth());

      // Rapid rerenders should not cause hook order issues
      expect(() => {
        for (let i = 0; i < 10; i++) {
          rerender();
        }
      }).not.toThrow();
    });
  });
});
