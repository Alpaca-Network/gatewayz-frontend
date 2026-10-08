"use client";

// Link a wallet for holdings rewards: connect any EVM wallet through Privy
// (MetaMask, Core, Coinbase Wallet, WalletConnect, or the Privy embedded
// wallet) and sign the backend's SIWE message once. Signing is a personal_sign
// on whatever network the wallet is on: no chain switch, no transaction, no
// contracts. Product language is "holdings rewards" only;
// __tests__/language.test.ts enforces the backend's word policy on this file.
import { useEffect, useRef, useState } from 'react';
import { usePrivy, useWallets, type ConnectedWallet } from '@privy-io/react-auth';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useIsTauri } from '@/lib/desktop/hooks';
import { useLinkedWallets, useLinkWallet } from '@/lib/hooks/use-linked-wallets';
import { holdingsQueryKeys } from '@/lib/hooks/use-holdings-rewards';
import {
  describeWalletAuthError,
  requestWalletLinkNonceForAnyChain,
  WalletAuthError,
  type LinkedWallet,
} from '@/lib/auth/wallet-auth-api';
import { truncateAddress } from '@/lib/holdings/format';

export const LINK_WALLET_ANCHOR = 'link-wallet';

/** "eip155:8453" -> 8453; undefined when unparseable. */
function parseChainId(caip2: string | undefined): number | undefined {
  const parsed = Number.parseInt(caip2?.split(':')[1] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function isUserRejection(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  if (e?.code === 4001 || e?.code === 'ACTION_REJECTED') return true;
  return typeof e?.message === 'string' && /reject|denied|cancel/i.test(e.message);
}

function describeLinkError(error: unknown): string {
  if (error instanceof WalletAuthError) return describeWalletAuthError(error);
  if (isUserRejection(error)) return 'The signature request was cancelled.';
  return 'Something went wrong. Please try again.';
}

function linkedLabel(wallet: LinkedWallet): string {
  if (wallet.wallet_client_type === 'privy') return 'Gatewayz wallet';
  if (wallet.wallet_client_type) return wallet.wallet_client_type.replace(/_/g, ' ');
  return wallet.source === 'siwe' ? 'Signed' : 'Privy';
}

function ShellCard({ children }: { children: React.ReactNode }) {
  return (
    <Card id={LINK_WALLET_ANCHOR} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Link a wallet</CardTitle>
        <CardDescription>
          Prove a wallet is yours by signing one message. Signing is free: no transaction, no gas, and no network
          switch. It works with MetaMask, Core, Coinbase Wallet, WalletConnect and your Gatewayz wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

export function HoldingsWalletLink() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDesktop = useIsTauri();
  const { status: authStatus } = useGatewayzAuth();
  const isAuthenticated = authStatus === 'authenticated';
  const { ready: privyReady, connectWallet } = usePrivy();
  const { wallets: connectedWallets } = useWallets();
  const linkedQuery = useLinkedWallets({ enabled: isAuthenticated });
  const linkWalletMutation = useLinkWallet();
  const [linkingAddress, setLinkingAddress] = useState<string | null>(null);
  // Addresses already connected when "Connect a wallet" was clicked. Privy's
  // modal resolves asynchronously, so the wallet it adds is picked up by the
  // effect below and linked straight away.
  const pendingConnectRef = useRef<Set<string> | null>(null);

  const linked = linkedQuery.data ?? [];
  const linkedSet = new Set(linked.map((w) => w.wallet_address.toLowerCase()));
  const unlinkedConnected = connectedWallets.filter((w) => !linkedSet.has(w.address.toLowerCase()));

  const performLink = async (wallet: ConnectedWallet) => {
    setLinkingAddress(wallet.address);
    try {
      const nonce = await requestWalletLinkNonceForAnyChain(wallet.address, parseChainId(wallet.chainId));
      const signature = await wallet.sign(nonce.message);
      await linkWalletMutation.mutateAsync({ walletAddress: wallet.address, message: nonce.message, signature });
      queryClient.invalidateQueries({ queryKey: holdingsQueryKeys.rewards });
      toast({ title: 'Wallet linked', description: truncateAddress(wallet.address) });
    } catch (error) {
      toast({ title: 'Could not link wallet', description: describeLinkError(error), variant: 'destructive' });
    } finally {
      setLinkingAddress(null);
    }
  };

  useEffect(() => {
    const before = pendingConnectRef.current;
    if (!before) return;
    const added = connectedWallets.find((w) => !before.has(w.address.toLowerCase()));
    if (!added) return;
    pendingConnectRef.current = null;
    if (!linkedSet.has(added.address.toLowerCase())) {
      performLink(added);
    }
    // performLink and linkedSet are recomputed every render; the ref guard above
    // makes this fire once per connect, keyed on the wallet list changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedWallets]);

  const handleConnect = () => {
    pendingConnectRef.current = new Set(connectedWallets.map((w) => w.address.toLowerCase()));
    connectWallet();
  };

  if (isDesktop) {
    return (
      <ShellCard>
        <p className="text-sm text-muted-foreground">
          Wallet linking needs a browser wallet. Open beta.gatewayz.ai/rewards in your browser to link one; it then
          counts for this account everywhere.
        </p>
      </ShellCard>
    );
  }

  if (!isAuthenticated || !privyReady || linkedQuery.isLoading) {
    return (
      <ShellCard>
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </ShellCard>
    );
  }

  const busy = linkingAddress !== null;

  return (
    <ShellCard>
      {linkedQuery.isError && (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your linked wallets. Please try again.</p>
      )}

      {linked.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Linked wallets</h3>
          <ul className="divide-y rounded-md border">
            {linked.map((wallet) => (
              <li key={wallet.wallet_address} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-mono text-sm" title={wallet.wallet_address}>
                  {truncateAddress(wallet.wallet_address)}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {linkedLabel(wallet)}
                  </Badge>
                  <Badge>Linked</Badge>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unlinkedConnected.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Connected, not linked yet</h3>
          <ul className="divide-y rounded-md border">
            {unlinkedConnected.map((wallet) => (
              <li key={wallet.address} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm" title={wallet.address}>
                    {truncateAddress(wallet.address)}
                  </span>
                  <Badge variant="outline" className="capitalize">
                    {wallet.walletClientType.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <Button size="sm" onClick={() => performLink(wallet)} disabled={busy}>
                  {linkingAddress === wallet.address ? 'Waiting for signature...' : 'Link with a signature'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {linked.length === 0 && unlinkedConnected.length === 0 && (
        <p className="text-sm text-muted-foreground">No wallets linked yet.</p>
      )}

      <div className="flex flex-col items-start gap-2">
        <Button variant={unlinkedConnected.length > 0 ? 'outline' : 'default'} onClick={handleConnect} disabled={busy}>
          {linked.length > 0 ? 'Connect another wallet' : 'Connect a wallet'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Your wallet may offer to switch networks when it connects. You can decline; linking works on any network.
        </p>
      </div>
    </ShellCard>
  );
}
