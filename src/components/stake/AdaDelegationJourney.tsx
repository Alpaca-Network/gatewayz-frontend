"use client";

// The live ADA flow on /stake: sign in, connect a CIP-30 wallet, link its stake
// address, delegate to the Gatewayz pool, then watch the discount accrue. The
// same panels as /rewards, run under the flag override so /stake works by
// direct link while every listed surface stays dark. The middleware already
// serves /stake/unavailable to restricted countries; the client check here is a
// second lock. Inside the panel, linking and delegating need the eligibility
// attestation; connecting and viewing do not.
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CardanoPoolPanel } from '@/components/delegation/CardanoPoolPanel';
import { DelegationPositionCard } from '@/components/delegation/DelegationPositionCard';
import { InferenceDiscountCard } from '@/components/delegation/InferenceDiscountCard';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { DelegationFlagOverrideProvider } from '@/lib/delegation/flag-override';
import { isCardanoPoolLive, isRewardShareModel } from '@/lib/delegation/flags';
import { useDelegationStatus } from '@/lib/delegation/use-delegation';
import { useDelegationRestricted } from '@/lib/delegation/use-region';

function Journey() {
  const statusQuery = useDelegationStatus();
  const { status: authStatus, login } = useGatewayzAuth();
  const status = statusQuery.data;
  // Edge country, or the backend has marked the account restricted.
  const regionBlocked = useDelegationRestricted();

  if (regionBlocked) {
    return (
      <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        ADA delegation is not available in your region. If you already delegated, your ADA is still in your wallet:
        re-delegate or spend it from your wallet at any time.
      </p>
    );
  }
  if (statusQuery.isLoading || regionBlocked === undefined) {
    return <Skeleton className="h-24 w-full" aria-busy="true" aria-label="Loading ADA delegation" />;
  }
  if (!status || !isCardanoPoolLive(status)) {
    return (
      <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        ADA delegation is not switched on yet. Check back soon.
      </p>
    );
  }

  if (authStatus !== 'authenticated') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">
          Sign in to your Gatewayz account first, so the delegation counts for you.
        </p>
        <Button onClick={() => login()} disabled={authStatus === 'authenticating' || authStatus === 'idle'}>
          Sign in to start
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CardanoPoolPanel status={status} />
      <InferenceDiscountCard status={status} shownDisclaimer={status.disclaimer} />
      <DelegationPositionCard shownDisclaimer={status.disclaimer} rewardShare={isRewardShareModel(status)} />
      {status.disclaimer && (
        <p className="whitespace-pre-line rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          {status.disclaimer}
        </p>
      )}
    </div>
  );
}

export function AdaDelegationJourney() {
  return (
    <DelegationFlagOverrideProvider>
      <Journey />
    </DelegationFlagOverrideProvider>
  );
}
