"use client";

// Compact holdings-rewards card for signed-in account pages: paid and pending
// credits once a wallet is linked, otherwise a pointer to /rewards. Product
// language is "holdings rewards" only; __tests__/language.test.ts enforces the
// backend's word policy on this file.
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useHoldingsRewards } from '@/lib/hooks/use-holdings-rewards';
import { formatCredits } from '@/lib/holdings/format';

export const REWARDS_HEADLINE = 'Earn free inference on what you hold';

export function HoldingsRewardsSummaryCard() {
  const { status } = useGatewayzAuth();
  const rewardsQuery = useHoldingsRewards({ enabled: status === 'authenticated' });
  const data = rewardsQuery.data;
  const hasWallets = !!data && data.wallets.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{REWARDS_HEADLINE}</CardTitle>
        <CardDescription>
          {hasWallets
            ? 'Inference credits for tokens in the wallets you linked.'
            : 'Link a wallet and get inference credits for the tokens you keep in it. You keep custody.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {hasWallets && (
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Paid, all time</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatCredits(data.totals.credits_paid_all)} credits</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Pending</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatCredits(data.totals.pending_credits)} credits</dd>
            </div>
          </dl>
        )}
        <Button asChild variant={hasWallets ? 'outline' : 'default'} size="sm" className="w-fit sm:ml-auto">
          <Link href={hasWallets ? '/rewards' : '/rewards#link-wallet'}>{hasWallets ? 'View rewards' : 'Link a wallet'}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
