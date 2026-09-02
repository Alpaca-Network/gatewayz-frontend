// The ONLY place that knows where the wallet's EIP-1193 provider comes from.
//
// Today (pre-#2243) it reads `window.ethereum` directly. Once Workstream A's
// Privy wallet-connect branch merges, this should read the provider off the
// active Privy wallet instead (`wallet.getEthereumProvider()`) — every other
// module in `src/lib/wayz/` goes through this function so that swap is a
// one-file change.
import type { EIP1193Provider } from 'viem';

export class NoWalletProviderError extends Error {
  constructor() {
    super('No wallet provider found. Connect a wallet first.');
    this.name = 'NoWalletProviderError';
  }
}

export function getEip1193Provider(): EIP1193Provider {
  if (typeof window === 'undefined') {
    throw new NoWalletProviderError();
  }

  const provider = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) {
    throw new NoWalletProviderError();
  }

  return provider;
}
