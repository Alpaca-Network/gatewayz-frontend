"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { parseUnits, type Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useOnchainStakingState, useRequestUnstake, useCancelUnstake, useWithdraw } from '@/lib/hooks/use-wayz-staking';
import { formatWayz, formatCountdown } from '@/lib/wayz/format';

export function UnstakeCard({ address }: { address: Address }) {
  const [amount, setAmount] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const { toast } = useToast();

  const onchainQuery = useOnchainStakingState(address);
  const requestMutation = useRequestUnstake(address);
  const cancelMutation = useCancelUnstake(address);
  const withdrawMutation = useWithdraw(address);

  const pending = onchainQuery.data?.pending;
  const hasPending = Boolean(pending && pending.amount > BigInt(0));

  // Tick the countdown every second while a request is pending.
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasPending]);

  const canWithdraw = hasPending && pending ? Number(pending.unlockAt) * 1000 <= now : false;

  const handleRequest = async (event: FormEvent) => {
    event.preventDefault();
    let parsedAmount: bigint;
    try {
      parsedAmount = parseUnits(amount || '0', 18);
    } catch {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    if (parsedAmount <= BigInt(0)) {
      toast({ title: 'Enter an amount greater than zero', variant: 'destructive' });
      return;
    }

    try {
      await requestMutation.mutateAsync(parsedAmount);
      toast({ title: 'Unstake requested' });
      setAmount('');
    } catch (error) {
      toast({
        title: 'Unstake request failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      toast({ title: 'Unstake cancelled' });
    } catch (error) {
      toast({
        title: 'Cancel failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleWithdraw = async () => {
    try {
      await withdrawMutation.mutateAsync();
      toast({ title: 'Withdrawn to your wallet' });
    } catch (error) {
      toast({
        title: 'Withdraw failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  if (hasPending && pending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Unstake</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-lg font-semibold">{formatWayz(pending.amount)} WAYZ</p>
          <p className="text-sm text-muted-foreground" data-testid="unstake-countdown">
            {formatCountdown(pending.unlockAt, now)}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={cancelMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleWithdraw} disabled={!canWithdraw || withdrawMutation.isPending}>
              Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Unstake</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRequest} className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label="Amount to unstake"
          />
          <Button type="submit" disabled={requestMutation.isPending}>
            Request Unstake
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
