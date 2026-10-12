"use client";

// Compact inference discount balance for Settings -> Credits. Same locks as
// the /rewards card: build flag, backend on with status.discount_enabled, and
// the account's discount.enabled. A load failure hides the line instead of
// cluttering the credits page; /rewards shows the full card and its errors.
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { formatDiscountUsd } from '@/lib/delegation/discount-format';
import { isDiscountLive } from '@/lib/delegation/flags';
import { useDelegationRewards, useDelegationStatus } from '@/lib/delegation/use-delegation';
import { DISCOUNT_ANCHOR, DISCOUNT_TITLE, payLine } from './discount-copy';

export function InferenceDiscountBalanceLine() {
  const { status: authStatus } = useGatewayzAuth();
  const statusQuery = useDelegationStatus();
  const status = statusQuery.data;
  const live = isDiscountLive(status);
  const query = useDelegationRewards({ enabled: live && authStatus === 'authenticated' });

  if (!live || authStatus !== 'authenticated') return null;
  if (query.isLoading) {
    return <Skeleton className="h-16 w-full" aria-busy="true" aria-label="Loading your inference discount" />;
  }

  const data = query.data;
  const discount = data?.discount;
  if (!data || !discount || !discount.enabled) return null;

  const pay = payLine(discount.discount_percent ?? status?.discount_percent);
  const disclaimer = data.disclaimer || status?.disclaimer || '';

  return (
    <section aria-labelledby="inference-discount-line-title" className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 id="inference-discount-line-title" className="text-xs uppercase tracking-wide text-muted-foreground">
            {DISCOUNT_TITLE} balance
          </h3>
          <p className="text-lg font-semibold tabular-nums">{formatDiscountUsd(discount.balance_usd)}</p>
          <p className="text-sm text-muted-foreground">
            {discount.balance_usd > 0
              ? pay ?? 'Part of each request is paid from this balance until it runs out.'
              : 'Stake ETH or ADA on the Rewards page to build a discount balance.'}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit shrink-0">
          <Link href={`/rewards#${DISCOUNT_ANCHOR}`}>View discount</Link>
        </Button>
      </div>
      {disclaimer && <p className="whitespace-pre-line text-xs text-muted-foreground">{disclaimer}</p>}
    </section>
  );
}
