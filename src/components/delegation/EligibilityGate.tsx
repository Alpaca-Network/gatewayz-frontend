"use client";

// Self-attestation in front of starting something new: linking a wallet,
// staking ETH, delegating ADA. The IP check in src/middleware.ts is easy to get
// around, so the user also confirms they are outside the US and Canada.
// Leaving is never gated: connecting a wallet, viewing a position, exiting and
// claiming all sit outside this component.
//
// The backend keeps the attestation (POST /delegation/eligibility) and pays
// nothing to an account without one. A signed-in account it already knows as
// eligible skips the box; one it has no attestation for sees the box even if
// this browser ticked it before (maybe for another account). The tick kept in
// localStorage covers a signed-out visitor and a backend that predates this.
import { useEffect, useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ATTESTATION_REQUIRED_MESSAGE,
  DelegationApiError,
  REGION_RESTRICTED_MESSAGE,
  attestDelegationEligibility,
  delegationRefusalOf,
} from '@/lib/delegation/api';
import { ATTESTATION_CHANGED_EVENT, ATTESTATION_LABEL, hasAttested, recordAttestation } from '@/lib/delegation/region';
import { delegationQueryKeys } from '@/lib/delegation/use-delegation';
import { useServerEligibility } from '@/lib/delegation/use-region';

/** This browser's tick, kept in sync across every gate on the page. */
function useLocalAttestation(): boolean | undefined {
  const [attested, setAttested] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const read = () => setAttested(hasAttested());
    read();
    window.addEventListener(ATTESTATION_CHANGED_EVENT, read);
    return () => window.removeEventListener(ATTESTATION_CHANGED_EVENT, read);
  }, []);
  return attested;
}

export function EligibilityGate({ children }: { children: ReactNode }) {
  const server = useServerEligibility();
  const localAttested = useLocalAttestation();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the backend stored it, so the box closes before the rewards refetch.
  const [savedHere, setSavedHere] = useState(false);
  const checkboxId = useId();

  if (server?.status === 'restricted') {
    return (
      <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        {REGION_RESTRICTED_MESSAGE}
      </p>
    );
  }
  if (server?.status === 'eligible' || savedHere) return <>{children}</>;
  if (localAttested === undefined) return null;
  if (localAttested && server?.status !== 'none') return <>{children}</>;

  const handleContinue = async () => {
    setError(null);
    // Signed in with a backend that tracks eligibility: it has to store the
    // attestation, or nothing is ever paid. Otherwise the tick stays local and
    // goes up with the first link request.
    if (server) {
      setSaving(true);
      try {
        await attestDelegationEligibility();
      } catch (err) {
        const refusal = delegationRefusalOf(err);
        if (refusal === 'region_restricted') {
          // The account is now restricted: the rewards refetch switches the
          // section to its exit-only view.
          queryClient.invalidateQueries({ queryKey: delegationQueryKeys.rewards });
          setError(REGION_RESTRICTED_MESSAGE);
          return;
        }
        if (refusal === 'attestation_required') {
          setError(ATTESTATION_REQUIRED_MESSAGE);
          return;
        }
        // 404: a backend without the endpoint; the link request carries the tick.
        if (!(err instanceof DelegationApiError && err.status === 404)) {
          setError('Could not save your confirmation. Please try again.');
          return;
        }
      } finally {
        setSaving(false);
      }
      setSavedHere(true);
      queryClient.invalidateQueries({ queryKey: delegationQueryKeys.rewards });
    }
    recordAttestation();
  };

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
      <Button disabled={!checked || saving} onClick={handleContinue}>
        {saving ? 'Saving...' : 'Continue'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
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
