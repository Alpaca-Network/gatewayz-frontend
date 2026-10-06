// Mirrors GET /holdings/rewards in gatewayz-backend src/routes/holdings.py:
// every number is a string (Decimal -> str), tier_min_usd is null when no tier
// matches, and `observed` is false until a sweep has measured the wallet.
export const RAW_HOLDINGS_REWARDS = {
  enabled: true,
  rate_table: [
    { min_usd: '1000', credits_per_1k_usd_per_day: '0.30' },
    { min_usd: '0', credits_per_1k_usd_per_day: '0.20' },
  ],
  daily_cap_credits: '50.0',
  total_usd_value: '2500.50',
  account_estimate: {
    estimated_credits_per_day: '0.750150',
    uncapped_credits_per_day: '0.750150',
    rate_credits_per_1k_usd: '0.30',
    min_usd: '1000',
  },
  wallets: [
    {
      address: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
      usd_value: '2500.50',
      observed: true,
      tier_min_usd: '1000',
      estimated_credits_per_day: '0.750150',
      uncapped_credits_per_day: '0.750150',
      rate_credits_per_1k_usd: '0.30',
      min_usd: '1000',
    },
    {
      address: '0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb',
      usd_value: '0',
      observed: false,
      tier_min_usd: '0',
      estimated_credits_per_day: '0',
      uncapped_credits_per_day: '0',
      rate_credits_per_1k_usd: '0.20',
      min_usd: '0',
    },
  ],
  totals: { credits_paid_30d: '1.500000', credits_paid_all: '3.250000', pending_credits: '0.100000' },
  history: [
    {
      reward_date: '2026-10-03',
      wallet_address: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
      usd_basis: '2400.00',
      credits: '0.720000',
      status: 'paid',
    },
    {
      reward_date: '2026-10-04',
      wallet_address: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
      usd_basis: '2450.00',
      credits: '0.100000',
      status: 'pending',
    },
  ],
};
