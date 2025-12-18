/**
 * Referral data utilities
 * Shared functions for normalizing and processing referral data
 */

// Flexible referral data type to handle different API response formats
export interface FlexibleReferralData {
  [key: string]: any;
}

// Referral transaction data type
export interface ReferralTransaction {
  id: string | number;
  referee_id: string;
  referee_email: string;
  status: 'pending' | 'completed';
  reward_amount: number;
  created_at: string;
  completed_at?: string;
}

/**
 * Normalize referral data from various API response formats
 * Handles both snake_case and camelCase field names, and various alternative field names
 */
export const normalizeReferralData = (rawData: FlexibleReferralData): ReferralTransaction => {
  // Normalize status to lowercase for consistent comparison
  const rawStatus = String(rawData.status || rawData.Status || 'pending').toLowerCase();
  const status = (rawStatus === 'completed' ? 'completed' : 'pending') as 'pending' | 'completed';

  // Extract normalized field values using all variations
  const refereeId = rawData.referee_id || rawData.refereeId || rawData.user_id || rawData.userId || '';
  const createdAt = rawData.created_at || rawData.createdAt || rawData.date_created || rawData.dateCreated || rawData.date || rawData.signed_up_at || '';

  // Transaction ID should be unique - don't use user_id as fallback to prevent duplicate React keys
  // Priority: 1) API-provided ID, 2) Synthetic ID from referee_id + timestamp, 3) UUID fallback
  const apiId = rawData.id || rawData.ID;

  let transactionId: string | number;
  if (apiId !== undefined && apiId !== null) {
    // Use API-provided ID as-is (can be string or number)
    transactionId = apiId;
  } else if (refereeId && createdAt) {
    // Create synthetic ID from referee_id + timestamp for uniqueness
    transactionId = `${refereeId}_${new Date(createdAt).getTime()}`;
  } else {
    // Fallback to UUID when critical fields are missing
    transactionId = crypto.randomUUID();
  }

  return {
    id: transactionId,
    referee_id: refereeId,
    referee_email: rawData.referee_email || rawData.refereeEmail || rawData.email || rawData.user_email || rawData.userEmail || '',
    status,
    reward_amount: Number(rawData.reward_amount || rawData.rewardAmount || rawData.amount || rawData.reward || 0),
    created_at: createdAt,
    completed_at: rawData.completed_at || rawData.completedAt || rawData.date_completed || rawData.dateCompleted || rawData.bonus_date || undefined
  };
};

/**
 * Calculate referral stats from API response and normalized data
 * Uses Number.isNaN to properly handle explicit 0 values from the API
 */
export const calculateStats = (
  statsData: { total_uses?: number; total_earned?: number; referrals?: unknown[] },
  normalizedReferrals: ReferralTransaction[]
) => {
  const totalUses = Number(statsData.total_uses);
  const totalEarned = Number(statsData.total_earned);

  return {
    totalReferrals: Number.isNaN(totalUses) ? normalizedReferrals.length : totalUses,
    completedReferrals: normalizedReferrals.filter((r) => r.status === 'completed').length,
    totalEarned: Number.isNaN(totalEarned) ? 0 : totalEarned
  };
};
