// Display formatting shared by the public /gpu dashboard and /gpu/provider
// portal. Kept separate from public-api.ts/provider-api.ts so those stay
// pure data layers — mirrors src/lib/wayz/format.ts's split.
import { formatDistanceToNow } from 'date-fns';
import { formatUnits } from 'viem';
import type { GpuNodeStatus } from './public-api';

/** USD amount as "$1,234.56". Sub-cent amounts keep up to 4 decimals ("$0.0042") so tiny
 *  per-request earnings don't all read as "$0.00". */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const decimals = abs > 0 && abs < 0.01 ? 4 : 2;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** ETH amount from wei as a trimmed decimal, e.g. 10000000000000000n -> "0.01". */
export function formatEthWei(wei: bigint, maxDecimals = 6): string {
  const full = formatUnits(wei, 18);
  const [whole, fraction] = full.split('.');
  if (!fraction) return whole;
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/** ETH amount already in ETH units (e.g. an allocation's `allocation_eth`), trimmed. */
export function formatEth(value: number | null | undefined, maxDecimals = 6): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(maxDecimals).replace(/\.?0+$/, '') || '0';
}

/** "5 minutes ago" copy for a node's last_heartbeat_at (or the public feed's uptime window). */
export function formatHeartbeatAge(iso: string | null): string {
  if (!iso) return 'never';
  try {
    return `${formatDistanceToNow(new Date(iso), { addSuffix: true })}`;
  } catch {
    return 'unknown';
  }
}

const NODE_STATUS_LABELS: Record<GpuNodeStatus, string> = {
  registered: 'Registered',
  active: 'Active',
  degraded: 'Degraded',
  offline: 'Offline',
  disabled: 'Disabled',
};

/** Human label for a node's status enum. */
export function describeNodeStatus(status: GpuNodeStatus): string {
  return NODE_STATUS_LABELS[status] ?? status;
}
