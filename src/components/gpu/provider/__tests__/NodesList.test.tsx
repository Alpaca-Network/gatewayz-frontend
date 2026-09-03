import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NodesList } from '../NodesList';
import { useDeleteGpuNode, useRotateGpuNodeToken } from '@/lib/hooks/use-gpu-provider';
import type { GpuNode } from '@/lib/gpu/provider-api';

jest.mock('@/lib/hooks/use-gpu-provider', () => ({
  useDeleteGpuNode: jest.fn(),
  useRotateGpuNodeToken: jest.fn(),
  useCreateGpuNode: jest.fn(), // pulled in transitively by AddNodeDialog
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('lucide-react', () => ({ X: () => 'X' }));

const mockUseDeleteGpuNode = useDeleteGpuNode as jest.Mock;
const mockUseRotateGpuNodeToken = useRotateGpuNodeToken as jest.Mock;

const NODE: GpuNode = {
  id: 5,
  provider_id: 1,
  name: 'gpu-node-01',
  region: 'us-east',
  gpu_model: 'RTX 4090',
  vram_gb: 24,
  bandwidth_mbps: 1000,
  endpoint_url: 'https://node.example.com',
  models: [{ id: 'llama-3.1-8b-instruct', max_context: 8192 }],
  status: 'active',
  last_heartbeat_at: new Date(Date.now() - 60_000).toISOString(),
  health_score: 100,
  outstanding_requests: 0,
  created_at: '2026-09-03T00:00:00Z',
};

describe('NodesList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDeleteGpuNode.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseRotateGpuNodeToken.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    const gpuProviderHooks = jest.requireMock('@/lib/hooks/use-gpu-provider');
    gpuProviderHooks.useCreateGpuNode.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  });

  it('shows an empty state with no nodes', () => {
    render(<NodesList nodes={[]} />);
    expect(screen.getByText(/no nodes yet/i)).toBeInTheDocument();
  });

  it('renders node status + heartbeat age', () => {
    render(<NodesList nodes={[NODE]} />);
    expect(screen.getByText('gpu-node-01')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/last heartbeat.*ago/i)).toBeInTheDocument();
  });

  it('rotates the token and shows it once', async () => {
    const mutateAsync = jest.fn().mockResolvedValue('gw_node_new_token');
    mockUseRotateGpuNodeToken.mockReturnValue({ mutateAsync, isPending: false });

    render(<NodesList nodes={[NODE]} />);
    fireEvent.click(screen.getByRole('button', { name: /rotate token/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(5));
    expect(await screen.findByText('gw_node_new_token')).toBeInTheDocument();
  });

  it('confirms before disabling a node', async () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    mockUseDeleteGpuNode.mockReturnValue({ mutateAsync, isPending: false });

    render(<NodesList nodes={[NODE]} />);
    fireEvent.click(screen.getByRole('button', { name: /^disable$/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/disable this node/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm disable/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(5));
  });

  it('disables the Disable button for already-disabled nodes', () => {
    render(<NodesList nodes={[{ ...NODE, status: 'disabled' }]} />);
    expect(screen.getByRole('button', { name: /^disable$/i })).toBeDisabled();
  });
});
