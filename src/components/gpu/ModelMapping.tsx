import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { GpuPublicModel } from '@/lib/gpu/public-api';

export function ModelMapping({ models, loading }: { models: GpuPublicModel[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!models || models.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No community models available yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Model</TableHead>
          <TableHead className="text-right">Serving nodes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {models.map((model) => (
          <TableRow key={model.id}>
            <TableCell className="font-mono text-sm">community/{model.id}</TableCell>
            <TableCell className="text-right">{model.nodes}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
