// Display formatting for the /staking dashboard. Kept separate from
// staking-api.ts/contract-reads.ts so those stay pure data layers — this is
// the only place that turns a bigint/ISO-string into copy a user reads.
import { formatUnits } from 'viem';
import { formatDistanceToNow } from 'date-fns';

/** Formats a wei bigint as a trimmed WAYZ amount (e.g. "123.4", not "123.400000000000000000"). */
export function formatWayz(wei: bigint, maxDecimals = 4): string {
  const full = formatUnits(wei, 18);
  const [whole, fraction] = full.split('.');
  if (!fraction) return whole;
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/** "synced 3 minutes ago" copy for the indexer's last_synced_at. */
export function formatSyncedAt(iso: string | null): string {
  if (!iso) return 'never synced';
  try {
    return `synced ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`;
  } catch {
    return 'sync status unknown';
  }
}

/** "7 days" copy for UNSTAKE_COOLDOWN() / unstake_cooldown_seconds. */
export function formatCooldownDuration(seconds: number): string {
  if (!seconds) return '—';
  const days = Math.round(seconds / 86400);
  if (days >= 1) return days === 1 ? '1 day' : `${days} days`;
  const hours = Math.round(seconds / 3600);
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

/** Countdown copy to a pending unstake's `unlockAt` (unix seconds, as returned by the contract). */
export function formatCountdown(unlockAtSeconds: bigint, nowMs: number = Date.now()): string {
  const unlockMs = Number(unlockAtSeconds) * 1000;
  const remainingMs = unlockMs - nowMs;
  if (remainingMs <= 0) return 'Ready to withdraw';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}
