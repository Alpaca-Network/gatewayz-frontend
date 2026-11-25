// User-facing copy for discount credits. The product name in every string is
// "discount credits"; __tests__/discount-language.test.ts keeps this file and
// the components free of other names for it and of words that would describe
// it as a rate of return. Numbers come from the backend; when one is missing
// the sentence falls back to wording without it.
import { formatDiscountUsd, formatSharePercent, payShareOfList } from '@/lib/discount-credits/format';

export const DISCOUNT_ANCHOR = 'discount-credits';
export const DISCOUNT_TITLE = 'Discount credits';
export const DISCOUNT_DESCRIPTION = 'Discount credits lower the price of your requests while your balance lasts.';
export const BALANCE_IN_USE_FALLBACK = 'Part of each request is paid from this balance until it runs out.';
export const BALANCE_EMPTY = 'Your balance is empty, so requests are charged at the list price.';

/** "You pay 1% of the list price until your balance runs out", or null without a usable discount_percent. */
export function payLine(discountPercent: number | null | undefined): string | null {
  const pay = payShareOfList(discountPercent);
  return pay === null ? null : `You pay ${formatSharePercent(pay)} of the list price until your balance runs out.`;
}

const HISTORY_KIND: Record<string, string> = {
  grant: 'Added',
  use: 'Used on requests',
  adjust: 'Adjustment',
  reverse: 'Reversed',
};

export function historyKindLabel(kind: string): string {
  return HISTORY_KIND[kind] ?? kind;
}

// Daily limit: how much of the balance can be used per UTC calendar day.
export const DAILY_LIMIT_TITLE = 'Daily limit';
export const DAILY_LIMIT_RESETS = 'Resets at 00:00 UTC';
export const DAILY_LIMIT_INPUT_LABEL = 'Daily limit (USD)';
export const DAILY_LIMIT_SAVE = 'Save';
export const DAILY_LIMIT_HELP =
  'Lowering the limit applies now. Raising it applies from the next day (UTC). When the limit is reached, requests continue and are billed to your paid balance.';
export const DAILY_LIMIT_SAVED_NOW = 'Daily limit updated.';
export const DAILY_LIMIT_SAVED_SCHEDULED = 'Your higher limit starts at 00:00 UTC.';
export const DAILY_LIMIT_SAVE_FAILED = 'The daily limit could not be saved. Try again.';
export const DAILY_LIMIT_INVALID = 'Enter an amount from 0 to 1,000,000, with up to 6 decimal places.';

/** "$12.50 of $50.00 used today" */
export function dailyLimitUsedLine(usedUsd: number, capUsd: number): string {
  return `${formatDiscountUsd(usedUsd)} of ${formatDiscountUsd(capUsd)} used today`;
}

/** "Changes to $80.00 on Nov 26, 2026 (UTC)"; without a usable date, "Changes to $80.00 at 00:00 UTC". */
export function dailyLimitPendingLine(nextUsd: number, fromDate: string | null): string {
  const date = fromDate ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? `${fromDate}T00:00:00Z` : fromDate) : null;
  if (!date || Number.isNaN(date.getTime())) return `Changes to ${formatDiscountUsd(nextUsd)} at 00:00 UTC`;
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `Changes to ${formatDiscountUsd(nextUsd)} on ${day} (UTC)`;
}
