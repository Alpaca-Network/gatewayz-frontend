import type { UserTier, SubscriptionStatus, UserData } from './api';

/**
 * Tier configuration and metadata
 */
export const TIER_CONFIG = {
  basic: {
    name: 'Basic',
    description: 'Pay-per-use credits',
    monthlyPrice: null, // Pay per use
    creditAllocation: 0, // No monthly allocation
    isSubscription: false,
  },
  pro: {
    name: 'Pro',
    description: '$15/month subscription',
    monthlyPrice: 1500, // $15.00 in cents
    creditAllocation: 0, // Credits determined by separate balance
    isSubscription: true,
  },
  max: {
    name: 'Max',
    description: '$75/month subscription',
    monthlyPrice: 7500, // $75.00 in cents
    creditAllocation: 15000, // $150 equivalent in credits
    isSubscription: true,
  },
} as const;

/**
 * Determines the user's current tier based on subscription status and credits
 * @param userData - User data from auth response
 * @returns The current tier (basic, pro, or max)
 */
export const getUserTier = (userData: UserData | null): UserTier => {
  if (!userData) {
    return 'basic';
  }

  // If user has explicit tier from backend, use it
  if (userData.tier) {
    const normalizedTier = (userData.tier as string).toLowerCase() as UserTier;
    // Validate the tier is a recognized value
    if (normalizedTier === 'basic' || normalizedTier === 'pro' || normalizedTier === 'max') {
      return normalizedTier;
    }
  }

  // Fallback to determining tier from subscription status
  // Note: When tier is missing from backend response, we cannot safely determine if user is 'pro' or 'max'
  // The backend should always return explicit tier for subscribed users
  if (userData.subscription_status === 'active') {
    // Cannot safely determine tier without explicit backend data
    // Default to 'pro' for backward compatibility, but log this edge case
    console.warn(
      'getUserTier: User has active subscription but no tier field. Defaulting to pro. User ID may need manual verification.',
      { subscription_status: userData.subscription_status }
    );
    return 'pro';
  }

  return 'basic';
};

/**
 * Checks if a user has an active subscription
 * @param userData - User data from auth response
 * @returns true if user has an active subscription
 */
export const hasActiveSubscription = (userData: UserData | null): boolean => {
  if (!userData) {
    return false;
  }
  return userData.subscription_status === 'active';
};

/**
 * Gets the next subscription renewal date
 * @param userData - User data from auth response
 * @returns Date object or null if no subscription
 */
export const getSubscriptionRenewalDate = (userData: UserData | null): Date | null => {
  if (!userData?.subscription_end_date) {
    return null;
  }
  return new Date(userData.subscription_end_date * 1000);
};

/**
 * Checks if subscription is set to expire soon (within 7 days)
 * @param userData - User data from auth response
 * @returns true if subscription expires within 7 days
 */
export const isSubscriptionExpiringsoon = (userData: UserData | null): boolean => {
  const renewalDate = getSubscriptionRenewalDate(userData);
  if (!renewalDate) {
    return false;
  }

  const daysUntilRenewal = Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return daysUntilRenewal <= 7 && daysUntilRenewal > 0;
};

/**
 * Formats tier information for display
 * @param tier - User tier
 * @returns Formatted tier info object
 */
export const formatTierInfo = (tier: UserTier) => {
  const config = TIER_CONFIG[tier];
  return {
    displayName: config.name,
    description: config.description,
    monthlyPrice: config.monthlyPrice ? `$${(config.monthlyPrice / 100).toFixed(2)}` : 'Pay-per-use',
    isSubscription: config.isSubscription,
  };
};

/**
 * Determines if a model requires a specific tier
 * @param modelRequiredTier - Required tier for the model (undefined = all tiers)
 * @param userTier - User's current tier
 * @returns true if user can access the model
 */
export const canAccessModel = (modelRequiredTier: UserTier | undefined, userTier: UserTier): boolean => {
  if (!modelRequiredTier) {
    // No tier requirement means all users can access
    return true;
  }

  const tierHierarchy: Record<UserTier, number> = {
    basic: 0,
    pro: 1,
    max: 2,
  };

  return tierHierarchy[userTier] >= tierHierarchy[modelRequiredTier];
};

/**
 * Gets subscription status display text
 * @param status - Subscription status
 * @returns Human-readable status text
 */
export const formatSubscriptionStatus = (status: SubscriptionStatus | undefined): string => {
  if (!status) {
    return 'No subscription';
  }

  switch (status) {
    case 'active':
      return 'Active';
    case 'cancelled':
      return 'Cancelled';
    case 'past_due':
      return 'Past due';
    case 'inactive':
      return 'Inactive';
    default:
      return 'Unknown';
  }
};
