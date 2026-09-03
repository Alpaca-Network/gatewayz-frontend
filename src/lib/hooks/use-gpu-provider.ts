/**
 * React-query hooks for the `/gpu/provider` portal (Milestone 4, W-D —
 * gatewayz-backend#2262 #2266). Wraps the typed client in
 * `@/lib/gpu/provider-api.ts`. Every mutation that can change the caller's
 * provider/node state invalidates the single `gpu-my-provider` query, which
 * bundles provider + nodes + earnings — same "one list, invalidate
 * on write" shape as `use-linked-wallets.ts`.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import {
  getMyGpuProvider,
  registerGpuProvider,
  createGpuNode,
  patchGpuNode,
  deleteGpuNode,
  rotateGpuNodeToken,
  getMyGpuEarnings,
  type GpuProviderMe,
  type GpuProvider,
  type RegisterGpuProviderInput,
  type CreateGpuNodeInput,
  type CreateGpuNodeResult,
  type PatchGpuNodeInput,
  type GpuNode,
  type GpuEarnings,
} from '@/lib/gpu/provider-api';

const GPU_MY_PROVIDER_QUERY_KEY = ['gpu-my-provider'] as const;
const GPU_MY_EARNINGS_QUERY_KEY = ['gpu-my-earnings'] as const;

/** GET /gpu/providers/me (Bearer) — the caller's provider, nodes, and earnings summary. */
export function useMyGpuProvider(options: { enabled?: boolean } = {}): UseQueryResult<GpuProviderMe> {
  return useQuery({
    queryKey: GPU_MY_PROVIDER_QUERY_KEY,
    queryFn: getMyGpuProvider,
    enabled: options.enabled ?? true,
    retry: false,
  });
}

/** POST /gpu/providers — registers the caller as a GPU provider. */
export function useRegisterGpuProvider(): UseMutationResult<GpuProvider, Error, RegisterGpuProviderInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterGpuProviderInput) => registerGpuProvider(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GPU_MY_PROVIDER_QUERY_KEY });
    },
  });
}

/** POST /gpu/nodes — registers a new node; the returned `node_token` is shown once. */
export function useCreateGpuNode(): UseMutationResult<CreateGpuNodeResult, Error, CreateGpuNodeInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGpuNode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GPU_MY_PROVIDER_QUERY_KEY });
    },
  });
}

/** PATCH /gpu/nodes/{id}. */
export function usePatchGpuNode(): UseMutationResult<GpuNode, Error, { id: number; input: PatchGpuNodeInput }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => patchGpuNode(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GPU_MY_PROVIDER_QUERY_KEY });
    },
  });
}

/** DELETE /gpu/nodes/{id} — disables the node. */
export function useDeleteGpuNode(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteGpuNode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GPU_MY_PROVIDER_QUERY_KEY });
    },
  });
}

/** POST /gpu/nodes/{id}/rotate-token — returns the new one-time token. Not part of the
 *  provider payload, so nothing to invalidate. */
export function useRotateGpuNodeToken(): UseMutationResult<string, Error, number> {
  return useMutation({
    mutationFn: (id: number) => rotateGpuNodeToken(id),
  });
}

/** GET /gpu/providers/me/earnings (Bearer). */
export function useMyGpuEarnings(options: { enabled?: boolean } = {}): UseQueryResult<GpuEarnings> {
  return useQuery({
    queryKey: GPU_MY_EARNINGS_QUERY_KEY,
    queryFn: getMyGpuEarnings,
    enabled: options.enabled ?? true,
    retry: false,
  });
}
