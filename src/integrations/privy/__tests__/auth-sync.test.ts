import { syncPrivyToGatewayz } from '../auth-sync';
import type { User } from '@privy-io/react-auth';
import type { AuthResponse, UserData } from '@/lib/api';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock Sentry (auth-sync.ts logs a captureMessage when the token can't be retrieved)
const mockSentryCaptureMessage = jest.fn();
jest.mock('@sentry/nextjs', () => ({
  captureMessage: (...args: unknown[]) => mockSentryCaptureMessage(...args),
}));

// Mock global fetch
global.fetch = jest.fn();

// Helper to mock window.location - use jsdom's Location properly
function mockLocation(props: { href?: string; search?: string; pathname?: string }) {
  // Create a new URL object that jsdom can work with
  const url = `http://localhost${props.pathname || '/'}${props.search || ''}`;

  // Use jsdom's built-in history API to change location
  window.history.pushState({}, '', url);
}

describe('auth-sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();

    // Mock Date.now for consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    // Set default location
    mockLocation({ search: '' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockPrivyUser = (overrides?: Partial<User>): User => ({
    id: 'privy-user-123',
    createdAt: new Date('2024-01-01').getTime(),
    linkedAccounts: [
      {
        type: 'email',
        email: 'test@example.com',
        verifiedAt: new Date('2024-01-01').getTime(),
        firstVerifiedAt: new Date('2024-01-01').getTime(),
        latestVerifiedAt: new Date('2024-01-01').getTime(),
      } as any,
    ],
    mfaMethods: [],
    hasAcceptedTerms: true,
    isGuest: false,
    ...overrides,
  } as User);

  const createMockAuthResponse = (overrides?: Partial<AuthResponse>): AuthResponse => ({
    success: true,
    message: 'Authentication successful',
    user_id: 12345,
    api_key: 'test-api-key-123',
    auth_method: 'email',
    privy_user_id: 'privy-user-123',
    is_new_user: false,
    display_name: 'Test User',
    email: 'test@example.com',
    credits: 100,
    timestamp: null,
    ...overrides,
  });

  /** A `getAccessToken` that resolves once, on the first call — the common case. */
  const tokenGetter = (token: string | null) => jest.fn().mockResolvedValue(token);

  describe('syncPrivyToGatewayz', () => {
    it('should sync new user with Privy and Gatewayz backend', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAccessToken = 'privy-access-token-xyz';
      const mockAuthResponse = createMockAuthResponse({ is_new_user: true });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      const result = await syncPrivyToGatewayz(mockPrivyUser, tokenGetter(mockAccessToken), null);

      expect(result).toEqual({
        authResponse: mockAuthResponse,
        privyAccessToken: mockAccessToken,
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      });

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody).toMatchObject({
        token: mockAccessToken,
        auto_create_api_key: true,
        is_new_user: true,
        privy_user_id: 'privy-user-123',
      });
      // trial_credits is dead on the backend (silently dropped by PrivyAuthRequest) — no
      // longer sent.
      expect(requestBody).not.toHaveProperty('trial_credits');
    });

    it('should sync existing user with stored API key', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAccessToken = 'privy-access-token-xyz';
      const existingUserData: UserData = {
        user_id: 12345,
        api_key: 'existing-api-key',
        auth_method: 'email',
        privy_user_id: 'privy-user-123',
        display_name: 'Existing User',
        email: 'existing@example.com',
        credits: 200,
      };
      const mockAuthResponse = createMockAuthResponse({ is_new_user: false });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      const result = await syncPrivyToGatewayz(
        mockPrivyUser,
        tokenGetter(mockAccessToken),
        existingUserData
      );

      expect(result.authResponse).toEqual(mockAuthResponse);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody).toMatchObject({
        auto_create_api_key: false, // Has stored API key
        is_new_user: false,
        privy_user_id: 'privy-user-123',
      });

      expect(requestBody).not.toHaveProperty('trial_credits');
    });

    it('should request new API key for existing user without stored key', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAccessToken = 'privy-access-token-xyz';
      const existingUserDataWithoutKey: UserData = {
        user_id: 12345,
        api_key: '', // Empty API key
        auth_method: 'email',
        privy_user_id: 'privy-user-123',
        display_name: 'User',
        email: 'user@example.com',
        credits: 100,
      };
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(
        mockPrivyUser,
        tokenGetter(mockAccessToken),
        existingUserDataWithoutKey
      );

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.auto_create_api_key).toBe(true);
    });

    it('should throw and never call fetch when the Privy token is unavailable after retries', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAuthResponse = createMockAuthResponse({ is_new_user: true });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      // getAccessToken() resolves null on every attempt — no "continue with an empty
      // token, let the backend decide" fallback anymore (W0 requires a verified token).
      const alwaysNullGetAccessToken = jest.fn().mockResolvedValue(null);

      await expect(
        syncPrivyToGatewayz(mockPrivyUser, alwaysNullGetAccessToken, null)
      ).rejects.toThrow('Could not verify your session');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
        'Privy access token unavailable after retries',
        expect.objectContaining({ tags: { auth_error: 'privy_token_unavailable' } })
      );
      // Initial attempt + 3 retries (see TOKEN_RETRY_DELAYS_MS).
      expect(alwaysNullGetAccessToken).toHaveBeenCalledTimes(4);
    }, 10000);

    it('should retry getAccessToken() and still sync once it eventually succeeds', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      const flakyGetAccessToken = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('recovered-token');

      const result = await syncPrivyToGatewayz(mockPrivyUser, flakyGetAccessToken, null);

      expect(result.privyAccessToken).toBe('recovered-token');
      expect(flakyGetAccessToken).toHaveBeenCalledTimes(2);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );
      expect(requestBody.token).toBe('recovered-token');
    }, 10000);

    it('should throw error when Privy user is missing', async () => {
      await expect(
        syncPrivyToGatewayz(null as any, tokenGetter('token'), null)
      ).rejects.toThrow('Privy user is required for sync');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should include wallet accounts in linked_accounts with their address', async () => {
      const mockPrivyUser = createMockPrivyUser({
        id: 'privy-xyz',
        createdAt: new Date('2024-06-15T10:30:00Z').getTime(),
        linkedAccounts: [
          {
            type: 'google_oauth',
            email: 'user@gmail.com',
            name: 'Test User',
            verifiedAt: new Date('2024-06-15T10:30:00Z').getTime(),
            firstVerifiedAt: new Date('2024-06-15T10:30:00Z').getTime(),
            latestVerifiedAt: new Date('2024-06-15T10:30:00Z').getTime(),
          } as any,
          {
            type: 'wallet',
            address: '0x1234567890abcdef1234567890abcdef12345678',
            chainType: 'ethereum',
            walletClientType: 'metamask',
            firstVerifiedAt: new Date('2024-06-15T10:30:00Z').getTime(),
            latestVerifiedAt: new Date('2024-06-15T10:30:00Z').getTime(),
          } as any,
        ],
        mfaMethods: ['sms'],
        hasAcceptedTerms: true,
        isGuest: false,
      });
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.user.linked_accounts).toHaveLength(2);
      expect(requestBody.user.linked_accounts).toContainEqual(
        expect.objectContaining({
          type: 'google_oauth',
          email: 'user@gmail.com',
          name: 'Test User',
        })
      );
      expect(requestBody.user.linked_accounts).toContainEqual(
        expect.objectContaining({
          type: 'wallet',
          address: '0x1234567890abcdef1234567890abcdef12345678',
          chain_type: 'ethereum',
          wallet_client_type: 'metamask',
        })
      );
    });

    it('should handle empty linked accounts', async () => {
      const mockPrivyUser = createMockPrivyUser({
        linkedAccounts: [],
      });
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.user.linked_accounts).toEqual([]);
    });

    it('should throw error on backend auth failure', async () => {
      const mockPrivyUser = createMockPrivyUser();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(
        syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null)
      ).rejects.toThrow('Backend authentication failed: 500');
    });

    it('should throw error on malformed JSON response', async () => {
      const mockPrivyUser = createMockPrivyUser();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => 'invalid-json{',
      });

      await expect(
        syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null)
      ).rejects.toThrow('Failed to parse authentication response');
    });

    it('should handle missing API key in response', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const responseWithoutApiKey = {
        success: true,
        message: 'Auth successful',
        user_id: 12345,
        // api_key is missing
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(responseWithoutApiKey),
      });

      await expect(
        syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null)
      ).rejects.toThrow('Backend authentication response missing API key');
    });

    it('should use fallback API key from nested data field', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const responseWithNestedApiKey = {
        success: true,
        message: 'Auth successful',
        user_id: 12345,
        data: {
          api_key: 'nested-api-key-123',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(responseWithNestedApiKey),
      });

      const result = await syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null);

      expect(result.authResponse.api_key).toBe('nested-api-key-123');
    });

    it('should use fallback API key from camelCase field', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const responseWithCamelCaseKey = {
        success: true,
        message: 'Auth successful',
        user_id: 12345,
        apiKey: 'camelcase-api-key-456',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(responseWithCamelCaseKey),
      });

      const result = await syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null);

      expect(result.authResponse.api_key).toBe('camelcase-api-key-456');
    });

    it('should handle network errors', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const networkError = new Error('Network connection failed');

      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      await expect(
        syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null)
      ).rejects.toThrow('Network connection failed');
    });

    it('should handle 401 unauthorized', async () => {
      const mockPrivyUser = createMockPrivyUser();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        syncPrivyToGatewayz(mockPrivyUser, tokenGetter('invalid-token'), null)
      ).rejects.toThrow('Backend authentication failed: 401');
    });

    it('should handle 429 rate limit', async () => {
      const mockPrivyUser = createMockPrivyUser();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Too Many Requests',
      });

      await expect(
        syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null)
      ).rejects.toThrow('Backend authentication failed: 429');
    });
  });

  describe('Edge Cases', () => {
    it('should handle guest users', async () => {
      const mockPrivyUser = createMockPrivyUser({
        isGuest: true,
        hasAcceptedTerms: false,
      });
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.user.is_guest).toBe(true);
      expect(requestBody.user.has_accepted_terms).toBe(false);
    });

    it('should handle undefined MFA methods', async () => {
      const mockPrivyUser = createMockPrivyUser({
        mfaMethods: undefined,
      });
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.user.mfa_methods).toEqual([]);
    });

    it('should handle SSR environment (no window)', async () => {
      const originalWindow = global.window;
      (global as any).window = undefined;

      const mockPrivyUser = createMockPrivyUser();
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.privy_user_id).toBe(mockPrivyUser.id);

      global.window = originalWindow;
    });

    it('should normalize github_oauth account type to github', async () => {
      // Test for the fix: Privy returns 'github_oauth' but backend expects 'github'
      const mockPrivyUser = createMockPrivyUser({
        linkedAccounts: [
          {
            type: 'github_oauth',
            subject: 'octocat',
            name: 'The Octocat',
            verifiedAt: new Date('2024-01-01').getTime(),
          } as any,
        ],
      });
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      // Verify GitHub account type is normalized from 'github_oauth' to 'github'
      expect(requestBody.user.linked_accounts).toHaveLength(1);
      expect(requestBody.user.linked_accounts[0]).toMatchObject({
        type: 'github',
        subject: 'octocat',
        name: 'The Octocat',
      });
    });

    it('should preserve google_oauth account type unchanged', async () => {
      // Ensure google_oauth doesn't get incorrectly normalized
      const mockPrivyUser = createMockPrivyUser({
        linkedAccounts: [
          {
            type: 'google_oauth',
            subject: 'google-user-123',
            email: 'user@gmail.com',
            verifiedAt: new Date('2024-01-01').getTime(),
          } as any,
        ],
      });
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      // Verify Google account type remains unchanged
      expect(requestBody.user.linked_accounts).toHaveLength(1);
      expect(requestBody.user.linked_accounts[0]).toMatchObject({
        type: 'google_oauth',
        subject: 'google-user-123',
        email: 'user@gmail.com',
      });
    });

    it('should handle mixed oauth accounts with github_oauth normalization', async () => {
      // Test multiple accounts including GitHub OAuth
      const mockPrivyUser = createMockPrivyUser({
        linkedAccounts: [
          {
            type: 'email',
            email: 'user@example.com',
            verifiedAt: new Date('2024-01-01').getTime(),
          } as any,
          {
            type: 'github_oauth',
            subject: 'octocat',
            verifiedAt: new Date('2024-01-02').getTime(),
          } as any,
          {
            type: 'google_oauth',
            subject: 'google-user-123',
            verifiedAt: new Date('2024-01-03').getTime(),
          } as any,
        ],
      });
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, tokenGetter('token'), null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      // Verify all accounts are present with correct types
      expect(requestBody.user.linked_accounts).toHaveLength(3);
      expect(requestBody.user.linked_accounts[0].type).toBe('email');
      expect(requestBody.user.linked_accounts[1].type).toBe('github'); // normalized from github_oauth
      expect(requestBody.user.linked_accounts[2].type).toBe('google_oauth'); // unchanged
    });
  });
});
