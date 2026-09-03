"use client";

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatWayz } from '@/lib/wayz/format';
import { useMyGpuEarnings } from '@/lib/hooks/use-gpu-provider';

export function EarningsSection() {
  const earningsQuery = useMyGpuEarnings();
  const data = earningsQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Accrued</p>
            {earningsQuery.isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-lg font-semibold">{data ? `${formatWayz(data.accrued_wei)} WAYZ` : '—'}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Settled</p>
            {earningsQuery.isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-lg font-semibold">{data ? `${formatWayz(data.settled_wei)} WAYZ` : '—'}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Void</p>
            {earningsQuery.isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-lg font-semibold">{data ? `${formatWayz(data.void_wei)} WAYZ` : '—'}</p>
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
                      <TableCell className="text-right">{formatWayz(settlement.amount_wei)} WAYZ</TableCell>
                      <TableCell>
                        <Badge variant="outline">{settlement.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {settlement.tx_url ? (
                          <a className="text-primary underline" href={settlement.tx_url} target="_blank" rel="noreferrer">
                            View on Snowtrace
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
