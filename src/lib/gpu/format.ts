// Display formatting shared by the public /gpu dashboard and /gpu/provider
// portal. Kept separate from public-api.ts/provider-api.ts so those stay
// pure data layers — mirrors src/lib/wayz/format.ts's split.
import { formatDistanceToNow } from 'date-fns';
import type { GpuNodeStatus } from './public-api';

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
