"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStakingSummary } from '@/lib/hooks/use-wayz-staking';
import { isWayzConfigured } from '@/lib/wayz/addresses';
import { formatWayz, formatSyncedAt, formatCooldownDuration } from '@/lib/wayz/format';
import { StatTile } from './stat-tile';

export function StakingHeader() {
  const configured = isWayzConfigured();
  const summaryQuery = useStakingSummary();
  const data = summaryQuery.data;

  return (
    <div className="flex flex-col gap-4">
      {!configured && (
        <div className="rounded-[12px] border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          Testnet contracts not deployed yet. Staking and the faucet will unlock once WAYZ launches on Avalanche
          Fuji.
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>WAYZ Staking</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile
            label="Total staked"
            loading={summaryQuery.isLoading}
            value={data ? `${formatWayz(data.total_staked)} WAYZ` : '—'}
          />
          <StatTile
            label="Wallets staking"
            loading={summaryQuery.isLoading}
            value={data ? data.wallet_count.toLocaleString() : '—'}
          />
          <StatTile
            label="Unstake cooldown"
            loading={summaryQuery.isLoading}
            value={data ? formatCooldownDuration(data.unstake_cooldown_seconds) : '—'}
          />
          <StatTile
            label="Indexer status"
            loading={summaryQuery.isLoading}
            value={data ? formatSyncedAt(data.last_synced_at) : '—'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
