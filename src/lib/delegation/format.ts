import { formatEther, parseEther } from 'viem';

/** Wei -> "1.2345 ETH" (up to 6 decimals, trailing zeros trimmed). */
export function formatEth(wei: bigint, maxDecimals = 6): string {
  const [whole, fraction = ''] = formatEther(wei).split('.');
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, '');
  return `${whole}${trimmed ? `.${trimmed}` : ''} ETH`;
}

/** Lovelace -> "12.5 ADA". */
export function formatAda(lovelace: bigint): string {
  const whole = lovelace / BigInt(1_000_000);
  const fraction = (lovelace % BigInt(1_000_000)).toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''} ADA`;
}

/** User-typed ETH amount -> wei; null for empty, malformed, zero or negative input. */
export function parseEthInput(input: string): bigint | null {
  const value = input.trim();
  if (!/^\d*\.?\d+$|^\d+\.$/.test(value)) return null;
  try {
    const wei = parseEther(value.endsWith('.') ? value.slice(0, -1) : value);
    return wei > BigInt(0) ? wei : null;
  } catch {
    return null;
  }
}

export function formatDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
