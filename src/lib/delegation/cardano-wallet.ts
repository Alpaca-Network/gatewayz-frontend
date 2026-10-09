"use client";

// Cardano wallet actions over CIP-30, using Mesh SDK (@meshsdk/wallet for the
// CIP-30 wrapper, @meshsdk/transaction for building the certificate tx). Mesh
// is imported dynamically, only when the ADA tab connects a wallet, so it
// never lands in the /rewards page bundle.
//
// Delegation moves no funds: the transaction carries a stake-delegation
// certificate (plus a registration certificate and its refundable 2 ADA
// deposit the first time a stake key is used). ADA stays in the user's wallet
// and spendable, and they can re-delegate at any time.
import type { BrowserWallet } from '@meshsdk/wallet';
import type { CardanoProtocolParams } from './koios';

export const CARDANO_MAINNET_NETWORK_ID = 1;
const DEFAULT_KEY_DEPOSIT_LOVELACE = 2_000_000;

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

/** Enables the CIP-30 wallet under `window.cardano[key]` and reads its stake address. */
export async function connectCardanoWallet(key: string): Promise<ConnectedCardanoWallet> {
  const { BrowserWallet } = await import('@meshsdk/wallet');
  const wallet = await BrowserWallet.enable(key);
  const networkId = await wallet.getNetworkId();
  if (networkId !== CARDANO_MAINNET_NETWORK_ID) {
    throw new CardanoWalletError('Switch your wallet to Cardano mainnet and connect again.');
  }
  const [stakeAddress] = await wallet.getRewardAddresses();
  if (!stakeAddress) throw new CardanoWalletError('This wallet did not share a stake address.');
  return { key, wallet, stakeAddress };
}

/**
 * CIP-30 signData over the backend's link message with the stake key.
 * Mesh hex-encodes the UTF-8 message and the bech32 address before calling the
 * wallet. Returns COSE_Sign1 and COSE_Key, both hex.
 */
export async function signLinkMessage(
  connected: ConnectedCardanoWallet,
  message: string,
): Promise<{ signature: string; key: string }> {
  const { signature, key } = await connected.wallet.signData(message, connected.stakeAddress);
  return { signature, key };
}

export interface DelegationTx {
  unsignedTx: string;
  feeLovelace: bigint;
  /** Refundable key deposit, charged only when the stake key is registered here. */
  depositLovelace: bigint;
}

/** Builds the delegation transaction (no wallet prompt yet) so the fee can be shown. */
export async function buildDelegationTx(
  connected: ConnectedCardanoWallet,
  input: { poolId: string; registered: boolean; params: CardanoProtocolParams | null },
): Promise<DelegationTx> {
  const { MeshTxBuilder } = await import('@meshsdk/transaction');
  const [utxos, changeAddress] = await Promise.all([
    connected.wallet.getUtxos(),
    connected.wallet.getChangeAddress(),
  ]);
  if (utxos.length === 0) {
    throw new CardanoWalletError('This wallet has no ADA to pay the network fee.');
  }

  const builder = new MeshTxBuilder({ params: input.params ?? undefined });
  if (!input.registered) builder.registerStakeCertificate(connected.stakeAddress);
  builder.delegateStakeCertificate(connected.stakeAddress, input.poolId);
  const unsignedTx = await builder.selectUtxosFrom(utxos).changeAddress(changeAddress).complete();
  const keyDeposit = BigInt(input.params?.keyDeposit ?? DEFAULT_KEY_DEPOSIT_LOVELACE);
  return {
    unsignedTx,
    feeLovelace: BigInt(builder.meshTxBuilderBody.fee || '0'),
    depositLovelace: input.registered ? BigInt(0) : keyDeposit,
  };
}

/** Wallet signs (payment + stake key) and submits. Returns the transaction hash. */
export async function signAndSubmit(connected: ConnectedCardanoWallet, unsignedTx: string): Promise<string> {
  const signedTx = await connected.wallet.signTx(unsignedTx);
  return connected.wallet.submitTx(signedTx);
}

export function describeCardanoError(error: unknown, isRejection: (e: unknown) => boolean): string {
  if (error instanceof CardanoWalletError) return error.message;
  if (isRejection(error)) return 'The request was cancelled in your wallet.';
  const text = String((error as { info?: unknown; message?: unknown } | null)?.info ?? (error as Error)?.message ?? '');
  if (/insufficient|not enough|UTxO Balance/i.test(text)) {
    return 'Not enough ADA for the network fee (and the 2 ADA deposit, the first time).';
  }
  return 'Something went wrong. Please try again.';
}
