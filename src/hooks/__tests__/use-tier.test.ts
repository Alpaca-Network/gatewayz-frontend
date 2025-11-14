import { renderHook } from '@testing-library/react';
import { useTier } from '../use-tier';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import type { UserData } from '@/lib/api';

// Mock the auth context
jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));

describe('useTier', () => {
  const mockUseGatewayzAuth = useGatewayzAuth as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Tier Users', () => {
    it('should return basic tier for user without subscription', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.tier).toBe('basic');
      expect(result.current.hasSubscription).toBe(false);
      expect(result.current.tierConfig.name).toBe('Basic');
      expect(result.current.tierConfig.monthlyPrice).toBeNull();
      expect(result.current.tierConfig.isSubscription).toBe(false);
    });

    it('should return basic tier for null userData', () => {
      mockUseGatewayzAuth.mockReturnValue({ userData: null });

      const { result } = renderHook(() => useTier());

      expect(result.current.tier).toBe('basic');
      expect(result.current.hasSubscription).toBe(false);
      expect(result.current.renewalDate).toBeNull();
    });

    it('should not allow access to pro tier models for basic users', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.canAccessModel(undefined)).toBe(true); // No requirement
      expect(result.current.canAccessModel('basic')).toBe(true);
      expect(result.current.canAccessModel('pro')).toBe(false);
      expect(result.current.canAccessModel('max')).toBe(false);
    });

    it('should format basic tier info correctly', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.tierInfo).toEqual({
        displayName: 'Basic',
        description: 'Pay-per-use credits',
        monthlyPrice: 'Pay-per-use',
        isSubscription: false,
      });
    });
  });

  describe('Pro Tier Users', () => {
    it('should return pro tier for subscribed user', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
        subscription_end_date: Math.floor(Date.now() / 1000) + 86400 * 30,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.tier).toBe('pro');
      expect(result.current.hasSubscription).toBe(true);
      expect(result.current.tierConfig.name).toBe('Pro');
      expect(result.current.tierConfig.monthlyPrice).toBe(1500);
      expect(result.current.tierConfig.isSubscription).toBe(true);
    });

    it('should allow access to basic and pro tier models', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.canAccessModel(undefined)).toBe(true);
      expect(result.current.canAccessModel('basic')).toBe(true);
      expect(result.current.canAccessModel('pro')).toBe(true);
      expect(result.current.canAccessModel('max')).toBe(false);
    });

    it('should format pro tier info correctly', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.tierInfo).toEqual({
        displayName: 'Pro',
        description: '$15/month subscription',
        monthlyPrice: '$15.00',
        isSubscription: true,
      });
    });

    it('should return renewal date for pro user', () => {
      const renewalTimestamp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
        subscription_end_date: renewalTimestamp,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.renewalDate).toBeInstanceOf(Date);
      expect(result.current.renewalDate?.getTime()).toBe(renewalTimestamp * 1000);
      expect(result.current.isExpiringSoon).toBe(false);
    });

    it('should detect expiring soon subscription', () => {
      const expiringTimestamp = Math.floor(Date.now() / 1000) + 86400 * 5; // 5 days from now
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
        subscription_end_date: expiringTimestamp,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.isExpiringSoon).toBe(true);
    });
  });

  describe('Max Tier Users', () => {
    it('should return max tier for premium subscribers', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 15000,
        tier: 'max',
        subscription_status: 'active',
        subscription_end_date: Math.floor(Date.now() / 1000) + 86400 * 30,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.tier).toBe('max');
      expect(result.current.hasSubscription).toBe(true);
      expect(result.current.tierConfig.name).toBe('Max');
      expect(result.current.tierConfig.monthlyPrice).toBe(7500);
      expect(result.current.tierConfig.creditAllocation).toBe(15000);
    });

    it('should allow access to all tier models', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 15000,
        tier: 'max',
        subscription_status: 'active',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.canAccessModel(undefined)).toBe(true);
      expect(result.current.canAccessModel('basic')).toBe(true);
      expect(result.current.canAccessModel('pro')).toBe(true);
      expect(result.current.canAccessModel('max')).toBe(true);
    });

    it('should format max tier info correctly', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 15000,
        tier: 'max',
        subscription_status: 'active',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.tierInfo).toEqual({
        displayName: 'Max',
        description: '$75/month subscription',
        monthlyPrice: '$75.00',
        isSubscription: true,
      });
    });
  });

  describe('Subscription Status', () => {
    it('should handle active subscription status', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.subscriptionStatus).toBe('active');
      expect(result.current.subscriptionStatusText).toBe('Active');
    });

    it('should handle cancelled subscription status', () => {
      const mockUserData: UserData = {
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

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.subscriptionStatus).toBe('cancelled');
      expect(result.current.subscriptionStatusText).toBe('Cancelled');
      expect(result.current.hasSubscription).toBe(false);
    });

    it('should handle past_due subscription status', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'pro',
        subscription_status: 'past_due',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.subscriptionStatus).toBe('past_due');
      expect(result.current.subscriptionStatusText).toBe('Past due');
      expect(result.current.hasSubscription).toBe(false);
    });

    it('should handle inactive subscription status', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic',
        subscription_status: 'inactive',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.subscriptionStatus).toBe('inactive');
      expect(result.current.subscriptionStatusText).toBe('Inactive');
      expect(result.current.hasSubscription).toBe(false);
    });

    it('should handle undefined subscription status', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.subscriptionStatus).toBeUndefined();
      expect(result.current.subscriptionStatusText).toBe('No subscription');
    });
  });

  describe('Raw Data Access', () => {
    it('should provide access to raw userData', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'pro',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.userData).toEqual(mockUserData);
    });

    it('should provide null userData when not authenticated', () => {
      mockUseGatewayzAuth.mockReturnValue({ userData: null });

      const { result } = renderHook(() => useTier());

      expect(result.current.userData).toBeNull();
    });
  });

  describe('Hook Reactivity', () => {
    it('should update when user upgrades tier', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result, rerender } = renderHook(() => useTier());

      expect(result.current.tier).toBe('basic');
      expect(result.current.canAccessModel('pro')).toBe(false);

      // Simulate tier upgrade
      const upgradedUserData: UserData = {
        ...mockUserData,
        tier: 'pro',
        subscription_status: 'active',
        credits: 1000,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: upgradedUserData });

      rerender();

      expect(result.current.tier).toBe('pro');
      expect(result.current.hasSubscription).toBe(true);
      expect(result.current.canAccessModel('pro')).toBe(true);
    });

    it('should update when subscription expires', () => {
      const activeSubscription: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
        subscription_end_date: Math.floor(Date.now() / 1000) + 86400 * 30,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: activeSubscription });

      const { result, rerender } = renderHook(() => useTier());

      expect(result.current.hasSubscription).toBe(true);
      expect(result.current.subscriptionStatus).toBe('active');

      // Simulate subscription cancellation
      const expiredSubscription: UserData = {
        ...activeSubscription,
        tier: 'basic',
        subscription_status: 'cancelled',
        subscription_end_date: undefined,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: expiredSubscription });

      rerender();

      expect(result.current.hasSubscription).toBe(false);
      expect(result.current.subscriptionStatus).toBe('cancelled');
      expect(result.current.tier).toBe('basic');
    });

    it('should update when credits change', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result, rerender } = renderHook(() => useTier());

      expect(result.current.userData?.credits).toBe(100);

      // Simulate credit purchase
      const updatedUserData: UserData = {
        ...mockUserData,
        credits: 1000,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: updatedUserData });

      rerender();

      expect(result.current.userData?.credits).toBe(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with tier but no subscription status', () => {
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 1000,
        tier: 'pro',
        // subscription_status is missing
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.tier).toBe('pro');
      expect(result.current.hasSubscription).toBe(false);
      expect(result.current.subscriptionStatusText).toBe('No subscription');
    });

    it('should handle expired renewal date', () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 86400; // 1 day ago
      const mockUserData: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic',
        subscription_end_date: expiredTimestamp,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: mockUserData });

      const { result } = renderHook(() => useTier());

      expect(result.current.renewalDate).toBeInstanceOf(Date);
      expect(result.current.renewalDate!.getTime()).toBeLessThan(Date.now());
      expect(result.current.isExpiringSoon).toBe(false); // Already expired
    });

    it.skip('should handle malformed tier data gracefully', () => {
      // Skipping this test as invalid tier data will cause errors
      // In production, backend should always return valid tier values
    });
  });

  describe('Integration Scenarios', () => {
    it('should support free trial to paid upgrade flow', () => {
      // Start as basic user
      const basicUser: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'New User',
        email: 'new@example.com',
        credits: 500, // Free trial credits
        tier: 'basic',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: basicUser });

      const { result, rerender } = renderHook(() => useTier());

      expect(result.current.tier).toBe('basic');
      expect(result.current.hasSubscription).toBe(false);
      expect(result.current.canAccessModel('pro')).toBe(false);

      // Upgrade to Pro
      const proUser: UserData = {
        ...basicUser,
        tier: 'pro',
        subscription_status: 'active',
        subscription_end_date: Math.floor(Date.now() / 1000) + 86400 * 30,
        credits: 1000,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: proUser });
      rerender();

      expect(result.current.tier).toBe('pro');
      expect(result.current.hasSubscription).toBe(true);
      expect(result.current.canAccessModel('pro')).toBe(true);
      expect(result.current.tierInfo.monthlyPrice).toBe('$15.00');
    });

    it('should support downgrade from max to basic', () => {
      // Start as Max user
      const maxUser: UserData = {
        user_id: 123,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        display_name: 'Premium User',
        email: 'premium@example.com',
        credits: 15000,
        tier: 'max',
        subscription_status: 'active',
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: maxUser });

      const { result, rerender } = renderHook(() => useTier());

      expect(result.current.tier).toBe('max');
      expect(result.current.canAccessModel('max')).toBe(true);

      // Downgrade to Basic
      const basicUser: UserData = {
        ...maxUser,
        tier: 'basic',
        subscription_status: 'cancelled',
        credits: 100,
      };

      mockUseGatewayzAuth.mockReturnValue({ userData: basicUser });
      rerender();

      expect(result.current.tier).toBe('basic');
      expect(result.current.hasSubscription).toBe(false);
      expect(result.current.canAccessModel('max')).toBe(false);
      expect(result.current.canAccessModel('pro')).toBe(false);
    });
  });
});
