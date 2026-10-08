// Explains why holdings rewards are or are not paying, from what
// GET /holdings/rewards exposes. The API reports the outcome (observed or not,
// value, tier, estimate, accruals) but not the accrual job's per-wallet skip
// reason, so the reasons below are inferred from that data plus the backend's
// documented rules (gatewayz-backend docs/holdings/REWARDS.md). Rules the API
// cannot confirm for this account (the inference-spend match) are listed as
// requirements, not as diagnoses.
import type { HoldingsRewards, HoldingsWallet } from './rewards-api';

/** Backend defaults (src/config/config.py). The API does not expose them; if
 *  ops changes one on Railway, the copy below goes stale, not the data. */
export const HOLDINGS_RULES = {
  /** HOLDINGS_MIN_WALLET_AGE_DAYS */
  minWalletAgeDays: 3,
  /** HOLDINGS_SNAPSHOTS_PER_DAY */
  sweepsPerDay: 4,
  /** HOLDINGS_MIN_SNAPSHOT_BATCHES_PER_DAY */
  minSweepsPerDay: 2,
  /** HOLDINGS_USAGE_LOOKBACK_DAYS */
  usageLookbackDays: 7,
  /** HOLDINGS_REWARDS_CRON_HOUR_UTC:HOLDINGS_REWARDS_CRON_MINUTE_UTC */
  accrualTimeUtc: '00:40 UTC',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type WalletStatusKind =
  | 'earning'
  | 'too_new'
  | 'not_measured'
  | 'empty'
  | 'no_tier'
  | 'zero_rate';

export interface WalletStatus {
  kind: WalletStatusKind;
  label: string;
  detail: string;
}

/**
 * Status for one wallet. `linkedAt` is the wallet's link time from
 * GET /auth/wallets (`verified_at`), used only to explain a wallet the sweep
 * has not reached yet; null when unknown.
 */
export function getWalletStatus(wallet: HoldingsWallet, linkedAt: string | null, now: Date = new Date()): WalletStatus {
  if (!wallet.observed) {
    const linkedMs = linkedAt ? Date.parse(linkedAt) : NaN;
    if (Number.isFinite(linkedMs)) {
      const eligibleMs = linkedMs + HOLDINGS_RULES.minWalletAgeDays * DAY_MS;
      if (eligibleMs > now.getTime()) {
        const daysLeft = Math.ceil((eligibleMs - now.getTime()) / DAY_MS);
        return {
          kind: 'too_new',
          label: 'Too new',
          detail: `Wallets are first measured ${HOLDINGS_RULES.minWalletAgeDays} days after linking. This one becomes eligible in about ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        };
      }
    }
    return {
      kind: 'not_measured',
      label: 'Not measured yet',
      detail: `No measurement recorded yet. Balances are measured ${HOLDINGS_RULES.sweepsPerDay} times a day; a measurement is dropped when a chain read is incomplete or a held token has no fresh price.`,
    };
  }
  if (wallet.usd_value <= 0) {
    return {
      kind: 'empty',
      label: 'No eligible tokens',
      detail: 'The latest measurement found none of the supported tokens in this wallet.',
    };
  }
  if (wallet.tier_min_usd === null) {
    return {
      kind: 'no_tier',
      label: 'Below every tier',
      detail: 'This value does not fall in any rate tier.',
    };
  }
  if (wallet.estimated_credits_per_day <= 0) {
    return {
      kind: 'zero_rate',
      label: 'Rate is 0',
      detail: 'The rate for this tier is currently 0 credits.',
    };
  }
  return {
    kind: 'earning',
    label: 'Eligible',
    detail: 'Measured and in a paying tier.',
  };
}

export type BlockerKind =
  | 'disabled'
  | 'no_wallets'
  | 'no_rate'
  | 'no_wallet_earning'
  | 'cap_reached'
  | 'awaiting_first_accrual'
  | 'usage_required';

export interface Blocker {
  kind: BlockerKind;
  title: string;
  detail: string;
  /** 'blocking' = nothing pays until fixed; 'info' = a rule that may limit payment. */
  severity: 'blocking' | 'info';
}

/**
 * Account-level reasons, most blocking first. `walletStatuses` must be in the
 * same order as `data.wallets`.
 */
export function getHoldingsBlockers(data: HoldingsRewards, walletStatuses: WalletStatus[]): Blocker[] {
  const blockers: Blocker[] = [];

  if (!data.enabled) {
    blockers.push({
      kind: 'disabled',
      title: 'Holdings rewards are switched off',
      detail: 'The platform is not accruing holdings rewards right now. Nothing is paid until they are switched on.',
      severity: 'blocking',
    });
  }

  if (data.wallets.length === 0) {
    blockers.push({
      kind: 'no_wallets',
      title: 'No linked wallets',
      detail: 'Only wallets linked to your account are measured. Link one on the Rewards page.',
      severity: 'blocking',
    });
  }

  const anyPayingTier = data.rate_table.some((t) => t.credits_per_1k_usd_per_day > 0);
  if (!anyPayingTier) {
    blockers.push({
      kind: 'no_rate',
      title: 'No reward rate is set',
      detail: 'Every rate tier currently pays 0 credits.',
      severity: 'blocking',
    });
  }

  if (data.wallets.length > 0 && anyPayingTier && !walletStatuses.some((s) => s.kind === 'earning')) {
    blockers.push({
      kind: 'no_wallet_earning',
      title: 'No wallet is in a paying state yet',
      detail: 'See the status of each wallet below.',
      severity: 'blocking',
    });
  }

  if (data.account_estimate.uncapped_credits_per_day > data.account_estimate.estimated_credits_per_day) {
    blockers.push({
      kind: 'cap_reached',
      title: 'Daily cap applies',
      detail: `Your holdings would earn more than the per-account daily cap of ${data.daily_cap_credits} credits, so the estimate is capped.`,
      severity: 'info',
    });
  }

  const hasPaid = data.history.some((row) => row.status === 'paid');
  if (data.enabled && !hasPaid && walletStatuses.some((s) => s.kind === 'earning')) {
    blockers.push({
      kind: 'awaiting_first_accrual',
      title: 'Waiting for the first accrual',
      detail: `Accruals run daily at ${HOLDINGS_RULES.accrualTimeUtc} for the previous day, and a day needs at least ${HOLDINGS_RULES.minSweepsPerDay} completed measurements to count.`,
      severity: 'info',
    });
  }

  blockers.push({
    kind: 'usage_required',
    title: 'Credits match your inference spend',
    detail: `Each day's credits are capped by what your account spent on inference over the last ${HOLDINGS_RULES.usageLookbackDays} days, minus holdings credits already granted in that window. An account with no inference spend earns nothing.`,
    severity: 'info',
  });

  return blockers;
}
