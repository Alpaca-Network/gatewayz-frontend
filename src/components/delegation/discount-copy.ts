// User-facing copy for the v3 inference discount (payout_model "reward_share").
// __tests__/discount-language.test.ts keeps this file and the discount
// components free of words that would describe the discount as something it
// is not (a rate of return on the stake). Numbers come from the backend; when
// one is missing the sentence falls back to wording without it.
import type { DelegationStatus } from '@/lib/delegation/api';
import { formatFractionPercent, payShareOfList } from '@/lib/delegation/discount-format';

export const DISCOUNT_ANCHOR = 'inference-discount';
export const DISCOUNT_TITLE = 'Inference discount';

function shareText(rewardShare: number | null | undefined): string {
  return typeof rewardShare === 'number' ? formatFractionPercent(rewardShare) : 'a share';
}

/** "You pay 1% of the list price until your balance runs out", or null without a usable discount_percent. */
export function payLine(discountPercent: number | null | undefined): string | null {
  const pay = payShareOfList(discountPercent);
  return pay === null ? null : `You pay ${formatFractionPercent(pay)} of the list price until your balance runs out.`;
}

export function rewardShareDescription(status: DelegationStatus): string {
  return `Stake ETH or ADA from your own wallet and get ${shareText(status.reward_share)} of the staking rewards it brings Gatewayz back as an inference discount.`;
}

/** The middle explainer points on /rewards when payout_model is "reward_share". */
export function rewardSharePoints(status: DelegationStatus): { title: string; detail: string }[] {
  const pay = payShareOfList(status.discount_percent);
  return [
    {
      title: 'Rewards come back as a discount',
      detail: `Gatewayz receives the staking rewards your stake brings in and puts ${shareText(status.reward_share)} of them on your account as an inference discount balance.`,
    },
    {
      title: 'Pay less for each request',
      detail:
        pay === null
          ? 'While your balance lasts, part of each request is paid from it instead of from your credits.'
          : `While your balance lasts, each request costs you ${formatFractionPercent(pay)} of the list price; the rest is paid from your discount balance.`,
    },
  ];
}

export function rewardShareFootnote(status: DelegationStatus, showVaultFee: boolean): string {
  const fee =
    showVaultFee && status.eth.fee_percent !== null
      ? ` The ETH vault takes a ${status.eth.fee_percent}% fee on staking rewards; that is how Gatewayz receives the rewards your discount comes from.`
      : '';
  return `Your discount depends on the staking rewards your stake actually brings in, which vary and can be zero. Gatewayz sets these terms and can change or stop them.${fee}`;
}

const ATTRIBUTION_STATUS: Record<string, string> = { pending: 'Pending', granted: 'Added', void: 'Void' };
const HISTORY_KIND: Record<string, string> = {
  grant: 'Added from staking rewards',
  use: 'Used on inference',
  adjust: 'Adjustment',
  reverse: 'Reversed',
};

export function attributionStatusLabel(status: string): string {
  return ATTRIBUTION_STATUS[status] ?? status;
}

export function historyKindLabel(kind: string): string {
  return HISTORY_KIND[kind] ?? kind;
}
