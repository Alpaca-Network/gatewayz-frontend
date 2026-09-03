"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, Wallet as WalletIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveWallet } from "@/lib/hooks/use-active-wallet";
import { useLinkedWallets, useLinkWallet, useUnlinkWallet } from "@/lib/hooks/use-linked-wallets";
import { requestWalletLinkNonce, describeWalletAuthError, WalletAuthError, type LinkedWallet } from "@/lib/auth/wallet-auth-api";

/** Truncates a 0x-address to `0x1234...abcd` (first 6 + last 4 characters). */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function describeUnknownError(): string {
  return "Something went wrong. Please try again.";
}

function WalletRow({
  wallet,
  onUnlink,
}: {
  wallet: LinkedWallet;
  onUnlink: (address: string) => void;
}) {
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(wallet.wallet_address);
      toast({ title: "Address copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy address", variant: "destructive" });
    }
  };

  return (
    <div className="px-4 py-3 hover:bg-muted/50 dark:hover:bg-muted/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm truncate">{truncateAddress(wallet.wallet_address)}</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy}>
            <Copy className="h-3 w-3" />
          </Button>
          {wallet.is_primary && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
              Primary
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="secondary">{wallet.source === "privy" ? "Privy" : "Signed"}</Badge>
          {wallet.wallet_client_type && (
            <Badge variant="outline" className="capitalize">
              {wallet.wallet_client_type}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
            onClick={() => onUnlink(wallet.wallet_address)}
          >
            Unlink
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WalletsPage() {
  const { toast } = useToast();
  const { address, chainId, isConnected, connect, signMessage } = useActiveWallet();
  const { data: wallets, isLoading, isError } = useLinkedWallets();
  const linkWalletMutation = useLinkWallet();
  const unlinkWalletMutation = useUnlinkWallet();

  const [isLinking, setIsLinking] = useState(false);
  const [walletToUnlink, setWalletToUnlink] = useState<string | null>(null);
  // Set when "Link a wallet" is clicked without a connected wallet — connect() opens
  // Privy's connect-wallet modal asynchronously, so the nonce/sign/link steps continue in
  // the effect below once `address` becomes available, rather than inline in the handler.
  const pendingLinkRef = useRef(false);

  const performLink = async (walletAddress: string) => {
    setIsLinking(true);
    try {
      const nonce = await requestWalletLinkNonce(walletAddress, chainId ?? undefined);
      const signature = await signMessage(nonce.message);
      await linkWalletMutation.mutateAsync({ walletAddress, message: nonce.message, signature });
      toast({ title: "Wallet linked", description: truncateAddress(walletAddress) });
    } catch (error) {
      if (error instanceof WalletAuthError) {
        toast({
          title: "Could not link wallet",
          description: describeWalletAuthError(error),
          variant: "destructive",
        });
      } else {
        toast({ title: "Could not link wallet", description: describeUnknownError(), variant: "destructive" });
      }
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    if (pendingLinkRef.current && isConnected && address) {
      pendingLinkRef.current = false;
      performLink(address);
    }
    // performLink is stable enough for this purpose; re-running on every render would
    // re-trigger the link flow, which the pendingLinkRef guard above already prevents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  const handleLinkClick = async () => {
    if (!isConnected || !address) {
      pendingLinkRef.current = true;
      await connect();
      return;
    }
    await performLink(address);
  };

  const handleConfirmUnlink = async () => {
    if (!walletToUnlink) return;
    const target = walletToUnlink;
    setWalletToUnlink(null);
    try {
      await unlinkWalletMutation.mutateAsync(target);
      toast({ title: "Wallet unlinked", description: truncateAddress(target) });
    } catch (error) {
      if (error instanceof WalletAuthError) {
        toast({
          title: "Could not unlink wallet",
          description: describeWalletAuthError(error),
          variant: "destructive",
        });
      } else {
        toast({ title: "Could not unlink wallet", description: describeUnknownError(), variant: "destructive" });
      }
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div className="flex justify-center">
        <h1 className="text-2xl sm:text-3xl font-bold">Wallets</h1>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-semibold">Linked Wallets</h2>
          <Button onClick={handleLinkClick} disabled={isLinking}>
            <WalletIcon className="h-4 w-4 mr-2" />
            {isLinking ? "Linking..." : "Link a wallet"}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isError ? (
          <div className="text-center py-12 border border-border rounded-lg bg-card">
            <p className="text-muted-foreground">Failed to load your wallets. Please try again.</p>
          </div>
        ) : !wallets || wallets.length === 0 ? (
          <div className="text-center py-12 border border-border rounded-lg bg-muted/30">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <WalletIcon className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">No wallets linked yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Link a wallet to sign in with it and stake WAYZ from this account.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-border overflow-hidden border-x-0 bg-card divide-y divide-border">
            {wallets.map((wallet) => (
              <WalletRow key={wallet.wallet_address} wallet={wallet} onUnlink={setWalletToUnlink} />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!walletToUnlink} onOpenChange={(open) => !open && setWalletToUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink this wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              {walletToUnlink && `${truncateAddress(walletToUnlink)} will no longer be able to sign in to this account.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUnlink} className="bg-destructive hover:bg-destructive/90">
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
