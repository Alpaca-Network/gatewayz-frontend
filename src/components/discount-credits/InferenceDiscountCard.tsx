"use client";

// The account's discount credits in full: the balance, what share of the list
// price is still paid while it lasts, lifetime totals and the balance history.
// Two locks: the build flag (NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED) and
// the account's own `enabled` from the backend. Not placed on any page yet.
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DiscountCreditsEntry } from '@/lib/discount-credits/api';
import { isVaultDiscountCreditsEnabled } from '@/lib/discount-credits/flag';
import { formatDiscountUsd } from '@/lib/discount-credits/format';
import { useDiscountCredits } from '@/lib/discount-credits/use-discount-credits';
import {
  BALANCE_EMPTY,
  BALANCE_IN_USE_FALLBACK,
  DISCOUNT_ANCHOR,
  DISCOUNT_DESCRIPTION,
  DISCOUNT_LOADING_LABEL,
  DISCOUNT_TITLE,
  historyKindLabel,
  payLine,
} from './discount-copy';

const PREVIEW_ROWS = 10;

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Grants and uses always read as +/-; adjustments and reversals keep the backend's sign. */
function formatSignedAmount(entry: DiscountCreditsEntry): string {
  const amount =
    entry.kind === 'use' ? -Math.abs(entry.amount_usd) : entry.kind === 'grant' ? Math.abs(entry.amount_usd) : entry.amount_usd;
  if (amount === 0) return formatDiscountUsd(0);
  return `${amount < 0 ? '−' : '+'}${formatDiscountUsd(Math.abs(amount))}`;
}

function ShowAllToggle({ total, expanded, onToggle, controls }: { total: number; expanded: boolean; onToggle: () => void; controls: string }) {
  if (total <= PREVIEW_ROWS) return null;
  return (
    <Button variant="ghost" size="sm" className="w-fit" aria-expanded={expanded} aria-controls={controls} onClick={onToggle}>
      {expanded ? 'Show fewer' : `Show all ${total}`}
    </Button>
  );
}

function HistoryTable({ rows }: { rows: DiscountCreditsEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, PREVIEW_ROWS);
  const id = 'discount-credits-history';
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">Balance history</h4>
      <div className="overflow-x-auto rounded-md border">
        <table id={id} className="w-full text-sm">
          <caption className="sr-only">Changes to your discount credits balance, newest first</caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Date</th>
              <th scope="col" className="px-3 py-2 font-medium">Change</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Balance after</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((row, i) => (
              <tr key={`${row.created_at}:${row.kind}:${i}`}>
                <td className="whitespace-nowrap px-3 py-2">{formatDate(row.created_at)}</td>
                <td className="px-3 py-2">{historyKindLabel(row.kind)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatSignedAmount(row)}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {row.balance_after === null ? '' : formatDiscountUsd(row.balance_after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ShowAllToggle total={rows.length} expanded={expanded} onToggle={() => setExpanded((v) => !v)} controls={id} />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section id={DISCOUNT_ANCHOR} aria-labelledby="discount-credits-title" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle id="discount-credits-title">{DISCOUNT_TITLE}</CardTitle>
          <CardDescription>{DISCOUNT_DESCRIPTION}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">{children}</CardContent>
      </Card>
    </section>
  );
}

/** `shownDisclaimer`: text already on the page, not repeated here. */
export function InferenceDiscountCard({ shownDisclaimer = '' }: { shownDisclaimer?: string }) {
  const live = isVaultDiscountCreditsEnabled();
  const query = useDiscountCredits({ enabled: live });
  if (!live) return null;

  if (query.isLoading) {
    return (
      <Shell>
        <div className="flex flex-col gap-2" aria-busy="true" aria-label={DISCOUNT_LOADING_LABEL}>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Shell>
    );
  }
  if (query.isError) {
    return (
      <Shell>
        <p role="alert" className="text-sm text-muted-foreground">
          Couldn&apos;t load your discount credits. Please try again later.
        </p>
      </Shell>
    );
  }

  const data = query.data;
  const balance = data?.balance;
  if (!data || !balance || !balance.enabled) return null;

  return (
    <Shell>
      <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-4">
        <span className="text-xs text-muted-foreground">Balance</span>
        <span className="text-2xl font-semibold tabular-nums">{formatDiscountUsd(balance.balance_usd)}</span>
        <p className="text-sm text-muted-foreground">
          {balance.balance_usd > 0 ? payLine(balance.discount_percent) ?? BALANCE_IN_USE_FALLBACK : BALANCE_EMPTY}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-lg border p-4">
          <dt className="text-xs text-muted-foreground">Added, all time</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatDiscountUsd(balance.lifetime_granted_usd)}</dd>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4">
          <dt className="text-xs text-muted-foreground">Used on requests, all time</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatDiscountUsd(balance.lifetime_used_usd)}</dd>
        </div>
      </dl>

      <HistoryTable rows={data.history} />

      {data.disclaimer && data.disclaimer !== shownDisclaimer && (
        <p className="whitespace-pre-line text-xs text-muted-foreground">{data.disclaimer}</p>
      )}
    </Shell>
  );
}
