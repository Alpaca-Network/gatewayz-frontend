"use client";

// Self-attestation in front of every wallet action (connect, link, stake,
// delegate). The IP check in src/middleware.ts is easy to get around, so the
// user also confirms they are outside the US and Canada. Accepted once per
// browser; position and discount cards stay outside the gate.
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
