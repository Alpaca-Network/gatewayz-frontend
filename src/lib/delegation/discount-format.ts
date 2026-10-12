// Display helpers for the v3 inference discount. Kept apart from ./format so
// the Settings -> Credits balance line does not pull in viem.

const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdMicros = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 });

/**
 * Discount amounts are numeric(38,6): a single request can use $0.000123, so
 * sub-cent values keep up to 6 decimals instead of rounding to "$0.00".
 */
export function formatDiscountUsd(value: number): string {
  if (!Number.isFinite(value)) return usdCents.format(0);
  return Math.abs(value) > 0 && Math.abs(value) < 0.01 ? usdMicros.format(value) : usdCents.format(value);
}

/** 0.99 -> "99%", 0.955 -> "95.5%"; floating noise (1 - 0.99) is rounded away. */
export function formatFractionPercent(fraction: number): string {
  return `${Number((fraction * 100).toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

/**
 * The share of the list price the user still pays while their balance lasts:
 * (1 - discount_percent). Null when the backend did not send a usable value.
 */
export function payShareOfList(discountPercent: number | null | undefined): number | null {
  if (typeof discountPercent !== 'number' || !Number.isFinite(discountPercent)) return null;
  if (discountPercent < 0 || discountPercent > 1) return null;
  return 1 - discountPercent;
}
