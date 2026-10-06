import { getHoldingsRewards, HoldingsApiError, parseHoldingsRewards } from '../rewards-api';
import { createErrorResponse, createSuccessResponse, setupFetchMock } from '@/__tests__/utils/mock-fetch';
import { saveApiKey } from '@/lib/api';
import { RAW_HOLDINGS_REWARDS } from './fixtures';

describe('holdings rewards-api', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockFetch = setupFetchMock();
  });

  it('GETs /holdings/rewards with a Bearer token and parses string numbers', async () => {
    saveApiKey('test-api-key');
    mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true, data: RAW_HOLDINGS_REWARDS }));

    const result = await getHoldingsRewards();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/holdings/rewards'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }) })
    );
    expect(result.enabled).toBe(true);
    expect(result.daily_cap_credits).toBe(50);
    expect(result.total_usd_value).toBe(2500.5);
    expect(result.account_estimate).toEqual({
      estimated_credits_per_day: 0.75015,
      uncapped_credits_per_day: 0.75015,
      rate_credits_per_1k_usd: 0.3,
      min_usd: 1000,
    });
    expect(result.wallets[0]).toEqual({
      address: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
      usd_value: 2500.5,
      observed: true,
      tier_min_usd: 1000,
      estimated_credits_per_day: 0.75015,
      uncapped_credits_per_day: 0.75015,
      rate_credits_per_1k_usd: 0.3,
      min_usd: 1000,
    });
    expect(result.wallets[1].observed).toBe(false);
    expect(result.totals).toEqual({ credits_paid_30d: 1.5, credits_paid_all: 3.25, pending_credits: 0.1 });
    expect(result.history[0]).toEqual({
      reward_date: '2026-10-03',
      wallet_address: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
      usd_basis: 2400,
      credits: 0.72,
      status: 'paid',
    });
  });

  it('sorts the rate table by floor', () => {
    const result = parseHoldingsRewards(RAW_HOLDINGS_REWARDS);
    expect(result.rate_table.map((t) => t.min_usd)).toEqual([0, 1000]);
  });

  it('keeps a null tier_min_usd as null and tolerates a missing payload', () => {
    const result = parseHoldingsRewards({
      wallets: [{ address: '0xabc', usd_value: '5', observed: true, tier_min_usd: null }],
    });
    expect(result.wallets[0].tier_min_usd).toBeNull();
    expect(result.enabled).toBe(false);
    expect(parseHoldingsRewards(undefined).wallets).toEqual([]);
  });

  it('maps a FastAPI {detail} error into HoldingsApiError', async () => {
    saveApiKey('test-api-key');
    mockFetch.mockResolvedValueOnce(createErrorResponse({ detail: 'Service unavailable' }, 503));

    let caught: unknown;
    try {
      await getHoldingsRewards();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HoldingsApiError);
    expect(caught).toMatchObject({ status: 503, detail: 'Service unavailable' });
  });
});
