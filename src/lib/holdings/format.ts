// Display formatting for holdings rewards.

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$1,234.56". */
export function formatUsd(value: number): string {
  return usdFormatter.format(Number.isFinite(value) ? value : 0);
}

/** Inference credits to a fixed 4 dp (small numeric(18,6) amounts); pair with tabular-nums. */
export function formatCredits(value: number): string {
  if (!Number.isFinite(value)) return '0.0000';
  return value.toFixed(4);
}

/** `0x1234...abcd`. */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
