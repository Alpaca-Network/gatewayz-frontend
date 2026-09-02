"use client";

import { useState, type FormEvent } from 'react';
import { parseUnits, type Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useOnchainStakingState, useApproveAndStake } from '@/lib/hooks/use-wayz-staking';
import { formatWayz } from '@/lib/wayz/format';
import { isWayzConfigured } from '@/lib/wayz/addresses';

function parseAmountOrNull(amount: string): bigint | null {
  if (!amount.trim()) return null;
  try {
    const parsed = parseUnits(amount, 18);
    return parsed > BigInt(0) ? parsed : null;
  } catch {
    return null;
  }
}

export function StakeForm({ address }: { address: Address }) {
  const [amount, setAmount] = useState('');
  const { toast } = useToast();
  const onchainQuery = useOnchainStakingState(address);
  const mutation = useApproveAndStake(address);

  const configured = isWayzConfigured();
  const paused = onchainQuery.data?.paused ?? false;
  const balance = onchainQuery.data?.tokenBalance ?? BigInt(0);
  const allowance = onchainQuery.data?.allowance ?? BigInt(0);
  const disabled = !configured || paused || mutation.isPending;

  const parsedAmount = parseAmountOrNull(amount);
  const needsApproval = parsedAmount !== null && parsedAmount > allowance;

  const handleMax = () => setAmount(formatWayz(balance, 18));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!parsedAmount) {
      toast({ title: 'Enter an amount greater than zero', variant: 'destructive' });
      return;
    }

    try {
      await mutation.mutateAsync({ amount: parsedAmount, currentAllowance: allowance });
      toast({ title: 'Staked successfully' });
      setAmount('');
    } catch (error) {
      toast({
        title: 'Stake failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stake WAYZ</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={disabled}
              aria-label="Amount to stake"
            />
            <Button type="button" variant="outline" onClick={handleMax} disabled={disabled}>
              Max
            </Button>
          </div>

          {!configured && <p className="text-xs text-muted-foreground">Testnet contracts not deployed yet.</p>}
          {configured && paused && <p className="text-xs text-muted-foreground">Staking is currently paused.</p>}
          {configured && !paused && (
            <p className="text-xs text-muted-foreground">
              {mutation.isPending
                ? 'Approving and staking…'
                : needsApproval
                  ? 'Step 1 of 2: approve, then stake'
                  : 'Ready to stake'}
            </p>
          )}

          <Button type="submit" disabled={disabled}>
            Stake
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
