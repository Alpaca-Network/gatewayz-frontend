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
 */
export const useTier = () => {
  try {
    const { userData } = useGatewayzAuth();

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
      // Tier info
      tier,
      tierDisplayName, // Use this instead of userData.tier_display_name
      tierConfig: TIER_CONFIG[tier],
      tierInfo: formatTierInfo(tier),

      // Subscription info
      hasSubscription,
      subscriptionStatus: status,
      subscriptionStatusText: formatSubscriptionStatus(status),
      renewalDate,
      isExpiringSoon,

      // Trial info
      isTrial,
      trialExpired,
      trialExpirationDate,
      trialDaysRemaining,
      trialExpiringSoon,

      // Access control
      canAccessModel: (requiredTier: UserTier | undefined) => canAccessModel(requiredTier, tier),

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
