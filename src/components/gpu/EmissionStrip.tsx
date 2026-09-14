// "Emission" strip for the public /gpu page (Chutes-style emission model,
// scratchpad/emission/spec.md §Frontend). Reads the optional `emission` block off
// `GET /gpu/public/summary` — a plain, presentational component (data/loading passed as
// props, same as SummaryCards) so it renders unchanged (hidden) whenever the backend hasn't
// shipped the field yet, without needing its own query mock in GpuPageClient's tests.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { GpuPublicEmission } from '@/lib/gpu/public-api';
import { formatBps, formatWayzAmount } from '@/lib/wayz/format';

const SPLITS: Array<{ key: keyof Pick<GpuPublicEmission, 'providers_bps' | 'stakers_bps' | 'treasury_bps'>; label: string }> = [
  { key: 'providers_bps', label: 'Providers' },
  { key: 'stakers_bps', label: 'Stakers' },
  { key: 'treasury_bps', label: 'Treasury' },
];

function SplitBar({ label, bps }: { label: string; bps: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{formatBps(bps)}</span>
      </div>
      <Progress value={bps / 100} className="h-2" />
    </div>
  );
}

export function EmissionStrip({ emission, loading }: { emission: GpuPublicEmission | undefined; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Emission</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Hidden under today's `per_unit` mode, or before the first emission epoch has run —
  // scratchpad/emission/spec.md §API.
  if (!emission) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emission</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Daily emission</p>
          <p className="text-2xl font-bold tabular-nums">{formatWayzAmount(emission.daily_emission_wayz)} WAYZ</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SPLITS.map(({ key, label }) => (
            <SplitBar key={key} label={label} bps={emission[key]} />
          ))}
        </div>
        {emission.last_epoch && (
          <p className="text-xs text-muted-foreground">Last epoch: {new Date(emission.last_epoch).toLocaleDateString()}</p>
        )}
      </CardContent>
    </Card>
  );
}
