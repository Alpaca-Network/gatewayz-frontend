/**
 * React-query hooks for the WAYZ `/staking` dashboard (gatewayz-backend#2246).
 *
 * Combines three data sources behind one hook surface:
 *  - the backend indexer (`staking-api.ts`) for the summary + per-wallet
 *    snapshot the indexer keeps in sync (refreshed roughly every ~15 min),
 *  - live on-chain reads (`contract-reads.ts`) for the numbers that need to
 *    be current right after a write (balances, allowance, pending unstake),
 *  - the write flows (`contract-writes.ts`), wired up as mutations that
 *    invalidate the reads above on success.
 *
 * Wallet state comes from `useActiveWallet` (Privy-backed, see
 * src/lib/hooks/use-active-wallet.ts) and the EIP-1193 provider from
 * `wallet-provider.ts`'s `useEip1193Provider`, which resolves the active
 * Privy wallet's provider — every mutation throws a clear "not connected"
 * error when no wallet is connected.
 */
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { createWalletClient, custom, type Address } from 'viem';
import { avalancheFuji } from '@/lib/wayz/chains';
import { useActiveWallet } from '@/lib/hooks/use-active-wallet';
import { useEip1193Provider } from '@/lib/wayz/wallet-provider';
import { getWayzAddresses } from '@/lib/wayz/addresses';
import { readStakingState, publicClient, type StakingState } from '@/lib/wayz/contract-reads';
import {
  approveAndStake as approveAndStakeWrite,
  requestUnstake as requestUnstakeWrite,
  cancelUnstake as cancelUnstakeWrite,
  withdraw as withdrawWrite,
  type WriteContext,
} from '@/lib/wayz/contract-writes';
import {
  getStakingSummary,
  getWalletStaking,
  getFaucetStatus,
  requestFaucetNonce,
  claimFaucet,
  type StakingSummary,
  type WalletStaking,
  type FaucetStatus,
  type FaucetClaimResult,
} from '@/lib/wayz/staking-api';

const STALE_TIME = 30_000;
const FAUCET_STALE_TIME = 15_000;

export const wayzQueryKeys = {
  summary: ['wayz', 'summary'] as const,
  wallet: (address: string | null) => ['wayz', 'wallet', address] as const,
  onchain: (address: string | null) => ['wayz', 'onchain', address] as const,
  faucet: (address: string | null) => ['wayz', 'faucet', address] as const,
};

/** GET /staking/summary — protocol-wide totals shown in `StakingHeader`. */
export function useStakingSummary(): UseQueryResult<StakingSummary> {
  return useQuery({
    queryKey: wayzQueryKeys.summary,
    queryFn: getStakingSummary,
    staleTime: STALE_TIME,
  });
}

/** GET /staking/wallets/{address} — the indexer's last-synced snapshot for one wallet. */
export function useWalletStaking(address: string | null): UseQueryResult<WalletStaking> {
  return useQuery({
    queryKey: wayzQueryKeys.wallet(address),
    queryFn: () => getWalletStaking(address as string),
    enabled: Boolean(address),
    staleTime: STALE_TIME,
  });
}

/** Live on-chain balances/allowance/pending-unstake via multicall — used right after a write. */
export function useOnchainStakingState(address: Address | null): UseQueryResult<StakingState> {
  const { token, staking } = getWayzAddresses();
  return useQuery({
    queryKey: wayzQueryKeys.onchain(address),
    queryFn: () => readStakingState(address as Address, { token: token as Address, staking: staking as Address }),
    enabled: Boolean(address && token && staking),
    staleTime: STALE_TIME,
  });
}

/** GET /faucet/status — eligibility + existing claim for the connected wallet. */
export function useFaucetStatus(address: string | null): UseQueryResult<FaucetStatus> {
  return useQuery({
    queryKey: wayzQueryKeys.faucet(address),
    queryFn: () => getFaucetStatus(address as string),
    enabled: Boolean(address),
    staleTime: FAUCET_STALE_TIME,
  });
}

/**
 * Returns a function that builds a `WriteContext` from the active wallet, or
 * null if not connected. Building it is async — `getEip1193Provider()`
 * (Privy's `wallet.getEthereumProvider()`) resolves a promise — so this
 * can't hand back a ready `WriteContext` synchronously; each mutation's
 * `mutationFn` awaits the builder instead.
 */
function useWriteContext(): (() => Promise<WriteContext>) | null {
  const wallet = useActiveWallet();
  const getProvider = useEip1193Provider();

  if (!wallet.isConnected || !wallet.address) {
    return null;
  }

  const account = wallet.address;
  const switchToFuji = wallet.switchToFuji;

  return async () => {
    const provider = await getProvider();
    const walletClient = createWalletClient({
      chain: avalancheFuji,
      transport: custom(provider),
    });

    return { walletClient, publicClient, account, switchToFuji };
  };
}

function useInvalidateStaking(address: Address | null) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: wayzQueryKeys.onchain(address) });
    queryClient.invalidateQueries({ queryKey: wayzQueryKeys.wallet(address) });
    queryClient.invalidateQueries({ queryKey: wayzQueryKeys.summary });
  };
}

/** Approve (if needed) + stake `amount`. */
export function useApproveAndStake(address: Address | null) {
  const buildCtx = useWriteContext();
  const invalidate = useInvalidateStaking(address);
  const { token, staking } = getWayzAddresses();

  return useMutation({
    mutationFn: async ({ amount, currentAllowance }: { amount: bigint; currentAllowance: bigint }) => {
      if (!buildCtx) throw new Error('Connect your wallet first.');
      if (!token || !staking) throw new Error('Staking contracts are not configured yet.');
      const ctx = await buildCtx();
      return approveAndStakeWrite(ctx, { tokenAddress: token, stakingAddress: staking, amount, currentAllowance });
    },
    onSuccess: invalidate,
  });
}

/** Request an unstake of `amount`. */
export function useRequestUnstake(address: Address | null) {
  const buildCtx = useWriteContext();
  const invalidate = useInvalidateStaking(address);
  const { staking } = getWayzAddresses();

  return useMutation({
    mutationFn: async (amount: bigint) => {
      if (!buildCtx) throw new Error('Connect your wallet first.');
      if (!staking) throw new Error('Staking contract is not configured yet.');
      const ctx = await buildCtx();
      return requestUnstakeWrite(ctx, { stakingAddress: staking, amount });
    },
    onSuccess: invalidate,
  });
}

/** Cancel the pending unstake request. */
export function useCancelUnstake(address: Address | null) {
  const buildCtx = useWriteContext();
  const invalidate = useInvalidateStaking(address);
  const { staking } = getWayzAddresses();

  return useMutation({
    mutationFn: async () => {
      if (!buildCtx) throw new Error('Connect your wallet first.');
      if (!staking) throw new Error('Staking contract is not configured yet.');
      const ctx = await buildCtx();
      return cancelUnstakeWrite(ctx, { stakingAddress: staking });
    },
    onSuccess: invalidate,
  });
}

/** Withdraw a pending unstake once its cooldown has elapsed. */
export function useWithdraw(address: Address | null) {
  const buildCtx = useWriteContext();
  const invalidate = useInvalidateStaking(address);
  const { staking } = getWayzAddresses();

  return useMutation({
    mutationFn: async () => {
      if (!buildCtx) throw new Error('Connect your wallet first.');
      if (!staking) throw new Error('Staking contract is not configured yet.');
      const ctx = await buildCtx();
      return withdrawWrite(ctx, { stakingAddress: staking });
    },
    onSuccess: invalidate,
  });
}

/** Nonce -> sign -> claim, in one mutation. Invalidates faucet status on success. */
export function useClaimFaucet(address: string | null) {
  const wallet = useActiveWallet();
  const queryClient = useQueryClient();

  return useMutation<FaucetClaimResult, Error, void>({
    mutationFn: async () => {
      if (!address) throw new Error('Connect your wallet first.');
      const nonce = await requestFaucetNonce(address);
      const signature = await wallet.signMessage(nonce.message);
      return claimFaucet(address, signature);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wayzQueryKeys.faucet(address) });
    },
  });
}
