/**
 * Unit tests for use-auth-sync.ts
 *
 * Tests the authentication synchronization hook including:
 * - Return value computation
 * - Event listener behavior
 *
 * NOTE: The initialization effect that previously read from localStorage and called
 * setAuth/setLoading was removed as part of a performance optimization.
 * Auth state is now initialized synchronously in auth-store.ts during store creation.
 * See auth-store.ts getInitialAuthState() for the new implementation.
 */

import { renderHook } from '@testing-library/react';

// Mock functions need to be defined before jest.mock calls
const mockSetAuth = jest.fn();
const mockSetLoading = jest.fn();
const mockSetError = jest.fn();
const mockClearAuth = jest.fn();
const mockResetChatState = jest.fn();
const mockGetApiKey = jest.fn();
const mockGetUserData = jest.fn();

// Create a mock getState that can be modified in tests
let mockIsAuthenticated = false;

jest.mock('@/lib/store/auth-store', () => {
  const store = jest.fn(() => ({
    setAuth: mockSetAuth,
    setLoading: mockSetLoading,
    setError: mockSetError,
    clearAuth: mockClearAuth,
    isAuthenticated: false,
  }));
  (store as any).getState = () => ({ isAuthenticated: mockIsAuthenticated });
  return { useAuthStore: store };
});

jest.mock('@/lib/store/chat-ui-store', () => ({
  useChatUIStore: jest.fn(() => ({
    resetChatState: mockResetChatState,
  })),
}));

jest.mock('@/lib/api', () => ({
  getApiKey: () => mockGetApiKey(),
  getUserData: () => mockGetUserData(),
  processAuthResponse: jest.fn(),
  AUTH_REFRESH_COMPLETE_EVENT: 'gatewayz:refresh-complete',
  AUTH_REFRESH_EVENT: 'gatewayz:refresh-auth',
}));

// Mutable so individual tests can supply a Privy user + getAccessToken for the
// queryFn-building tests below.
let mockPrivyUser: unknown = null;
let mockGetAccessToken = jest.fn();

jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    user: mockPrivyUser,
    ready: true,
    authenticated: false,
    getAccessToken: mockGetAccessToken,
  }),
}));

// Captures the `queryFn` passed to useQuery so the queryFn-building tests below (which
// exercise the shared build-auth-request logic) can invoke it directly, without needing a
// real QueryClient.
let capturedQueryFn: (() => Promise<unknown>) | null = null;

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((options: { queryFn?: () => Promise<unknown> }) => {
    capturedQueryFn = options.queryFn ?? null;
    return {
      data: undefined,
      isLoading: false,
      error: null,
    };
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    clear: jest.fn(),
  }),
}));

// Import after mocks
import { useAuthSync } from '../use-auth-sync';
import type { User } from '@privy-io/react-auth';

describe('useAuthSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApiKey.mockReturnValue(null);
    mockGetUserData.mockReturnValue(null);
    mockIsAuthenticated = false;
    mockPrivyUser = null;
    mockGetAccessToken = jest.fn();
    capturedQueryFn = null;
  });

  describe('initialization behavior', () => {
    // NOTE: The initialization effect was removed as part of a performance optimization.
    // Auth state is now initialized synchronously in auth-store.ts during store creation.
    // These tests verify that useAuthSync no longer calls setAuth/setLoading during mount.

    it('should NOT call setLoading on mount (initialization moved to auth-store)', () => {
      // Arrange: No credentials in localStorage
      mockGetApiKey.mockReturnValue(null);
      mockGetUserData.mockReturnValue(null);

      // Act
      renderHook(() => useAuthSync());

      // Assert: setLoading should NOT be called - initialization happens in auth-store.ts
      expect(mockSetLoading).not.toHaveBeenCalled();
    });

    it('should NOT call setAuth on mount (initialization moved to auth-store)', () => {
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

      // Act
      renderHook(() => useAuthSync());

      // Assert: setAuth should NOT be called on mount - initialization happens in auth-store.ts
      expect(mockSetAuth).not.toHaveBeenCalled();
    });
  });

  describe('return value', () => {
    it('should return isLoading: false for non-authenticated users', () => {
      // Arrange
      mockIsAuthenticated = false;

      // Act
      const { result } = renderHook(() => useAuthSync());

      // Assert: isLoading should be false when query is not loading and user is not authenticated
      // The formula is: isLoading && !isAuthenticated
      // With isLoading from query = false, result = false && true = false
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should return isAuthenticated: true when user has credentials', () => {
      // Arrange
      mockIsAuthenticated = true;

      // Act
      const { result } = renderHook(() => useAuthSync());

      // Assert
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('queryFn (shared auth-request builder)', () => {
    // useAuthSync backs the chat-v2 auth path (ChatLayout.tsx) — it used to carry its own
    // copy of the /auth request-body logic (which filtered out wallet accounts and never
    // retried a null Privy token). It now delegates to build-auth-request.ts, same as
    // gatewayz-auth-context.tsx and integrations/privy/auth-sync.ts.
    const makeUser = (overrides?: Partial<User>): User =>
      ({
        id: 'privy-user-1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        linkedAccounts: [
          { type: 'email', email: 'test@example.com' } as any,
          {
            type: 'wallet',
            address: '0xabc0000000000000000000000000000000abcd',
            chainType: 'ethereum',
            walletClientType: 'metamask',
          } as any,
        ],
        mfaMethods: [],
        hasAcceptedTerms: true,
        isGuest: false,
        ...overrides,
      }) as User;

    let mockFetch: jest.Mock;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch as unknown as typeof fetch;
    });

    it('includes wallet accounts in the request body it POSTs to /api/auth', async () => {
      mockPrivyUser = makeUser();
      mockGetAccessToken = jest.fn().mockResolvedValue('tok');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, api_key: 'gw_live_x', user_id: 1 }),
      });

      renderHook(() => useAuthSync());
      expect(capturedQueryFn).not.toBeNull();

      await capturedQueryFn!();

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.user.linked_accounts).toContainEqual(
        expect.objectContaining({ type: 'wallet', address: '0xabc0000000000000000000000000000000abcd' })
      );
      expect(requestBody).not.toHaveProperty('trial_credits');
    });

    it('throws without calling fetch when the Privy token never resolves', async () => {
      mockPrivyUser = makeUser();
      mockGetAccessToken = jest.fn().mockResolvedValue(null);

      renderHook(() => useAuthSync());
      expect(capturedQueryFn).not.toBeNull();

      await expect(capturedQueryFn!()).rejects.toThrow('Could not verify your session');
      expect(mockFetch).not.toHaveBeenCalled();
    }, 10000);
  });
});
