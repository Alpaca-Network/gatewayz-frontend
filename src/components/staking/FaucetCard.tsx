"use client";

import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFaucetStatus, useClaimFaucet } from '@/lib/hooks/use-wayz-staking';
import { FaucetError, describeFaucetError } from '@/lib/wayz/staking-api';

const SNOWTRACE_TESTNET_TX_URL = 'https://testnet.snowtrace.io/tx/';

export function FaucetCard({ address }: { address: Address | null }) {
  const { toast } = useToast();
  const statusQuery = useFaucetStatus(address);
  const claimMutation = useClaimFaucet(address);
  const data = statusQuery.data;

  const handleClaim = async () => {
    try {
      const result = await claimMutation.mutateAsync();
      toast({ title: `Claimed ${result.amount} WAYZ` });
    } catch (error) {
      const description =
        error instanceof FaucetError ? describeFaucetError(error) : error instanceof Error ? error.message : undefined;
      toast({ title: 'Claim failed', description, variant: 'destructive' });
    }
  };

  if (statusQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Testnet Faucet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading faucet status…</CardContent>
      </Card>
    );
  }

  if (!data || !data.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Testnet Faucet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">The testnet faucet is not configured yet.</CardContent>
      </Card>
    );
  }

  if (data.claim) {
    const claim = data.claim;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Testnet Faucet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            Claim status: <span className="font-medium">{claim.status}</span>
          </p>
          {claim.tx_hash && (
            <a
              className="text-primary underline"
              href={`${SNOWTRACE_TESTNET_TX_URL}${claim.tx_hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction on Snowtrace
            </a>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!data.eligible) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Testnet Faucet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Complete at least {data.min_requests} inference request{data.min_requests === 1 ? '' : 's'} to unlock the
          faucet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Testnet Faucet</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">You&apos;re eligible for testnet WAYZ.</p>
        <Button onClick={handleClaim} disabled={claimMutation.isPending}>
          Claim {data.claim_amount} WAYZ
        </Button>
      </CardContent>
    </Card>
  );
}
