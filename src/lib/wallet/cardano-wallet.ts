"use client";

// Cardano wallet connection over CIP-30 and message signing over CIP-8, using
// Mesh SDK's CIP-30 wrapper (@meshsdk/wallet). Mesh is imported dynamically,
// only when a wallet is connected, so it stays out of every page's first load.
//
// Connecting and signing move no funds and send no transaction: the wallet
// shares its stake address and signs one message with the stake key, which
// ./cardano-link-api.ts sends to the backend to link the wallet to the account.
import type { BrowserWallet } from '@meshsdk/wallet';
import { cardanoNetworkConfig, type CardanoNetwork } from './cardano-network';
import { isCip30Rejection } from './cip30';

export interface ConnectedCardanoWallet {
  key: string;
  wallet: BrowserWallet;
  /** Bech32 reward (stake) address, `stake1...`. */
  stakeAddress: string;
}

export class CardanoWalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CardanoWalletError';
  }
}

/**
 * Enables the CIP-30 wallet under `window.cardano[key]` and reads its stake address.
 * Only a testnet demo passes "preprod" (no caller yet; kept for the vault's testnet phase).
 */
export async function connectCardanoWallet(
  key: string,
  network: CardanoNetwork = 'mainnet',
): Promise<ConnectedCardanoWallet> {
  const { walletNetworkId, stakeAddressPrefix } = cardanoNetworkConfig(network);
  const { BrowserWallet } = await import('@meshsdk/wallet');
  const wallet = await BrowserWallet.enable(key);
  const networkId = await wallet.getNetworkId();
  if (networkId !== walletNetworkId) {
    throw new CardanoWalletError(
      network === 'preprod'
        ? 'Switch your wallet to the Cardano preprod testnet and connect again.'
        : 'Switch your wallet to Cardano mainnet and connect again.',
    );
  }
  // Mesh returns these bech32-encoded ("stake1..."), the form the backend expects.
  const [stakeAddress] = await wallet.getRewardAddresses();
  if (!stakeAddress) throw new CardanoWalletError('This wallet did not share a stake address.');
  // Key-hash mainnet stake addresses (header 0xe1) encode as "stake1u..." (0xe0,
  // "stake_test1u..." on testnets); script ones (0xf1, "stake17...") have no key to
  // sign with and the backend rejects them.
  if (!stakeAddress.startsWith(stakeAddressPrefix)) {
    throw new CardanoWalletError('This wallet uses a script stake address, which cannot sign. Use a regular wallet.');
  }
  return { key, wallet, stakeAddress };
}

/**
 * CIP-30 signData with the stake key. The backend verifies that the COSE
 * protected `address` header is the stake address and the payload is
 * hex(utf8(message)); it sends that hex as `payload_hex`, which is signed
 * as-is when present. Mesh converts the bech32 address to raw bytes for the
 * wallet. Returns COSE_Sign1 and COSE_Key, both hex.
 */
export async function signLinkMessage(
  connected: ConnectedCardanoWallet,
  nonce: { message: string; payload_hex: string | null },
): Promise<{ signature: string; key: string }> {
  // The user reads `message`; the wallet signs `payload_hex`. They must be the
  // same text, or the user would be signing something they were not shown.
  const expectedHex = utf8ToHex(nonce.message);
  if (nonce.payload_hex && nonce.payload_hex.toLowerCase() !== expectedHex) {
    throw new CardanoWalletError('The message to sign did not match. Please try again.');
  }
  const { signature, key } = await connected.wallet.signData(expectedHex, connected.stakeAddress, false);
  return { signature, key };
}

function utf8ToHex(text: string): string {
  return Array.from(new TextEncoder().encode(text), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Short, user-facing copy for a failed connect or signature. */
export function describeCardanoError(error: unknown): string {
  if (error instanceof CardanoWalletError) return error.message;
  if (isCip30Rejection(error)) return 'The request was cancelled in your wallet.';
  return 'Something went wrong. Please try again.';
}
