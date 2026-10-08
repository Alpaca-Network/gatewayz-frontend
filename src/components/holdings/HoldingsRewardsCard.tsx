"use client";

// Holdings rewards: inference credits for tokens held in wallets linked to the
// account (GET /holdings/rewards, gatewayz-backend docs/holdings/REWARDS.md).
// Account-scoped, so unlike the wallet-scoped cards beside it this needs a
// Gatewayz sign-in but no connected wallet. Product language is "holdings
// rewards" only; __tests__/language.test.ts enforces the backend's word policy
// on this file.
import Link from 'next/link';
import { AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useHoldingsRewards } from '@/lib/hooks/use-holdings-rewards';
import { useLinkedWallets } from '@/lib/hooks/use-linked-wallets';
import { HoldingsApiError, type HoldingsRateTier, type HoldingsRewards } from '@/lib/holdings/rewards-api';
import { formatCredits, formatUsd, truncateAddress } from '@/lib/holdings/format';
import { getHoldingsBlockers, getWalletStatus, type WalletStatus } from '@/lib/holdings/status';

const TITLE = 'Holdings rewards';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function ShellCard({ description, children }: { description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLE}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RateTiers({ tiers, activeFloor }: { tiers: HoldingsRateTier[]; activeFloor: number | null }) {
  if (tiers.length === 0) {
    return <p className="text-sm text-muted-foreground">No rate tiers are configured yet.</p>;
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Holdings from</TableHead>
            <TableHead className="text-right">Credits per $1,000 / day</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tiers.map((tier) => {
            const active = tier.min_usd === activeFloor;
            return (
              <TableRow key={tier.min_usd} data-active={active || undefined} className={active ? 'bg-muted/60' : undefined}>
                <TableCell>
                  {formatUsd(tier.min_usd)}
                  {active && (
                    <Badge variant="secondary" className="ml-2">
                      Your tier
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCredits(tier.credits_per_1k_usd_per_day)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function statusVariant(kind: WalletStatus['kind']): 'default' | 'secondary' | 'outline' {
  if (kind === 'earning') return 'default';
  if (kind === 'too_new' || kind === 'not_measured') return 'secondary';
  return 'outline';
}

function HoldingsRewardsView({ data, linkedAtByAddress }: { data: HoldingsRewards; linkedAtByAddress: Map<string, string | null> }) {
  const walletStatuses = data.wallets.map((w) => getWalletStatus(w, linkedAtByAddress.get(w.address.toLowerCase()) ?? null));
  const blockers = getHoldingsBlockers(data, walletStatuses);
  const blocking = blockers.filter((b) => b.severity === 'blocking');
  const info = blockers.filter((b) => b.severity === 'info');
  // The backend's tier for the account's total measured value. Payouts pick a
  // tier per wallet, so a split balance can sit in lower tiers than this.
  const activeFloor = data.wallets.some((w) => w.observed) ? data.account_estimate.min_usd : null;
  const activeTier = data.rate_table.find((t) => t.min_usd === activeFloor);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{TITLE}</CardTitle>
          <Badge variant={data.enabled ? 'default' : 'outline'}>{data.enabled ? 'On' : 'Off'}</Badge>
        </div>
        <CardDescription>
          Inference credits for tokens held in wallets linked to your account. We only read public balances and never
          take custody. Rates can change or stop at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Measured holdings" value={formatUsd(data.total_usd_value)} hint="Latest measurement" />
          <Stat
            label="Estimated / day"
            value={`${formatCredits(data.account_estimate.estimated_credits_per_day)} credits`}
            hint={`Cap ${formatCredits(data.daily_cap_credits)} / day`}
          />
          <Stat
            label="Active tier"
            value={activeTier ? `From ${formatUsd(activeTier.min_usd)}` : '—'}
            hint={activeTier ? `${formatCredits(activeTier.credits_per_1k_usd_per_day)} per $1,000 / day` : undefined}
          />
          <Stat label="Pending" value={`${formatCredits(data.totals.pending_credits)} credits`} />
          <Stat label="Paid, last 30 days" value={`${formatCredits(data.totals.credits_paid_30d)} credits`} />
          <Stat label="Paid, all time" value={`${formatCredits(data.totals.credits_paid_all)} credits`} />
        </div>

        <p className="text-xs text-muted-foreground">
          Estimates use each wallet&apos;s latest measurement. Payouts use the lowest measurement of the day, so a balance
          that moved during the day earns less than shown.
        </p>

        {blocking.length > 0 && (
          <Alert variant="destructive" aria-label="Why holdings rewards are not paying">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Why this isn&apos;t paying yet</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {blocking.map((b) => (
                  <li key={b.kind}>
                    <span className="font-medium">{b.title}.</span> {b.detail}
                    {b.kind === 'no_wallets' && (
                      <>
                        {' '}
                        <Link href="/rewards#link-wallet" className="underline">
                          Link a wallet
                        </Link>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Alert aria-label="Payout rules">
          <Info className="h-4 w-4" />
          <AlertTitle>What limits payouts</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {info.map((b) => (
                <li key={b.kind}>
                  <span className="font-medium">{b.title}.</span> {b.detail}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Linked wallets</h3>
          {data.wallets.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">No wallets linked to this account.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/rewards#link-wallet">Link a wallet</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wallet</TableHead>
                    <TableHead className="text-right">Measured</TableHead>
                    <TableHead className="text-right">Est. / day</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.wallets.map((wallet, i) => {
                    const status = walletStatuses[i];
                    return (
                      <TableRow key={wallet.address}>
                        <TableCell className="font-mono text-sm" title={wallet.address}>
                          {truncateAddress(wallet.address)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {wallet.observed ? formatUsd(wallet.usd_value) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCredits(wallet.estimated_credits_per_day)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={statusVariant(status.kind)} className="w-fit">
                              {status.label}
                            </Badge>
                            {status.kind !== 'earning' && (
                              <span className="text-xs text-muted-foreground">{status.detail}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Rate tiers</h3>
          <RateTiers tiers={data.rate_table} activeFloor={activeFloor} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">History</h3>
          {data.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accruals yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead className="text-right">Basis</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.history.map((row) => (
                    <TableRow key={`${row.wallet_address}-${row.reward_date}`}>
                      <TableCell className="text-sm text-muted-foreground">{row.reward_date}</TableCell>
                      <TableCell className="font-mono text-sm">{truncateAddress(row.wallet_address)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsd(row.usd_basis)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCredits(row.credits)}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'paid' ? 'default' : 'secondary'}>{row.status}</Badge>
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

export function HoldingsRewardsCard() {
  const { status: authStatus, login } = useGatewayzAuth();
  const isAuthenticated = authStatus === 'authenticated';
  const rewardsQuery = useHoldingsRewards({ enabled: isAuthenticated });
  const linkedWalletsQuery = useLinkedWallets({ enabled: isAuthenticated });

  if (!isAuthenticated) {
    if (authStatus === 'unauthenticated' || authStatus === 'error') {
      return (
        <ShellCard description="Inference credits for tokens held in wallets linked to your account.">
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Sign in to see holdings rewards for your linked wallets.</p>
            <Button variant="outline" onClick={() => login()}>
              Sign in
            </Button>
          </div>
        </ShellCard>
      );
    }
  }

  if (!isAuthenticated || rewardsQuery.isLoading) {
    return (
      <ShellCard>
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      </ShellCard>
    );
  }

  if (rewardsQuery.isError || !rewardsQuery.data) {
    const message = rewardsQuery.error instanceof HoldingsApiError ? rewardsQuery.error.detail : 'Please try again.';
    return (
      <ShellCard>
        <p className="text-sm text-muted-foreground">Couldn&apos;t load holdings rewards: {message}</p>
      </ShellCard>
    );
  }

  const linkedAtByAddress = new Map<string, string | null>(
    (linkedWalletsQuery.data ?? []).map((w) => [w.wallet_address.toLowerCase(), w.verified_at])
  );

  return <HoldingsRewardsView data={rewardsQuery.data} linkedAtByAddress={linkedAtByAddress} />;
}
