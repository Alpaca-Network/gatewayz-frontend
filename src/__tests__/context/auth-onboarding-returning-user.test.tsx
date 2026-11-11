/**
 * Returning accounts must not be shown onboarding again on sign-in.
 *
 * Onboarding progress lives only in localStorage (per browser, per domain), so a returning
 * user signing in on a new browser or on beta.gatewayz.ai used to get the onboarding banner
 * every time. A successful sync where the backend says `is_new_user: false` now marks
 * onboarding complete; a brand-new account (`is_new_user: true`) keeps the onboarding flow.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { GatewayzAuthProvider, useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { usePrivy } from '@privy-io/react-auth';
import * as api from '@/lib/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
// Don't actually redirect new users during the test
jest.mock('@/components/analytics/google-analytics', () => ({
  trackSignupConversion: jest.fn(),
}));

const COMPLETED_KEY = 'gatewayz_onboarding_completed';

describe('GatewayzAuthContext - onboarding for returning users', () => {
  const mockUsePrivy = usePrivy as jest.MockedFunction<typeof usePrivy>;
  const mockGetApiKey = api.getApiKey as jest.Mock;
  const mockGetUserData = api.getUserData as jest.Mock;

  const wrapper = ({ children }: { children: ReactNode }) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
      <QueryClientProvider client={queryClient}>
        <GatewayzAuthProvider>{children}</GatewayzAuthProvider>
      </QueryClientProvider>
    );
  };

  const signInWithBackendResponse = (isNewUser: boolean) => {
    const authResponse = {
      success: true,
      message: 'ok',
      user_id: 7,
      api_key: 'gw_live_returning_user_key',
      auth_method: 'email',
      privy_user_id: 'privy-user',
      is_new_user: isNewUser,
      display_name: 'User',
      email: 'user@example.com',
      credits: 5, // <= 10 so the API-key upgrade check doesn't make an extra request
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(JSON.stringify(authResponse)),
      json: () => Promise.resolve(authResponse),
    }) as unknown as typeof fetch;

    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      user: { id: 'privy-user', email: { address: 'user@example.com' } },
      getAccessToken: jest.fn().mockResolvedValue('privy-access-token'),
      login: jest.fn(),
      logout: jest.fn(),
    } as any);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockGetApiKey.mockReturnValue(null);
    mockGetUserData.mockReturnValue(null);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('marks onboarding complete when the backend says the account already exists', async () => {
    signInWithBackendResponse(false);

    renderHook(() => useGatewayzAuth(), { wrapper });

    await waitFor(() => expect(localStorage.getItem(COMPLETED_KEY)).toBe('true'));
  });

  it('leaves onboarding open for a brand-new account', async () => {
    signInWithBackendResponse(true);

    const { result } = renderHook(() => useGatewayzAuth(), { wrapper });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth', expect.anything()));
    await waitFor(() => expect(api.processAuthResponse).toHaveBeenCalled());
    expect(result.current).toBeDefined();
    expect(localStorage.getItem(COMPLETED_KEY)).toBeNull();
  });
});
