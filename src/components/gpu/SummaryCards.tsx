import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { GpuPublicSummary } from '@/lib/gpu/public-api';

function StatCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>{loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{value}</div>}</CardContent>
    </Card>
  );
}

export function SummaryCards({ data, loading }: { data: GpuPublicSummary | undefined; loading: boolean }) {
  const lastHour = data?.last_hour;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Active nodes" loading={loading} value={data ? data.active_nodes.toLocaleString() : '—'} />
      <StatCard label="Approved providers" loading={loading} value={data ? data.approved_providers.toLocaleString() : '—'} />
      <StatCard
        label="Requests (last hour)"
        loading={loading}
        value={lastHour ? lastHour.requests.toLocaleString() : '—'}
      />
      <StatCard
        label="Tokens (last hour)"
        loading={loading}
        value={lastHour ? lastHour.tokens.toLocaleString() : '—'}
      />
      <StatCard
        label="Avg latency (last hour)"
        loading={loading}
        value={lastHour ? `${lastHour.avg_latency_ms.toLocaleString()} ms` : '—'}
      />
      <StatCard
        label="Error rate (last hour)"
        loading={loading}
        value={lastHour ? `${(lastHour.error_rate * 100).toFixed(2)}%` : '—'}
      />
    </div>
  );
}
