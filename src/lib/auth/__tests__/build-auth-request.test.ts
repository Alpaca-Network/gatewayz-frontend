import type { User } from '@privy-io/react-auth';
import type { UserData } from '@/lib/api';
import {
  buildAuthRequestBody,
  mapLinkedAccount,
  getPrivyAccessTokenWithRetry,
  TOKEN_RETRY_DELAYS_MS,
} from '../build-auth-request';

const createMockPrivyUser = (overrides?: Partial<User>): User =>
  ({
    id: 'privy-user-123',
    createdAt: new Date('2024-01-01T00:00:00Z').getTime(),
    linkedAccounts: [
      {
        type: 'email',
        email: 'test@example.com',
        firstVerifiedAt: new Date('2024-01-01T00:00:00Z').getTime(),
        latestVerifiedAt: new Date('2024-01-01T00:00:00Z').getTime(),
      } as any,
    ],
    mfaMethods: [],
    hasAcceptedTerms: true,
    isGuest: false,
    ...overrides,
  }) as User;

describe('build-auth-request', () => {
  describe('mapLinkedAccount', () => {
    it('includes wallet accounts (no longer filtered)', () => {
      // firstVerifiedAt/latestVerifiedAt are real Date objects on Privy's LinkMetadata type
      // (types-B4eMcjTQ.d.ts) — pass Date instances, not raw ms numbers, to match production.
      const walletAccount = {
        type: 'wallet',
        address: '0xABCDEF0123456789ABCDEF0123456789ABCDEF01',
        chainType: 'ethereum',
        walletClientType: 'privy',
        connectorType: 'embedded',
        firstVerifiedAt: new Date('2024-01-01T00:00:00Z'),
        latestVerifiedAt: new Date('2024-01-02T00:00:00Z'),
      } as any;

      const mapped = mapLinkedAccount(walletAccount);

      expect(mapped).toMatchObject({
        type: 'wallet',
        address: '0xABCDEF0123456789ABCDEF0123456789ABCDEF01',
        chain_type: 'ethereum',
        wallet_client_type: 'privy',
        connector_type: 'embedded',
        first_verified_at: Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000),
        latest_verified_at: Math.floor(new Date('2024-01-02T00:00:00Z').getTime() / 1000),
      });
    });

    it('includes smart_wallet accounts', () => {
      const smartWalletAccount = {
        type: 'smart_wallet',
        address: '0x1111111111111111111111111111111111111',
        chainType: 'ethereum',
        walletClientType: 'safe',
      } as any;

      const mapped = mapLinkedAccount(smartWalletAccount);

      expect(mapped).toMatchObject({
        type: 'smart_wallet',
        address: '0x1111111111111111111111111111111111111',
        chain_type: 'ethereum',
        wallet_client_type: 'safe',
      });
    });

    it('normalizes github_oauth/sms/twitter_oauth/discord_oauth types', () => {
      expect(mapLinkedAccount({ type: 'github_oauth', subject: 'octocat' } as any)).toMatchObject({
        type: 'github',
      });
      expect(mapLinkedAccount({ type: 'sms', phoneNumber: '+15551234567' } as any)).toMatchObject({
        type: 'phone',
        phone_number: '+15551234567',
      });
      expect(mapLinkedAccount({ type: 'twitter_oauth', subject: 'x' } as any)).toMatchObject({
        type: 'twitter',
      });
      expect(mapLinkedAccount({ type: 'discord_oauth', subject: 'd' } as any)).toMatchObject({
        type: 'discord',
      });
    });

    it('leaves non-normalized types (e.g. google_oauth, email) unchanged', () => {
      expect(mapLinkedAccount({ type: 'google_oauth', email: 'a@b.com' } as any)).toMatchObject({
        type: 'google_oauth',
      });
      expect(mapLinkedAccount({ type: 'email', email: 'a@b.com' } as any)).toMatchObject({
        type: 'email',
      });
    });

    it('strips fields absent on the account rather than sending explicit undefined/null', () => {
      const mapped = mapLinkedAccount({ type: 'email', email: 'a@b.com' } as any);
      expect(mapped).not.toHaveProperty('address');
      expect(mapped).not.toHaveProperty('chain_type');
      expect(mapped).not.toHaveProperty('wallet_client_type');
    });
  });

  describe('buildAuthRequestBody', () => {
    it('includes wallet linked accounts in the body sent to the backend', () => {
      const user = createMockPrivyUser({
        linkedAccounts: [
          { type: 'email', email: 'test@example.com' } as any,
          {
            type: 'wallet',
            address: '0xabc0000000000000000000000000000000abcd',
            chainType: 'ethereum',
            walletClientType: 'metamask',
          } as any,
        ],
      });

      const body = buildAuthRequestBody(user, { token: 'tok', existingUserData: null });

      expect(body.user.linked_accounts).toHaveLength(2);
      expect(body.user.linked_accounts as any[]).toContainEqual(
        expect.objectContaining({
          type: 'wallet',
          address: '0xabc0000000000000000000000000000000abcd',
          chain_type: 'ethereum',
          wallet_client_type: 'metamask',
        })
      );
    });

    it('does not send a trial_credits field for new users (dead on the backend)', () => {
      const user = createMockPrivyUser();
      const body = buildAuthRequestBody(user, { token: 'tok', existingUserData: null });

      expect(body).not.toHaveProperty('trial_credits');
      expect(body.is_new_user).toBe(true);
    });

    it('sends is_guest: true and the token for a Privy guest account (M2 W3b)', () => {
      // A Privy guest account (created via useGuestAccounts().createGuestAccount(), see
      // src/lib/auth/guest-account.ts) goes through this exact same builder once Privy flips
      // to authenticated — no separate guest-specific request path.
      const guestUser = createMockPrivyUser({ isGuest: true, linkedAccounts: [] });
      const body = buildAuthRequestBody(guestUser, { token: 'guest-access-token', existingUserData: null });

      expect((body.user as { is_guest?: boolean }).is_guest).toBe(true);
      expect(body.token).toBe('guest-access-token');
      expect(body.is_new_user).toBe(true);
    });

    it('sets auto_create_api_key true for a new user, false for an existing user with a stored key', () => {
      const user = createMockPrivyUser();
      const existingUserData: UserData = {
        user_id: 1,
        api_key: 'gw_live_existing',
        auth_method: 'email',
        privy_user_id: user.id,
        display_name: 'Test',
        email: 'test@example.com',
        credits: 10,
      };

      const newUserBody = buildAuthRequestBody(user, { token: 'tok', existingUserData: null });
      expect(newUserBody.auto_create_api_key).toBe(true);
      expect(newUserBody.is_new_user).toBe(true);

      const existingUserBody = buildAuthRequestBody(user, { token: 'tok', existingUserData });
      expect(existingUserBody.auto_create_api_key).toBe(false);
      expect(existingUserBody.is_new_user).toBe(false);
    });

    it('requests a new key for an existing user without a stored api_key', () => {
      const user = createMockPrivyUser();
      const existingUserData: UserData = {
        user_id: 1,
        api_key: '',
        auth_method: 'email',
        privy_user_id: user.id,
        display_name: 'Test',
        email: 'test@example.com',
        credits: 0,
      };

      const body = buildAuthRequestBody(user, { token: 'tok', existingUserData });
      expect(body.auto_create_api_key).toBe(true);
    });

    it('sends an empty string token (never null) when the token is null', () => {
      const user = createMockPrivyUser();
      const body = buildAuthRequestBody(user, { token: null, existingUserData: null });
      expect(body.token).toBe('');
    });

    it('produces an identical body for the same inputs regardless of caller', () => {
      // Simulates the two (now three) call sites building a body from the same Privy user —
      // the whole point of extracting this module is that they can never drift again.
      const user = createMockPrivyUser({
        linkedAccounts: [
          { type: 'email', email: 'test@example.com' } as any,
          { type: 'wallet', address: '0xdead', chainType: 'ethereum', walletClientType: 'privy' } as any,
        ],
      });
      const opts = { token: 'shared-token', existingUserData: null };

      const bodyA = buildAuthRequestBody(user, opts);
      const bodyB = buildAuthRequestBody(user, opts);

      expect(bodyA).toEqual(bodyB);
    });
  });

  describe('getPrivyAccessTokenWithRetry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns the token immediately on first success without waiting', async () => {
      const getAccessToken = jest.fn().mockResolvedValue('tok-1');

      const result = await getPrivyAccessTokenWithRetry(getAccessToken);

      expect(result).toBe('tok-1');
      expect(getAccessToken).toHaveBeenCalledTimes(1);
    });

    it('retries with backoff and succeeds on a later attempt', async () => {
      const getAccessToken = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('tok-after-retries');

      const promise = getPrivyAccessTokenWithRetry(getAccessToken);

      // First attempt is immediate and fails; advance through the two backoff delays
      // (250ms, 500ms) before the third attempt succeeds.
      await jest.advanceTimersByTimeAsync(TOKEN_RETRY_DELAYS_MS[0]);
      await jest.advanceTimersByTimeAsync(TOKEN_RETRY_DELAYS_MS[1]);

      const result = await promise;

      expect(result).toBe('tok-after-retries');
      expect(getAccessToken).toHaveBeenCalledTimes(3);
    });

    it('gives up and returns null after exhausting all retries', async () => {
      const getAccessToken = jest.fn().mockResolvedValue(null);

      const promise = getPrivyAccessTokenWithRetry(getAccessToken);

      for (const delayMs of TOKEN_RETRY_DELAYS_MS) {
        await jest.advanceTimersByTimeAsync(delayMs);
      }

      const result = await promise;

      expect(result).toBeNull();
      // Initial attempt + one retry per configured backoff delay.
      expect(getAccessToken).toHaveBeenCalledTimes(1 + TOKEN_RETRY_DELAYS_MS.length);
    });

    it('treats a rejected getAccessToken() call as a null attempt and keeps retrying', async () => {
      const getAccessToken = jest
        .fn()
        .mockRejectedValueOnce(new Error('network blip'))
        .mockResolvedValueOnce('tok-recovered');

      const promise = getPrivyAccessTokenWithRetry(getAccessToken);
      await jest.advanceTimersByTimeAsync(TOKEN_RETRY_DELAYS_MS[0]);

      const result = await promise;

      expect(result).toBe('tok-recovered');
    });
  });
});
