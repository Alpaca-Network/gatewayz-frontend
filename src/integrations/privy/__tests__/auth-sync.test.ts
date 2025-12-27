import { syncPrivyToGatewayz } from '../auth-sync';
import type { User } from '@privy-io/react-auth';
import type { AuthResponse, UserData } from '@/lib/api';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

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

  describe('syncPrivyToGatewayz', () => {
    it('should sync new user with Privy and Gatewayz backend', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAccessToken = 'privy-access-token-xyz';
      const mockAuthResponse = createMockAuthResponse({ is_new_user: true });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      const result = await syncPrivyToGatewayz(mockPrivyUser, mockAccessToken, null);

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
        trial_credits: 5, // New users get trial credits ($1/day cap, $5 total)
        privy_user_id: 'privy-user-123',
      });
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
        mockAccessToken,
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
        mockAccessToken,
        existingUserDataWithoutKey
      );

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.auto_create_api_key).toBe(true);
    });

    it('should handle null Privy access token', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAuthResponse = createMockAuthResponse({ is_new_user: true });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      const result = await syncPrivyToGatewayz(mockPrivyUser, null, null);

      expect(result.privyAccessToken).toBeNull();

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.token).toBe('');
    });

    it('should throw error when Privy user is missing', async () => {
      await expect(syncPrivyToGatewayz(null as any, 'token', null)).rejects.toThrow(
        'Privy user is required for sync'
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should include referral code from localStorage', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAccessToken = 'privy-access-token-xyz';
      const mockAuthResponse = createMockAuthResponse({ is_new_user: true });

      localStorage.setItem('gatewayz_referral_code', 'FRIEND123');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, mockAccessToken, null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody).toMatchObject({
        has_referral_code: true,
        referral_code: 'FRIEND123',
      });
    });

    it('should capture referral code from URL and store it', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAccessToken = 'privy-access-token-xyz';
      const mockAuthResponse = createMockAuthResponse({ is_new_user: true });

      mockLocation({
        search: '?ref=URLREF456',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, mockAccessToken, null);

      // Should be stored in localStorage
      expect(localStorage.getItem('gatewayz_referral_code')).toBe('URLREF456');

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody).toMatchObject({
        has_referral_code: true,
        referral_code: 'URLREF456',
      });
    });

    it('should prefer localStorage referral code over URL', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAccessToken = 'privy-access-token-xyz';
      const mockAuthResponse = createMockAuthResponse();

      localStorage.setItem('gatewayz_referral_code', 'STORED123');

      mockLocation({
        search: '?ref=URLREF456',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, mockAccessToken, null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.referral_code).toBe('STORED123');
    });

    it('should transform Privy user data correctly', async () => {
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

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.user).toMatchObject({
        id: 'privy-xyz',
        created_at: Math.floor(new Date('2024-06-15T10:30:00Z').getTime() / 1000),
        linked_accounts: [
          {
            type: 'google_oauth',
            email: 'user@gmail.com',
            name: 'Test User',
            verified_at: Math.floor(new Date('2024-06-15T10:30:00Z').getTime() / 1000),
            first_verified_at: Math.floor(
              new Date('2024-06-15T10:30:00Z').getTime() / 1000
            ),
            latest_verified_at: Math.floor(
              new Date('2024-06-15T10:30:00Z').getTime() / 1000
            ),
          },
        ],
        mfa_methods: ['sms'],
        has_accepted_terms: true,
        is_guest: false,
      });
    });

    it('should handle Privy user without createdAt', async () => {
      const mockPrivyUser = createMockPrivyUser({
        createdAt: undefined,
      });
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      // Should use current timestamp
      expect(requestBody.user.created_at).toBe(Math.floor(1700000000000 / 1000));
    });

    it('should filter out wallet accounts from linked_accounts', async () => {
      const mockPrivyUser = createMockPrivyUser({
        linkedAccounts: [
          {
            type: 'email',
            email: 'test@example.com',
            verifiedAt: new Date('2024-01-01').getTime(),
          } as any,
          {
            type: 'wallet',
            address: '0x1234567890abcdef',
            chainType: 'ethereum',
            // Wallet accounts should be filtered out
          } as any,
        ],
      });
      const mockAuthResponse = createMockAuthResponse();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      // Only email account should be included, wallet account should be filtered out
      expect(requestBody.user.linked_accounts).toHaveLength(1);
      expect(requestBody.user.linked_accounts[0]).toMatchObject({
        type: 'email',
        email: 'test@example.com',
      });
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

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

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
        syncPrivyToGatewayz(mockPrivyUser, 'token', null)
      ).rejects.toThrow('Backend authentication failed: 500');
    });

    it('should throw error on malformed JSON response', async () => {
      const mockPrivyUser = createMockPrivyUser();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => 'invalid-json{',
      });

      await expect(
        syncPrivyToGatewayz(mockPrivyUser, 'token', null)
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
        syncPrivyToGatewayz(mockPrivyUser, 'token', null)
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

      const result = await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

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

      const result = await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

      expect(result.authResponse.api_key).toBe('camelcase-api-key-456');
    });

    it('should handle network errors', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const networkError = new Error('Network connection failed');

      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      await expect(
        syncPrivyToGatewayz(mockPrivyUser, 'token', null)
      ).rejects.toThrow('Network connection failed');
    });

    it('should log sync start and success', async () => {
      const mockPrivyUser = createMockPrivyUser({ id: 'privy-xyz-789' });
      const mockAuthResponse = createMockAuthResponse({ is_new_user: true });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

      // Test passes if no errors are thrown and result is valid
    });

    it('should handle 401 unauthorized', async () => {
      const mockPrivyUser = createMockPrivyUser();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        syncPrivyToGatewayz(mockPrivyUser, 'invalid-token', null)
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
        syncPrivyToGatewayz(mockPrivyUser, 'token', null)
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

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

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

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.user.mfa_methods).toEqual([]);
    });

    it('should handle empty referral code string', async () => {
      const mockPrivyUser = createMockPrivyUser();
      const mockAuthResponse = createMockAuthResponse();

      mockLocation({
        search: '?ref=',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.has_referral_code).toBe(false);
      expect(requestBody.referral_code).toBeNull();
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

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody.has_referral_code).toBe(false);
      expect(requestBody.referral_code).toBeNull();

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

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

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

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

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

      await syncPrivyToGatewayz(mockPrivyUser, 'token', null);

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
