import { render, waitFor } from '@testing-library/react';
import { SessionInitializer } from '../SessionInitializer';
import * as sessionTransfer from '@/integrations/privy/auth-session-transfer';
import * as api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));

jest.mock('@/integrations/privy/auth-session-transfer', () => ({
  getSessionTransferParams: jest.fn(),
  cleanupSessionTransferParams: jest.fn(),
  storeSessionTransferToken: jest.fn(),
  getStoredSessionTransferToken: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  saveApiKey: jest.fn(),
  saveUserData: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

describe('SessionInitializer', () => {
  let mockRouter: { push: jest.Mock };
  let mockAuthContext: {
    status: string;
    refresh: jest.Mock;
    login: jest.Mock;
    privyReady: boolean;
  };

  beforeEach(() => {
    // Reset ALL mocks including their implementations and return values
    jest.resetAllMocks();

    // Reset fetch mock completely
    (global.fetch as jest.Mock).mockReset();
    // Set a default that will cause tests to fail if they don't set up fetch
    (global.fetch as jest.Mock).mockRejectedValue(new Error('fetch not mocked in test'));

    // Clear SessionInitializer cache for tests
    if (typeof (window as any).__clearSessionInitializerCache === 'function') {
      (window as any).__clearSessionInitializerCache();
    }

    // Setup router mock
    mockRouter = {
      push: jest.fn(),
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Setup auth context mock
    mockAuthContext = {
      status: 'unauthenticated',
      refresh: jest.fn().mockResolvedValue(undefined),
      login: jest.fn().mockResolvedValue(undefined),
      privyReady: true,
    };
    (useGatewayzAuth as jest.Mock).mockReturnValue(mockAuthContext);

    // Default mock implementations
    (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
      token: null,
      userId: null,
      returnUrl: null,
      action: null,
    });

    (sessionTransfer.getStoredSessionTransferToken as jest.Mock).mockReturnValue({
      token: null,
      userId: null,
    });
  });

  describe('Session Transfer from URL Parameters', () => {
    it('should process valid token and userId from URL params', async () => {
      const mockToken = 'test-api-key-123';
      const mockUserId = '12345';
      const mockUserData = {
        user_id: 12345,
        email: 'test@example.com',
        display_name: 'Test User',
        credits: 100,
        tier: 'basic',
        subscription_status: 'active',
      };

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: mockToken,
        userId: mockUserId,
        returnUrl: null,
        action: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUserData,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        // Verify token was stored
        expect(sessionTransfer.storeSessionTransferToken).toHaveBeenCalledWith(
          mockToken,
          mockUserId
        );
      });

      // Verify API key was saved
      expect(api.saveApiKey).toHaveBeenCalledWith(mockToken);

      // Verify user data fetch
      expect(global.fetch).toHaveBeenCalledWith('/api/user/me', expect.objectContaining({
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
      }));

      // Verify user data was saved
      await waitFor(() => {
        expect(api.saveUserData).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 12345,
            api_key: mockToken,
            email: 'test@example.com',
            display_name: 'Test User',
            credits: 100,
            tier: 'basic',
          })
        );
      });

      // Verify URL cleanup
      expect(sessionTransfer.cleanupSessionTransferParams).toHaveBeenCalled();

      // Verify auth refresh was triggered
      expect(mockAuthContext.refresh).toHaveBeenCalledWith({ force: true });
    });

    it('should redirect to returnUrl when provided', async () => {
      const mockToken = 'test-api-key-redirect';
      const mockUserId = '12345';
      const mockReturnUrl = '/dashboard';
      const mockUserData = {
        user_id: 12345,
        email: 'test@example.com',
        display_name: 'Test User',
        credits: 100,
      };

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: mockToken,
        userId: mockUserId,
        returnUrl: mockReturnUrl,
        action: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUserData,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveUserData).toHaveBeenCalled();
      });

      // Wait for the setTimeout to trigger
      await waitFor(
        () => {
          expect(mockRouter.push).toHaveBeenCalledWith(mockReturnUrl);
        },
        { timeout: 200 }
      );
    });

    it('should handle failed user data fetch gracefully', async () => {
      const mockToken = 'test-api-key-failed';
      const mockUserId = '12345';

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: mockToken,
        userId: mockUserId,
        returnUrl: null,
        action: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SessionInit] Failed to fetch user data:'),
          401
        );
      });

      // Token should still be saved
      expect(api.saveApiKey).toHaveBeenCalledWith(mockToken);

      // But user data should NOT be saved
      expect(api.saveUserData).not.toHaveBeenCalled();

      // URL cleanup and refresh should still happen
      expect(sessionTransfer.cleanupSessionTransferParams).toHaveBeenCalled();

      // Wait for async refresh to be called (refresh is now non-blocking)
      await waitFor(() => {
        expect(mockAuthContext.refresh).toHaveBeenCalledWith({ force: true });
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle network errors during user data fetch', async () => {
      const mockToken = 'test-api-key-network';
      const mockUserId = '12345';

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: mockToken,
        userId: mockUserId,
        returnUrl: null,
        action: null,
      });

      const networkError = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SessionInit] Error fetching user data:'),
          networkError
        );
      });

      // Token should still be saved
      expect(api.saveApiKey).toHaveBeenCalledWith(mockToken);

      // URL cleanup and refresh should still happen
      expect(sessionTransfer.cleanupSessionTransferParams).toHaveBeenCalled();

      // Wait for async refresh to be called (refresh is now non-blocking)
      await waitFor(() => {
        expect(mockAuthContext.refresh).toHaveBeenCalledWith({ force: true });
      });

      consoleErrorSpy.mockRestore();
    });

    it('should normalize user data correctly', async () => {
      const mockToken = 'test-api-key-normalize';
      const mockUserId = '12345';
      const mockUserData = {
        user_id: 12345,
        email: 'test@example.com',
        credits: 150.75, // Decimal credits
        tier: 'PRO', // Uppercase tier
        subscription_status: 'active',
        subscription_end_date: 1735689600,
      };

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: mockToken,
        userId: mockUserId,
        returnUrl: null,
        action: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUserData,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveUserData).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 12345,
            credits: 150, // Should be floored
            tier: 'pro', // Should be lowercased
            subscription_status: 'active',
            subscription_end_date: 1735689600,
          })
        );
      });
    });

    it('should use fallback values for missing user data fields', async () => {
      const mockToken = 'test-api-key-456-fallback';
      const mockUserId = '12345';
      const mockUserData = {
        user_id: 12345,
        // Missing email, display_name, etc.
      };

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: mockToken,
        userId: mockUserId,
        returnUrl: null,
        action: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUserData,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveUserData).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 12345,
            auth_method: 'session_transfer',
            privy_user_id: '12345',
            display_name: 'User', // Fallback when not provided
            email: '', // Fallback when not provided
            credits: 0, // Fallback when not provided
            api_key: mockToken,
          })
        );
      });
    });
  });

  describe('Session Transfer from SessionStorage (Fallback)', () => {
    beforeEach(() => {
      // Mock localStorage to not have API key
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn().mockReturnValue(null),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        },
        writable: true,
      });
    });

    it('should use stored token when no URL params but sessionStorage has token', async () => {
      const mockToken = 'stored-api-key-456';
      const mockUserId = '67890';
      const mockUserData = {
        user_id: 67890,
        email: 'stored@example.com',
        display_name: 'Stored User',
        credits: 200,
      };

      // No URL params
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: null,
      });

      // But sessionStorage has token
      (sessionTransfer.getStoredSessionTransferToken as jest.Mock).mockReturnValue({
        token: mockToken,
        userId: mockUserId,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUserData,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveApiKey).toHaveBeenCalledWith(mockToken);
      });

      // Verify user data fetch
      expect(global.fetch).toHaveBeenCalledWith('/api/user/me', expect.objectContaining({
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
      }));

      // Verify user data was saved
      await waitFor(() => {
        expect(api.saveUserData).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 67890,
            api_key: mockToken,
            email: 'stored@example.com',
          })
        );
      });

      // Verify auth refresh was triggered
      expect(mockAuthContext.refresh).toHaveBeenCalledWith({ force: true });
    });

    it('should NOT use stored token if localStorage already has API key', async () => {
      const existingApiKey = 'existing-api-key';

      // Mock localStorage with existing API key
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn().mockReturnValue(existingApiKey),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        },
        writable: true,
      });

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: null,
      });

      (sessionTransfer.getStoredSessionTransferToken as jest.Mock).mockReturnValue({
        token: 'stored-token',
        userId: '12345',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveApiKey).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });
  });

  describe('Action Parameter Handling', () => {
    it('should trigger login when action parameter is present and user is unauthenticated', async () => {
      mockAuthContext.status = 'unauthenticated';

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'signin',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalled();
      });

      expect(sessionTransfer.cleanupSessionTransferParams).toHaveBeenCalled();
    });

    it('should handle freetrial action', async () => {
      mockAuthContext.status = 'unauthenticated';

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'freetrial',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalled();
      });

      expect(sessionTransfer.cleanupSessionTransferParams).toHaveBeenCalled();
    });

    it('should NOT trigger login when action is present but user is authenticated', async () => {
      mockAuthContext.status = 'authenticated';

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'signin',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).not.toHaveBeenCalled();
      });
    });

    it('should wait for Privy to be ready before processing action', async () => {
      mockAuthContext.status = 'unauthenticated';
      mockAuthContext.privyReady = false; // Privy not ready yet

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'freetrial',
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SessionInit] Privy not ready yet')
        );
      });

      expect(mockAuthContext.login).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should do nothing when already authenticated and no params', async () => {
      mockAuthContext.status = 'authenticated';

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: null,
      });

      (sessionTransfer.getStoredSessionTransferToken as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveApiKey).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockAuthContext.refresh).not.toHaveBeenCalled();
      });
    });

    it('should handle missing token but present userId', async () => {
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: '12345',
        returnUrl: null,
        action: null,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(sessionTransfer.storeSessionTransferToken).not.toHaveBeenCalled();
        expect(api.saveApiKey).not.toHaveBeenCalled();
      });
    });

    it('should handle missing userId but present token', async () => {
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: 'test-token',
        userId: null,
        returnUrl: null,
        action: null,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(sessionTransfer.storeSessionTransferToken).not.toHaveBeenCalled();
        expect(api.saveApiKey).not.toHaveBeenCalled();
      });
    });

    it('should catch and log errors during initialization', async () => {
      const mockError = new Error('Initialization error');

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SessionInit] Error initializing session:'),
          mockError
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Component Lifecycle', () => {
    it('should only run initialization once on mount', async () => {
      const mockToken = 'test-api-key-lifecycle';
      const mockUserId = '12345';
      const mockUserData = {
        user_id: 12345,
        email: 'test@example.com',
        credits: 100,
      };

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: mockToken,
        userId: mockUserId,
        returnUrl: null,
        action: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUserData,
      });

      const { rerender } = render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveApiKey).toHaveBeenCalledTimes(1);
      });

      // Rerender component
      rerender(<SessionInitializer />);

      // Should not trigger additional calls
      expect(api.saveApiKey).toHaveBeenCalledTimes(1);
    });

    it('should render null (no UI)', () => {
      const { container } = render(<SessionInitializer />);
      expect(container.firstChild).toBeNull();
    });
  });
});
