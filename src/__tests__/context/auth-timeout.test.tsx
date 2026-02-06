import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { GatewayzAuthProvider, useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { usePrivy } from '@privy-io/react-auth';
import * as api from '@/lib/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
jest.mock('@privy-io/react-auth');
jest.mock('@sentry/nextjs');
jest.mock('@/lib/api');
jest.mock('@/integrations/privy/auth-session-transfer', () => ({
  redirectToBetaWithSession: jest.fn(),
  getSessionTransferParams: jest.fn(() => null),
  cleanupSessionTransferParams: jest.fn(),
  storeSessionTransferToken: jest.fn(),
  getStoredSessionTransferToken: jest.fn(() => null),
}));
jest.mock('@/lib/network-timeouts', () => ({
  getAdaptiveTimeout: jest.fn((base) => base),
}));
jest.mock('@/lib/retry-utils', () => ({
  retryFetch: jest.fn((fn) => fn()),
}));
jest.mock('@/lib/referral', () => ({
  getReferralCode: jest.fn(() => null),
  clearReferralCode: jest.fn(),
}));
jest.mock('@/lib/guest-chat', () => ({
  resetGuestMessageCount: jest.fn(),
}));

describe('GatewayzAuthContext - Authentication Timeout', () => {
  const mockUsePrivy = usePrivy as jest.MockedFunction<typeof usePrivy>;
  const mockGetApiKey = api.getApiKey as jest.Mock;
  const mockGetUserData = api.getUserData as jest.Mock;
  const mockSaveApiKey = api.saveApiKey as jest.Mock;
  const mockSaveUserData = api.saveUserData as jest.Mock;
  const mockRemoveApiKey = api.removeApiKey as jest.Mock;
  const mockProcessAuthResponse = api.processAuthResponse as jest.Mock;

  // Create a new QueryClient for each test to avoid shared state
  const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => {
    const queryClient = createTestQueryClient();
    return (
      <QueryClientProvider client={queryClient}>
        <GatewayzAuthProvider>{children}</GatewayzAuthProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockGetApiKey.mockReturnValue(null);
    mockGetUserData.mockReturnValue(null);

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: false,
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      getAccessToken: jest.fn(),
      linkEmail: jest.fn(),
      linkWallet: jest.fn(),
      unlinkEmail: jest.fn(),
      unlinkWallet: jest.fn(),
      exportWallet: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should timeout after 60 seconds of being stuck in authenticating state', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: { address: 'test@example.com' },
    };

    const mockToken = 'test-token';
    const mockGetAccessToken = jest.fn().mockResolvedValue(mockToken);

    // Mock fetch to never resolve (simulating slow backend)
    global.fetch = jest.fn(() => new Promise(() => {}));

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: jest.fn(),
      logout: jest.fn(),
    } as any);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    // Should start authenticating immediately when Privy is authenticated
    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });

    // Fast-forward 90 seconds (AUTHENTICATING_TIMEOUT_MS)
    act(() => {
      jest.advanceTimersByTime(90000);
    });

    // Should auto-retry (AUTH_REFRESH_EVENT dispatched, which retries and clears the error)
    // The status should still be 'authenticating' after retry
    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });

    // Verify Sentry was called for retry
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Authentication timeout - auto-retrying',
      expect.objectContaining({
        level: 'warning',
      })
    );
  });

  it('should transition to unauthenticated after max retries exceeded', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: { address: 'test@example.com' },
    };

    const mockToken = 'test-token';
    const mockGetAccessToken = jest.fn().mockResolvedValue(mockToken);

    // Mock fetch to never resolve (simulating slow backend)
    global.fetch = jest.fn(() => new Promise(() => {}));

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: jest.fn(),
      logout: jest.fn(),
    } as any);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    // Should start authenticating immediately
    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });

    // Trigger 3 timeout cycles to hit max retries
    for (let i = 0; i < 3; i++) {
      // Timeout each attempt (90 seconds)
      act(() => {
        jest.advanceTimersByTime(90000);
      });

      // Allow retry event to process if not final attempt
      if (i < 2) {
        await waitFor(() => {
          expect(result.current.status).toBe('authenticating');
        });
      }
    }

    // After 3 retries, should be unauthenticated (not error)
    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.error).toContain('try signing in again');
    });

    // Verify Sentry was called for timeout
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Authentication timeout - stuck in authenticating state',
      expect.objectContaining({
        level: 'error',
        tags: {
          auth_error: 'authenticating_timeout',
        },
      })
    );

    // Verify credentials were cleared
    expect(mockRemoveApiKey).toHaveBeenCalled();
  });

  it('should clear sync state on timeout to prevent stuck state', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: { address: 'test@example.com' },
    };

    const mockToken = 'test-token';
    const mockGetAccessToken = jest.fn().mockResolvedValue(mockToken);

    // Mock fetch to never resolve
    global.fetch = jest.fn(() => new Promise(() => {}));

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: jest.fn(),
      logout: jest.fn(),
    } as any);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });

    // Timeout
    act(() => {
      jest.advanceTimersByTime(90000);
    });

    // Wait for auto-retry to trigger (should still be authenticating after retry)
    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });

    // Should be able to manually trigger another refresh after timeout (sync state cleared)
    act(() => {
      result.current.refresh();
    });

    // Should enter authenticating state again
    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });
  });

  it('should dispatch AUTH_REFRESH_EVENT on timeout retry', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: { address: 'test@example.com' },
    };

    const mockToken = 'test-token';
    const mockGetAccessToken = jest.fn().mockResolvedValue(mockToken);

    // Mock fetch to never resolve
    global.fetch = jest.fn(() => new Promise(() => {}));

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: jest.fn(),
      logout: jest.fn(),
    } as any);

    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });

    // Timeout (first attempt)
    act(() => {
      jest.advanceTimersByTime(90000);
    });

    // Verify event was dispatched for retry
    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    });

    dispatchSpy.mockRestore();
  });

  it('should allow manual retry after timeout by transitioning to unauthenticated', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: { address: 'test@example.com' },
    };

    const mockToken = 'test-token';
    const mockGetAccessToken = jest.fn().mockResolvedValue(mockToken);
    const mockLogin = jest.fn();

    // Mock fetch to never resolve
    global.fetch = jest.fn(() => new Promise(() => {}));

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: mockLogin,
      logout: jest.fn(),
    } as any);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    // Should start authenticating immediately
    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });

    // Exhaust retries by timing out 3 times
    for (let i = 0; i < 3; i++) {
      act(() => {
        jest.advanceTimersByTime(90000);
      });

      // Allow retry event to process if not final attempt
      if (i < 2) {
        await waitFor(() => {
          expect(result.current.status).toBe('authenticating');
        });
      }
    }

    // Should be unauthenticated after max retries
    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
    });

    // User can now manually retry by logging in again
    act(() => {
      result.current.login();
    });

    expect(mockLogin).toHaveBeenCalled();
  });

  describe('Privy SDK Initialization Timeout', () => {
    it('should immediately transition to unauthenticated if no cached credentials (guest mode)', async () => {
      // Mock Privy as not ready (simulating slow or failed SDK load)
      mockUsePrivy.mockReturnValue({
        ready: false,
        authenticated: false,
        user: null,
        login: jest.fn(),
        logout: jest.fn(),
        getAccessToken: jest.fn(),
      } as any);

      // No cached credentials
      mockGetApiKey.mockReturnValue(null);
      mockGetUserData.mockReturnValue(null);

      const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

      // FIX: Should immediately transition to unauthenticated when no cached credentials
      // This allows guest users to access the chat without waiting for Privy SDK
      // (matching the behavior of DesktopAuthProvider)
      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      // Sentry should NOT be called for Privy timeout since we transitioned immediately
      // The backup timeout may still be running but since status is already 'unauthenticated',
      // the timeout handler will be a no-op
      expect(Sentry.captureMessage).not.toHaveBeenCalledWith(
        'Privy SDK initialization timeout',
        expect.anything()
      );
    });

    it('should use cached credentials if Privy not ready but credentials exist', async () => {
      // Mock Privy as not ready
      mockUsePrivy.mockReturnValue({
        ready: false,
        authenticated: false,
        user: null,
        login: jest.fn(),
        logout: jest.fn(),
        getAccessToken: jest.fn(),
      } as any);

      // Mock cached credentials
      mockGetApiKey.mockReturnValue('gw_test_api_key');
      mockGetUserData.mockReturnValue({
        user_id: 'cached-user-id',
        email: 'cached@example.com',
        api_key: 'gw_test_api_key',
      });

      const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

      // Should immediately use cached credentials and become authenticated
      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });

      // Privy timeout should NOT fire since we have cached credentials
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Should still be authenticated
      expect(result.current.status).toBe('authenticated');

      // Sentry should NOT be called for timeout
      expect(Sentry.captureMessage).not.toHaveBeenCalledWith(
        'Privy SDK initialization timeout',
        expect.anything()
      );
    });

    it('should already be unauthenticated when Privy becomes ready (no timeout needed)', async () => {
      // Start with Privy not ready
      mockUsePrivy.mockReturnValue({
        ready: false,
        authenticated: false,
        user: null,
        login: jest.fn(),
        logout: jest.fn(),
        getAccessToken: jest.fn(),
      } as any);

      // No cached credentials
      mockGetApiKey.mockReturnValue(null);
      mockGetUserData.mockReturnValue(null);

      const { result, rerender } = renderHook(() => useGatewayzAuth(), { wrapper });

      // FIX: Should immediately be unauthenticated (no cached credentials = guest mode)
      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      // Advance time but not past the timeout
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Still unauthenticated (not idle)
      expect(result.current.status).toBe('unauthenticated');

      // Now Privy becomes ready and user is not authenticated
      mockUsePrivy.mockReturnValue({
        ready: true,
        authenticated: false,
        user: null,
        login: jest.fn(),
        logout: jest.fn(),
        getAccessToken: jest.fn(),
      } as any);

      rerender();

      // Should still be unauthenticated (no change needed)
      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      // Sentry should NOT be called for timeout
      expect(Sentry.captureMessage).not.toHaveBeenCalledWith(
        'Privy SDK initialization timeout',
        expect.anything()
      );
    });

    it('should allow login immediately in guest mode (no wait needed)', async () => {
      const mockLogin = jest.fn();

      // Mock Privy as not ready
      mockUsePrivy.mockReturnValue({
        ready: false,
        authenticated: false,
        user: null,
        login: mockLogin,
        logout: jest.fn(),
        getAccessToken: jest.fn(),
      } as any);

      // No cached credentials
      mockGetApiKey.mockReturnValue(null);
      mockGetUserData.mockReturnValue(null);

      const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

      // FIX: Should immediately be unauthenticated (guest mode), not idle
      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      // User should be able to try logging in immediately (no timeout wait needed)
      act(() => {
        result.current.login();
      });

      expect(mockLogin).toHaveBeenCalled();
    });
  });
});
