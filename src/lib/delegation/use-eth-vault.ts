"use client";

// React glue for the ETH vault. Clients are built per call on the chosen Privy
// wallet's EIP-1193 provider with chain = Ethereum mainnet, so this never
// touches the app-wide wagmi config (Base + Avalanche Fuji for /staking).
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConnectedWallet } from '@privy-io/react-auth';
import {
  createPublicClient,
  createWalletClient,
  custom,
  zeroAddress,
  type Address,
  type EIP1193Provider,
  type Hash,
  type PublicClient,
} from 'viem';
import { mainnet } from 'viem/chains';
import { ETH_VAULT_ABI } from './stakewise-abi';
import type { DelegationExitTicket } from './api';
import {
  describeTickets,
  ETHEREUM_MAINNET_ID,
  readExitRequests,
  readVaultPosition,
  type ExitRequest,
  type VaultPosition,
} from './eth-vault';
import { delegationQueryKeys } from './use-delegation';

/** "eip155:1" -> 1; undefined when unparseable. */
export function chainIdOf(wallet: Pick<ConnectedWallet, 'chainId'> | null | undefined): number | undefined {
  const parsed = Number.parseInt(wallet?.chainId?.split(':')[1] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function providerOf(wallet: ConnectedWallet): Promise<EIP1193Provider> {
  // Privy's provider type and viem's describe the same EIP-1193 surface but
  // differ in `on` typing; viem's custom() transport only calls request().
  return (await wallet.getEthereumProvider()) as unknown as EIP1193Provider;
}

export async function publicClientFor(wallet: ConnectedWallet): Promise<PublicClient> {
  return createPublicClient({ chain: mainnet, transport: custom(await providerOf(wallet)) }) as PublicClient;
}

/**
 * Asks the wallet itself to switch to Ethereum mainnet. Called only from the
 * ETH tab's own button, never on load, so other pages keep their network.
 */
export async function switchToEthereum(wallet: ConnectedWallet): Promise<void> {
  const provider = await providerOf(wallet);
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
}

export interface EthVaultState {
  position: VaultPosition;
  /** The wallet's own ETH balance, in wei. */
  balance: bigint;
  exits: ExitRequest[];
  /** True when the exit-event scan failed (some wallet RPCs cap log ranges). */
  exitsError: boolean;
}

/**
 * Position, balance and exit queue for one wallet. Exit tickets come from the
 * backend when it lists them (its RPC has no log-range cap); otherwise from an
 * event scan through the wallet's RPC, which some providers refuse.
 */
export function useEthVaultState(
  wallet: ConnectedWallet | null,
  vault: Address | null,
  backendTickets: DelegationExitTicket[] = [],
) {
  const onMainnet = chainIdOf(wallet) === ETHEREUM_MAINNET_ID;
  const address = wallet?.address as Address | undefined;
  const mine = backendTickets.filter((t) => t.wallet_address.toLowerCase() === address?.toLowerCase());
  return useQuery<EthVaultState>({
    queryKey: [...delegationQueryKeys.ethVault, vault, address, mine.map((t) => t.position_ticket).join(',')],
    enabled: !!wallet && !!vault && onMainnet,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const client = await publicClientFor(wallet as ConnectedWallet);
      const [position, balance] = await Promise.all([
        readVaultPosition(client, vault as Address, address as Address),
        client.getBalance({ address: address as Address }),
      ]);
      try {
        const exits =
          mine.length > 0
            ? await describeTickets(
                client,
                vault as Address,
                address as Address,
                mine.map((t) => ({
                  positionTicket: BigInt(t.position_ticket),
                  timestamp: BigInt(t.timestamp),
                  shares: BigInt(t.shares),
                })),
              )
            : await readExitRequests(client, vault as Address, address as Address);
        return { position, balance, exits, exitsError: false };
      } catch {
        return { position, balance, exits: [], exitsError: true };
      }
    },
  });
}

export type VaultAction =
  | { kind: 'deposit'; value: bigint }
  | { kind: 'exit'; shares: bigint }
  | { kind: 'claim'; request: ExitRequest };

export function argsFor(action: VaultAction, receiver: Address) {
  switch (action.kind) {
    case 'deposit':
      return { functionName: 'deposit' as const, args: [receiver, zeroAddress] as const, value: action.value };
    case 'exit':
      return { functionName: 'enterExitQueue' as const, args: [action.shares, receiver] as const, value: undefined };
    case 'claim':
      return {
        functionName: 'claimExitedAssets' as const,
        args: [action.request.positionTicket, action.request.timestamp, action.request.exitQueueIndex ?? BigInt(0)] as const,
        value: undefined,
      };
  }
}

/**
 * Sends one vault transaction from the wallet and waits for it to be mined.
 * Simulates first so a revert (not harvested, over capacity, not claimable)
 * is reported before the wallet ever prompts.
 */
export function useEthVaultAction(wallet: ConnectedWallet | null, vault: Address | null) {
  const queryClient = useQueryClient();
  const send = useCallback(
    async (action: VaultAction): Promise<Hash> => {
      if (!wallet || !vault) throw new Error('Connect a wallet first.');
      const provider = await providerOf(wallet);
      const account = wallet.address as Address;
      const publicClient = createPublicClient({ chain: mainnet, transport: custom(provider) });
      const walletClient = createWalletClient({ account, chain: mainnet, transport: custom(provider) });
      const { functionName, args, value } = argsFor(action, account);
      const { request } = await publicClient.simulateContract({
        address: vault,
        abi: ETH_VAULT_ABI,
        functionName,
        args,
        account,
        value,
      } as never);
      const hash = await walletClient.writeContract(request as never);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('The transaction was reverted.');
      return hash;
    },
    [wallet, vault],
  );

  return useMutation({
    mutationFn: send,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: delegationQueryKeys.ethVault });
      queryClient.invalidateQueries({ queryKey: delegationQueryKeys.rewards });
    },
  });
}
