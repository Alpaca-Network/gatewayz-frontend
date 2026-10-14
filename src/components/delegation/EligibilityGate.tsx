"use client";

// Self-attestation in front of starting something new: linking a wallet,
// staking ETH, delegating ADA. The IP check in src/middleware.ts is easy to get
// around, so the user also confirms they are outside the US and Canada.
// Accepted once per browser. Leaving is never gated: connecting a wallet,
// viewing a position, exiting and claiming all sit outside this component.
import { useEffect, useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ATTESTATION_LABEL, hasAttested, recordAttestation } from '@/lib/delegation/region';

export function EligibilityGate({ children }: { children: ReactNode }) {
  const [attested, setAttested] = useState<boolean | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const checkboxId = useId();

  useEffect(() => {
    setAttested(hasAttested());
  }, []);

  if (attested === undefined) return null;
  if (attested) return <>{children}</>;

  return (
    <div className="flex flex-col items-start gap-3 rounded-md border p-4">
      <p className="text-sm text-muted-foreground">
        Delegated staking is not available to residents or citizens of the United States or Canada.{' '}
        <Link href="/stake/terms" className="text-primary underline">
          Terms &amp; eligibility
        </Link>
      </p>
      <div className="flex items-start gap-2">
        <Checkbox id={checkboxId} checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
        <Label htmlFor={checkboxId} className="text-sm leading-snug">
          {ATTESTATION_LABEL}
        </Label>
      </div>
      <Button
        disabled={!checked}
        onClick={() => {
          recordAttestation();
          setAttested(true);
        }}
      >
        Continue
      </Button>
    </div>
  );
}

/** Shown in place of the stake/delegate controls to visitors in a restricted region. */
export function NewStakeUnavailable({ asset }: { asset: 'eth' | 'ada' }) {
  return (
    <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
      New stakes are not available in your region.{' '}
      {asset === 'eth'
        ? 'You can still view, exit and claim an existing position here.'
        : 'Your ADA stays in your wallet; you can re-delegate or spend it from your wallet at any time.'}
    </p>
  );
}
