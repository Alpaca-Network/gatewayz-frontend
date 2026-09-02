"use client";

import type { Address } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWalletStaking, useOnchainStakingState } from '@/lib/hooks/use-wayz-staking';
import { formatWayz, formatSyncedAt } from '@/lib/wayz/format';
import { StatTile } from './stat-tile';

export function BalancesCard({ address }: { address: Address }) {
  const walletQuery = useWalletStaking(address);
  const onchainQuery = useOnchainStakingState(address);

  const loading = onchainQuery.isLoading;
  const balance = onchainQuery.data?.tokenBalance;
  // Prefer the live on-chain read; fall back to the indexer's last-synced value.
  const staked = onchainQuery.data?.stakedBalance ?? walletQuery.data?.staked_amount;
  const allowance = walletQuery.data?.daily_allowance;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Balances</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="WAYZ balance" loading={loading} value={balance !== undefined ? `${formatWayz(balance)} WAYZ` : '—'} />
        <StatTile label="Staked" loading={loading} value={staked !== undefined ? `${formatWayz(staked)} WAYZ` : '—'} />
        <StatTile
          label="Daily inference allowance"
          loading={walletQuery.isLoading}
          value={allowance !== undefined ? `${formatWayz(allowance)} WAYZ` : '—'}
        />
      </CardContent>
      <p className="px-6 pb-4 text-xs text-muted-foreground">
        {walletQuery.data ? formatSyncedAt(walletQuery.data.last_synced_at) : 'awaiting first sync'} — the daily
        allowance refreshes roughly every 15 minutes via the indexer.
      </p>
    </Card>
  );
}
