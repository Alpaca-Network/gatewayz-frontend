/**
 * Tests for referral data normalization and stats calculation logic
 */

import {
  normalizeReferralData,
  calculateStats,
  ReferralTransaction
} from '@/lib/referral-utils';

describe('normalizeReferralData', () => {
  it('should normalize snake_case fields', () => {
    const raw = {
      id: 1,
      referee_id: 'user123',
      referee_email: 'test@example.com',
      status: 'completed',
      reward_amount: 5.00,
      created_at: '2024-01-01T00:00:00Z',
      completed_at: '2024-01-02T00:00:00Z'
    };

    const result = normalizeReferralData(raw);

    expect(result).toEqual({
      id: 1,
      referee_id: 'user123',
      referee_email: 'test@example.com',
      status: 'completed',
      reward_amount: 5.00,
      created_at: '2024-01-01T00:00:00Z',
      completed_at: '2024-01-02T00:00:00Z'
    });
  });

  it('should normalize camelCase fields', () => {
    const raw = {
      ID: 2,
      refereeId: 'user456',
      refereeEmail: 'camel@example.com',
      Status: 'pending',
      rewardAmount: 10.00,
      createdAt: '2024-02-01T00:00:00Z',
      completedAt: undefined
    };

    const result = normalizeReferralData(raw);

    expect(result).toEqual({
      id: 2,
      referee_id: 'user456',
      referee_email: 'camel@example.com',
      status: 'pending',
      reward_amount: 10.00,
      created_at: '2024-02-01T00:00:00Z',
      completed_at: undefined
    });
  });

  it('should handle alternative field names', () => {
    const raw = {
      id: 3,
      user_id: 'altuser',
      email: 'alt@example.com',
      status: 'completed',
      amount: 15.00,
      date_created: '2024-03-01T00:00:00Z',
      date_completed: '2024-03-02T00:00:00Z'
    };

    const result = normalizeReferralData(raw);

    expect(result).toEqual({
      id: 3,
      referee_id: 'altuser',
      referee_email: 'alt@example.com',
      status: 'completed',
      reward_amount: 15.00,
      created_at: '2024-03-01T00:00:00Z',
      completed_at: '2024-03-02T00:00:00Z'
    });
  });

  it('should handle missing fields with defaults', () => {
    const raw = {};

    const result = normalizeReferralData(raw);

    expect(result).toEqual({
      id: 0,
      referee_id: '',
      referee_email: '',
      status: 'pending',
      reward_amount: 0,
      created_at: '',
      completed_at: undefined
    });
  });

  it('should handle uppercase Status field', () => {
    const raw = {
      id: 4,
      referee_email: 'upper@example.com',
      Status: 'COMPLETED',  // uppercase from some APIs
      reward_amount: 5
    };

    const result = normalizeReferralData(raw);

    expect(result.status).toBe('completed');
  });

  it('should convert string reward amounts to numbers', () => {
    const raw = {
      id: 5,
      referee_email: 'string@example.com',
      reward_amount: '25.50',
      status: 'completed'
    };

    const result = normalizeReferralData(raw);

    expect(result.reward_amount).toBe(25.50);
    expect(typeof result.reward_amount).toBe('number');
  });
});

describe('calculateStats', () => {
  const sampleReferrals: ReferralTransaction[] = [
    {
      id: 1,
      referee_id: 'user1',
      referee_email: 'user1@example.com',
      status: 'completed',
      reward_amount: 5,
      created_at: '2024-01-01'
    },
    {
      id: 2,
      referee_id: 'user2',
      referee_email: 'user2@example.com',
      status: 'pending',
      reward_amount: 5,
      created_at: '2024-01-02'
    },
    {
      id: 3,
      referee_id: 'user3',
      referee_email: 'user3@example.com',
      status: 'completed',
      reward_amount: 5,
      created_at: '2024-01-03'
    }
  ];

  it('should use API total_uses when provided', () => {
    const statsData = { total_uses: 10, total_earned: 50 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.totalReferrals).toBe(10);
  });

  it('should fall back to array length when total_uses is undefined', () => {
    const statsData = { total_earned: 50 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.totalReferrals).toBe(3);
  });

  it('should use 0 when total_uses is explicitly 0 (not fall back to array length)', () => {
    const statsData = { total_uses: 0, total_earned: 0 };

    const result = calculateStats(statsData, sampleReferrals);

    // This is the key test - 0 should be preserved, not treated as falsy
    expect(result.totalReferrals).toBe(0);
  });

  it('should fall back when total_uses is undefined', () => {
    const statsData = { total_uses: undefined, total_earned: 50 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.totalReferrals).toBe(3); // Falls back to array length
  });

  it('should fall back when total_uses is NaN (non-numeric string)', () => {
    const statsData = { total_uses: 'not-a-number' as unknown as number, total_earned: 50 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.totalReferrals).toBe(3); // Falls back to array length
  });

  it('should count completed referrals from normalized data', () => {
    const statsData = { total_uses: 3, total_earned: 10 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.completedReferrals).toBe(2); // Only 2 have status 'completed'
  });

  it('should use API total_earned when provided', () => {
    const statsData = { total_uses: 3, total_earned: 99.99 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.totalEarned).toBe(99.99);
  });

  it('should use 0 when total_earned is explicitly 0', () => {
    const statsData = { total_uses: 3, total_earned: 0 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.totalEarned).toBe(0);
  });

  it('should fall back to 0 when total_earned is undefined', () => {
    const statsData = { total_uses: 3 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.totalEarned).toBe(0);
  });

  it('should handle empty referrals array', () => {
    const statsData = { total_uses: 0, total_earned: 0 };

    const result = calculateStats(statsData, []);

    expect(result).toEqual({
      totalReferrals: 0,
      completedReferrals: 0,
      totalEarned: 0
    });
  });
});
