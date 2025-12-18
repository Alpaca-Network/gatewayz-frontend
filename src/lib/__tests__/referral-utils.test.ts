/**
 * Tests for referral utility functions
 */

import {
  normalizeReferralData,
  calculateStats,
  ReferralTransaction,
  FlexibleReferralData
} from '../referral-utils';

describe('normalizeReferralData', () => {
  it('should normalize snake_case fields', () => {
    const raw: FlexibleReferralData = {
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
    const raw: FlexibleReferralData = {
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
    const raw: FlexibleReferralData = {
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

  it('should handle additional date field fallbacks', () => {
    const raw: FlexibleReferralData = {
      id: 4,
      user_id: 'dateuser',
      email: 'date@example.com',
      status: 'pending',
      reward: 20.00,
      date: '2024-04-01T00:00:00Z',
      bonus_date: '2024-04-02T00:00:00Z'
    };

    const result = normalizeReferralData(raw);

    expect(result.created_at).toBe('2024-04-01T00:00:00Z');
    expect(result.completed_at).toBe('2024-04-02T00:00:00Z');
  });

  it('should handle signed_up_at field', () => {
    const raw: FlexibleReferralData = {
      id: 5,
      email: 'signup@example.com',
      signed_up_at: '2024-05-01T00:00:00Z'
    };

    const result = normalizeReferralData(raw);

    expect(result.created_at).toBe('2024-05-01T00:00:00Z');
  });

  it('should handle missing fields with defaults', () => {
    const raw: FlexibleReferralData = {};

    const result = normalizeReferralData(raw);

    // UUID should be generated when id, referee_id, and created_at are all missing
    expect(typeof result.id).toBe('string');
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(result.referee_id).toBe('');
    expect(result.referee_email).toBe('');
    expect(result.status).toBe('pending');
    expect(result.reward_amount).toBe(0);
    expect(result.created_at).toBe('');
    expect(result.completed_at).toBe(undefined);
  });

  it('should handle uppercase Status field', () => {
    const raw: FlexibleReferralData = {
      id: 6,
      referee_email: 'upper@example.com',
      Status: 'COMPLETED',
      reward_amount: 5
    };

    const result = normalizeReferralData(raw);

    expect(result.status).toBe('completed');
  });

  it('should convert string reward amounts to numbers', () => {
    const raw: FlexibleReferralData = {
      id: 7,
      referee_email: 'string@example.com',
      reward_amount: '25.50',
      status: 'completed'
    };

    const result = normalizeReferralData(raw);

    expect(result.reward_amount).toBe(25.50);
    expect(typeof result.reward_amount).toBe('number');
  });

  it('should default reward_amount to 0 when not provided', () => {
    const raw: FlexibleReferralData = {
      id: 8,
      referee_email: 'noreward@example.com',
      status: 'pending'
    };

    const result = normalizeReferralData(raw);

    expect(result.reward_amount).toBe(0);
  });

  it('should generate synthetic ID from referee_id and created_at when id is missing', () => {
    const raw: FlexibleReferralData = {
      referee_id: 'user999',
      referee_email: 'synthetic@example.com',
      created_at: '2024-06-01T12:00:00Z',
      status: 'pending',
      reward_amount: 10
    };

    const result = normalizeReferralData(raw);

    // Synthetic ID should be referee_id + timestamp
    expect(typeof result.id).toBe('string');
    expect(result.id).toContain('user999_');
    expect(result.id).toContain('1717243200000'); // timestamp of 2024-06-01T12:00:00Z
  });

  it('should generate synthetic ID with camelCase fields', () => {
    const raw: FlexibleReferralData = {
      refereeId: 'camelUser',
      refereeEmail: 'camel@example.com',
      createdAt: '2024-07-01T12:00:00Z',
      status: 'pending'
    };

    const result = normalizeReferralData(raw);

    // Should use camelCase fallbacks for synthetic ID generation
    expect(typeof result.id).toBe('string');
    expect(result.id).toContain('camelUser_');
  });

  it('should accept string IDs from API without converting', () => {
    const raw: FlexibleReferralData = {
      id: 'api-string-id-123',
      referee_email: 'string-id@example.com',
      status: 'completed'
    };

    const result = normalizeReferralData(raw);

    // String IDs should be preserved as-is
    expect(result.id).toBe('api-string-id-123');
    expect(typeof result.id).toBe('string');
  });

  it('should accept numeric IDs from API without converting', () => {
    const raw: FlexibleReferralData = {
      id: 12345,
      referee_email: 'numeric-id@example.com',
      status: 'completed'
    };

    const result = normalizeReferralData(raw);

    // Numeric IDs should be preserved as-is
    expect(result.id).toBe(12345);
    expect(typeof result.id).toBe('number');
  });

  it('should generate unique UUIDs for multiple empty objects', () => {
    const result1 = normalizeReferralData({});
    const result2 = normalizeReferralData({});

    // Each should get a different UUID
    expect(result1.id).not.toBe(result2.id);
    expect(typeof result1.id).toBe('string');
    expect(typeof result2.id).toBe('string');
  });

  it('should fallback to UUID when createdAt is invalid date string', () => {
    const raw: FlexibleReferralData = {
      referee_id: 'user123',
      created_at: 'invalid-date-string',
      referee_email: 'invalid@example.com',
      status: 'pending'
    };

    const result = normalizeReferralData(raw);

    // Should generate UUID instead of synthetic ID with NaN
    expect(typeof result.id).toBe('string');
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(result.id).not.toContain('NaN');
  });

  it('should generate different UUIDs for multiple records with same invalid date', () => {
    const raw1 = {
      referee_id: 'user123',
      created_at: 'invalid-date',
      referee_email: 'test1@example.com'
    };
    const raw2 = {
      referee_id: 'user123',
      created_at: 'invalid-date',
      referee_email: 'test2@example.com'
    };

    const result1 = normalizeReferralData(raw1);
    const result2 = normalizeReferralData(raw2);

    // Each should get a unique UUID, not duplicate "user123_NaN"
    expect(result1.id).not.toBe(result2.id);
    expect(result1.id).not.toContain('NaN');
    expect(result2.id).not.toContain('NaN');
  });

  it('should accept 0 as a valid API-provided ID', () => {
    const raw: FlexibleReferralData = {
      id: 0,
      referee_email: 'zero-id@example.com',
      status: 'pending'
    };

    const result = normalizeReferralData(raw);

    // 0 is a valid ID and should be preserved
    expect(result.id).toBe(0);
    expect(typeof result.id).toBe('number');
  });

  it('should generate valid UUID format in all environments', () => {
    const raw: FlexibleReferralData = {
      referee_email: 'uuid-test@example.com',
      status: 'pending'
    };

    const result = normalizeReferralData(raw);

    // Should generate a valid UUID (regardless of crypto availability)
    expect(typeof result.id).toBe('string');
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
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

  it('should preserve 0 when total_uses is explicitly 0', () => {
    const statsData = { total_uses: 0, total_earned: 0 };

    const result = calculateStats(statsData, sampleReferrals);

    // This is the key test - 0 should be preserved, not treated as falsy
    expect(result.totalReferrals).toBe(0);
  });

  it('should fall back when total_uses is NaN', () => {
    const statsData = { total_uses: 'not-a-number' as any, total_earned: 50 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.totalReferrals).toBe(3);
  });

  it('should count completed referrals from normalized data', () => {
    const statsData = { total_uses: 3, total_earned: 10 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.completedReferrals).toBe(2);
  });

  it('should use API total_earned when provided', () => {
    const statsData = { total_uses: 3, total_earned: 99.99 };

    const result = calculateStats(statsData, sampleReferrals);

    expect(result.totalEarned).toBe(99.99);
  });

  it('should preserve 0 when total_earned is explicitly 0', () => {
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
