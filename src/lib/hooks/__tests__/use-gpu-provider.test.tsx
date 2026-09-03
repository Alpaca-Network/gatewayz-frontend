import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useMyGpuProvider,
  useRegisterGpuProvider,
  useCreateGpuNode,
  usePatchGpuNode,
  useDeleteGpuNode,
  useRotateGpuNodeToken,
  useMyGpuEarnings,
} from '../use-gpu-provider';
import * as providerApi from '@/lib/gpu/provider-api';

jest.mock('@/lib/gpu/provider-api', () => ({
  ...jest.requireActual('@/lib/gpu/provider-api'),
  getMyGpuProvider: jest.fn(),
  registerGpuProvider: jest.fn(),
  createGpuNode: jest.fn(),
  patchGpuNode: jest.fn(),
  deleteGpuNode: jest.fn(),
  rotateGpuNodeToken: jest.fn(),
  getMyGpuEarnings: jest.fn(),
}));

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('use-gpu-provider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('useMyGpuProvider fetches the current provider', async () => {
    (providerApi.getMyGpuProvider as jest.Mock).mockResolvedValue({ provider: { id: 1 } });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyGpuProvider(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ provider: { id: 1 } }));
  });

  it('useRegisterGpuProvider invalidates the provider query on success', async () => {
    (providerApi.registerGpuProvider as jest.Mock).mockResolvedValue({ id: 1, status: 'pending' });
    const { Wrapper, queryClient } = makeWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRegisterGpuProvider(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ display_name: 'Acme', payout_wallet_address: '0xabc' });
    });

    expect(providerApi.registerGpuProvider).toHaveBeenCalledWith({
      display_name: 'Acme',
      payout_wallet_address: '0xabc',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gpu-my-provider'] });
  });

  it('useCreateGpuNode invalidates the provider query on success', async () => {
    (providerApi.createGpuNode as jest.Mock).mockResolvedValue({ node: { id: 5 }, node_token: 'gw_node_x' });
    const { Wrapper, queryClient } = makeWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateGpuNode(), { wrapper: Wrapper });

    let mutationResult;
    await act(async () => {
      mutationResult = await result.current.mutateAsync({
        name: 'n',
        region: 'us-east',
        gpu_model: 'x',
        vram_gb: 1,
        bandwidth_mbps: 1,
        endpoint_url: 'https://x.example.com',
        endpoint_api_key: 'k',
        models: [],
      });
    });

    expect(mutationResult).toEqual({ node: { id: 5 }, node_token: 'gw_node_x' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gpu-my-provider'] });
  });

  it('usePatchGpuNode invalidates the provider query on success', async () => {
    (providerApi.patchGpuNode as jest.Mock).mockResolvedValue({ id: 5, name: 'renamed' });
    const { Wrapper, queryClient } = makeWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePatchGpuNode(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 5, input: { name: 'renamed' } });
    });

    expect(providerApi.patchGpuNode).toHaveBeenCalledWith(5, { name: 'renamed' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gpu-my-provider'] });
  });

  it('useDeleteGpuNode invalidates the provider query on success', async () => {
    (providerApi.deleteGpuNode as jest.Mock).mockResolvedValue(undefined);
    const { Wrapper, queryClient } = makeWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteGpuNode(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(5);
    });

    expect(providerApi.deleteGpuNode).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gpu-my-provider'] });
  });

  it('useRotateGpuNodeToken returns the new token without invalidating (token isn\'t on the provider payload)', async () => {
    (providerApi.rotateGpuNodeToken as jest.Mock).mockResolvedValue('gw_node_new');
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRotateGpuNodeToken(), { wrapper: Wrapper });

    let token;
    await act(async () => {
      token = await result.current.mutateAsync(5);
    });

    expect(token).toBe('gw_node_new');
  });

  it('useMyGpuEarnings fetches earnings', async () => {
    (providerApi.getMyGpuEarnings as jest.Mock).mockResolvedValue({ accrued_wei: 1n, work: [], settlements: [] });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyGpuEarnings(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ accrued_wei: 1n, work: [], settlements: [] }));
  });
});
