"use client";

// "Your score" card for /gpu/provider (Chutes-style emission model, scratchpad/emission/spec.md
// §Frontend). Self-fetching via `useMyGpuEarnings`, same pattern as EarningsSection — the two
// cards read the same `/gpu/providers/me/earnings` query (react-query dedupes by key), this one
// just projects the optional `emission` block instead of the totals/work/settlements one.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyGpuEarnings } from '@/lib/hooks/use-gpu-provider';
import type { GpuEmissionScore } from '@/lib/gpu/provider-api';
import { formatFractionPercent, formatWayzAmount } from '@/lib/wayz/format';

// Fixed weights from `PROVIDER_SCORE_WEIGHTS_BPS` (scratchpad/emission/spec.md §Design) — not
// part of the API payload (only the resulting per-provider metrics are), so hardcoded here
// purely for display alongside each metric's bar.
const METRIC_WEIGHTS: Array<{ key: keyof Pick<GpuEmissionScore, 'compute' | 'speed' | 'availability' | 'unique_models'>; label: string; weightPct: number }> = [
  { key: 'compute', label: 'Compute', weightPct: 55 },
  { key: 'speed', label: 'Response speed', weightPct: 20 },
  { key: 'availability', label: 'Availability', weightPct: 20 },
  { key: 'unique_models', label: 'Unique models', weightPct: 5 },
];

function MetricBar({ label, weightPct, value }: { label: string; weightPct: number; value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{formatFractionPercent(value)}</span>
      </div>
      <Progress value={pct} className="h-2" />
      <p className="text-[11px] text-muted-foreground/70">{weightPct}% weight</p>
    </div>
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your score</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
  );
}

export function ProviderScoreCard() {
  const earningsQuery = useMyGpuEarnings();

  if (earningsQuery.isLoading) {
    return <LoadingCard />;
  }

  const emission = earningsQuery.data?.emission;

  // Hidden under today's `per_unit` mode, or before this provider has been scored in an
  // emission epoch yet — scratchpad/emission/spec.md §API.
  if (!emission) {
    return null;
  }

  const { score } = emission;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your score</CardTitle>
        <CardDescription>
          {emission.last_epoch ? `Last epoch: ${new Date(emission.last_epoch).toLocaleDateString()}` : 'No epoch has run yet.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          {METRIC_WEIGHTS.map(({ key, label, weightPct }) => (
            <MetricBar key={key} label={label} weightPct={weightPct} value={score[key]} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Adjusted score</p>
            <p className="text-lg font-semibold tabular-nums">{score.adjusted.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Share</p>
            <p className="text-lg font-semibold tabular-nums">{formatFractionPercent(score.share)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Rank</p>
            <p className="text-lg font-semibold tabular-nums">
              {emission.rank} of {emission.providers_scored}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Next epoch (est.)</p>
            <p className="text-lg font-semibold tabular-nums">{formatWayzAmount(emission.allocation_wayz)} WAYZ</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
