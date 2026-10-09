"use client";

// The account's staked positions and the inference allowance they earn, from
// GET /delegation/rewards. Positions are measured by the backend from chain
// data, so a fresh stake appears after its next measurement.
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCredits, formatUsd, truncateAddress } from '@/lib/holdings/format';
import { useDelegationRewards } from '@/lib/delegation/use-delegation';

function formatAmount(amount: number, asset: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${asset}`;
}

function shortAddress(address: string): string {
  return address.startsWith('stake') && address.length > 20
    ? `${address.slice(0, 10)}...${address.slice(-6)}`
    : truncateAddress(address);
}

export function DelegationPositionCard() {
  const query = useDelegationRewards();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your positions and allowance</CardTitle>
        <CardDescription>
          What you have staked through Gatewayz, and the inference allowance it earns. Positions update after each
          measurement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {query.isLoading && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {query.isError && (
          <p role="alert" className="text-sm text-muted-foreground">
            Couldn&apos;t load your positions. Please try again later.
          </p>
        )}
        {query.data && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1 rounded-lg border p-4">
                <span className="text-xs text-muted-foreground">Allowance per day</span>
                <span className="text-lg font-semibold">{formatCredits(query.data.allowance.credits_per_day_estimate)}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border p-4">
                <span className="text-xs text-muted-foreground">Estimated per month</span>
                <span className="text-lg font-semibold">{formatUsd(query.data.allowance.month_estimate_usd)}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border p-4">
                <span className="text-xs text-muted-foreground">Pending credits</span>
                <span className="text-lg font-semibold">{formatCredits(query.data.totals.pending)}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border p-4">
                <span className="text-xs text-muted-foreground">Credits paid</span>
                <span className="text-lg font-semibold">{formatCredits(query.data.totals.paid)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">Positions</h4>
              {query.data.positions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No positions yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {query.data.positions.map((p) => (
                    <li
                      key={`${p.asset}:${p.wallet_address}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{p.asset}</Badge>
                        <span className="font-mono" title={p.wallet_address}>
                          {shortAddress(p.wallet_address)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-mono">{formatAmount(p.amount, p.asset)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatUsd(p.usd_value)}
                          {p.measured_at ? ` · measured ${new Date(p.measured_at).toLocaleDateString('en-US')}` : ''}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {query.data.history.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">History</h4>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">Date</th>
                        <th scope="col" className="px-3 py-2 font-medium">Asset</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Credits</th>
                        <th scope="col" className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {query.data.history.map((row, i) => (
                        <tr key={`${row.date}:${row.asset}:${i}`}>
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2">{row.asset}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatCredits(row.credits)}</td>
                          <td className="px-3 py-2 capitalize">{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
