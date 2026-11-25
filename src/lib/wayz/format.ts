// WAYZ amount formatting for the GPU / emission pages.
import { formatUnits } from 'viem';

/** Formats a wei bigint as a trimmed WAYZ amount (e.g. "123.4", not "123.400000000000000000"). */
export function formatWayz(wei: bigint, maxDecimals = 4): string {
  const full = formatUnits(wei, 18);
  const [whole, fraction] = full.split('.');
  if (!fraction) return whole;
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/** Formats a plain (non-wei) WAYZ amount — a config value like a daily emission target or a
 *  provider's next-epoch allocation estimate — to a fixed 4 decimal places.
 *  Pair with `tabular-nums` in the caller's className so a column of these lines up. */
export function formatWayzAmount(value: number): string {
  if (!Number.isFinite(value)) return '0.0000';
  return value.toFixed(4);
}

/** Formats a basis-points integer (0-10000) as a percent string, e.g. 4100 -> "41.00%"
 *  (the emission split's `*_bps` fields — scratchpad/emission/spec.md §API). */
export function formatBps(bps: number): string {
  if (!Number.isFinite(bps)) return '0.00%';
  return `${(bps / 100).toFixed(2)}%`;
}

/** Formats a 0..1 fraction (e.g. a provider's `score.share`) as a
 *  percent string, e.g. 0.1234 -> "12.34%". */
export function formatFractionPercent(value: number): string {
  if (!Number.isFinite(value)) return '0.00%';
  return `${(value * 100).toFixed(2)}%`;
}
