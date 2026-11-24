"use client";

// Compact discount credits balance for Settings -> Credits. Two locks: the
// build flag (NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED) and the account's
// own `enabled` from the backend. A load failure hides the line instead of
// cluttering the credits page.
import { Skeleton } from '@/components/ui/skeleton';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { isVaultDiscountCreditsEnabled } from '@/lib/discount-credits/flag';
import { formatDiscountUsd } from '@/lib/discount-credits/format';
import { useDiscountCredits } from '@/lib/discount-credits/use-discount-credits';
import { BALANCE_EMPTY, BALANCE_IN_USE_FALLBACK, DISCOUNT_LOADING_LABEL, DISCOUNT_TITLE, payLine } from './discount-copy';

export function InferenceDiscountBalanceLine() {
  const { status: authStatus } = useGatewayzAuth();
  const live = isVaultDiscountCreditsEnabled() && authStatus === 'authenticated';
  const query = useDiscountCredits({ enabled: live });

  if (!live) return null;
  if (query.isLoading) {
    return <Skeleton className="h-16 w-full" aria-busy="true" aria-label={DISCOUNT_LOADING_LABEL} />;
  }

  const data = query.data;
  const balance = data?.balance;
  if (!data || !balance || !balance.enabled) return null;

  return (
    <section aria-labelledby="discount-credits-line-title" className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 id="discount-credits-line-title" className="text-xs uppercase tracking-wide text-muted-foreground">
          {DISCOUNT_TITLE} balance
        </h3>
        <p className="text-lg font-semibold tabular-nums">{formatDiscountUsd(balance.balance_usd)}</p>
        <p className="text-sm text-muted-foreground">
          {balance.balance_usd > 0 ? payLine(balance.discount_percent) ?? BALANCE_IN_USE_FALLBACK : BALANCE_EMPTY}
        </p>
      </div>
      {data.disclaimer && <p className="whitespace-pre-line text-xs text-muted-foreground">{data.disclaimer}</p>}
    </section>
  );
}
