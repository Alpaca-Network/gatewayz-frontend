import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { GatewayzAuthProvider, useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { usePrivy } from '@privy-io/react-auth';
import * as api from '@/lib/api';

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

  const wrapper = ({ children }: { children: ReactNode }) => (
    <GatewayzAuthProvider>{children}</GatewayzAuthProvider>
  );

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

    // Mock slow backend that never responds
    mockProcessAuthResponse.mockImplementation(() => new Promise(() => {})); // Never resolves

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: jest.fn(),
      logout: jest.fn(),
    } as any);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    // Wait for initial state
    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
    });

    // Trigger refresh
    act(() => {
      result.current.refresh();
    });

    // Should be authenticating
    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });

    // Fast-forward 60 seconds (AUTHENTICATING_TIMEOUT_MS)
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // Should auto-retry first
    await waitFor(() => {
      expect(result.current.error).toContain('taking longer than expected');
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

    // Mock slow backend that never responds
    mockProcessAuthResponse.mockImplementation(() => new Promise(() => {}));

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: jest.fn(),
      logout: jest.fn(),
    } as any);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    // Trigger refresh 3 times to hit max retries
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticating');
      });

      // Timeout each attempt
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      // Wait for retry or final state
      act(() => {
        jest.runAllTimers();
      });
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

    // Mock slow backend
    mockProcessAuthResponse.mockImplementation(() => new Promise(() => {}));

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: jest.fn(),
      logout: jest.fn(),
    } as any);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });

    // Timeout
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    act(() => {
      jest.runAllTimers();
    });

    // Should be able to retry after timeout (sync state cleared)
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

    mockProcessAuthResponse.mockImplementation(() => new Promise(() => {}));

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

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('authenticating');
    });

    // Timeout (first attempt)
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    act(() => {
      jest.runAllTimers();
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

    // First 3 attempts fail, 4th succeeds
    let attemptCount = 0;
    mockProcessAuthResponse.mockImplementation(() => {
      attemptCount++;
      if (attemptCount <= 3) {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve({
        success: true,
        user_id: 123,
        api_key: 'new-key',
        credits: 100,
        display_name: 'Test User',
        email: 'test@example.com',
      });
    });

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: mockLogin,
      logout: jest.fn(),
    } as any);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    // Exhaust retries
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticating');
      });

      act(() => {
        jest.advanceTimersByTime(60000);
        jest.runAllTimers();
      });
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
});
