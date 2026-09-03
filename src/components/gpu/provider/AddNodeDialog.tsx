"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCreateGpuNode } from '@/lib/hooks/use-gpu-provider';
import { GpuProviderApiError, describeGpuProviderError, type GpuNodeModel } from '@/lib/gpu/provider-api';

const EMPTY_FORM = {
  name: '',
  region: '',
  gpuModel: '',
  vramGb: '',
  bandwidthMbps: '',
  endpointUrl: '',
  endpointApiKey: '',
  modelsCsv: '',
};

/** Parses a comma-separated "id[:max_context], id2[:max_context]" list into GpuNodeModel[]. */
function parseModelsCsv(csv: string): GpuNodeModel[] {
  return csv
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, maxContext] = entry.split(':').map((s) => s.trim());
      return { id, max_context: maxContext ? Number(maxContext) : 8192 };
    });
}

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function AddNodeDialog() {
  const { toast } = useToast();
  const createNodeMutation = useCreateGpuNode();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const models = parseModelsCsv(form.modelsCsv);
  const urlValid = form.endpointUrl === '' || isValidHttpsUrl(form.endpointUrl);
  const canSubmit =
    form.name.trim() &&
    form.region.trim() &&
    form.gpuModel.trim() &&
    form.vramGb &&
    form.bandwidthMbps &&
    isValidHttpsUrl(form.endpointUrl) &&
    form.endpointApiKey.trim() &&
    models.length > 0;

  const resetAndClose = () => {
    setOpen(false);
    setForm(EMPTY_FORM);
    setRevealedToken(null);
    setCopied(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      const result = await createNodeMutation.mutateAsync({
        name: form.name.trim(),
        region: form.region.trim(),
        gpu_model: form.gpuModel.trim(),
        vram_gb: Number(form.vramGb),
        bandwidth_mbps: Number(form.bandwidthMbps),
        endpoint_url: form.endpointUrl.trim(),
        endpoint_api_key: form.endpointApiKey.trim(),
        models,
      });
      // Shown once — the backend never returns this token again (spec.md §3).
      setRevealedToken(result.node_token);
    } catch (error) {
      const description =
        error instanceof GpuProviderApiError ? describeGpuProviderError(error) : 'Something went wrong. Please try again.';
      toast({ title: 'Could not add node', description, variant: 'destructive' });
    }
  };

  const handleCopy = async () => {
    if (!revealedToken) return;
    try {
      await navigator.clipboard.writeText(revealedToken);
      setCopied(true);
    } catch {
      toast({ title: 'Failed to copy token', variant: 'destructive' });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetAndClose();
        } else {
          setOpen(true);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>Add node</Button>
      </DialogTrigger>
      <DialogContent>
        {revealedToken ? (
          <>
            <DialogHeader>
              <DialogTitle>Node token</DialogTitle>
              <DialogDescription>
                Copy this token now — you won&apos;t see it again. Put it in your node agent&apos;s config as the
                bearer token for heartbeats.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
              <code className="flex-1 overflow-x-auto text-sm">{revealedToken}</code>
              <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={resetAndClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a GPU node</DialogTitle>
              <DialogDescription>
                Your endpoint must be reachable over https and answer <code>GET /v1/models</code> with the model ids
                below.
              </DialogDescription>
            </DialogHeader>
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="node-name">Name</Label>
                  <Input id="node-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="node-region">Region</Label>
                  <Input
                    id="node-region"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="node-gpu-model">GPU model</Label>
                  <Input
                    id="node-gpu-model"
                    value={form.gpuModel}
                    onChange={(e) => setForm({ ...form, gpuModel: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="node-vram">VRAM (GB)</Label>
                  <Input
                    id="node-vram"
                    type="number"
                    value={form.vramGb}
                    onChange={(e) => setForm({ ...form, vramGb: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="node-bandwidth">Bandwidth (Mbps)</Label>
                  <Input
                    id="node-bandwidth"
                    type="number"
                    value={form.bandwidthMbps}
                    onChange={(e) => setForm({ ...form, bandwidthMbps: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="node-endpoint-url">Endpoint URL</Label>
                <Input
                  id="node-endpoint-url"
                  value={form.endpointUrl}
                  onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })}
                  placeholder="https://your-node.example.com"
                />
                {!urlValid && <p className="text-xs text-destructive">Must be an https URL.</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="node-endpoint-key">Endpoint API key</Label>
                <Input
                  id="node-endpoint-key"
                  type="password"
                  value={form.endpointApiKey}
                  onChange={(e) => setForm({ ...form, endpointApiKey: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="node-models">Models</Label>
                <Input
                  id="node-models"
                  value={form.modelsCsv}
                  onChange={(e) => setForm({ ...form, modelsCsv: e.target.value })}
                  placeholder="llama-3.1-8b-instruct:8192, mistral-7b-instruct:4096"
                />
                <p className="text-xs text-muted-foreground">Comma-separated model id[:max_context] pairs.</p>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={!canSubmit || createNodeMutation.isPending}>
                  {createNodeMutation.isPending ? 'Adding…' : 'Register node'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
