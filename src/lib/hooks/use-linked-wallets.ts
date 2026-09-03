/**
 * React-query hooks for Settings → Wallets (M2 W3a — gatewayz-backend#2250 #2251).
 * Wraps the typed client in `@/lib/auth/wallet-auth-api.ts`.
 */
import { useMutation, useQuery, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import {
  getLinkedWallets,
  linkWallet,
  unlinkWallet,
  type LinkedWallet,
} from '@/lib/auth/wallet-auth-api';

const LINKED_WALLETS_QUERY_KEY = ['linked-wallets'] as const;

/** GET /auth/wallets — the caller's linked wallets. */
export function useLinkedWallets(
  options: { enabled?: boolean } = {}
): UseQueryResult<LinkedWallet[]> {
  return useQuery({
    queryKey: LINKED_WALLETS_QUERY_KEY,
    queryFn: getLinkedWallets,
    enabled: options.enabled ?? true,
  });
}

/**
 * Links a wallet the caller has already signed a nonce with (see
 * `requestWalletLinkNonce` / `useActiveWallet().signMessage`). On success, invalidates
 * `useLinkedWallets` so the Settings → Wallets list refetches.
 */
export function useLinkWallet(): UseMutationResult<
  LinkedWallet,
  Error,
  { walletAddress: string; message: string; signature: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ walletAddress, message, signature }) => linkWallet(walletAddress, message, signature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LINKED_WALLETS_QUERY_KEY });
    },
  });
}

/** DELETE /auth/wallets/{wallet_address} — invalidates the list on success. */
export function useUnlinkWallet(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (walletAddress: string) => unlinkWallet(walletAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LINKED_WALLETS_QUERY_KEY });
    },
  });
}
