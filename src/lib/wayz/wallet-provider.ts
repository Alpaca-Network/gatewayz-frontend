"use client";

// The ONLY place in src/lib/wayz/ that knows where the wallet's EIP-1193
// provider comes from — the active Privy wallet, via `useWallets()` from
// `@privy-io/react-auth` (feat/wayz-wallet-connect, #2243; the same source
// `useActiveWallet` reads its address/chainId from, and the same
// most-recently-connected-first ordering it relies on for "the active
// wallet"). Every write in this dashboard threads its viem `WalletClient`'s
// transport through this hook rather than reaching for `window.ethereum` or
// Privy directly, so a future provider change is a one-file change.
import { useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import type { EIP1193Provider } from 'viem';

export class NoWalletProviderError extends Error {
  constructor() {
    super('No wallet provider found. Connect a wallet first.');
    this.name = 'NoWalletProviderError';
  }
}

/**
 * Returns a function that resolves the active wallet's EIP-1193 provider.
 * `wallet.getEthereumProvider()` is async (verified against the installed
 * @privy-io/react-auth@3.10.2 types — `ConnectedWallet.getEthereumProvider:
 * () => Promise<EIP1193Provider>`), so this can't be a plain synchronous
 * getter; callers `await` it inside their own async mutation function.
 */
export function useEip1193Provider(): () => Promise<EIP1193Provider> {
  const { wallets } = useWallets();
  const wallet = wallets[0] ?? null;

  return useCallback(async () => {
    if (!wallet) {
      throw new NoWalletProviderError();
    }
    // Privy's ConnectedWallet.getEthereumProvider() returns Privy's OWN
    // EIP1193Provider interface (declared in @privy-io/react-auth), not
    // viem's. The two describe the same standard EIP-1193 surface
    // (request/on/removeListener) but are structurally incompatible under
    // TS's strict checking of `on`'s event-name typing. viem's `custom()`
    // transport only ever calls `.request(...)` on this value, so the cast
    // is safe.
    return (await wallet.getEthereumProvider()) as unknown as EIP1193Provider;
  }, [wallet]);
}
