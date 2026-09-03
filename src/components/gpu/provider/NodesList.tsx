"use client";

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { describeNodeStatus, formatHeartbeatAge } from '@/lib/gpu/format';
import { useDeleteGpuNode, useRotateGpuNodeToken } from '@/lib/hooks/use-gpu-provider';
import type { GpuNode, GpuNodeStatus } from '@/lib/gpu/provider-api';
import { AddNodeDialog } from './AddNodeDialog';

const STATUS_VARIANT: Record<GpuNodeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  registered: 'outline',
  active: 'default',
  degraded: 'secondary',
  offline: 'destructive',
  disabled: 'destructive',
};

function NodeRow({ node, onDisable }: { node: GpuNode; onDisable: (id: number) => void }) {
  const { toast } = useToast();
  const rotateMutation = useRotateGpuNodeToken();
  const [rotatedToken, setRotatedToken] = useState<string | null>(null);

  const handleRotate = async () => {
    try {
      const token = await rotateMutation.mutateAsync(node.id);
      setRotatedToken(token);
    } catch {
      toast({ title: 'Could not rotate token', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{node.name}</span>
          <Badge variant={STATUS_VARIANT[node.status]}>{describeNodeStatus(node.status)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRotate} disabled={rotateMutation.isPending}>
            Rotate token
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => onDisable(node.id)}
            disabled={node.status === 'disabled'}
          >
            Disable
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {node.region} · {node.gpu_model} · {node.vram_gb} GB · last heartbeat {formatHeartbeatAge(node.last_heartbeat_at)}
      </p>
      {rotatedToken && (
        <div className="rounded-md border bg-muted px-3 py-2 text-sm">
          New token (shown once): <code className="break-all">{rotatedToken}</code>
        </div>
      )}
    </div>
  );
}

export function NodesList({ nodes }: { nodes: GpuNode[] }) {
  const { toast } = useToast();
  const deleteMutation = useDeleteGpuNode();
  const [nodeToDisable, setNodeToDisable] = useState<number | null>(null);

  const handleConfirmDisable = async () => {
    if (nodeToDisable === null) return;
    const id = nodeToDisable;
    setNodeToDisable(null);
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Node disabled' });
    } catch {
      toast({ title: 'Could not disable node', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Nodes</CardTitle>
        <AddNodeDialog />
      </CardHeader>
      <CardContent className="p-0">
        {nodes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No nodes yet — add your first GPU node above.
          </p>
        ) : (
          nodes.map((node) => <NodeRow key={node.id} node={node} onDisable={setNodeToDisable} />)
        )}
      </CardContent>

      <AlertDialog open={nodeToDisable !== null} onOpenChange={(open) => !open && setNodeToDisable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable this node?</AlertDialogTitle>
            <AlertDialogDescription>
              It will stop receiving new requests. You can add a replacement node at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisable} className="bg-destructive hover:bg-destructive/90">
              Confirm disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
