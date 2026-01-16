import { useMemo } from 'react';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import {
  getUserTier,
  hasActiveSubscription,
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
  TIER_CONFIG,
} from '@/lib/tier-utils';
import type { UserTier } from '@/lib/api';
import { captureHookError } from '@/lib/sentry-utils';

/**
 * Get the corrected display name for the tier
 * This ensures the display name matches the computed tier, not stale userData
 */
const getTierDisplayName = (tier: UserTier, rawDisplayName: string | undefined): string => {
  // If raw display name matches the computed tier, use it (preserves casing from backend)
  if (rawDisplayName) {
    const normalizedRaw = rawDisplayName.toLowerCase();
    if (normalizedRaw === tier) {
      return rawDisplayName;
    }
  }
  // Otherwise use the canonical display name from tier config
  return TIER_CONFIG[tier].name;
};

/**
 * Hook to access tier and subscription information for the current user
 * Memoized to prevent excessive recalculations and console warnings
 */
export const useTier = () => {
  try {
    const { userData } = useGatewayzAuth();

    // Memoize all tier calculations to prevent repeated console warnings
    // when there's a tier/subscription mismatch
    const tierData = useMemo(() => {
      const tier = getUserTier(userData);
      const hasSubscription = hasActiveSubscription(userData);
      const renewalDate = getSubscriptionRenewalDate(userData);
      const isExpiringSoon = isSubscriptionExpiringsoon(userData);
      const status = userData?.subscription_status;

      // Trial info
      const isTrial = isOnTrial(userData);
      const trialExpired = isTrialExpired(userData);
      const trialExpirationDate = getTrialExpirationDate(userData);
      const trialDaysRemaining = getTrialDaysRemaining(userData);
      const trialExpiringSoon = isTrialExpiringSoon(userData);

      // Get corrected display name that matches the computed tier
      const tierDisplayName = getTierDisplayName(tier, userData?.tier_display_name);

      return {
        tier,
        tierDisplayName,
        hasSubscription,
        renewalDate,
        isExpiringSoon,
        status,
        isTrial,
        trialExpired,
        trialExpirationDate,
        trialDaysRemaining,
        trialExpiringSoon,
      };
    }, [userData]);

    // Memoize the canAccessModel function to maintain referential equality
    const canAccessModelFn = useMemo(
      () => (requiredTier: UserTier | undefined) => canAccessModel(requiredTier, tierData.tier),
      [tierData.tier]
    );

    return {
      // Tier info
      tier: tierData.tier,
      tierDisplayName: tierData.tierDisplayName,
      tierConfig: TIER_CONFIG[tierData.tier],
      tierInfo: formatTierInfo(tierData.tier),

      // Subscription info
      hasSubscription: tierData.hasSubscription,
      subscriptionStatus: tierData.status,
      subscriptionStatusText: formatSubscriptionStatus(tierData.status),
      renewalDate: tierData.renewalDate,
      isExpiringSoon: tierData.isExpiringSoon,

      // Trial info
      isTrial: tierData.isTrial,
      trialExpired: tierData.trialExpired,
      trialExpirationDate: tierData.trialExpirationDate,
      trialDaysRemaining: tierData.trialDaysRemaining,
      trialExpiringSoon: tierData.trialExpiringSoon,

      // Access control
      canAccessModel: canAccessModelFn,

      // Raw data
      userData,

      // Loading state
      isLoading: false,
      error: null,
    };
  } catch (error) {
    captureHookError(error, {
      hookName: 'useTier',
      operation: 'tier_utils_calculation',
    });
    throw error;
  }
};
