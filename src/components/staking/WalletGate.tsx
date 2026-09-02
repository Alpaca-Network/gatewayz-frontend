"use client";

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useActiveWallet } from '@/lib/hooks/use-active-wallet';
import { FUJI_CHAIN_ID } from '@/lib/wayz/chains';

/** Gates staking/faucet actions behind "wallet connected" + "on Avalanche Fuji". */
export function WalletGate({ children }: { children: ReactNode }) {
  const wallet = useActiveWallet();

  if (!wallet.isReady) {
    return <p className="text-sm text-muted-foreground">Loading wallet…</p>;
  }

  if (!wallet.isConnected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">Connect a wallet to stake WAYZ and claim testnet tokens.</p>
          <Button onClick={() => wallet.connect()}>Connect Wallet</Button>
        </CardContent>
      </Card>
    );
  }

  if (wallet.chainId !== FUJI_CHAIN_ID) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">Switch your wallet to the Avalanche Fuji testnet to continue.</p>
          <Button onClick={() => wallet.switchToFuji()}>Switch to Avalanche Fuji</Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
