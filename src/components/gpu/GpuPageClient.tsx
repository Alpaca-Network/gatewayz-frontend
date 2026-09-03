"use client";

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isGpuMarketplaceEnabled } from '@/lib/gpu/flag';
import { useGpuPublicSummary, useGpuPublicNodes } from '@/lib/hooks/use-gpu-public';
import { SummaryCards } from './SummaryCards';
import { UtilizationChart } from './UtilizationChart';
import { NodesTable } from './NodesTable';
import { ModelMapping } from './ModelMapping';
import { TrustDisclosure } from './TrustDisclosure';

export function GpuPageClient() {
  // Flag gate: this whole surface renders nothing until the backend ships
  // (spec.md §7 — "Hidden behind NEXT_PUBLIC_GPU_MARKETPLACE=true until
  // backend ships"). Checked at render time (not module load) so Jest can
  // flip it per-test via process.env. Hooks still run unconditionally
  // (rules-of-hooks) — `enabled` below is what actually stops the fetch
  // when the flag is off, so a flag-off render never hits a backend route
  // that may not exist yet.
  const enabled = isGpuMarketplaceEnabled();
  const summaryQuery = useGpuPublicSummary({ enabled });
  const nodesQuery = useGpuPublicNodes({ enabled });

  if (!enabled) {
    return null;
  }

  return (
    <div className="container mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">GPU Marketplace</h1>
        <p className="text-muted-foreground">
          Live utilization for the community GPU nodes serving open-weight models on Gatewayz.
        </p>
      </div>

      <SummaryCards data={summaryQuery.data} loading={summaryQuery.isLoading} />

      <UtilizationChart />

      <Card>
        <CardHeader>
          <CardTitle>Nodes</CardTitle>
        </CardHeader>
        <CardContent>
          <NodesTable nodes={nodesQuery.data} loading={nodesQuery.isLoading} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Models</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelMapping models={summaryQuery.data?.models} loading={summaryQuery.isLoading} />
        </CardContent>
      </Card>

      <TrustDisclosure />

      <p className="text-center text-sm text-muted-foreground">
        Want to run a node?{' '}
        <Link href="/gpu/provider" className="text-primary underline">
          Register as a provider
        </Link>
        .
      </p>
    </div>
  );
}
