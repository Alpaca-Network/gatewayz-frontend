import {
  TIER_CONFIG,
  getUserTier,
  hasActiveSubscription,
  getSubscriptionRenewalDate,
  isSubscriptionExpiringsoon,
  formatTierInfo,
  canAccessModel,
  formatSubscriptionStatus,
} from '../tier-utils';
import type { UserData, UserTier, SubscriptionStatus } from '../api';

describe('tier-utils', () => {
  describe('TIER_CONFIG', () => {
    it('should have correct configuration for basic tier', () => {
      expect(TIER_CONFIG.basic).toEqual({
        name: 'Basic',
        description: 'Pay-per-use credits',
        monthlyPrice: null,
        creditAllocation: 0,
        isSubscription: false,
      });
    });

    it('should have correct configuration for pro tier', () => {
      expect(TIER_CONFIG.pro).toEqual({
        name: 'Pro',
        description: '$15/month subscription',
        monthlyPrice: 1500,
        creditAllocation: 0,
        isSubscription: true,
      });
    });

    it('should have correct configuration for max tier', () => {
      expect(TIER_CONFIG.max).toEqual({
        name: 'Max',
        description: '$75/month subscription',
        monthlyPrice: 7500,
        creditAllocation: 15000,
        isSubscription: true,
      });
    });
  });

  describe('getUserTier', () => {
    it('should return basic tier when userData is null', () => {
      expect(getUserTier(null)).toBe('basic');
    });

    it('should return tier from userData when explicitly set', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'pro',
      };

      expect(getUserTier(userData)).toBe('pro');
    });

    it('should return max tier when explicitly set', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'max',
      };

      expect(getUserTier(userData)).toBe('max');
    });

    it('should return pro tier when subscription is active but tier not set', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_status: 'active',
      };

      expect(getUserTier(userData)).toBe('pro');
    });

    it('should return basic tier when subscription is cancelled', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_status: 'cancelled',
      };

      expect(getUserTier(userData)).toBe('basic');
    });

    it('should return basic tier when subscription is past_due', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_status: 'past_due',
      };

      expect(getUserTier(userData)).toBe('basic');
    });

    it('should prioritize explicit tier over subscription status', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'max',
        subscription_status: 'cancelled',
      };

      expect(getUserTier(userData)).toBe('max');
    });
  });

  describe('hasActiveSubscription', () => {
    it('should return false when userData is null', () => {
      expect(hasActiveSubscription(null)).toBe(false);
    });

    it('should return true when subscription status is active', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_status: 'active',
      };

      expect(hasActiveSubscription(userData)).toBe(true);
    });

    it('should return false when subscription status is cancelled', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_status: 'cancelled',
      };

      expect(hasActiveSubscription(userData)).toBe(false);
    });

    it('should return false when subscription status is past_due', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_status: 'past_due',
      };

      expect(hasActiveSubscription(userData)).toBe(false);
    });

    it('should return false when subscription status is inactive', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_status: 'inactive',
      };

      expect(hasActiveSubscription(userData)).toBe(false);
    });

    it('should return false when subscription status is undefined', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      };

      expect(hasActiveSubscription(userData)).toBe(false);
    });
  });

  describe('getSubscriptionRenewalDate', () => {
    it('should return null when userData is null', () => {
      expect(getSubscriptionRenewalDate(null)).toBeNull();
    });

    it('should return null when subscription_end_date is undefined', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      };

      expect(getSubscriptionRenewalDate(userData)).toBeNull();
    });

    it('should convert Unix timestamp to Date object', () => {
      const unixTimestamp = 1735689600; // 2025-01-01 00:00:00 UTC
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_end_date: unixTimestamp,
      };

      const result = getSubscriptionRenewalDate(userData);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(unixTimestamp * 1000);
    });

    it('should handle future dates correctly', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_end_date: futureTimestamp,
      };

      const result = getSubscriptionRenewalDate(userData);
      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('isSubscriptionExpiringSoon', () => {
    it('should return false when userData is null', () => {
      expect(isSubscriptionExpiringsoon(null)).toBe(false);
    });

    it('should return false when renewal date is null', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      };

      expect(isSubscriptionExpiringsoon(userData)).toBe(false);
    });

    it('should return true when subscription expires in 7 days', () => {
      const sevenDaysFromNow = Math.floor(Date.now() / 1000) + 86400 * 7;
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_end_date: sevenDaysFromNow,
      };

      expect(isSubscriptionExpiringsoon(userData)).toBe(true);
    });

    it('should return true when subscription expires in 1 day', () => {
      const oneDayFromNow = Math.floor(Date.now() / 1000) + 86400;
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_end_date: oneDayFromNow,
      };

      expect(isSubscriptionExpiringsoon(userData)).toBe(true);
    });

    it('should return false when subscription expires in 8 days', () => {
      const eightDaysFromNow = Math.floor(Date.now() / 1000) + 86400 * 8;
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_end_date: eightDaysFromNow,
      };

      expect(isSubscriptionExpiringsoon(userData)).toBe(false);
    });

    it('should return false when subscription already expired', () => {
      const yesterday = Math.floor(Date.now() / 1000) - 86400;
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_end_date: yesterday,
      };

      expect(isSubscriptionExpiringsoon(userData)).toBe(false);
    });

    it('should return false when subscription expires in 30 days', () => {
      const thirtyDaysFromNow = Math.floor(Date.now() / 1000) + 86400 * 30;
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        subscription_end_date: thirtyDaysFromNow,
      };

      expect(isSubscriptionExpiringsoon(userData)).toBe(false);
    });
  });

  describe('formatTierInfo', () => {
    it('should format basic tier info correctly', () => {
      const result = formatTierInfo('basic');
      expect(result).toEqual({
        displayName: 'Basic',
        description: 'Pay-per-use credits',
        monthlyPrice: 'Pay-per-use',
        isSubscription: false,
      });
    });

    it('should format pro tier info correctly', () => {
      const result = formatTierInfo('pro');
      expect(result).toEqual({
        displayName: 'Pro',
        description: '$15/month subscription',
        monthlyPrice: '$15.00',
        isSubscription: true,
      });
    });

    it('should format max tier info correctly', () => {
      const result = formatTierInfo('max');
      expect(result).toEqual({
        displayName: 'Max',
        description: '$75/month subscription',
        monthlyPrice: '$75.00',
        isSubscription: true,
      });
    });
  });

  describe('canAccessModel', () => {
    it('should allow access when model has no tier requirement', () => {
      expect(canAccessModel(undefined, 'basic')).toBe(true);
      expect(canAccessModel(undefined, 'pro')).toBe(true);
      expect(canAccessModel(undefined, 'max')).toBe(true);
    });

    it('should allow basic tier user to access basic tier models', () => {
      expect(canAccessModel('basic', 'basic')).toBe(true);
    });

    it('should allow pro tier user to access basic tier models', () => {
      expect(canAccessModel('basic', 'pro')).toBe(true);
    });

    it('should allow max tier user to access basic tier models', () => {
      expect(canAccessModel('basic', 'max')).toBe(true);
    });

    it('should deny basic tier user access to pro tier models', () => {
      expect(canAccessModel('pro', 'basic')).toBe(false);
    });

    it('should allow pro tier user to access pro tier models', () => {
      expect(canAccessModel('pro', 'pro')).toBe(true);
    });

    it('should allow max tier user to access pro tier models', () => {
      expect(canAccessModel('pro', 'max')).toBe(true);
    });

    it('should deny basic tier user access to max tier models', () => {
      expect(canAccessModel('max', 'basic')).toBe(false);
    });

    it('should deny pro tier user access to max tier models', () => {
      expect(canAccessModel('max', 'pro')).toBe(false);
    });

    it('should allow max tier user to access max tier models', () => {
      expect(canAccessModel('max', 'max')).toBe(true);
    });

    it('should enforce tier hierarchy correctly', () => {
      // Basic can only access basic
      expect(canAccessModel('basic', 'basic')).toBe(true);
      expect(canAccessModel('pro', 'basic')).toBe(false);
      expect(canAccessModel('max', 'basic')).toBe(false);

      // Pro can access basic and pro
      expect(canAccessModel('basic', 'pro')).toBe(true);
      expect(canAccessModel('pro', 'pro')).toBe(true);
      expect(canAccessModel('max', 'pro')).toBe(false);

      // Max can access everything
      expect(canAccessModel('basic', 'max')).toBe(true);
      expect(canAccessModel('pro', 'max')).toBe(true);
      expect(canAccessModel('max', 'max')).toBe(true);
    });
  });

  describe('formatSubscriptionStatus', () => {
    it('should format active status', () => {
      expect(formatSubscriptionStatus('active')).toBe('Active');
    });

    it('should format cancelled status', () => {
      expect(formatSubscriptionStatus('cancelled')).toBe('Cancelled');
    });

    it('should format past_due status', () => {
      expect(formatSubscriptionStatus('past_due')).toBe('Past due');
    });

    it('should format inactive status', () => {
      expect(formatSubscriptionStatus('inactive')).toBe('Inactive');
    });

    it('should handle undefined status', () => {
      expect(formatSubscriptionStatus(undefined)).toBe('No subscription');
    });

    it('should handle unknown status gracefully', () => {
      expect(formatSubscriptionStatus('unknown' as SubscriptionStatus)).toBe('Unknown');
    });
  });

  describe('Integration Scenarios', () => {
    it('should correctly handle new user workflow', () => {
      const newUser: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'New User',
        email: 'new@example.com',
        credits: 500,
      };

      expect(getUserTier(newUser)).toBe('basic');
      expect(hasActiveSubscription(newUser)).toBe(false);
      expect(getSubscriptionRenewalDate(newUser)).toBeNull();
      expect(canAccessModel(undefined, getUserTier(newUser))).toBe(true);
      expect(canAccessModel('pro', getUserTier(newUser))).toBe(false);
    });

    it('should correctly handle pro subscriber workflow', () => {
      const proUser: UserData = {
        user_id: 456,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-456',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
        subscription_end_date: Math.floor(Date.now() / 1000) + 86400 * 30,
      };

      expect(getUserTier(proUser)).toBe('pro');
      expect(hasActiveSubscription(proUser)).toBe(true);
      expect(getSubscriptionRenewalDate(proUser)).not.toBeNull();
      expect(canAccessModel('basic', getUserTier(proUser))).toBe(true);
      expect(canAccessModel('pro', getUserTier(proUser))).toBe(true);
      expect(canAccessModel('max', getUserTier(proUser))).toBe(false);
    });

    it('should correctly handle max subscriber workflow', () => {
      const maxUser: UserData = {
        user_id: 789,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-789',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 15000,
        tier: 'max',
        subscription_status: 'active',
        subscription_end_date: Math.floor(Date.now() / 1000) + 86400 * 5,
      };

      expect(getUserTier(maxUser)).toBe('max');
      expect(hasActiveSubscription(maxUser)).toBe(true);
      expect(isSubscriptionExpiringsoon(maxUser)).toBe(true);
      expect(canAccessModel('basic', getUserTier(maxUser))).toBe(true);
      expect(canAccessModel('pro', getUserTier(maxUser))).toBe(true);
      expect(canAccessModel('max', getUserTier(maxUser))).toBe(true);
    });

    it('should correctly handle cancelled subscription workflow', () => {
      const cancelledUser: UserData = {
        user_id: 999,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-999',
        display_name: 'Cancelled User',
        email: 'cancelled@example.com',
        credits: 50,
        tier: 'basic',
        subscription_status: 'cancelled',
      };

      expect(getUserTier(cancelledUser)).toBe('basic');
      expect(hasActiveSubscription(cancelledUser)).toBe(false);
      expect(canAccessModel('pro', getUserTier(cancelledUser))).toBe(false);
      expect(canAccessModel('max', getUserTier(cancelledUser))).toBe(false);
    });
  });
});
