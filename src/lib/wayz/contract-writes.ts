// WAYZ staking write flows: approve+stake, requestUnstake, cancelUnstake,
// withdraw. Each takes a viem `WalletClient` built from the active wallet's
// EIP-1193 provider (see wallet-provider.ts) — kept independent of wagmi so
// this works before #2243 merges wagmi's provider in.
import {
  BaseError,
  ContractFunctionRevertedError,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { avalancheFuji } from './chains';
import { wayzTokenAbi } from './abi/wayz-token';
import { wayzStakingAbi } from './abi/wayz-staking';

/** The slice of each viem client this module actually calls — narrowed for testability. */
export type StakingWalletClient = Pick<WalletClient, 'writeContract'>;
export type StakingWaitClient = Pick<PublicClient, 'waitForTransactionReceipt'>;

export interface WriteContext {
  walletClient: StakingWalletClient;
  publicClient: StakingWaitClient;
  account: Address;
  /** Called before every write to make sure the wallet is on Fuji first. */
  switchToFuji: () => Promise<void>;
}

/** Friendly copy for the staking contract's custom errors (see abi/wayz-staking.ts). */
const STAKING_ERROR_MESSAGES: Record<string, string> = {
  ZeroAmount: 'Amount must be greater than zero.',
  InsufficientStake: 'You do not have enough staked WAYZ to unstake that amount.',
  PendingUnstakeExists: 'You already have a pending unstake request — cancel it before starting a new one.',
  NoPendingUnstake: 'There is no pending unstake request to act on.',
  StillCoolingDown: 'This unstake is still cooling down. Check back after the cooldown ends.',
  ZeroAddress: 'Invalid wallet address.',
};

/** Thrown by every write helper below with a friendly, already-decoded message. */
export class StakingWriteError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StakingWriteError';
    this.cause = cause;
  }
}

/** Decodes a viem write/revert error into user-facing copy, using the custom errors when present. */
export function decodeStakingError(error: unknown): string {
  if (error instanceof BaseError) {
    const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      if (errorName && STAKING_ERROR_MESSAGES[errorName]) {
        return STAKING_ERROR_MESSAGES[errorName];
      }
      if (errorName) {
        return `Transaction reverted: ${errorName}`;
      }
    }
    return error.shortMessage || error.message;
  }
  return error instanceof Error ? error.message : 'Transaction failed. Please try again.';
}

async function sendAndWait(ctx: WriteContext, send: () => Promise<Hash>): Promise<Hash> {
  await ctx.switchToFuji();
  try {
    const hash = await send();
    await ctx.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  } catch (error) {
    throw new StakingWriteError(decodeStakingError(error), error);
  }
}

/**
 * Approves the staking contract for `amount` (skipped if the current
 * allowance already covers it) and then stakes `amount`. Returns every tx
 * hash sent, in order.
 */
export async function approveAndStake(
  ctx: WriteContext,
  params: { tokenAddress: Address; stakingAddress: Address; amount: bigint; currentAllowance: bigint }
): Promise<Hash[]> {
  const { tokenAddress, stakingAddress, amount, currentAllowance } = params;
  const hashes: Hash[] = [];

  if (currentAllowance < amount) {
    const approveHash = await sendAndWait(ctx, () =>
      ctx.walletClient.writeContract({
        address: tokenAddress,
        abi: wayzTokenAbi,
        functionName: 'approve',
        args: [stakingAddress, amount],
        account: ctx.account,
        chain: avalancheFuji,
      })
    );
    hashes.push(approveHash);
  }

  const stakeHash = await sendAndWait(ctx, () =>
    ctx.walletClient.writeContract({
      address: stakingAddress,
      abi: wayzStakingAbi,
      functionName: 'stake',
      args: [amount],
      account: ctx.account,
      chain: avalancheFuji,
    })
  );
  hashes.push(stakeHash);

  return hashes;
}

/** Requests an unstake of `amount`. Reverts with `PendingUnstakeExists` if one is already pending. */
export async function requestUnstake(
  ctx: WriteContext,
  params: { stakingAddress: Address; amount: bigint }
): Promise<Hash> {
  return sendAndWait(ctx, () =>
    ctx.walletClient.writeContract({
      address: params.stakingAddress,
      abi: wayzStakingAbi,
      functionName: 'requestUnstake',
      args: [params.amount],
      account: ctx.account,
      chain: avalancheFuji,
    })
  );
}

/** Cancels the pending unstake request, returning the amount to the staked balance. */
export async function cancelUnstake(ctx: WriteContext, params: { stakingAddress: Address }): Promise<Hash> {
  return sendAndWait(ctx, () =>
    ctx.walletClient.writeContract({
      address: params.stakingAddress,
      abi: wayzStakingAbi,
      functionName: 'cancelUnstake',
      account: ctx.account,
      chain: avalancheFuji,
    })
  );
}

/** Withdraws a pending unstake once its cooldown has elapsed. */
export async function withdraw(ctx: WriteContext, params: { stakingAddress: Address }): Promise<Hash> {
  return sendAndWait(ctx, () =>
    ctx.walletClient.writeContract({
      address: params.stakingAddress,
      abi: wayzStakingAbi,
      functionName: 'withdraw',
      account: ctx.account,
      chain: avalancheFuji,
    })
  );
}
