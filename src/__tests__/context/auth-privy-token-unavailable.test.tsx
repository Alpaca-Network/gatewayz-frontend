/**
 * A Privy token that never resolves (all `getPrivyAccessTokenWithRetry` attempts return
 * null) must NOT flip an already-authenticated cached session to `status:"error"` — that
 * would block Settings/etc for a user with a perfectly usable cached API key just because
 * this cycle's Privy resync hit a transient token-fetch hiccup (network flake, third-party
 * cookie issues, etc). Only a caller with no cached credential at all should hard-fail.
 * See src/context/gatewayz-auth-context.tsx's `syncWithBackend` token-retry block.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { GatewayzAuthProvider, useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { usePrivy } from '@privy-io/react-auth';
import * as api from '@/lib/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TOKEN_RETRY_DELAYS_MS } from '@/lib/auth/build-auth-request';

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
jest.mock('@/lib/guest-chat', () => ({
  resetGuestMessageCount: jest.fn(),
}));

describe('GatewayzAuthContext - Privy token unavailable', () => {
  const mockUsePrivy = usePrivy as jest.MockedFunction<typeof usePrivy>;
  const mockGetApiKey = api.getApiKey as jest.Mock;
  const mockGetUserData = api.getUserData as jest.Mock;
  const mockRemoveApiKey = api.removeApiKey as jest.Mock;

  const createTestQueryClient = () =>
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  const wrapper = ({ children }: { children: ReactNode }) => {
    const queryClient = createTestQueryClient();
    return (
      <QueryClientProvider client={queryClient}>
        <GatewayzAuthProvider>{children}</GatewayzAuthProvider>
      </QueryClientProvider>
    );
  };

  const mockUser = { id: 'test-user-id', email: { address: 'test@example.com' } };

  const advanceThroughAllRetries = async () => {
    // Initial attempt is immediate; then one wait per configured backoff delay.
    for (const delayMs of TOKEN_RETRY_DELAYS_MS) {
      await act(async () => {
        jest.advanceTimersByTime(delayMs);
        // Flush the microtask queue so the next getAccessToken() call is issued before the
        // next advanceTimersByTime.
        await Promise.resolve();
      });
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetApiKey.mockReturnValue(null);
    mockGetUserData.mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hard-fails to status:"error" when there is no cached session', async () => {
    const mockGetAccessToken = jest.fn().mockResolvedValue(null);
    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: jest.fn(),
      logout: jest.fn(),
    } as any);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticating'));
    await advanceThroughAllRetries();

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('Could not verify your session');
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Privy access token unavailable after retries',
      expect.objectContaining({
        level: 'error',
        tags: { auth_error: 'privy_token_unavailable', had_cached_session: 'false' },
      })
    );
  });

  it('keeps status:"authenticated" and skips the resync when a valid cached session exists', async () => {
    const cachedUser = {
      user_id: 42,
      api_key: 'gw_live_cached',
      auth_method: 'email',
      privy_user_id: 'test-user-id',
      display_name: 'Cached User',
      email: 'cached@example.com',
      credits: 100,
    };
    mockGetApiKey.mockReturnValue('gw_live_cached');
    mockGetUserData.mockReturnValue(cachedUser);

    const mockGetAccessToken = jest.fn().mockResolvedValue(null);
    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: mockUser,
      getAccessToken: mockGetAccessToken,
      login: jest.fn(),
      logout: jest.fn(),
    } as any);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    // Cached credentials put it in "authenticating" almost immediately (the sync effect
    // fires as soon as Privy reports authenticated), not stuck on "idle".
    await waitFor(() => expect(result.current.status).toBe('authenticating'));

    await advanceThroughAllRetries();

    await waitFor(() => {
      expect(result.current.status).toBe('authenticated');
    });
    // Never hard-cleared the cached credentials for this transient failure.
    expect(mockRemoveApiKey).not.toHaveBeenCalled();

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Privy access token unavailable after retries',
      expect.objectContaining({
        level: 'warning',
        tags: { auth_error: 'privy_token_unavailable', had_cached_session: 'true' },
      })
    );
  });
});
