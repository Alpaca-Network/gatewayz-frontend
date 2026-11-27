"use client";

// The Cardano wallet line on the discount credits card: which stake address
// is linked, and the way to the wallet page to link or unlink one.
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLinkedCardanoWallets } from '@/lib/wallet/use-cardano-wallet-link';
import {
  SUMMARY_LINK,
  SUMMARY_MANAGE,
  SUMMARY_NONE,
  SUMMARY_TITLE,
  WALLET_PAGE_PATH,
  shortStakeAddress,
} from './wallet-copy';

export function WalletLinkSummary() {
  const linked = useLinkedCardanoWallets();
  const wallets = linked.data ?? [];
  const hasLinked = wallets.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h4 className="text-sm font-semibold">{SUMMARY_TITLE}</h4>
        {linked.isLoading ? (
          <span className="text-sm text-muted-foreground">…</span>
        ) : hasLinked ? (
          <ul className="flex flex-col gap-0.5">
            {wallets.map((w) => (
              <li key={w.wallet_address} className="truncate font-mono text-sm" title={w.wallet_address}>
                {shortStakeAddress(w.wallet_address)}
              </li>
            ))}
          </ul>
        ) : (
          // An error reads as "nothing linked" here; the wallet page shows the error itself.
          <p className="text-sm text-muted-foreground">{SUMMARY_NONE}</p>
        )}
      </div>
      <Button asChild variant={hasLinked ? 'outline' : 'default'} size="sm" className="h-10 w-full shrink-0 sm:w-auto">
        <Link href={WALLET_PAGE_PATH}>{hasLinked ? SUMMARY_MANAGE : SUMMARY_LINK}</Link>
      </Button>
    </div>
  );
}
