import { parseHoldingsRewards, type HoldingsWallet } from '../rewards-api';
import { getHoldingsBlockers, getWalletStatus, HOLDINGS_RULES } from '../status';
import { RAW_HOLDINGS_REWARDS } from './fixtures';

const NOW = new Date('2026-10-05T12:00:00Z');

const wallet = (overrides: Partial<HoldingsWallet> = {}): HoldingsWallet => ({
  address: '0xabc',
  usd_value: 2000,
  observed: true,
  tier_min_usd: 1000,
  estimated_credits_per_day: 0.6,
  uncapped_credits_per_day: 0.6,
  rate_credits_per_1k_usd: 0.3,
  min_usd: 1000,
  ...overrides,
});

describe('getWalletStatus', () => {
  it('flags a wallet younger than the minimum age with time left', () => {
    const status = getWalletStatus(wallet({ observed: false, usd_value: 0 }), '2026-10-04T12:00:00Z', NOW);
    expect(status.kind).toBe('too_new');
    expect(status.detail).toContain(`${HOLDINGS_RULES.minWalletAgeDays} days after linking`);
    expect(status.detail).toContain('about 2 days');
  });

  it('says not measured when old enough but no sweep has recorded it', () => {
    expect(getWalletStatus(wallet({ observed: false }), '2026-09-01T00:00:00Z', NOW).kind).toBe('not_measured');
    expect(getWalletStatus(wallet({ observed: false }), null, NOW).kind).toBe('not_measured');
  });

  it('distinguishes an empty wallet, no tier, and a zero rate', () => {
    expect(getWalletStatus(wallet({ usd_value: 0 }), null, NOW).kind).toBe('empty');
    expect(getWalletStatus(wallet({ tier_min_usd: null }), null, NOW).kind).toBe('no_tier');
    expect(getWalletStatus(wallet({ estimated_credits_per_day: 0 }), null, NOW).kind).toBe('zero_rate');
  });

  it('reports a measured wallet in a paying tier as earning', () => {
    expect(getWalletStatus(wallet(), null, NOW).kind).toBe('earning');
  });
});

describe('getHoldingsBlockers', () => {
  const base = parseHoldingsRewards(RAW_HOLDINGS_REWARDS);
  const kinds = (data = base, statuses = data.wallets.map((w) => getWalletStatus(w, null, NOW))) =>
    getHoldingsBlockers(data, statuses).map((b) => b.kind);

  it('only lists the inference-spend rule for a healthy, already-paid account', () => {
    expect(kinds()).toEqual(['usage_required']);
  });

  it('blocks when the feature is off', () => {
    expect(kinds({ ...base, enabled: false })).toContain('disabled');
  });

  it('blocks when no wallets are linked', () => {
    expect(kinds({ ...base, wallets: [] }, [])).toContain('no_wallets');
  });

  it('blocks when every tier pays 0', () => {
    const data = { ...base, rate_table: base.rate_table.map((t) => ({ ...t, credits_per_1k_usd_per_day: 0 })) };
    expect(kinds(data)).toContain('no_rate');
  });

  it('blocks when no wallet is in a paying state', () => {
    const data = { ...base, wallets: [wallet({ observed: false })] };
    expect(kinds(data)).toContain('no_wallet_earning');
  });

  it('notes the daily cap when the uncapped estimate exceeds it', () => {
    const data = {
      ...base,
      account_estimate: { ...base.account_estimate, estimated_credits_per_day: 50, uncapped_credits_per_day: 80 },
    };
    expect(kinds(data)).toContain('cap_reached');
  });

  it('notes the first accrual is pending when earning but nothing has been paid', () => {
    expect(kinds({ ...base, history: [] })).toContain('awaiting_first_accrual');
  });
});
