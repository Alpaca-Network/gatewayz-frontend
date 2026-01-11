import {
  TIER_CONFIG,
  getUserTier,
  hasActiveSubscription,
  hasPurchasedCredits,
  getSubscriptionRenewalDate,
  isSubscriptionExpiringsoon,
  formatTierInfo,
  canAccessModel,
  formatSubscriptionStatus,
  isOnTrial,
  isTrialExpired,
  getTrialExpirationDate,
  getTrialDaysRemaining,
  isTrialExpiringSoon,
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

    it('should return pro tier when user has basic tier but active subscription (data inconsistency fix)', () => {
      // This test covers the bug where a user upgrades to Pro but tier field
      // wasn't updated from 'basic' due to webhook timing or database sync issues
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic', // Stale - wasn't updated after subscription purchase
        subscription_status: 'active', // But subscription is clearly active
      };

      // Basic tier users cannot have active subscriptions, so this should return 'pro'
      expect(getUserTier(userData)).toBe('pro');

      // Should log a warning about the data inconsistency
      expect(consoleSpy).toHaveBeenCalledWith(
        'getUserTier: User has active subscription but tier is "basic". Correcting to "pro".',
        { tier: 'basic', subscription_status: 'active' }
      );

      consoleSpy.mockRestore();
    });

    it('should not change pro tier when subscription is active', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'pro',
        subscription_status: 'active',
      };

      // Pro tier with active subscription should stay as pro
      expect(getUserTier(userData)).toBe('pro');
    });

    it('should not change max tier when subscription is active', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'max',
        subscription_status: 'active',
      };

      // Max tier with active subscription should stay as max
      expect(getUserTier(userData)).toBe('max');
    });

    it('should keep basic tier when subscription is not active (cancelled user)', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic',
        subscription_status: 'cancelled',
      };

      // Basic tier with cancelled subscription should stay basic
      expect(getUserTier(userData)).toBe('basic');
    });

    it('should infer max tier from tier_display_name when tier is basic but subscription is active', () => {
      // This test covers the case where a max subscriber has stale tier='basic'
      // but tier_display_name correctly shows 'Max' or 'MAX'
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic', // Stale
        tier_display_name: 'Max', // Correct value from backend
        subscription_status: 'active',
      };

      // Should use tier_display_name to determine correct tier
      expect(getUserTier(userData)).toBe('max');

      // Should log a warning about the correction
      expect(consoleSpy).toHaveBeenCalledWith(
        'getUserTier: User has active subscription but tier is "basic". Correcting to "max" based on tier_display_name.',
        { tier: 'basic', tier_display_name: 'Max', subscription_status: 'active' }
      );

      consoleSpy.mockRestore();
    });

    it('should infer pro tier from tier_display_name when tier is basic but subscription is active', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic', // Stale
        tier_display_name: 'Pro', // Correct value from backend
        subscription_status: 'active',
      };

      // Should use tier_display_name to determine correct tier
      expect(getUserTier(userData)).toBe('pro');

      consoleSpy.mockRestore();
    });

    it('should default to pro when tier_display_name is also basic or missing', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic',
        tier_display_name: 'Basic', // Also stale
        subscription_status: 'active',
      };

      // When tier_display_name doesn't help, default to 'pro'
      expect(getUserTier(userData)).toBe('pro');

      consoleSpy.mockRestore();
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

  describe('hasPurchasedCredits', () => {
    it('should return false when userData is null', () => {
      expect(hasPurchasedCredits(null)).toBe(false);
    });

    it('should return false when credits is 0', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 0,
      };

      expect(hasPurchasedCredits(userData)).toBe(false);
    });

    it('should return false when credits is at trial threshold (3)', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 3, // Exactly at trial threshold
      };

      expect(hasPurchasedCredits(userData)).toBe(false);
    });

    it('should return true when credits is above trial threshold', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 4, // Just above trial threshold
      };

      expect(hasPurchasedCredits(userData)).toBe(true);
    });

    it('should return true when user has substantial purchased credits', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      };

      expect(hasPurchasedCredits(userData)).toBe(true);
    });

    it('should return false when credits is undefined', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
      };

      expect(hasPurchasedCredits(userData)).toBe(false);
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

    it('should format trial status', () => {
      expect(formatSubscriptionStatus('trial')).toBe('Trial');
    });

    it('should format expired status', () => {
      expect(formatSubscriptionStatus('expired')).toBe('Expired');
    });

    it('should handle undefined status', () => {
      expect(formatSubscriptionStatus(undefined)).toBe('No subscription');
    });

    it('should handle unknown status gracefully', () => {
      expect(formatSubscriptionStatus('unknown' as SubscriptionStatus)).toBe('Unknown');
    });
  });

  describe('isOnTrial', () => {
    it('should return false when userData is null', () => {
      expect(isOnTrial(null)).toBe(false);
    });

    it('should return true when subscription status is trial and credits <= 3 (trial amount)', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 3, // Trial amount (users start with 3 credits)
        subscription_status: 'trial',
      };

      expect(isOnTrial(userData)).toBe(true);
    });

    it('should return false when subscription status is active', () => {
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

      expect(isOnTrial(userData)).toBe(false);
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

      expect(isOnTrial(userData)).toBe(false);
    });

    it('should return false when user has max tier even if subscription_status is trial', () => {
      // This handles the edge case where subscription_status hasn't been updated after upgrade
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'max',
        subscription_status: 'trial',
      };

      expect(isOnTrial(userData)).toBe(false);
    });

    it('should return false when user has pro tier even if subscription_status is trial', () => {
      // This handles the edge case where subscription_status hasn't been updated after upgrade
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'pro',
        subscription_status: 'trial',
      };

      expect(isOnTrial(userData)).toBe(false);
    });

    it('should return true when user has basic tier and subscription_status is trial with trial credits', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 2, // Below trial threshold
        tier: 'basic',
        subscription_status: 'trial',
      };

      expect(isOnTrial(userData)).toBe(true);
    });

    it('should return false when user has purchased credits even with trial subscription_status', () => {
      // This handles the case where a user has added credits but subscription_status wasn't updated
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 10, // More than trial threshold (3), indicating they've purchased credits
        tier: 'basic',
        subscription_status: 'trial',
      };

      expect(isOnTrial(userData)).toBe(false);
    });

    it('should return false when user has exactly at threshold with purchased credits', () => {
      // 4 credits = 3 trial + purchased, so they've paid
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 4, // Just above trial threshold
        subscription_status: 'trial',
      };

      expect(isOnTrial(userData)).toBe(false);
    });
  });

  describe('isTrialExpired', () => {
    it('should return false when userData is null', () => {
      expect(isTrialExpired(null)).toBe(false);
    });

    it('should return true when subscription status is expired', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 0,
        subscription_status: 'expired',
      };

      expect(isTrialExpired(userData)).toBe(true);
    });

    it('should return false when subscription status is trial', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 2, // Trial credits
        subscription_status: 'trial',
      };

      expect(isTrialExpired(userData)).toBe(false);
    });

    it('should return false when user has max tier even if subscription_status is expired', () => {
      // This handles the edge case where subscription_status hasn't been updated after upgrade
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'max',
        subscription_status: 'expired',
      };

      expect(isTrialExpired(userData)).toBe(false);
    });

    it('should return false when user has pro tier even if subscription_status is expired', () => {
      // This handles the edge case where subscription_status hasn't been updated after upgrade
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'pro',
        subscription_status: 'expired',
      };

      expect(isTrialExpired(userData)).toBe(false);
    });

    it('should return true when user has basic tier and subscription_status is expired', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 0,
        tier: 'basic',
        subscription_status: 'expired',
      };

      expect(isTrialExpired(userData)).toBe(true);
    });

    it('should return false when user has purchased credits even with expired subscription_status', () => {
      // This handles the case where a user has added credits but subscription_status wasn't updated
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 15, // More than trial threshold (3), indicating they've purchased credits
        tier: 'basic',
        subscription_status: 'expired',
      };

      expect(isTrialExpired(userData)).toBe(false);
    });
  });

  describe('getTrialExpirationDate', () => {
    it('should return null when userData is null', () => {
      expect(getTrialExpirationDate(null)).toBeNull();
    });

    it('should return null when trial_expires_at is undefined', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 5,
        subscription_status: 'trial',
      };

      expect(getTrialExpirationDate(userData)).toBeNull();
    });

    it('should convert ISO string to Date object', () => {
      const isoDate = '2025-01-15T00:00:00.000Z';
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 5,
        subscription_status: 'trial',
        trial_expires_at: isoDate,
      };

      const result = getTrialExpirationDate(userData);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(isoDate);
    });
  });

  describe('getTrialDaysRemaining', () => {
    it('should return null when userData is null', () => {
      expect(getTrialDaysRemaining(null)).toBeNull();
    });

    it('should return null when trial_expires_at is undefined', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 5,
        subscription_status: 'trial',
      };

      expect(getTrialDaysRemaining(userData)).toBeNull();
    });

    it('should return 0 when trial has expired', () => {
      const pastDate = new Date(Date.now() - 86400 * 1000).toISOString(); // 1 day ago
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 0,
        subscription_status: 'expired',
        trial_expires_at: pastDate,
      };

      expect(getTrialDaysRemaining(userData)).toBe(0);
    });

    it('should return correct number of days remaining', () => {
      const futureDate = new Date(Date.now() + 3 * 86400 * 1000).toISOString(); // 3 days from now
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 5,
        subscription_status: 'trial',
        trial_expires_at: futureDate,
      };

      const result = getTrialDaysRemaining(userData);
      expect(result).toBe(3);
    });
  });

  describe('isTrialExpiringSoon', () => {
    it('should return false when userData is null', () => {
      expect(isTrialExpiringSoon(null)).toBe(false);
    });

    it('should return false when trial_expires_at is undefined', () => {
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 5,
        subscription_status: 'trial',
      };

      expect(isTrialExpiringSoon(userData)).toBe(false);
    });

    it('should return true when trial expires in 1 day', () => {
      const oneDayFromNow = new Date(Date.now() + 86400 * 1000).toISOString();
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 5,
        subscription_status: 'trial',
        trial_expires_at: oneDayFromNow,
      };

      expect(isTrialExpiringSoon(userData)).toBe(true);
    });

    it('should return false when trial expires in 3 days', () => {
      const threeDaysFromNow = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 5,
        subscription_status: 'trial',
        trial_expires_at: threeDaysFromNow,
      };

      expect(isTrialExpiringSoon(userData)).toBe(false);
    });

    it('should return false when trial has already expired', () => {
      const pastDate = new Date(Date.now() - 86400 * 1000).toISOString();
      const userData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 0,
        subscription_status: 'expired',
        trial_expires_at: pastDate,
      };

      expect(isTrialExpiringSoon(userData)).toBe(false);
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

    it('should correctly handle trial user workflow', () => {
      const threeDaysFromNow = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
      const trialUser: UserData = {
        user_id: 111,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-111',
        display_name: 'Trial User',
        email: 'trial@example.com',
        credits: 3, // Trial users start with 3 credits
        tier: 'basic',
        subscription_status: 'trial',
        trial_expires_at: threeDaysFromNow,
      };

      expect(getUserTier(trialUser)).toBe('basic');
      expect(hasActiveSubscription(trialUser)).toBe(false);
      expect(isOnTrial(trialUser)).toBe(true);
      expect(isTrialExpired(trialUser)).toBe(false);
      expect(hasPurchasedCredits(trialUser)).toBe(false);
      expect(getTrialDaysRemaining(trialUser)).toBe(3);
      expect(isTrialExpiringSoon(trialUser)).toBe(false);
      expect(formatSubscriptionStatus(trialUser.subscription_status)).toBe('Trial');
    });

    it('should correctly handle expired trial user workflow', () => {
      const pastDate = new Date(Date.now() - 86400 * 1000).toISOString();
      const expiredTrialUser: UserData = {
        user_id: 222,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-222',
        display_name: 'Expired Trial User',
        email: 'expired@example.com',
        credits: 0,
        tier: 'basic',
        subscription_status: 'expired',
        trial_expires_at: pastDate,
      };

      expect(getUserTier(expiredTrialUser)).toBe('basic');
      expect(hasActiveSubscription(expiredTrialUser)).toBe(false);
      expect(isOnTrial(expiredTrialUser)).toBe(false);
      expect(isTrialExpired(expiredTrialUser)).toBe(true);
      expect(getTrialDaysRemaining(expiredTrialUser)).toBe(0);
      expect(isTrialExpiringSoon(expiredTrialUser)).toBe(false);
      expect(formatSubscriptionStatus(expiredTrialUser.subscription_status)).toBe('Expired');
    });

    it('should correctly handle trial expiring soon workflow', () => {
      const oneDayFromNow = new Date(Date.now() + 86400 * 1000).toISOString();
      const expiringSoonUser: UserData = {
        user_id: 333,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-333',
        display_name: 'Expiring Soon User',
        email: 'expiring@example.com',
        credits: 2,
        tier: 'basic',
        subscription_status: 'trial',
        trial_expires_at: oneDayFromNow,
      };

      expect(isOnTrial(expiringSoonUser)).toBe(true);
      expect(isTrialExpired(expiringSoonUser)).toBe(false);
      expect(getTrialDaysRemaining(expiringSoonUser)).toBe(1);
      expect(isTrialExpiringSoon(expiringSoonUser)).toBe(true);
    });

    it('should correctly handle max tier user with stale trial subscription_status (bug fix)', () => {
      // This is the specific bug scenario: user has max tier but subscription_status
      // wasn't updated from 'trial' to 'active' due to webhook timing or database sync issues
      const oneDayFromNow = new Date(Date.now() + 86400 * 1000).toISOString();
      const maxUserWithStaleTrialStatus: UserData = {
        user_id: 444,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-444',
        display_name: 'Max User with Stale Trial',
        email: 'vaughn.dimarco@gmail.com',
        credits: 15000,
        tier: 'max',
        subscription_status: 'trial', // Stale - should have been updated to 'active'
        trial_expires_at: oneDayFromNow, // Stale trial expiration
      };

      // The key assertion: user with max tier should NOT appear as on trial
      expect(getUserTier(maxUserWithStaleTrialStatus)).toBe('max');
      expect(isOnTrial(maxUserWithStaleTrialStatus)).toBe(false);
      expect(isTrialExpired(maxUserWithStaleTrialStatus)).toBe(false);
      // Tier takes precedence - max tier user should be treated as paid subscriber
      expect(canAccessModel('max', getUserTier(maxUserWithStaleTrialStatus))).toBe(true);
    });

    it('should correctly handle pro tier user with stale expired subscription_status (bug fix)', () => {
      // Another bug scenario: user upgraded to pro but subscription_status is stale 'expired'
      const proUserWithStaleExpiredStatus: UserData = {
        user_id: 555,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-555',
        display_name: 'Pro User with Stale Expired',
        email: 'pro@example.com',
        credits: 5000,
        tier: 'pro',
        subscription_status: 'expired', // Stale - should have been updated to 'active'
      };

      // The key assertion: user with pro tier should NOT appear as expired
      expect(getUserTier(proUserWithStaleExpiredStatus)).toBe('pro');
      expect(isOnTrial(proUserWithStaleExpiredStatus)).toBe(false);
      expect(isTrialExpired(proUserWithStaleExpiredStatus)).toBe(false);
      // Pro tier user should have access to pro features
      expect(canAccessModel('pro', getUserTier(proUserWithStaleExpiredStatus))).toBe(true);
    });

    it('should correctly handle basic user who purchased credits with stale trial status (bug fix)', () => {
      // Scenario: basic tier user purchased credits but subscription_status still shows 'trial'
      const basicUserWithPurchasedCredits: UserData = {
        user_id: 666,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-666',
        display_name: 'Basic User with Purchased Credits',
        email: 'basic@example.com',
        credits: 25, // More than 3 trial credits = purchased
        tier: 'basic',
        subscription_status: 'trial', // Stale - should have been updated after payment
      };

      // The key assertion: user who has purchased credits should NOT appear as on trial
      expect(getUserTier(basicUserWithPurchasedCredits)).toBe('basic');
      expect(hasPurchasedCredits(basicUserWithPurchasedCredits)).toBe(true);
      expect(isOnTrial(basicUserWithPurchasedCredits)).toBe(false);
      expect(isTrialExpired(basicUserWithPurchasedCredits)).toBe(false);
    });

    it('should correctly handle basic user who purchased credits with stale expired status (bug fix)', () => {
      // Scenario: basic tier user purchased credits but subscription_status still shows 'expired'
      const basicUserWithPurchasedCreditsExpired: UserData = {
        user_id: 777,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-777',
        display_name: 'Basic User with Purchased Credits',
        email: 'basic-expired@example.com',
        credits: 50, // More than 3 trial credits = purchased
        tier: 'basic',
        subscription_status: 'expired', // Stale - user has paid for credits
      };

      // The key assertion: user who has purchased credits should NOT appear as expired
      expect(getUserTier(basicUserWithPurchasedCreditsExpired)).toBe('basic');
      expect(hasPurchasedCredits(basicUserWithPurchasedCreditsExpired)).toBe(true);
      expect(isOnTrial(basicUserWithPurchasedCreditsExpired)).toBe(false);
      expect(isTrialExpired(basicUserWithPurchasedCreditsExpired)).toBe(false);
    });
  });
});
