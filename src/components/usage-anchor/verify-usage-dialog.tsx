'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { makeAuthenticatedRequest } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { CHAIN_NAMES, verifyProof, type AnchorsDoc, type Proof, type ProofResult } from '@/lib/usage-anchor';

const TRANSPARENCY_URL = 'https://www.gatewayz.ai/transparency';

/**
 * The published anchoring setup, or null while it isn't configured. Used to
 * show "Verify on-chain" only once there is a contract to verify against.
 */
export function usePublishedAnchors(): AnchorsDoc | null {
  const [doc, setDoc] = useState<AnchorsDoc | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`${API_BASE_URL}/.well-known/anchors.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AnchorsDoc | null) => {
        if (live && d?.configured && d.contract_address) setDoc(d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return doc;
}

type State =
  | { step: 'loading' }
  | { step: 'unavailable'; detail: string }
  | { step: 'done'; proof: Proof & { explorer_url?: string | null }; result: ProofResult };

/**
 * Fetches the inclusion proof for one of the user's usage records and checks
 * it in the browser: the root is recomputed locally and compared with the
 * root read from the contract, never with the root the API sent.
 */
export function VerifyUsageDialog({
  ledgerId,
  published,
  open,
  onOpenChange,
}: {
  ledgerId: number;
  published: AnchorsDoc;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<State>({ step: 'loading' });

  useEffect(() => {
    if (!open) return;
    let live = true;
    setState({ step: 'loading' });
    (async () => {
      try {
        const r = await makeAuthenticatedRequest(`${API_BASE_URL}/v1/anchors/proof/${ledgerId}`);
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          // 409: the record's day isn't anchored yet (or can't be proven); 404: not this user's record.
          const detail = r.status === 409 ? String(body.detail ?? 'This day is not anchored yet.') : `The proof isn't available (HTTP ${r.status}).`;
          if (live) setState({ step: 'unavailable', detail });
          return;
        }
        const proof = await r.json();
        const result = await verifyProof(proof, published);
        if (live) setState({ step: 'done', proof, result });
      } catch (e) {
        if (live) setState({ step: 'unavailable', detail: `Check failed: ${(e as Error).message}` });
      }
    })();
    return () => {
      live = false;
    };
  }, [open, ledgerId, published]);

  const chain = CHAIN_NAMES[published.chain_id] ?? `chain ${published.chain_id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify on-chain</DialogTitle>
          <DialogDescription>
            Each day&apos;s usage records are hashed into one Merkle root, written to {chain}. Your browser recomputes the root from
            this record and compares it with the one on the contract.
          </DialogDescription>
        </DialogHeader>

        {state.step === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Fetching the proof and reading the chain…
          </p>
        )}

        {state.step === 'unavailable' && <p className="text-sm text-muted-foreground">{state.detail}</p>}

        {state.step === 'done' && (
          <div className="space-y-3 text-sm">
            {state.result.ok ? (
              <p className="flex items-center gap-2 font-medium text-green-600">
                <CheckCircle className="h-4 w-4" /> Verified: this record is in the root anchored for {state.proof.day}.
              </p>
            ) : (
              <p className="flex items-center gap-2 font-medium text-red-600">
                <XCircle className="h-4 w-4" /> Not verified. {'reason' in state.result ? state.result.reason : ''}
              </p>
            )}
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 font-mono text-xs">
              <dt className="text-muted-foreground">record</dt>
              <dd className="break-all">{ledgerId}</dd>
              <dt className="text-muted-foreground">computed</dt>
              <dd className="break-all">{state.result.computedRoot ?? '-'}</dd>
              <dt className="text-muted-foreground">on-chain</dt>
              <dd className="break-all">{state.result.onchainRoot ?? '-'}</dd>
            </dl>
            <div className="flex flex-wrap gap-4">
              {state.proof.explorer_url && (
                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={state.proof.explorer_url} target="_blank" rel="noreferrer">
                  Anchor transaction <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={TRANSPARENCY_URL} target="_blank" rel="noreferrer">
                How this works <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
