import type { UserTier, SubscriptionStatus, UserData } from './api';

// Track logged warnings to prevent duplicate console spam
// Limited to MAX_LOGGED_WARNINGS entries to prevent memory leaks in long-running apps
const MAX_LOGGED_WARNINGS = 100;
const loggedWarnings = new Set<string>();

/**
 * Log a warning only once per unique key to prevent console spam
 */
const warnOnce = (key: string, message: string, data?: Record<string, unknown>) => {
  if (loggedWarnings.has(key)) return;

  // Prevent unbounded growth - clear oldest entries when limit reached
  if (loggedWarnings.size >= MAX_LOGGED_WARNINGS) {
    const firstKey = loggedWarnings.values().next().value;
    if (firstKey) loggedWarnings.delete(firstKey);
  }

  loggedWarnings.add(key);
  if (data) {
    console.warn(message, data);
  } else {
    console.warn(message);
  }
};

/**
 * Reset logged warnings (for testing purposes)
 * @internal
 */
export const _resetLoggedWarnings = () => {
  loggedWarnings.clear();
};

/**
 * Tier configuration and metadata
 */
export const TIER_CONFIG = {
  free: {
    name: 'Free',
    description: 'Free tier — purchase a plan to unlock more credits',
    monthlyPrice: 0,
    creditAllocation: 0,
    monthlyAllowance: 0,
    isSubscription: false,
  },
  basic: {
    name: 'Starter',
    description: '$35/month - $35 in credits (20% savings vs pay-as-you-go)',
    monthlyPrice: 3500, // $35.00 in cents
    creditAllocation: 3500, // $35 in credits
    monthlyAllowance: 3500, // $35.00 in cents
    isSubscription: true,
  },
  pro: {
    name: 'Pro',
    description: '$120/month - $130 in credits (27% savings vs pay-as-you-go)',
    monthlyPrice: 12000, // $120.00 in cents
    creditAllocation: 13000, // $130 in credits
    monthlyAllowance: 13000, // $130.00 in cents
    isSubscription: true,
  },
  max: {
    name: 'Max',
    description: '$350/month - $400 in credits (30% savings vs pay-as-you-go)',
    monthlyPrice: 35000, // $350.00 in cents
    creditAllocation: 40000, // $400 in credits
    monthlyAllowance: 40000, // $400.00 in cents
    isSubscription: true,
  },
} as const;

/**
 * Helper to infer tier from tier_display_name
 * @param tierDisplayName - Display name string from backend (e.g., "Pro", "MAX", "Max")
 * @returns The inferred tier or null if cannot be determined
 */
const inferTierFromDisplayName = (tierDisplayName: string | undefined): UserTier | null => {
  if (!tierDisplayName) return null;
  const normalized = tierDisplayName.toLowerCase();
  if (normalized === 'max') return 'max';
  if (normalized === 'pro') return 'pro';
  if (normalized === 'basic') return 'basic';
  if (normalized === 'free') return 'free';
  return null;
};

/**
 * Determines the user's current tier based on subscription status and tier field.
 *
 * Primary gate: subscription_status === 'active' → trust the tier field.
 * Secondary gate: hasPurchasedCredits → trust the tier field even with stale
 *   subscription_status (e.g. after a webhook delay or one-time credit purchase).
 * Everyone else: return 'free' — they have not paid, regardless of what the
 *   DB tier column says (it defaults to 'basic' for all new users).
 *
 * @param userData - User data from auth response
 * @returns The current tier ('free', 'basic', 'pro', or 'max')
 */
export const getUserTier = (userData: UserData | null): UserTier => {
  if (!userData) {
    return 'free';
  }

  const tier = (userData.tier as string | undefined)?.toLowerCase();
  const isPaidTier = tier === 'basic' || tier === 'pro' || tier === 'max';

  // Active subscription — trust the tier field
  if (userData.subscription_status === 'active') {
    if (isPaidTier) return tier as UserTier;
    // Active subscription but unrecognized tier — return 'basic' as safe minimum
    return 'basic';
  }

  // Stale subscription_status but user has clearly purchased credits (> $5 trial amount)
  // This handles webhook delays and one-time credit purchases with stale status
  if (isPaidTier && hasPurchasedCredits(userData)) {
    return tier as UserTier;
  }

  // No active subscription and no purchased credits — free tier
  return 'free';
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

// Trial users start with 3 credits - if they have more, they've purchased credits
// Trial credits threshold in cents ($5 = 500 cents)
const TRIAL_CREDIT_THRESHOLD = 500;

/**
 * Checks if a user has purchased credits (more than trial amount)
 * @param userData - User data from auth response
 * @returns true if user has purchased credits beyond trial allocation
 */
export const hasPurchasedCredits = (userData: UserData | null): boolean => {
  if (!userData) {
    return false;
  }
  // Credits > 500 cents ($5) indicates user has added payment beyond initial trial credits
  return (userData.credits ?? 0) > TRIAL_CREDIT_THRESHOLD;
};

/**
 * Checks if a user is on a trial
 * @param userData - User data from auth response
 * @returns true if user is on trial
 */
export const isOnTrial = (userData: UserData | null): boolean => {
  if (!userData) {
    return false;
  }
  // Users with pro or max tier are never on trial, even if subscription_status
  // hasn't been updated yet (e.g., due to webhook timing or database sync issues)
  const tier = userData.tier?.toLowerCase();
  if (tier === 'pro' || tier === 'max') {
    return false;
  }
  // Users who have purchased credits (> trial amount) are not on trial
  // This handles cases where subscription_status hasn't been updated after payment
  if (hasPurchasedCredits(userData)) {
    return false;
  }
  return userData.subscription_status === 'trial';
};

/**
 * Checks if a user's trial has expired
 * @param userData - User data from auth response
 * @returns true if trial has expired
 */
export const isTrialExpired = (userData: UserData | null): boolean => {
  if (!userData) {
    return false;
  }
  // Users with pro or max tier never have expired trials, even if subscription_status
  // hasn't been updated yet (e.g., due to webhook timing or database sync issues)
  const tier = userData.tier?.toLowerCase();
  if (tier === 'pro' || tier === 'max') {
    return false;
  }
  // Users who have purchased credits (> trial amount) don't have expired trials
  // This handles cases where subscription_status hasn't been updated after payment
  if (hasPurchasedCredits(userData)) {
    return false;
  }
  return userData.subscription_status === 'expired';
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
    free: -1,
    basic: 0,
    pro: 1,
    max: 2,
  };

  return tierHierarchy[userTier] >= tierHierarchy[modelRequiredTier];
};

/**
 * Gets the trial expiration date
 * @param userData - User data from auth response
 * @returns Date object or null if not on trial
 */
export const getTrialExpirationDate = (userData: UserData | null): Date | null => {
  if (!userData?.trial_expires_at) {
    return null;
  }
  return new Date(userData.trial_expires_at);
};

/**
 * Gets the number of days remaining in trial
 * @param userData - User data from auth response
 * @returns Number of days remaining or null if not on trial
 */
export const getTrialDaysRemaining = (userData: UserData | null): number | null => {
  const expirationDate = getTrialExpirationDate(userData);
  if (!expirationDate) {
    return null;
  }
  const daysRemaining = Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysRemaining);
};

/**
 * Checks if trial is expiring soon (within 1 day)
 * @param userData - User data from auth response
 * @returns true if trial expires within 1 day
 */
export const isTrialExpiringSoon = (userData: UserData | null): boolean => {
  const daysRemaining = getTrialDaysRemaining(userData);
  if (daysRemaining === null) {
    return false;
  }
  return daysRemaining <= 1 && daysRemaining > 0;
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
    case 'trial':
      return 'Trial';
    case 'expired':
      return 'Expired';
    default:
      return 'Unknown';
  }
};

/**
 * Get the monthly subscription allowance for a tier in dollars
 */
export const getMonthlyAllowance = (tier: UserTier): number => {
  return TIER_CONFIG[tier].monthlyAllowance / 100;
};

/**
 * Calculate remaining allowance percentage
 */
export const getAllowancePercentage = (
  subscriptionAllowance: number,
  tier: UserTier
): number => {
  const maxAllowance = getMonthlyAllowance(tier);
  if (maxAllowance <= 0) return 0;
  return Math.min(100, Math.max(0, (subscriptionAllowance / maxAllowance) * 100));
};
