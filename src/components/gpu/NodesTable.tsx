import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { describeNodeStatus } from '@/lib/gpu/format';
import type { GpuPublicNode, GpuNodeStatus } from '@/lib/gpu/public-api';

const STATUS_VARIANT: Record<GpuNodeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  registered: 'outline',
  active: 'default',
  degraded: 'secondary',
  offline: 'destructive',
  disabled: 'destructive',
};

export function NodesTable({ nodes, loading }: { nodes: GpuPublicNode[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!nodes || nodes.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No community nodes online yet.</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>GPU</TableHead>
            <TableHead className="text-right">VRAM</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Uptime (24h)</TableHead>
            <TableHead>Models</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodes.map((node) => (
            <TableRow key={node.name}>
              <TableCell className="font-medium">{node.name}</TableCell>
              <TableCell>{node.region}</TableCell>
              <TableCell>{node.gpu_model}</TableCell>
              <TableCell className="text-right">{node.vram_gb} GB</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[node.status]}>{describeNodeStatus(node.status)}</Badge>
              </TableCell>
              <TableCell className="text-right">{node.uptime_24h_pct.toFixed(1)}%</TableCell>
              <TableCell className="text-sm text-muted-foreground">{node.models.join(', ')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
