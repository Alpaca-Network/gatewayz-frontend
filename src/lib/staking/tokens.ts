/**
 * Staking → inference catalogue.
 *
 * TWO MODELS, NEVER PRESENTED AS ONE:
 *   non-custodial — ADA only. Cardano delegation keeps the asset in the user's
 *                   wallet. We cannot move, freeze, spend or lose it.
 *   custodial     — everything else. The user transfers the asset to us and we
 *                   stake it through a provider. We hold it; it can be lost.
 *
 * PRICING IS PASS-THROUGH: the asset's own yield, minus our fee.
 *
 * An earlier version used a near-flat rate card with ADA highest. It does not
 * work — ADA earns 2.69% natively and ATOM 14%, so "ADA highest" is a SUBSIDY by
 * construction, and that book stopped making money once ADA passed 54.1% of it,
 * which is exactly where recommending ADA drives it.
 *
 * ADA'S FEE IS THE LOWEST AND IT IS COST-JUSTIFIED, not promotional:
 * non-custodial means no custody infrastructure, no insurance and no idle
 * liquidity buffer, so ADA genuinely costs us less to serve. The pitch is
 * therefore "you keep 95% of what you earn", not a headline rate — ADA is the
 * best DEAL even though Cardano cannot pay the highest RATE.
 *
 * ⚠️ Only ADA's nativeApy is measured by us (2.693%, median of 12 mainnet pools,
 * epochs 630–653). Every other figure is INDICATIVE and must be sourced before
 * this page is promoted.
 */
export type StakingModel = "non-custodial" | "custodial";

export interface StakingToken {
  symbol: string;
  name: string;
  model: StakingModel;
  nativeApy: number;
  yieldVerified: boolean;
  chain: string;
  unbonding: string;
  blurb: string;
  provider?: string;
  risks: string[];
}

export const TOKENS: StakingToken[] = [
  {
    symbol: "ADA", name: "Cardano", model: "non-custodial",
    nativeApy: 0.02693, yieldVerified: true, chain: "Cardano",
    unbonding: "none — re-delegate any epoch",
    blurb:
      "The only asset here where your principal never moves. Cardano delegation is non-custodial by protocol design, so we never hold it.",
    risks: [
      "a pool may mint no blocks in an epoch, so rewards can be zero",
      "the ADA price affects the dollar value of the discount funded",
    ],
  },
  {
    symbol: "ETH", name: "Ethereum", model: "custodial",
    nativeApy: 0.03, yieldVerified: false, chain: "Ethereum",
    unbonding: "exit queue, variable",
    blurb: "Staked through an institutional provider. We take custody to do so.",
    provider: "institutional staking provider (to be selected)",
    risks: ["we hold your ETH", "provider counterparty risk", "validator slashing",
            "the exit queue can delay withdrawal"],
  },
  {
    symbol: "SOL", name: "Solana", model: "custodial",
    nativeApy: 0.065, yieldVerified: false, chain: "Solana",
    unbonding: "~2–3 days",
    blurb: "Staked through an institutional validator. We take custody to do so.",
    provider: "institutional validator (to be selected)",
    risks: ["we hold your SOL", "validator counterparty risk", "slashing"],
  },
  {
    symbol: "DOT", name: "Polkadot", model: "custodial",
    nativeApy: 0.11, yieldVerified: false, chain: "Polkadot",
    unbonding: "28 days",
    blurb: "Nominated staking through a provider. We take custody to do so.",
    provider: "institutional nominator (to be selected)",
    risks: ["we hold your DOT", "28-day unbonding — you cannot exit the chain quickly",
            "slashing"],
  },
  {
    symbol: "ATOM", name: "Cosmos", model: "custodial",
    nativeApy: 0.14, yieldVerified: false, chain: "Cosmos Hub",
    unbonding: "21 days",
    blurb: "Delegated through a provider. We take custody to do so.",
    provider: "institutional validator (to be selected)",
    risks: ["we hold your ATOM", "21-day unbonding", "slashing"],
  },
  {
    symbol: "AVAX", name: "Avalanche", model: "custodial",
    nativeApy: 0.07, yieldVerified: false, chain: "Avalanche",
    unbonding: "fixed staking period",
    blurb: "Staked through a provider. We take custody to do so.",
    provider: "institutional validator (to be selected)",
    risks: ["we hold your AVAX", "funds are locked for the staking period"],
  },
  {
    symbol: "USDC", name: "USD Coin", model: "custodial",
    nativeApy: 0.04, yieldVerified: false, chain: "multi-chain",
    unbonding: "venue-dependent",
    blurb:
      "Staked into a stablecoin liquidity pool, paired against another stablecoin so there is no meaningful price divergence and impermanent loss is negligible. Yield comes from trading fees and pool incentives.",
    provider: "established stablecoin liquidity pool (to be selected)",
    risks: ["we hold your USDC",
            "pool smart-contract risk — an exploit can lose principal",
            "yield depends on trading volume and incentives, and can fall",
            "a depeg on either side of the pair reintroduces impermanent loss"],
  },
  {
    symbol: "USDT", name: "Tether", model: "custodial",
    nativeApy: 0.04, yieldVerified: false, chain: "multi-chain",
    unbonding: "venue-dependent",
    blurb:
      "As USDC: staked into a stablecoin liquidity pool, earning trading fees and incentives with negligible impermanent loss while both sides hold their peg.",
    provider: "established stablecoin liquidity pool (to be selected)",
    risks: ["we hold your USDT",
            "pool smart-contract risk — an exploit can lose principal",
            "yield depends on trading volume and incentives, and can fall",
            "a depeg on either side of the pair reintroduces impermanent loss"],
  },
];

export const bySymbol = (s: string) =>
  TOKENS.find((t) => t.symbol.toLowerCase() === s.toLowerCase());

/** Commitment tiers. Longer commitment → smaller idle buffer → lower fee. */
export const TIERS = [
  { label: "0–3 months", months: 0, ada: 0.10, other: 0.20 },
  { label: "3–12 months", months: 3, ada: 0.07, other: 0.15 },
  { label: "12+ months", months: 12, ada: 0.05, other: 0.10 },
];

export function feeFor(t: StakingToken, months = 0) {
  const tier = [...TIERS].reverse().find((x) => months >= x.months) ?? TIERS[0];
  return t.symbol === "ADA" ? tier.ada : tier.other;
}

/** What the user receives: the asset's own yield, minus our fee. */
export const offeredRate = (t: StakingToken, months = 0) =>
  t.nativeApy * (1 - feeFor(t, months));

export function discountBudget(amountUsd: number, t: StakingToken, months = 12) {
  const fee = feeFor(t, months);
  const gross = amountUsd * t.nativeApy;
  return {
    fee,
    userKeeps: 1 - fee,
    offeredRate: t.nativeApy * (1 - fee),
    grossUsd: gross,
    budgetUsd: gross * (1 - fee),
    perMonthUsd: (gross * (1 - fee)) / 12,
  };
}

/**
 * Blended margin for a book that is `adaShare` ADA, remainder split evenly.
 * Under pass-through every asset carries a positive margin, so this is positive
 * at EVERY mix. Kept as a regression guard: a negative means someone has
 * reintroduced a subsidy.
 */
export function blendedMargin(adaShare: number, months = 12) {
  const ada = bySymbol("ADA")!;
  const others = TOKENS.filter((t) => t.symbol !== "ADA");
  const rest = (1 - adaShare) / others.length;
  return (
    adaShare * ada.nativeApy * feeFor(ada, months) +
    others.reduce((a, t) => a + rest * t.nativeApy * feeFor(t, months), 0)
  );
}
