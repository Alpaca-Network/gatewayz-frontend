"use client";

// Earnings card for /staking (staking rewards spec, 2026-09-11 §Frontend). Stakers are paid
// in Gatewayz inference credits, not WAYZ — see rewards-api.ts's header comment. This card
// never touches the stake/unstake flows; it only reads `/staking/rewards` (personalized, for
// a linked wallet) or `/staking/wallets/{address}`'s `rewards` field (public estimate, for a
// connected-but-unlinked wallet).
import type { Address } from 'viem';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useLinkedWallets } from '@/lib/hooks/use-linked-wallets';
import { useStakingRewards, useWalletRewardsEstimate } from '@/lib/hooks/use-wayz-staking';
import { RewardsApiError, type RewardAccrualStatus, type RewardRateTier } from '@/lib/wayz/rewards-api';
import { formatCredits, formatFractionPercent, formatWayzAmount } from '@/lib/wayz/format';

/** Truncates a 0x-address to `0x1234...abcd` (mirrors settings/wallets/page.tsx and
 *  RegisterProviderForm.tsx's copy of the same helper). */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const STATUS_VARIANT: Record<RewardAccrualStatus, 'default' | 'secondary' | 'outline'> = {
  paid: 'default',
  pending: 'secondary',
  skipped: 'outline',
};

function RateTierTable({ tiers }: { tiers: RewardRateTier[] }) {
  if (tiers.length === 0) {
    return <p className="text-sm text-muted-foreground">Reward tiers haven&apos;t been configured yet.</p>;
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Minimum stake</TableHead>
            <TableHead className="text-right">Credits per 1,000 WAYZ / day</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tiers.map((tier) => (
            <TableRow key={tier.min_stake_wayz}>
              <TableCell>{tier.min_stake_wayz.toLocaleString()} WAYZ</TableCell>
              <TableCell className="text-right tabular-nums">{formatCredits(tier.credits_per_1k_wayz_per_day)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your staking rewards: {message}</p>
      </CardContent>
    </Card>
  );
}

export function EarningsCard({ address }: { address: Address }) {
  const { status: authStatus } = useGatewayzAuth();
  const linkedWalletsQuery = useLinkedWallets({ enabled: authStatus === 'authenticated' });

  const isLinkResolved = authStatus !== 'authenticated' || !linkedWalletsQuery.isLoading;
  const isLinked =
    authStatus === 'authenticated' &&
    Boolean(linkedWalletsQuery.data?.some((w) => w.wallet_address.toLowerCase() === address.toLowerCase()));

  const rewardsQuery = useStakingRewards({ enabled: isLinkResolved && isLinked });
  const estimateQuery = useWalletRewardsEstimate(address, { enabled: isLinkResolved && !isLinked });

  if (!isLinkResolved) {
    return <LoadingCard />;
  }

  if (isLinked) {
    if (rewardsQuery.isLoading) {
      return <LoadingCard />;
    }
    if (rewardsQuery.isError || !rewardsQuery.data) {
      const message = rewardsQuery.error instanceof RewardsApiError ? rewardsQuery.error.detail : 'Please try again.';
      return <ErrorCard message={message} />;
    }

    const data = rewardsQuery.data;

    if (!data.enabled) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Earnings</CardTitle>
            <CardDescription>Staking rewards are not live yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <RateTierTable tiers={data.rate_table} />
          </CardContent>
        </Card>
      );
    }

    const currentWallet = data.wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());
    const perDay = currentWallet?.estimated_credits_per_day ?? 0;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Earnings</CardTitle>
          <CardDescription>
            {perDay > 0
              ? `Earning ≈ ${formatCredits(perDay)} credits/day at your current stake.`
              : "You're not earning yet — stake WAYZ above to start earning credits."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last 30 days</p>
              <p className="text-lg font-semibold tabular-nums">{formatCredits(data.totals.credits_paid_30d)} credits</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">All-time</p>
              <p className="text-lg font-semibold tabular-nums">{formatCredits(data.totals.credits_paid_all)} credits</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className="text-lg font-semibold tabular-nums">{formatCredits(data.totals.pending_credits)} credits</p>
            </div>
          </div>

          {data.mode === 'emission' && data.emission ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Emission</h3>
              <p className="text-sm text-muted-foreground">
                Stakers share{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {formatWayzAmount(data.emission.daily_emission_wayz)} WAYZ
                </span>
                /day; your share{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {formatFractionPercent(data.emission.your_share)}
                </span>{' '}
                → ≈{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {formatCredits(data.emission.estimated_credits_per_day)} credits
                </span>
                /day.
              </p>
            </div>
          ) : (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Reward tiers</h3>
              <RateTierTable tiers={data.rate_table} />
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">History</h3>
            {data.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reward history yet.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead className="text-right">Staked</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.history.map((row) => (
                      <TableRow key={`${row.wallet_address}-${row.reward_date}`}>
                        <TableCell className="text-sm text-muted-foreground">{row.reward_date}</TableCell>
                        <TableCell className="font-mono text-sm">{truncateAddress(row.wallet_address)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.staked_wayz.toLocaleString()} WAYZ</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCredits(row.credits)}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connected wallet is not linked to the caller's account (or the caller isn't logged into
  // Gatewayz at all) — only the public, unauthenticated estimate is available.
  if (estimateQuery.isLoading) {
    return <LoadingCard />;
  }
  if (estimateQuery.isError || !estimateQuery.data) {
    const message = estimateQuery.error instanceof RewardsApiError ? estimateQuery.error.detail : 'Please try again.';
    return <ErrorCard message={message} />;
  }

  const estimate = estimateQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings</CardTitle>
        <CardDescription>
          {estimate.estimated_credits_per_day > 0
            ? `Earning ≈ ${formatCredits(estimate.estimated_credits_per_day)} credits/day at your current stake (estimate).`
            : 'Stake WAYZ to start earning inference credits.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          Link this wallet in Settings → Wallets to receive credits.
        </p>
        <Button asChild variant="outline">
          <Link href="/settings/wallets">Link this wallet</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
