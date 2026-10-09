"use client";

// Confirmation step before any wallet prompt: restates what will happen,
// shows the network-fee estimate (or why the transaction would fail), and
// only then hands off to the wallet.
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmRow {
  label: string;
  value: string;
}

export function ConfirmTxDialog({
  open,
  title,
  description,
  rows,
  estimateFee,
  confirmLabel,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  rows: ConfirmRow[];
  /** Resolves to a formatted fee, or throws with a user-facing reason. */
  estimateFee: () => Promise<string>;
  confirmLabel: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [fee, setFee] = useState<{ state: 'loading' } | { state: 'ok'; value: string } | { state: 'error'; message: string }>(
    { state: 'loading' },
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFee({ state: 'loading' });
    estimateFee()
      .then((value) => !cancelled && setFee({ state: 'ok', value }))
      .catch((error: unknown) =>
        !cancelled &&
        setFee({ state: 'error', message: error instanceof Error ? error.message : 'Could not estimate the fee.' }),
      );
    return () => {
      cancelled = true;
    };
    // Re-estimate each time the dialog opens; estimateFee changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="break-all text-right font-mono">{row.value}</dd>
            </div>
          ))}
          <dt className="text-muted-foreground">Network fee</dt>
          <dd className="text-right font-mono" aria-live="polite">
            {fee.state === 'loading' && 'Estimating...'}
            {fee.state === 'ok' && fee.value}
            {fee.state === 'error' && <span className="font-sans text-destructive">Unavailable</span>}
          </dd>
        </dl>
        {fee.state === 'error' && (
          <p role="alert" className="text-sm text-destructive">
            {fee.message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button onClick={onConfirm} disabled={fee.state !== 'ok'}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
