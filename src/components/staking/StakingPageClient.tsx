"use client";

import { useActiveWallet } from '@/lib/hooks/use-active-wallet';
import { StakingHeader } from './StakingHeader';
import { WalletGate } from './WalletGate';
import { BalancesCard } from './BalancesCard';
import { StakeForm } from './StakeForm';
import { UnstakeCard } from './UnstakeCard';
import { FaucetCard } from './FaucetCard';

export function StakingPageClient() {
  const wallet = useActiveWallet();

  return (
    <div className="container mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <StakingHeader />
      <WalletGate>
        {wallet.address && (
          <div className="flex flex-col gap-6">
            <BalancesCard address={wallet.address} />
            <div className="grid gap-6 sm:grid-cols-2">
              <StakeForm address={wallet.address} />
              <UnstakeCard address={wallet.address} />
            </div>
            <FaucetCard address={wallet.address} />
          </div>
        )}
      </WalletGate>
    </div>
  );
}
