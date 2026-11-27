"use client";

// React Query hooks for the discount credits wallet page: the linked Cardano
// stake addresses, linking one (nonce, CIP-8 signature, link) and unlinking.
// Nothing is fetched while the discount credits build flag is off.
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { isVaultDiscountCreditsEnabled } from '@/lib/discount-credits/flag';
import {
  getLinkedCardanoWallets,
  linkCardanoStakeAddress,
  requestCardanoLinkNonce,
  unlinkCardanoStakeAddress,
  type CardanoLinkedWallet,
  type LinkedCardanoWallet,
} from './cardano-link-api';
import { signLinkMessage, type ConnectedCardanoWallet } from './cardano-wallet';

export const cardanoWalletsQueryKey = ['cardano-wallets'] as const;
// Settings > Wallets lists every linked wallet under this key; keep it in step.
const linkedWalletsQueryKey = ['linked-wallets'] as const;

/** The account's linked Cardano stake addresses. */
export function useLinkedCardanoWallets(options: { enabled?: boolean } = {}): UseQueryResult<LinkedCardanoWallet[]> {
  return useQuery({
    queryKey: cardanoWalletsQueryKey,
    queryFn: getLinkedCardanoWallets,
    enabled: (options.enabled ?? true) && isVaultDiscountCreditsEnabled(),
    staleTime: 30_000,
    retry: false,
  });
}

function useInvalidateWallets() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: cardanoWalletsQueryKey }),
      queryClient.invalidateQueries({ queryKey: linkedWalletsQueryKey }),
    ]);
}

export interface LinkCardanoWalletInput {
  connected: ConnectedCardanoWallet;
  /** The user ticked "I am not a resident or citizen of the United States or Canada". */
  notUsCaPerson: boolean;
}

/**
 * Links a connected wallet: asks the backend for the message, has the wallet
 * sign it with the stake key (CIP-8), then sends the signature. No transaction,
 * no funds move.
 */
export function useLinkCardanoWallet(): UseMutationResult<CardanoLinkedWallet, unknown, LinkCardanoWalletInput> {
  const invalidate = useInvalidateWallets();
  return useMutation({
    mutationFn: async ({ connected, notUsCaPerson }: LinkCardanoWalletInput) => {
      const nonce = await requestCardanoLinkNonce(connected.stakeAddress, notUsCaPerson);
      const { signature, key } = await signLinkMessage(connected, nonce);
      return linkCardanoStakeAddress({ stakeAddress: connected.stakeAddress, signature, key, notUsCaPerson });
    },
    onSuccess: () => invalidate(),
  });
}

export function useUnlinkCardanoWallet(): UseMutationResult<void, unknown, string> {
  const invalidate = useInvalidateWallets();
  return useMutation({
    mutationFn: (stakeAddress: string) => unlinkCardanoStakeAddress(stakeAddress),
    // A 404 also means "not linked any more": refresh either way.
    onSettled: () => invalidate(),
  });
}
