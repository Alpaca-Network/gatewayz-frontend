// Read-only WAYZ contract state via a plain viem public client — deliberately
// independent of wagmi (Workstream A's wagmi provider isn't mounted on this
// branch; see chains.ts). Once #2243 merges, these reads can move to wagmi's
// `useReadContract`/`useReadContracts` if desired, but this module keeps
// working standalone either way.
import { createPublicClient, http, type Address } from 'viem';
import { avalancheFuji, FUJI_RPC_URL } from './chains';
import { wayzTokenAbi } from './abi/wayz-token';
import { wayzStakingAbi } from './abi/wayz-staking';

export function createStakingPublicClient() {
  return createPublicClient({ chain: avalancheFuji, transport: http(FUJI_RPC_URL) });
}

/** Module-level client, reused by default so callers don't create a new one per read. */
export const publicClient = createStakingPublicClient();

/** The slice of the viem public client this module actually calls — narrowed for testability. */
export type StakingPublicClient = Pick<ReturnType<typeof createPublicClient>, 'multicall'>;

export interface PendingUnstake {
  amount: bigint;
  unlockAt: bigint;
}

export interface StakingState {
  tokenBalance: bigint;
  stakedBalance: bigint;
  pending: PendingUnstake;
  totalStaked: bigint;
  allowance: bigint;
  paused: boolean;
}

/**
 * Reads everything the dashboard needs about one wallet + the staking
 * contract in a single multicall. Individual call failures (e.g. a contract
 * that reverts unexpectedly) degrade to safe defaults rather than throwing,
 * so a single bad read doesn't blank the whole page.
 */
export async function readStakingState(
  address: Address,
  addresses: { token: Address; staking: Address },
  client: StakingPublicClient = publicClient
): Promise<StakingState> {
  const { token, staking } = addresses;

  const results = await client.multicall({
    contracts: [
      { address: token, abi: wayzTokenAbi, functionName: 'balanceOf', args: [address] },
      { address: staking, abi: wayzStakingAbi, functionName: 'stakedBalanceOf', args: [address] },
      { address: staking, abi: wayzStakingAbi, functionName: 'pendingUnstake', args: [address] },
      { address: staking, abi: wayzStakingAbi, functionName: 'totalStaked' },
      { address: token, abi: wayzTokenAbi, functionName: 'allowance', args: [address, staking] },
      { address: staking, abi: wayzStakingAbi, functionName: 'paused' },
    ],
    allowFailure: true,
  });

  const [tokenBalanceResult, stakedBalanceResult, pendingResult, totalStakedResult, allowanceResult, pausedResult] =
    results;

  const pendingTuple =
    pendingResult.status === 'success' ? (pendingResult.result as readonly [bigint, bigint]) : undefined;

  const ZERO = BigInt(0);

  return {
    tokenBalance: tokenBalanceResult.status === 'success' ? (tokenBalanceResult.result as bigint) : ZERO,
    stakedBalance: stakedBalanceResult.status === 'success' ? (stakedBalanceResult.result as bigint) : ZERO,
    pending: {
      amount: pendingTuple ? pendingTuple[0] : ZERO,
      unlockAt: pendingTuple ? pendingTuple[1] : ZERO,
    },
    totalStaked: totalStakedResult.status === 'success' ? (totalStakedResult.result as bigint) : ZERO,
    allowance: allowanceResult.status === 'success' ? (allowanceResult.result as bigint) : ZERO,
    paused: pausedResult.status === 'success' ? (pausedResult.result as boolean) : false,
  };
}
