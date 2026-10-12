"use client";

// The account's inference discount (v3, payout_model "reward_share"), from
// GET /delegation/rewards: the balance, what share of the list price is still
// paid while it lasts, lifetime totals, which staking rewards each wallet's
// stake brought in and the discount they gave, and the balance history.
// Renders nothing unless the build flag, the backend and its discount switch
// (status.discount_enabled, then rewards.discount.enabled) are all on.
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DelegationAttribution, DelegationDiscountEntry, DelegationStatus } from '@/lib/delegation/api';
import { formatDiscountUsd, formatFractionPercent } from '@/lib/delegation/discount-format';
import { isDiscountLive } from '@/lib/delegation/flags';
import { useDelegationRewards } from '@/lib/delegation/use-delegation';
import { attributionStatusLabel, DISCOUNT_ANCHOR, DISCOUNT_TITLE, historyKindLabel, payLine } from './discount-copy';

const PREVIEW_ROWS = 10;

function formatStake(amount: number, asset: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${asset}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Grants and uses always read as +/-; adjustments and reversals keep the backend's sign. */
function formatSignedAmount(entry: DelegationDiscountEntry): string {
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

function AttributionTable({ rows }: { rows: DelegationAttribution[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, PREVIEW_ROWS);
  const id = 'inference-discount-attributions';

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">Your share of staking rewards &rarr; discount</h4>
      <p className="text-xs text-muted-foreground">
        For each period: the staking rewards Gatewayz received that your stake brought in, and the discount that put
        on your balance.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet. Rewards appear here after each period is recorded.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table id={id} className="w-full text-sm">
            <caption className="sr-only">Staking rewards from your stake and the discount they added, by period</caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Period</th>
                <th scope="col" className="px-3 py-2 font-medium">Asset</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Your stake</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Rewards from your stake</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Discount</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((row) => (
                <tr key={`${row.asset}:${row.period_key}:${row.stake_native}`}>
                  <td className="whitespace-nowrap px-3 py-2">{row.period_key}</td>
                  <td className="px-3 py-2">{row.asset}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{formatStake(row.stake_native, row.asset)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatDiscountUsd(row.attributed_usd)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatDiscountUsd(row.discount_usd)}</td>
                  <td className="px-3 py-2">
                    <span title={row.granted_at ? `Added ${formatDate(row.granted_at)}` : undefined}>
                      {attributionStatusLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ShowAllToggle total={rows.length} expanded={expanded} onToggle={() => setExpanded((v) => !v)} controls={id} />
    </div>
  );
}

function HistoryTable({ rows }: { rows: DelegationDiscountEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, PREVIEW_ROWS);
  const id = 'inference-discount-history';
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">Discount history</h4>
      <div className="overflow-x-auto rounded-md border">
        <table id={id} className="w-full text-sm">
          <caption className="sr-only">Changes to your inference discount balance, newest first</caption>
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

function Shell({ children, description }: { children: React.ReactNode; description?: string }) {
  return (
    <section id={DISCOUNT_ANCHOR} aria-labelledby="inference-discount-title" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle id="inference-discount-title">{DISCOUNT_TITLE}</CardTitle>
          <CardDescription>
            {description ?? 'A share of the staking rewards your stake brings Gatewayz, kept on your account to pay for inference.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">{children}</CardContent>
      </Card>
    </section>
  );
}

/** `shownDisclaimer`: text already on the page (from /delegation/status), not repeated here. */
export function InferenceDiscountCard({ status, shownDisclaimer = '' }: { status: DelegationStatus; shownDisclaimer?: string }) {
  const live = isDiscountLive(status);
  const query = useDelegationRewards({ enabled: live });
  if (!live) return null;

  if (query.isLoading) {
    return (
      <Shell>
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading your inference discount">
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
          Couldn&apos;t load your inference discount. Please try again later.
        </p>
      </Shell>
    );
  }

  const data = query.data;
  const discount = data?.discount;
  if (!data || !discount || !discount.enabled) return null;

  const rewardShare = discount.reward_share ?? status.reward_share ?? null;
  const pay = payLine(discount.discount_percent ?? status.discount_percent);
  const hasBalance = discount.balance_usd > 0;
  const disclaimer = data.disclaimer || status.disclaimer;

  return (
    <Shell
      description={
        rewardShare !== null
          ? `${formatFractionPercent(rewardShare)} of the staking rewards your stake brings Gatewayz, kept on your account to pay for inference.`
          : undefined
      }
    >
      <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-4">
        <span className="text-xs text-muted-foreground">Discount balance</span>
        <span className="text-2xl font-semibold tabular-nums">{formatDiscountUsd(discount.balance_usd)}</span>
        <p className="text-sm text-muted-foreground">
          {hasBalance
            ? pay ?? 'Part of each request is paid from this balance until it runs out.'
            : 'Your balance is empty, so requests are charged at the list price. It refills after each period of staking rewards is recorded.'}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-lg border p-4">
          <dt className="text-xs text-muted-foreground">Added, all time</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatDiscountUsd(discount.lifetime_granted_usd)}</dd>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4">
          <dt className="text-xs text-muted-foreground">Used on inference, all time</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatDiscountUsd(discount.lifetime_used_usd)}</dd>
        </div>
      </dl>

      <AttributionTable rows={data.attributions} />
      <HistoryTable rows={data.discount_history} />

      {data.attributions.some((r) => r.status === 'pending') && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Pending</Badge>
          <span>Pending periods are added once the wallet is confirmed as linked to your account.</span>
        </div>
      )}

      {disclaimer && disclaimer !== shownDisclaimer && (
        <p className="whitespace-pre-line text-xs text-muted-foreground">{disclaimer}</p>
      )}
    </Shell>
  );
}
