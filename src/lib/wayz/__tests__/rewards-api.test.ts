// Fixtures below cite the staking-rewards spec's §API contract
// (scratchpad/staking-rewards/spec.md, 2026-09-11): GET /staking/rewards returns
// {success, data:{enabled, rate_table, wallets, totals, history}}, numbers as strings;
// GET /staking/wallets/{address} gains a `rewards: {estimated_credits_per_day,
// rate_credits_per_1k}` field. Backend is built in parallel — no live contract to run
// against yet, so this only tests the client's own parsing/error-mapping against the spec.
import { getStakingRewards, getWalletRewardsEstimate, RewardsApiError } from '../rewards-api';
import { createSuccessResponse, createErrorResponse, setupFetchMock } from '@/__tests__/utils/mock-fetch';
import { saveApiKey } from '@/lib/api';

describe('rewards-api', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockFetch = setupFetchMock();
  });

  describe('getStakingRewards', () => {
    it('GETs /staking/rewards with a Bearer token and parses the envelope', async () => {
      saveApiKey('test-api-key');
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            enabled: true,
            rate_table: [
              { min_stake_wayz: '0', credits_per_1k_wayz_per_day: '0.010000' },
              { min_stake_wayz: '10000', credits_per_1k_wayz_per_day: '0.012000' },
            ],
            wallets: [{ address: '0xabc', staked_wayz: '5000', estimated_credits_per_day: '0.05' }],
            totals: { credits_paid_30d: '1.500000', credits_paid_all: '9.999900', pending_credits: '0.010000' },
            history: [
              {
                reward_date: '2026-09-10',
                wallet_address: '0xabc',
                staked_wayz: '5000',
                credits: '0.050000',
                status: 'paid',
              },
            ],
          },
        })
      );

      const result = await getStakingRewards();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/staking/rewards'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }) })
      );
      expect(result).toEqual({
        enabled: true,
        rate_table: [
          { min_stake_wayz: 0, credits_per_1k_wayz_per_day: 0.01 },
          { min_stake_wayz: 10000, credits_per_1k_wayz_per_day: 0.012 },
        ],
        wallets: [{ address: '0xabc', staked_wayz: 5000, estimated_credits_per_day: 0.05 }],
        totals: { credits_paid_30d: 1.5, credits_paid_all: 9.9999, pending_credits: 0.01 },
        history: [{ reward_date: '2026-09-10', wallet_address: '0xabc', staked_wayz: 5000, credits: 0.05, status: 'paid' }],
      });
    });

    it('reports enabled:false with an empty personalized view (rewards not live yet)', async () => {
      saveApiKey('test-api-key');
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            enabled: false,
            rate_table: [{ min_stake_wayz: '0', credits_per_1k_wayz_per_day: '0.010000' }],
            wallets: [],
            totals: { credits_paid_30d: '0', credits_paid_all: '0', pending_credits: '0' },
            history: [],
          },
        })
      );

      const result = await getStakingRewards();
      expect(result.enabled).toBe(false);
      expect(result.wallets).toEqual([]);
    });

    it('maps error.context.parameter_value into RewardsApiError.detail', async () => {
      saveApiKey('test-api-key');
      mockFetch.mockResolvedValueOnce(
        createErrorResponse({ error: { message: 'Invalid request', context: { parameter_value: 'stake_sync_stale' } } }, 409)
      );

      await expect(getStakingRewards()).rejects.toMatchObject({ status: 409, detail: 'stake_sync_stale' });
    });

    it('falls back to error.message when parameter_value is absent', async () => {
      saveApiKey('test-api-key');
      mockFetch.mockResolvedValueOnce(createErrorResponse({ error: { message: 'Internal error' } }, 500));

      let caught: unknown;
      try {
        await getStakingRewards();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(RewardsApiError);
      expect(caught).toMatchObject({ status: 500, detail: 'Internal error' });
    });
  });

  describe('getWalletRewardsEstimate', () => {
    it('GETs /staking/wallets/{address} (no auth) and returns just the rewards field', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            wallet_address: '0xabc',
            staked_amount: '5000000000000000000000',
            rewards: { estimated_credits_per_day: '0.05', rate_credits_per_1k: '0.010000' },
          },
        })
      );

      const result = await getWalletRewardsEstimate('0xabc');

      expect(mockFetch).toHaveBeenCalledWith('https://api.gatewayz.ai/staking/wallets/0xabc');
      expect(result).toEqual({ estimated_credits_per_day: 0.05, rate_credits_per_1k: 0.01 });
    });

    it('defaults to all-zero when the rewards field is missing (unconfigured rate table)', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({ success: true, data: { wallet_address: '0xabc', staked_amount: '0' } })
      );

      const result = await getWalletRewardsEstimate('0xabc');
      expect(result).toEqual({ estimated_credits_per_day: 0, rate_credits_per_1k: 0 });
    });

    it('throws RewardsApiError on a non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse({ error: { message: 'not found' } }, 404));
      await expect(getWalletRewardsEstimate('0xabc')).rejects.toMatchObject({ status: 404 });
    });
  });
});
