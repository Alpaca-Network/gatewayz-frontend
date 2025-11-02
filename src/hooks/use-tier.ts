import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import {
  getUserTier,
  hasActiveSubscription,
  getSubscriptionRenewalDate,
  isSubscriptionExpiringsoon,
  formatTierInfo,
  canAccessModel,
  formatSubscriptionStatus,
  TIER_CONFIG,
} from '@/lib/tier-utils';
import type { UserTier } from '@/lib/api';

/**
 * Hook to access tier and subscription information for the current user
 */
export const useTier = () => {
  const { userData } = useGatewayzAuth();

  const tier = getUserTier(userData);
  const hasSubscription = hasActiveSubscription(userData);
  const renewalDate = getSubscriptionRenewalDate(userData);
  const isExpiringSoon = isSubscriptionExpiringsoon(userData);
  const status = userData?.subscription_status;

  return {
    // Tier info
    tier,
    tierConfig: TIER_CONFIG[tier],
    tierInfo: formatTierInfo(tier),

    // Subscription info
    hasSubscription,
    subscriptionStatus: status,
    subscriptionStatusText: formatSubscriptionStatus(status),
    renewalDate,
    isExpiringSoon,

    // Access control
    canAccessModel: (requiredTier: UserTier | undefined) => canAccessModel(requiredTier, tier),

    // Raw data
    userData,
  };
};
