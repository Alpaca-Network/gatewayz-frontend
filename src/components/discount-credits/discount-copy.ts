// User-facing copy for discount credits. The product name in every string is
// "discount credits"; __tests__/discount-language.test.ts keeps this file and
// the components free of other names for it and of words that would describe
// it as a rate of return. Numbers come from the backend; when one is missing
// the sentence falls back to wording without it.
import { formatSharePercent, payShareOfList } from '@/lib/discount-credits/format';

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
