/**
 * Staking → inference catalogue.
 *
 * TWO MODELS, NEVER PRESENTED AS ONE:
 *   non-custodial — ADA only. Cardano delegation keeps the asset in the user's
 *                   wallet. We cannot move, freeze, spend or lose it.
 *   custodial     — everything else. The user transfers the asset to us and we
 *                   stake it through a provider. We hold it; it can be lost.
 *
 * `nativeApy` is what the asset earns. `offered` is what we pay — a RATE CARD,
 * not a pass-through, with ADA highest to steer toward the non-custodial option.
 * ADA and ETH are therefore subsidised from the spread on ATOM/DOT/SOL/AVAX, so
 * the book only works if it is not mostly ADA. See `blendedSpread`.
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
  offered: number;
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
    nativeApy: 0.02693, offered: 0.05, yieldVerified: true, chain: "Cardano",
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
    nativeApy: 0.03, offered: 0.045, yieldVerified: false, chain: "Ethereum",
    unbonding: "exit queue, variable",
    blurb: "Staked through an institutional provider. We take custody to do so.",
    provider: "institutional staking provider (to be selected)",
    risks: ["we hold your ETH", "provider counterparty risk", "validator slashing",
            "the exit queue can delay withdrawal"],
  },
  {
    symbol: "SOL", name: "Solana", model: "custodial",
    nativeApy: 0.065, offered: 0.045, yieldVerified: false, chain: "Solana",
    unbonding: "~2–3 days",
    blurb: "Staked through an institutional validator. We take custody to do so.",
    provider: "institutional validator (to be selected)",
    risks: ["we hold your SOL", "validator counterparty risk", "slashing"],
  },
  {
    symbol: "DOT", name: "Polkadot", model: "custodial",
    nativeApy: 0.11, offered: 0.045, yieldVerified: false, chain: "Polkadot",
    unbonding: "28 days",
    blurb: "Nominated staking through a provider. We take custody to do so.",
    provider: "institutional nominator (to be selected)",
    risks: ["we hold your DOT", "28-day unbonding — you cannot exit the chain quickly",
            "slashing"],
  },
  {
    symbol: "ATOM", name: "Cosmos", model: "custodial",
    nativeApy: 0.14, offered: 0.045, yieldVerified: false, chain: "Cosmos Hub",
    unbonding: "21 days",
    blurb: "Delegated through a provider. We take custody to do so.",
    provider: "institutional validator (to be selected)",
    risks: ["we hold your ATOM", "21-day unbonding", "slashing"],
  },
  {
    symbol: "AVAX", name: "Avalanche", model: "custodial",
    nativeApy: 0.07, offered: 0.045, yieldVerified: false, chain: "Avalanche",
    unbonding: "fixed staking period",
    blurb: "Staked through a provider. We take custody to do so.",
    provider: "institutional validator (to be selected)",
    risks: ["we hold your AVAX", "funds are locked for the staking period"],
  },
  {
    symbol: "USDC", name: "USD Coin", model: "custodial",
    nativeApy: 0.04, offered: 0.04, yieldVerified: false, chain: "multi-chain",
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
    nativeApy: 0.04, offered: 0.04, yieldVerified: false, chain: "multi-chain",
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

/** Commitment tiers. Longer commitment → smaller idle liquidity buffer → lower fee. */
export const TIERS = [
  { label: "0–3 months", months: 0, fee: 0.15 },
  { label: "3–12 months", months: 3, fee: 0.10 },
  { label: "12+ months", months: 12, fee: 0.05 },
];

export function discountBudget(amountUsd: number, t: StakingToken, months = 12) {
  const tier = [...TIERS].reverse().find((x) => months >= x.months) ?? TIERS[0];
  const gross = amountUsd * t.offered;
  return {
    tier, fee: tier.fee,
    grossUsd: gross,
    budgetUsd: gross * (1 - tier.fee),
    perMonthUsd: (gross * (1 - tier.fee)) / 12,
  };
}

/** Native minus offered. Negative = we subsidise it. */
export const spread = (t: StakingToken) => t.nativeApy - t.offered;

/** Blended spread for a book that is `adaShare` ADA, remainder split evenly. */
export function blendedSpread(adaShare: number) {
  const ada = bySymbol("ADA")!;
  const others = TOKENS.filter((t) => t.symbol !== "ADA");
  const rest = (1 - adaShare) / others.length;
  return adaShare * spread(ada) + others.reduce((a, t) => a + rest * spread(t), 0);
}
