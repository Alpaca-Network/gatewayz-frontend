"use client";

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatEthWei, formatUsd } from '@/lib/gpu/format';
import type { GpuSettlementRow } from '@/lib/gpu/provider-api';
import { formatWayz } from '@/lib/wayz/format';
import { useMyGpuEarnings } from '@/lib/hooks/use-gpu-provider';

/** Settlement amount in the asset it was actually paid in: ETH on Base (with the USD it
 *  settled), or WAYZ for legacy pre-2026-09-22 testnet rows. Never labels ETH as WAYZ. */
function settlementAmount(settlement: GpuSettlementRow): string {
  if (settlement.asset === 'ETH') {
    const eth = `${formatEthWei(settlement.amount_wei)} ETH`;
    return settlement.amount_usd === null ? eth : `${eth} (${formatUsd(settlement.amount_usd)})`;
  }
  return `${formatWayz(settlement.amount_wei)} WAYZ`;
}

function settlementStatus(settlement: GpuSettlementRow): string {
  if (settlement.status === 'pending' && settlement.tx_hash) return 'confirming';
  return settlement.status;
}

export function EarningsSection() {
  const earningsQuery = useMyGpuEarnings();
  const data = earningsQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Earnings are counted in USD and paid out daily in ETH on Base, at the ETH/USD price when paid.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Earned, unpaid</p>
            {earningsQuery.isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <>
                <p className="text-lg font-semibold tabular-nums">{data ? formatUsd(data.accrued_usd) : '—'}</p>
                {data && data.eth_usd_price !== null && data.accrued_usd > 0 ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    ≈ {formatEthWei(data.accrued_wei)} ETH at today&apos;s price
                  </p>
                ) : null}
              </>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid</p>
            {earningsQuery.isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <>
                <p className="text-lg font-semibold tabular-nums">
                  {data ? `${formatEthWei(data.settled_wei)} ETH` : '—'}
                </p>
                {data ? (
                  <p className="text-xs text-muted-foreground tabular-nums">{formatUsd(data.settled_usd)} earned</p>
                ) : null}
              </>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Void</p>
            {earningsQuery.isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-lg font-semibold tabular-nums">{data ? formatUsd(data.void_usd) : '—'}</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Recent work</h3>
          {!data || data.work.length === 0 ? (
            <p className="text-sm text-muted-foreground">No verified work yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Prompt tokens</TableHead>
                    <TableHead className="text-right">Completion tokens</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.work.map((row) => (
                    <TableRow key={row.billing_ref}>
                      <TableCell className="font-mono text-sm">{row.model}</TableCell>
                      <TableCell className="text-right">{row.prompt_tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.completion_tokens.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.verification}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Settlements</h3>
          {!data || data.settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No settlements yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.settlements.map((settlement) => (
                    <TableRow key={settlement.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(settlement.period_start).toLocaleDateString()} –{' '}
                        {new Date(settlement.period_end).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{settlementAmount(settlement)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{settlementStatus(settlement)}</Badge>
                      </TableCell>
                      <TableCell>
                        {settlement.tx_url ? (
                          <a className="text-primary underline" href={settlement.tx_url} target="_blank" rel="noreferrer">
                            {settlement.asset === 'ETH' ? 'View on Basescan' : 'View on Snowtrace'}
                          </a>
                        ) : (
                          '—'
                        )}
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
