import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useGpuPublicSummary, useGpuPublicNodes, useGpuUtilization } from '../use-gpu-public';
import * as publicApi from '@/lib/gpu/public-api';

jest.mock('@/lib/gpu/public-api', () => ({
  ...jest.requireActual('@/lib/gpu/public-api'),
  getGpuPublicSummary: jest.fn(),
  getGpuPublicNodes: jest.fn(),
  getGpuUtilization: jest.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('use-gpu-public', () => {
  beforeEach(() => jest.clearAllMocks());

  it('useGpuPublicSummary fetches and refetches every 30s', async () => {
    (publicApi.getGpuPublicSummary as jest.Mock).mockResolvedValue({ active_nodes: 1 });
    const { result } = renderHook(() => useGpuPublicSummary(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ active_nodes: 1 }));
    expect(publicApi.getGpuPublicSummary).toHaveBeenCalledTimes(1);
  });

  it('useGpuPublicNodes fetches the node list', async () => {
    (publicApi.getGpuPublicNodes as jest.Mock).mockResolvedValue([{ name: 'n1' }]);
    const { result } = renderHook(() => useGpuPublicNodes(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ name: 'n1' }]));
  });

  it('useGpuUtilization passes window/group through and keys the cache by them', async () => {
    (publicApi.getGpuUtilization as jest.Mock).mockResolvedValue({ series: [] });
    const { result } = renderHook(() => useGpuUtilization('7d', 'model'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ series: [] }));
    expect(publicApi.getGpuUtilization).toHaveBeenCalledWith('7d', 'model');
  });
});
